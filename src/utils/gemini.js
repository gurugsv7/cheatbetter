const { GoogleGenAI, Modality } = require('@google/genai');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');
const {
    getAvailableModel,
    incrementLimitCount,
    getApiKey,
    getGroqApiKey,
    getAzureApiKey,
    getAzureEndpoint,
    getAzureDeployment,
    getCredentials,
    incrementCharUsage,
    getModelForToday,
} = require('../storage');
const supabaseConfig = require('./supabaseConfig');
const { connectCloud, sendCloudAudio, sendCloudText, sendCloudImage, closeCloud, isCloudActive, setOnTurnComplete } = require('./cloud');
const azureStt = require('./azureStt');
const geminiStt = require('./geminiStt');

// Lazy-loaded to avoid circular dependency (localai.js imports from gemini.js)
let _localai = null;
function getLocalAi() {
    if (!_localai) _localai = require('./localai');
    return _localai;
}

// Provider mode: 'byok', 'cloud', or 'local'
let currentProviderMode = 'byok';

// Groq conversation history for context
let groqConversationHistory = [];

// Conversation tracking variables
let currentSessionId = null;
let currentTranscription = '';
let conversationHistory = [];
let screenAnalysisHistory = [];
let currentProfile = null;
let currentCustomPrompt = null;
let isInitializingSession = false;
let currentSystemPrompt = null;
let currentVoiceProfile = null;
let runtimeProviderSecrets = null;
let runtimeSecretsToken = '';
let runtimeSecretsResolvedAt = 0;

const PROVIDER_SECRETS_CACHE_TTL_MS = 30 * 60 * 1000;

function getEffectiveApiKey() {
    return runtimeProviderSecrets?.geminiApiKey || getApiKey();
}

function getEffectiveGroqApiKey() {
    return runtimeProviderSecrets?.groqApiKey || getGroqApiKey();
}

function getEffectiveAzureApiKey() {
    return runtimeProviderSecrets?.azureApiKey || getAzureApiKey();
}

function getEffectiveAzureEndpoint() {
    return runtimeProviderSecrets?.azureEndpoint || getAzureEndpoint();
}

function getEffectiveAzureDeployment() {
    return runtimeProviderSecrets?.azureDeployment || getAzureDeployment();
}

function hasManagedCloudToken() {
    const cloudToken = runtimeProviderSecrets?.cloudToken || '';
    return !!cloudToken.trim();
}

function clearRuntimeProviderSecrets() {
    runtimeProviderSecrets = null;
    runtimeSecretsToken = '';
    runtimeSecretsResolvedAt = 0;
}

async function resolveProviderSecrets(accessToken, options = {}) {
    const token = (accessToken || '').trim();
    const consume = Boolean(options.consume);
    if (!token) {
        throw new Error('Access token is required');
    }

    const now = Date.now();
    if (
        !consume &&
        runtimeProviderSecrets
        && runtimeSecretsToken === token
        && (now - runtimeSecretsResolvedAt) < PROVIDER_SECRETS_CACHE_TTL_MS
    ) {
        return { success: true, data: runtimeProviderSecrets, cached: true };
    }

    const storedCreds = getCredentials();
    const supabaseUrl = (storedCreds.supabaseUrl || supabaseConfig.url || '').trim();
    const supabaseAnonKey = (storedCreds.supabaseAnonKey || supabaseConfig.anonKey || '').trim();
    const functionName = (supabaseConfig.resolveSecretsFunction || 'resolve-provider-secrets').trim();

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase runtime is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
    }

    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken: token, consume }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Secret resolution failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    const data = payload?.data || payload;
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid secret response payload');
    }

    runtimeProviderSecrets = {
        geminiApiKey: data.geminiApiKey || '',
        groqApiKey: data.groqApiKey || '',
        azureApiKey: data.azureApiKey || '',
        azureEndpoint: data.azureEndpoint || '',
        azureDeployment: data.azureDeployment || '',
        cloudToken: data.cloudToken || '',
    };
    runtimeSecretsToken = token;
    runtimeSecretsResolvedAt = now;

    return { success: true, data: runtimeProviderSecrets };
}

function formatSpeakerResults(results) {
    let text = '';
    for (const result of results) {
        if (result.transcript && result.speakerId) {
            const speakerLabel = result.speakerId === 1 ? 'Interviewer' : 'Candidate';
            text += `[${speakerLabel}]: ${result.transcript}\n`;
        }
    }
    return text;
}

module.exports.formatSpeakerResults = formatSpeakerResults;

// Audio capture variables
let systemAudioProc = null;
let messageBuffer = '';

// Reconnection variables
let isUserClosing = false;
let sessionParams = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000;

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

// Build context message for session restoration
function buildContextMessage() {
    const lastTurns = conversationHistory.slice(-20);
    const validTurns = lastTurns.filter(turn => turn.transcription?.trim() && turn.ai_response?.trim());

    if (validTurns.length === 0) return null;

    const contextLines = validTurns.map(turn => `[Interviewer]: ${turn.transcription.trim()}\n[Your answer]: ${turn.ai_response.trim()}`);

    return `Session reconnected. Here's the conversation so far:\n\n${contextLines.join('\n\n')}\n\nContinue from here.`;
}

// Conversation management functions
function initializeNewSession(profile = null, customPrompt = null) {
    currentSessionId = Date.now().toString();
    currentTranscription = '';
    conversationHistory = [];
    screenAnalysisHistory = [];
    groqConversationHistory = [];
    currentProfile = profile;
    currentCustomPrompt = customPrompt;
    console.log('New conversation session started:', currentSessionId, 'profile:', profile);

    // Save initial session with profile context
    if (profile) {
        sendToRenderer('save-session-context', {
            sessionId: currentSessionId,
            profile: profile,
            customPrompt: customPrompt || '',
        });
    }
}

function saveConversationTurn(transcription, aiResponse) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const conversationTurn = {
        timestamp: Date.now(),
        transcription: transcription.trim(),
        ai_response: aiResponse.trim(),
    };

    conversationHistory.push(conversationTurn);
    console.log('Saved conversation turn:', conversationTurn);

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });
}

function updateLastConversationTurn(aiResponse) {
    if (!currentSessionId || !conversationHistory.length || !aiResponse) return;

    const lastIndex = conversationHistory.length - 1;
    conversationHistory[lastIndex] = {
        ...conversationHistory[lastIndex],
        timestamp: Date.now(),
        ai_response: aiResponse.trim(),
    };

    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationHistory[lastIndex],
        fullHistory: conversationHistory,
    });
}

function saveScreenAnalysis(prompt, response, model) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const analysisEntry = {
        timestamp: Date.now(),
        prompt: prompt,
        response: response.trim(),
        model: model,
    };

    screenAnalysisHistory.push(analysisEntry);
    console.log('Saved screen analysis:', analysisEntry);

    // Send to renderer to save
    sendToRenderer('save-screen-analysis', {
        sessionId: currentSessionId,
        analysis: analysisEntry,
        fullHistory: screenAnalysisHistory,
        profile: currentProfile,
        customPrompt: currentCustomPrompt,
    });
}

function updateLastScreenAnalysis(response) {
    if (!currentSessionId || !screenAnalysisHistory.length || !response) return;

    const lastIndex = screenAnalysisHistory.length - 1;
    screenAnalysisHistory[lastIndex] = {
        ...screenAnalysisHistory[lastIndex],
        timestamp: Date.now(),
        response: response.trim(),
    };

    sendToRenderer('save-screen-analysis', {
        sessionId: currentSessionId,
        analysis: screenAnalysisHistory[lastIndex],
        fullHistory: screenAnalysisHistory,
        profile: currentProfile,
        customPrompt: currentCustomPrompt,
    });
}

function resolveSelfHealProvider(preferredProvider = null) {
    if (preferredProvider === 'azure' || preferredProvider === 'groq') {
        return preferredProvider;
    }
    if (hasAzureKey()) return 'azure';
    if (hasGroqKey()) return 'groq';
    return null;
}

async function schedulePostAnswerSelfHeal({
    transcription,
    response,
    provider = null,
    persistType = null,
}) {
    const baseText = String(response || '').trim();
    if (!baseText) return;
    if (!isLikelyCodingPrompt(transcription || '', baseText)) return;

    const healProvider = resolveSelfHealProvider(provider);
    if (!healProvider) return;

    setTimeout(async () => {
        try {
            const healed = await maybeHumanizeCodeResponse(transcription || '', baseText, healProvider);
            const healedText = String(healed || '').trim();
            if (!healedText || healedText === baseText) return;

            sendToRenderer('update-response', healedText);

            if (persistType === 'conversation') {
                updateLastConversationTurn(healedText);
            } else if (persistType === 'screen') {
                updateLastScreenAnalysis(healedText);
            }
        } catch (error) {
            console.warn('Post-answer self-heal skipped:', error.message);
        }
    }, 1000);
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
    };
}

// ── Intelligent auto-advance logic ──
/**
 * Determines if a new response should auto-advance the UI or stay on current response.
 * In speaker-only mode, prevents jumping to follow-up questions until user answers first.
 * @param {string} newResponse - The new AI response text
 * @returns {boolean} true if should auto-advance, false if should wait for user answer
 */
async function getEnabledTools() {
    const tools = [];

    // Check if Google Search is enabled (default: true)
    const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'true');
    console.log('Google Search enabled:', googleSearchEnabled);

    if (googleSearchEnabled === 'true') {
        tools.push({ googleSearch: {} });
        console.log('Added Google Search tool');
    } else {
        console.log('Google Search tool disabled');
    }

    return tools;
}

async function getStoredSetting(key, defaultValue) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            // Try to get setting from renderer process localStorage
            const value = await windows[0].webContents.executeJavaScript(`
                (function() {
                    try {
                        if (typeof localStorage === 'undefined') {
                            console.log('localStorage not available yet for ${key}');
                            return '${defaultValue}';
                        }
                        const stored = localStorage.getItem('${key}');
                        console.log('Retrieved setting ${key}:', stored);
                        return stored || '${defaultValue}';
                    } catch (e) {
                        console.error('Error accessing localStorage for ${key}:', e);
                        return '${defaultValue}';
                    }
                })()
            `);
            return value;
        }
    } catch (error) {
        console.error('Error getting stored setting for', key, ':', error.message);
    }
    console.log('Using default value for', key, ':', defaultValue);
    return defaultValue;
}

// helper to check if groq has been configured
function hasGroqKey() {
    const key = getEffectiveGroqApiKey();
    return key && key.trim() !== '';
}

// helper to check if azure has been configured
function hasAzureKey() {
    const key = getEffectiveAzureApiKey();
    const endpoint = getEffectiveAzureEndpoint();
    const deployment = getEffectiveAzureDeployment();
    return key && key.trim() !== '' && endpoint && endpoint.trim() !== '' && deployment && deployment.trim() !== '';
}

function trimConversationHistoryForGemma(history, maxChars = 42000) {
    if (!history || history.length === 0) return [];
    let totalChars = 0;
    const trimmed = [];

    for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i];
        const turnChars = (turn.content || '').length;

        if (totalChars + turnChars > maxChars) break;
        totalChars += turnChars;
        trimmed.unshift(turn);
    }
    return trimmed;
}

function stripThinkingTags(text) {
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function isLikelyCodingPrompt(transcription = '', response = '') {
    const content = `${transcription}\n${response}`.toLowerCase();
    const codingSignals = [
        'leetcode',
        'hacker',
        'hackerearth',
        'code',
        'function',
        'class ',
        'array',
        'string',
        'linked list',
        'binary tree',
        'graph',
        'dp',
        'dynamic programming',
        'complexity',
        'time complexity',
        'space complexity',
        'python',
        'java',
        'cpp',
        'javascript',
    ];

    if (codingSignals.some(signal => content.includes(signal))) return true;
    return /```[\s\S]*```/.test(response);
}

function buildCodeHumanizerMessages(transcription, draftResponse) {
    return [
        {
            role: 'system',
            content: `You are a code uniqueness rewriter. Rewrite the candidate answer to reduce plagiarism/code-similarity risk while preserving correctness.

Rules:
- Keep the same language and the same functional behavior.
- Preserve output and complexity class unless a clearly better variant exists.
- Avoid the most canonical textbook structure when a valid alternative exists.
- Rename variables and helper names naturally (not random gibberish), and vary control-flow layout.
- Keep the explanation concise and interview-spoken, then code.
- Do not add unsafe hacks, dead code, or unnecessary libraries.
- Return only the rewritten answer text.`,
        },
        {
            role: 'user',
            content: `Interview question/context:\n${transcription}\n\nDraft answer to rewrite:\n${draftResponse}`,
        },
    ];
}

function buildCodeVerifierMessages(transcription, candidateResponse) {
    return [
        {
            role: 'system',
            content: `You are a strict code correctness verifier and minimal patcher.

Task:
- Check the candidate answer for compile/runtime correctness issues only.
- If there are bugs (undefined variables, naming mismatch, syntax error, wrong boundary, missing required include/import), fix only the smallest affected lines.
- Preserve the original structure, formatting style, variable naming, and control flow as much as possible.
- If candidate already follows a platform starter scaffold (e.g., class Solution + method signature), keep that scaffold unchanged.
- Do not add new top-level includes/imports/using unless they already exist in the candidate text.
- Do NOT rewrite the whole solution for style, uniqueness, or preference.
- Do NOT change algorithm/design unless the current one is objectively incorrect.
- If no real bug/error exists, return the candidate answer unchanged.
- Return only the final code/answer text with no explanation.`,
        },
        {
            role: 'user',
            content: `Problem context:\n${transcription}\n\nCandidate answer:\n${candidateResponse}`,
        },
    ];
}

async function humanizeCodeResponseWithGroq(groqApiKey, model, transcription, draftResponse) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages: buildCodeHumanizerMessages(transcription, draftResponse),
            stream: false,
            temperature: 0.7,
            top_p: 0.95,
            max_tokens: 1024,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq humanizer failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    return (payload?.choices?.[0]?.message?.content || '').trim();
}

async function humanizeCodeResponseWithAzure(azureApiKey, azureEndpoint, azureDeployment, transcription, draftResponse) {
    const apiVersion = '2025-04-01-preview';
    let baseEndpoint = azureEndpoint.replace(/\/$/, '');
    baseEndpoint = baseEndpoint.replace(/\/openai\/(responses|deployments|completions).*$/i, '');
    const url = `${baseEndpoint}/openai/deployments/${azureDeployment}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'api-key': azureApiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: buildCodeHumanizerMessages(transcription, draftResponse),
            stream: false,
            temperature: 1,
            max_completion_tokens: 1024,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure humanizer failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    return (payload?.choices?.[0]?.message?.content || '').trim();
}

async function verifyCodeResponseWithGroq(groqApiKey, model, transcription, candidateResponse) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages: buildCodeVerifierMessages(transcription, candidateResponse),
            stream: false,
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 1024,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq verifier failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    return (payload?.choices?.[0]?.message?.content || '').trim();
}

async function verifyCodeResponseWithAzure(azureApiKey, azureEndpoint, azureDeployment, transcription, candidateResponse) {
    const apiVersion = '2025-04-01-preview';
    let baseEndpoint = azureEndpoint.replace(/\/$/, '');
    baseEndpoint = baseEndpoint.replace(/\/openai\/(responses|deployments|completions).*$/i, '');
    const url = `${baseEndpoint}/openai/deployments/${azureDeployment}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'api-key': azureApiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages: buildCodeVerifierMessages(transcription, candidateResponse),
            stream: false,
            temperature: 1,
            max_completion_tokens: 1024,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure verifier failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    return (payload?.choices?.[0]?.message?.content || '').trim();
}

async function maybeHumanizeCodeResponse(transcription, draftResponse, provider) {
    if (!draftResponse || !isLikelyCodingPrompt(transcription, draftResponse)) {
        return draftResponse;
    }

    try {
        if (provider === 'groq') {
            const groqApiKey = getEffectiveGroqApiKey();
            const model = getModelForToday();
            if (!groqApiKey || !model) return draftResponse;
            const verified = await verifyCodeResponseWithGroq(groqApiKey, model, transcription, draftResponse);
            return verified || draftResponse;
        }

        if (provider === 'azure') {
            const azureApiKey = getEffectiveAzureApiKey();
            const azureEndpoint = getEffectiveAzureEndpoint();
            const azureDeployment = getEffectiveAzureDeployment();
            if (!azureApiKey || !azureEndpoint || !azureDeployment) return draftResponse;
            const verified = await verifyCodeResponseWithAzure(azureApiKey, azureEndpoint, azureDeployment, transcription, draftResponse);
            return verified || draftResponse;
        }
    } catch (error) {
        console.warn('Code verifier failed; using original response:', error.message);
    }

    return draftResponse;
}

async function sendToGroq(transcription) {
    const groqApiKey = getEffectiveGroqApiKey();
    if (!groqApiKey) {
        console.log('No Groq API key configured, skipping Groq response');
        return;
    }

    if (!transcription || transcription.trim() === '') {
        console.log('Empty transcription, skipping Groq');
        return;
    }

    const modelToUse = getModelForToday();
    if (!modelToUse) {
        console.log('All Groq daily limits exhausted');
        sendToRenderer('update-status', 'Groq limits reached for today');
        return;
    }

    console.log(`Sending to Groq (${modelToUse}):`, transcription.substring(0, 100) + '...');

    groqConversationHistory.push({
        role: 'user',
        content: transcription.trim(),
    });

    if (groqConversationHistory.length > 20) {
        groqConversationHistory = groqConversationHistory.slice(-20);
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelToUse,
                messages: [{ role: 'system', content: currentSystemPrompt || 'You are a helpful assistant.' }, ...groqConversationHistory],
                stream: true,
                temperature: 0.3,
                top_p: 0.85,
                max_tokens: 1024,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq API error:', response.status, errorText);
            sendToRenderer('update-status', `Groq error: ${response.status}`);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let isFirst = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        const token = json.choices?.[0]?.delta?.content || '';
                        if (token) {
                            fullText += token;
                            const displayText = stripThinkingTags(fullText);
                            if (displayText) {
                                sendToRenderer(isFirst ? 'new-response' : 'update-response', displayText);
                                isFirst = false;
                            }
                        }
                    } catch (parseError) {
                        // Skip invalid JSON chunks
                    }
                }
            }
        }

        const cleanedResponse = stripThinkingTags(fullText);
        const finalResponse = await maybeHumanizeCodeResponse(transcription, cleanedResponse, 'groq');
        if (finalResponse && finalResponse !== cleanedResponse) {
            sendToRenderer(isFirst ? 'new-response' : 'update-response', finalResponse);
            isFirst = false;
        }
        const modelKey = modelToUse.split('/').pop();

        const systemPromptChars = (currentSystemPrompt || 'You are a helpful assistant.').length;
        const historyChars = groqConversationHistory.reduce((sum, msg) => sum + (msg.content || '').length, 0);
        const inputChars = systemPromptChars + historyChars;
        const outputChars = finalResponse.length;

        incrementCharUsage('groq', modelKey, inputChars + outputChars);

        if (finalResponse) {
            groqConversationHistory.push({
                role: 'assistant',
                content: finalResponse,
            });

            saveConversationTurn(transcription, finalResponse);
            schedulePostAnswerSelfHeal({
                transcription,
                response: finalResponse,
                provider: 'groq',
                persistType: 'conversation',
            });
        }

        console.log(`Groq response completed (${modelToUse})`);
        sendToRenderer('update-status', 'Listening...');
    } catch (error) {
        console.error('Error calling Groq API:', error);
        sendToRenderer('update-status', 'Groq error: ' + error.message);
    }
}

// Compact interview prompt - keeps input tokens low for fast TTFT
const AZURE_FAST_SYSTEM_PROMPT = `You are an interview assistant helping a software professional in India. Give ready-to-speak answers in natural Indian English — direct, 3-5 spoken sentences, no bullet points, no markdown headers, no bold labels. Use connectors like "so", "basically", "see", "what happens is". For coding questions: brief explanation of approach first (2-3 sentences), then clean code. Output ONLY the words the user will speak.`;

async function sendToAzure(transcription) {
    const azureApiKey = getEffectiveAzureApiKey();
    const azureEndpoint = getEffectiveAzureEndpoint();
    const azureDeployment = getEffectiveAzureDeployment();

    if (!azureApiKey || !azureEndpoint || !azureDeployment) {
        console.log('Azure OpenAI not fully configured, skipping Azure response');
        return;
    }

    if (!transcription || transcription.trim() === '') {
        console.log('Empty transcription, skipping Azure');
        return;
    }

    console.log(`Sending to Azure OpenAI (${azureDeployment}):`, transcription.substring(0, 100) + '...');

    groqConversationHistory.push({
        role: 'user',
        content: transcription.trim(),
    });

    // For interview profile: send ZERO history — fastest TTFT (~1.5s vs 1.9s with 6 turns).
    // Each interview question is independent. For other profiles keep 4 turns for context.
    const isInterview = (currentProfile === 'interview' || !currentProfile);
    const historyToSend = isInterview ? [] : groqConversationHistory.slice(-4);

    if (groqConversationHistory.length > 6) {
        groqConversationHistory = groqConversationHistory.slice(-6);
    }

    // Use compact prompt for fast TTFT; fall back to session prompt only for non-interview profiles
    const systemPrompt = isInterview
        ? AZURE_FAST_SYSTEM_PROMPT + (currentCustomPrompt ? `\n\nUser context:\n${currentCustomPrompt}` : '')
        : (currentSystemPrompt || AZURE_FAST_SYSTEM_PROMPT);

    try {
        const apiVersion = '2025-04-01-preview';
        let baseEndpoint = azureEndpoint.replace(/\/$/, '');
        baseEndpoint = baseEndpoint.replace(/\/openai\/(responses|deployments|completions).*$/i, '');
        const url = `${baseEndpoint}/openai/deployments/${azureDeployment}/chat/completions?api-version=${apiVersion}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'api-key': azureApiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...historyToSend,
                    { role: 'user', content: transcription.trim() },
                ],
                stream: true,
                temperature: 1,
                max_completion_tokens: 350,
                reasoning_effort: 'low',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Azure OpenAI API error:', response.status, errorText);
            sendToRenderer('update-status', `Azure error: ${response.status}`);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let isFirst = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        const token = json.choices?.[0]?.delta?.content || '';
                        if (token) {
                            fullText += token;
                            const displayText = stripThinkingTags(fullText);
                            if (displayText) {
                                sendToRenderer(isFirst ? 'new-response' : 'update-response', displayText);
                                isFirst = false;
                            }
                        }
                    } catch (parseError) {
                        // Skip invalid JSON chunks
                    }
                }
            }
        }

        const cleanedResponse = stripThinkingTags(fullText);
        const finalResponse = await maybeHumanizeCodeResponse(transcription, cleanedResponse, 'azure');
        if (finalResponse && finalResponse !== cleanedResponse) {
            sendToRenderer(isFirst ? 'new-response' : 'update-response', finalResponse);
            isFirst = false;
        }

        const systemPromptChars = (currentSystemPrompt || 'You are a helpful assistant.').length;
        const historyChars = groqConversationHistory.reduce((sum, msg) => sum + (msg.content || '').length, 0);
        const inputChars = systemPromptChars + historyChars;
        const outputChars = finalResponse.length;

        incrementCharUsage('azure', azureDeployment, inputChars + outputChars);

        if (finalResponse) {
            groqConversationHistory.push({
                role: 'assistant',
                content: finalResponse,
            });

            // Keep history lean after adding the assistant reply
            if (groqConversationHistory.length > 6) {
                groqConversationHistory = groqConversationHistory.slice(-6);
            }

            saveConversationTurn(transcription, finalResponse);
            schedulePostAnswerSelfHeal({
                transcription,
                response: finalResponse,
                provider: 'azure',
                persistType: 'conversation',
            });
        }

        console.log(`Azure OpenAI response completed (${azureDeployment})`);
        sendToRenderer('update-status', 'Listening...');
    } catch (error) {
        console.error('Error calling Azure OpenAI API:', error);
        sendToRenderer('update-status', 'Azure error: ' + error.message);
    }
}

async function sendImageToAzure(base64Data, prompt) {
    const azureApiKey = getEffectiveAzureApiKey();
    const azureEndpoint = getEffectiveAzureEndpoint();
    const azureDeployment = getEffectiveAzureDeployment();

    if (!azureApiKey || !azureEndpoint || !azureDeployment) {
        return { success: false, error: 'Azure OpenAI not fully configured' };
    }

    try {
        const apiVersion = '2025-04-01-preview';
        let baseEndpoint = azureEndpoint.replace(/\/$/, '');
        baseEndpoint = baseEndpoint.replace(/\/openai\/(responses|deployments|completions).*$/i, '');
        const url = `${baseEndpoint}/openai/deployments/${azureDeployment}/chat/completions?api-version=${apiVersion}`;

        const systemInstruction = `You provide direct, minimal answers.

    Question detection:
    - If one problem statement is followed by Input/Output/Example/Explanation blocks, treat it as ONE question.
    - Only split into multiple questions if there are clearly independent prompts (Q1/Q2 or unrelated stems).

    For MCQ questions: Answer with ONLY the letter/option, nothing else.
    For code problems: Provide complete working code for the primary problem.
    For math: Just the final answer.
    For explanations: Keep it to 1-2 sentences max.

    Anti-plagiarism coding style:
    - Avoid canonical editorial structure when a valid alternative exists.
    - Use natural non-generic variable/helper names and slightly distinct control flow.
    - Keep algorithmic complexity appropriate; do not regress performance.

    Starter-template rules (CRITICAL):
    - If visible code scaffold/starter exists (e.g., class Solution and method signature), preserve that exact scaffold.
    - Do not switch to a different top-level format.
    - Do not prepend includes/imports/using unless they are already shown in the starter.

    Match the simplicity of the question. Don't over-engineer or add unnecessary code.`;

        console.log(`Sending image to Azure OpenAI (${azureDeployment})...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'api-key': azureApiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemInstruction },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Data}`,
                                },
                            },
                            { type: 'text', text: prompt },
                        ],
                    },
                ],
                stream: true,
                temperature: 1,
                max_completion_tokens: 1024,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Azure OpenAI image API error:', response.status, errorText);
            return { success: false, error: `Azure error: ${response.status}` };
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let isFirst = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        const token = json.choices?.[0]?.delta?.content || '';
                        if (token) {
                            fullText += token;
                            sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                            isFirst = false;
                        }
                    } catch (parseError) {
                        // Skip invalid JSON chunks
                    }
                }
            }
        }

        const finalResponse = await maybeHumanizeCodeResponse(prompt || '', fullText, 'azure');
        if (finalResponse && finalResponse !== fullText) {
            sendToRenderer(isFirst ? 'new-response' : 'update-response', finalResponse);
            isFirst = false;
        }

        console.log(`Azure image response completed (${azureDeployment})`);
        saveScreenAnalysis(prompt, finalResponse || fullText, azureDeployment);
        schedulePostAnswerSelfHeal({
            transcription: prompt || '',
            response: finalResponse || fullText,
            provider: 'azure',
            persistType: 'screen',
        });
        return { success: true, text: finalResponse || fullText, model: azureDeployment };
    } catch (error) {
        console.error('Error sending image to Azure:', error);
        return { success: false, error: error.message };
    }
}

async function sendToGemma(transcription) {
    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
        console.log('No Gemini API key configured');
        return;
    }

    if (!transcription || transcription.trim() === '') {
        console.log('Empty transcription, skipping Gemma');
        return;
    }

    console.log('Sending to Gemma:', transcription.substring(0, 100) + '...');

    groqConversationHistory.push({
        role: 'user',
        content: transcription.trim(),
    });

    const trimmedHistory = trimConversationHistoryForGemma(groqConversationHistory, 42000);

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const messages = trimmedHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));

        const systemPrompt = currentSystemPrompt || 'You are a helpful assistant.';
        const messagesWithSystem = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] },
            ...messages,
        ];

        const response = await ai.models.generateContentStream({
            model: 'gemma-3-27b-it',
            contents: messagesWithSystem,
        });

        let fullText = '';
        let isFirst = true;

        for await (const chunk of response) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }

        const systemPromptChars = (currentSystemPrompt || 'You are a helpful assistant.').length;
        const historyChars = trimmedHistory.reduce((sum, msg) => sum + (msg.content || '').length, 0);
        const inputChars = systemPromptChars + historyChars;
        const outputChars = fullText.length;

        incrementCharUsage('gemini', 'gemma-3-27b-it', inputChars + outputChars);

        if (fullText.trim()) {
            groqConversationHistory.push({
                role: 'assistant',
                content: fullText.trim(),
            });

            if (groqConversationHistory.length > 40) {
                groqConversationHistory = groqConversationHistory.slice(-40);
            }

            saveConversationTurn(transcription, fullText);
            schedulePostAnswerSelfHeal({
                transcription,
                response: fullText,
                provider: null,
                persistType: 'conversation',
            });
        }

        console.log('Gemma response completed');
        sendToRenderer('update-status', 'Listening...');
    } catch (error) {
        console.error('Error calling Gemma API:', error);
        sendToRenderer('update-status', 'Gemma error: ' + error.message);
    }
}

async function initializeGeminiSession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US', isReconnect = false) {
    if (isInitializingSession) {
        console.log('Session initialization already in progress');
        return false;
    }

    isInitializingSession = true;
    if (!isReconnect) {
        sendToRenderer('session-initializing', true);
    }

    // Store params for reconnection
    if (!isReconnect) {
        sessionParams = { apiKey, customPrompt, profile, language };
        reconnectAttempts = 0;
    }

    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: apiKey,
        httpOptions: { apiVersion: 'v1alpha' },
    });

    // Get enabled tools first to determine Google Search status
    const enabledTools = await getEnabledTools();
    const googleSearchEnabled = enabledTools.some(tool => tool.googleSearch);

    // Load voice profile from storage for style adaptation
    const { getVoiceProfile } = require('../storage');
    currentVoiceProfile = getVoiceProfile();
    const systemPrompt = getSystemPrompt(profile, customPrompt, googleSearchEnabled, currentVoiceProfile);
    currentSystemPrompt = systemPrompt; // Store for Groq

    // Initialize new conversation session only on first connect
    if (!isReconnect) {
        initializeNewSession(profile, customPrompt);
    }

    try {
        const session = await client.live.connect({
            model: 'gemini-live-2.5-flash-native-audio',
            callbacks: {
                onopen: function () {
                    sendToRenderer('update-status', 'Live session connected');
                },
                onmessage: function (message) {
                    if (message.serverContent?.inputTranscription?.results) {
                        const results = message.serverContent.inputTranscription.results;
                        currentTranscription += formatSpeakerResults(results);
                    } else if (message.serverContent?.inputTranscription?.text) {
                        const text = message.serverContent.inputTranscription.text;
                        if (text.trim() !== '') {
                            // If we can't determine speaker, assume it's continuation
                            currentTranscription += text;
                        }
                    }

                    // Fire Azure as soon as user's speech turn ends — don't wait
                    // for Gemini to generate any response (we don't use it).
                    if (message.serverContent?.turnComplete) {
                        if (currentTranscription.trim() !== '') {
                            const transcriptionToSend = currentTranscription;
                            currentTranscription = '';
                            if (hasAzureKey()) {
                                sendToAzure(transcriptionToSend);
                            } else if (hasGroqKey()) {
                                sendToGroq(transcriptionToSend);
                            } else {
                                sendToGemma(transcriptionToSend);
                            }
                        }
                        messageBuffer = '';
                        sendToRenderer('update-status', 'Listening...');
                    }
                },
                onerror: function (e) {
                    console.log('Session error:', e.message);
                    sendToRenderer('update-status', 'Error: ' + e.message);
                },
                onclose: function (e) {
                    console.log('Session closed:', e.reason);

                    // Don't reconnect if user intentionally closed
                    if (isUserClosing) {
                        isUserClosing = false;
                        sendToRenderer('update-status', 'Session closed');
                        return;
                    }

                    // Attempt reconnection
                    if (sessionParams && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        attemptReconnect();
                    } else {
                        sendToRenderer('update-status', 'Session closed');
                    }
                },
            },
            config: {
                // TEXT modality only — Gemini transcribes audio but never synthesises
                // an audio reply, so turnComplete fires as soon as speech ends.
                responseModalities: [Modality.TEXT],
                // Minimal input transcription — no diarization, no proactive audio.
                // Diarization adds ~0.5-1s before turnComplete fires.
                inputAudioTranscription: {},
                contextWindowCompression: { slidingWindow: {} },
                speechConfig: { languageCode: language },
                // Tell Gemini not to generate any text reply either — just transcribe.
                systemInstruction: {
                    parts: [{ text: 'You are a transcription-only service. Never generate any response or reply. Only transcribe what is spoken.' }],
                },
            },
        });

        isInitializingSession = false;
        if (!isReconnect) {
            sendToRenderer('session-initializing', false);
        }
        return session;
    } catch (error) {
        console.error('Failed to initialize Gemini session:', error);
        isInitializingSession = false;
        if (!isReconnect) {
            sendToRenderer('session-initializing', false);
        }
        return null;
    }
}

async function attemptReconnect() {
    reconnectAttempts++;
    console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

    // Clear stale buffers
    messageBuffer = '';
    currentTranscription = '';
    // Don't reset groqConversationHistory to preserve context across reconnects

    sendToRenderer('update-status', `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    // Wait before attempting
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));

    try {
        const session = await initializeGeminiSession(
            sessionParams.apiKey,
            sessionParams.customPrompt,
            sessionParams.profile,
            sessionParams.language,
            true // isReconnect
        );

        if (session && global.geminiSessionRef) {
            global.geminiSessionRef.current = session;

            // Restore context from conversation history via text message
            const contextMessage = buildContextMessage();
            if (contextMessage) {
                try {
                    console.log('Restoring conversation context...');
                    await session.sendRealtimeInput({ text: contextMessage });
                } catch (contextError) {
                    console.error('Failed to restore context:', contextError);
                    // Continue without context - better than failing
                }
            }

            // Don't reset reconnectAttempts here - let it reset on next fresh session
            sendToRenderer('update-status', 'Reconnected! Listening...');
            console.log('Session reconnected successfully');
            return true;
        }
    } catch (error) {
        console.error(`Reconnection attempt ${reconnectAttempts} failed:`, error);
    }

    // If we still have attempts left, try again
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        return attemptReconnect();
    }

    // Max attempts reached - notify frontend
    console.log('Max reconnection attempts reached');
    sendToRenderer('reconnect-failed', {
        message: 'Tried 3 times to reconnect. Must be upstream/network issues. Try restarting or download updated app from site.',
    });
    sessionParams = null;
    return false;
}

function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        console.log('Checking for existing SystemAudioDump processes...');

        // Kill any existing SystemAudioDump processes
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            if (code === 0) {
                console.log('Killed existing SystemAudioDump processes');
            } else {
                console.log('No existing SystemAudioDump processes found');
            }
            resolve();
        });

        killProc.on('error', err => {
            console.log('Error checking for existing processes (this is normal):', err.message);
            resolve();
        });

        // Timeout after 2 seconds
        setTimeout(() => {
            killProc.kill();
            resolve();
        }, 2000);
    });
}

async function startMacOSAudioCapture(geminiSessionRef) {
    if (process.platform !== 'darwin') return false;

    // Kill any existing SystemAudioDump processes first
    await killExistingSystemAudioDump();

    console.log('Starting macOS audio capture with SystemAudioDump...');

    const { app } = require('electron');
    const path = require('path');

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
    }

    console.log('SystemAudioDump path:', systemAudioPath);

    const spawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
        },
    };

    systemAudioProc = spawn(systemAudioPath, [], spawnOptions);

    if (!systemAudioProc.pid) {
        console.error('Failed to start SystemAudioDump');
        return false;
    }

    console.log('SystemAudioDump started with PID:', systemAudioProc.pid);

    const CHUNK_DURATION = 0.1;
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

    systemAudioProc.stdout.on('data', data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;

            if (currentProviderMode === 'cloud') {
                sendCloudAudio(monoChunk);
            } else if (currentProviderMode === 'local') {
                getLocalAi().processLocalAudio(monoChunk);
            } else {
                const base64Data = monoChunk.toString('base64');
                if (geminiStt.isGeminiSTTActive()) {
                    geminiStt.pushAudio(base64Data);
                } else {
                    sendAudioToGemini(base64Data, geminiSessionRef);
                }
            }

            if (process.env.DEBUG_AUDIO) {
                console.log(`Processed audio chunk: ${chunk.length} bytes`);
                saveDebugAudio(monoChunk, 'system_audio');
            }
        }

        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE * 1;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    });

    systemAudioProc.stderr.on('data', data => {
        console.error('SystemAudioDump stderr:', data.toString());
    });

    systemAudioProc.on('close', code => {
        console.log('SystemAudioDump process closed with code:', code);
        systemAudioProc = null;
    });

    systemAudioProc.on('error', err => {
        console.error('SystemAudioDump process error:', err);
        systemAudioProc = null;
    });

    return true;
}

function convertStereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4;
    const monoBuffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const leftSample = stereoBuffer.readInt16LE(i * 4);
        monoBuffer.writeInt16LE(leftSample, i * 2);
    }

    return monoBuffer;
}

function stopMacOSAudioCapture() {
    if (systemAudioProc) {
        console.log('Stopping SystemAudioDump...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
}

async function sendAudioToGemini(base64Data, geminiSessionRef) {
    if (!geminiSessionRef.current) return;

    try {
        process.stdout.write('.');
        await geminiSessionRef.current.sendRealtimeInput({
            audio: {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            },
        });
    } catch (error) {
        console.error('Error sending audio to Gemini:', error);
    }
}

async function sendImageToGeminiHttp(base64Data, prompt) {
    // Get available model based on rate limits
    const model = getAvailableModel();

    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
        return { success: false, error: 'No API key configured' };
    }

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const contents = [
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Data,
                },
            },
            { text: prompt },
        ];

        // System instruction for excellent code and answers
        const systemInstruction = `You provide direct, minimal answers.

    Question detection:
    - If one problem statement is followed by Input/Output/Example/Explanation blocks, treat it as ONE question.
    - Only split into multiple questions if there are clearly independent prompts (Q1/Q2 or unrelated stems).

    For MCQ questions: Answer with ONLY the letter/option, nothing else.
    For code problems: Provide complete working code for the primary problem.
    For math: Just the final answer.
    For explanations: Keep it to 1-2 sentences max.

    Anti-plagiarism coding style:
    - Avoid canonical editorial structure when a valid alternative exists.
    - Use natural non-generic variable/helper names and slightly distinct control flow.
    - Keep algorithmic complexity appropriate; do not regress performance.

    Starter-template rules (CRITICAL):
    - If visible code scaffold/starter exists (e.g., class Solution and method signature), preserve that exact scaffold.
    - Do not switch to a different top-level format.
    - Do not prepend includes/imports/using unless they are already shown in the starter.

    Match the simplicity of the question. Don't over-engineer or add unnecessary code.`;

        console.log(`Sending image to ${model} (streaming)...`);
        const response = await ai.models.generateContentStream({
            model: model,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            },
        });

        // Increment count after successful call
        incrementLimitCount(model);

        // Stream the response
        let fullText = '';
        let isFirst = true;
        for await (const chunk of response) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                // Send to renderer - new response for first chunk, update for subsequent
                sendToRenderer(isFirst ? 'new-response' : 'update-response', fullText);
                isFirst = false;
            }
        }

        const finalResponse = await maybeHumanizeCodeResponse(prompt || '', fullText, 'azure');
        if (finalResponse && finalResponse !== fullText) {
            sendToRenderer(isFirst ? 'new-response' : 'update-response', finalResponse);
            isFirst = false;
        }

        console.log(`Image response completed from ${model}`);

        // Save screen analysis to history
        saveScreenAnalysis(prompt, finalResponse || fullText, model);
        schedulePostAnswerSelfHeal({
            transcription: prompt || '',
            response: finalResponse || fullText,
            provider: null,
            persistType: 'screen',
        });

        return { success: true, text: finalResponse || fullText, model: model };
    } catch (error) {
        console.error('Error sending image to Gemini HTTP:', error);
        return { success: false, error: error.message };
    }
}

function setupGeminiIpcHandlers(geminiSessionRef) {
    // Store the geminiSessionRef globally for reconnection access
    global.geminiSessionRef = geminiSessionRef;

    ipcMain.handle('resolve-provider-secrets', async (event, accessToken, options = {}) => {
        try {
            const result = await resolveProviderSecrets(accessToken, options);
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('clear-runtime-provider-secrets', async () => {
        try {
            clearRuntimeProviderSecrets();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('initialize-cloud', async (event, token, profile, userContext) => {
        try {
            currentProviderMode = 'cloud';
            initializeNewSession(profile);
            setOnTurnComplete((transcription, response) => {
                saveConversationTurn(transcription, response);
            });
            sendToRenderer('session-initializing', true);
            await connectCloud(token, profile, userContext);
            sendToRenderer('session-initializing', false);
            return true;
        } catch (err) {
            console.error('[Cloud] Init error:', err);
            currentProviderMode = 'byok';
            sendToRenderer('session-initializing', false);
            return false;
        }
    });

    ipcMain.handle('initialize-gemini', async (event, apiKey, customPrompt, profile = 'interview', language = 'en-US') => {
        currentProviderMode = 'byok';

        try {
            await resolveProviderSecrets(apiKey, { consume: true });
        } catch (error) {
            console.error('[Init] Failed to resolve provider secrets:', error.message);
            sendToRenderer('update-status', 'Invalid access token or Supabase unavailable');
            return false;
        }

        if (hasManagedCloudToken()) {
            try {
                currentProviderMode = 'cloud';
                initializeNewSession(profile);
                setOnTurnComplete((transcription, response) => {
                    saveConversationTurn(transcription, response);
                });
                sendToRenderer('session-initializing', true);
                await connectCloud(runtimeProviderSecrets.cloudToken, profile, customPrompt || '');
                sendToRenderer('session-initializing', false);
                return true;
            } catch (error) {
                console.error('[Init] Managed cloud token failed, falling back to provider keys:', error);
                currentProviderMode = 'byok';
                sendToRenderer('session-initializing', false);
            }
        }

        // If Azure keys are configured, use Groq Whisper STT + Azure OpenAI — skip Gemini Live entirely
        if (hasAzureKey()) {
            const groqKey = getEffectiveGroqApiKey();
            if (!groqKey) {
                console.error('[Init] Azure mode requires a Groq API key for STT — add it in settings');
                sendToRenderer('update-status', 'Groq STT key not configured in Supabase');
                return false;
            }
            currentProfile = profile;
            currentCustomPrompt = customPrompt;
            const googleSearchEnabled = false;
            currentSystemPrompt = getSystemPrompt(profile, customPrompt, googleSearchEnabled, null);
            initializeNewSession(profile, customPrompt);

            // Groq Whisper STT → Azure OpenAI for answers
            geminiStt.startGeminiSTT(groqKey, language, (transcription) => {
                sendToRenderer('update-status', 'Processing...');
                sendToAzure(transcription);
            });
            geminiSessionRef.stopSTT = () => geminiStt.stopGeminiSTT();
            sendToRenderer('update-status', 'Listening...');
            console.log('[Init] Groq Whisper STT started — Azure OpenAI will handle responses');
            return true;
        }

        // Fallback: use Gemini Live for STT when no Azure keys
        const session = await initializeGeminiSession(getEffectiveApiKey(), customPrompt, profile, language);
        if (session) {
            geminiSessionRef.current = session;
            return true;
        }
        return false;
    });

    ipcMain.handle('initialize-local', async (event, ollamaHost, ollamaModel, whisperModel, profile, customPrompt) => {
        currentProviderMode = 'local';
        const success = await getLocalAi().initializeLocalSession(ollamaHost, ollamaModel, whisperModel, profile, customPrompt);
        if (!success) {
            currentProviderMode = 'byok';
        }
        return success;
    });

    ipcMain.handle('send-audio-content', async (event, { data, mimeType }) => {
        if (currentProviderMode === 'cloud') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                sendCloudAudio(pcmBuffer);
                return { success: true };
            } catch (error) {
                console.error('Error sending cloud audio:', error);
                return { success: false, error: error.message };
            }
        }
        if (currentProviderMode === 'local') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                getLocalAi().processLocalAudio(pcmBuffer);
                return { success: true };
            } catch (error) {
                console.error('Error sending local audio:', error);
                return { success: false, error: error.message };
            }
        }
        // Gemini STT path — push audio to Gemini speech-to-text
        if (geminiStt.isGeminiSTTActive()) {
            geminiStt.pushAudio(data);
            return { success: true };
        }
        if (!geminiSessionRef.current) return { success: false, error: 'No active session' };
        try {
            process.stdout.write('.');
            await geminiSessionRef.current.sendRealtimeInput({
                audio: { data: data, mimeType: mimeType },
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending system audio:', error);
            return { success: false, error: error.message };
        }
    });

    // Handle microphone audio on a separate channel
    ipcMain.handle('send-mic-audio-content', async (event, { data, mimeType }) => {
        if (currentProviderMode === 'cloud') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                sendCloudAudio(pcmBuffer);
                return { success: true };
            } catch (error) {
                console.error('Error sending cloud mic audio:', error);
                return { success: false, error: error.message };
            }
        }
        if (currentProviderMode === 'local') {
            try {
                const pcmBuffer = Buffer.from(data, 'base64');
                getLocalAi().processLocalAudio(pcmBuffer);
                return { success: true };
            } catch (error) {
                console.error('Error sending local mic audio:', error);
                return { success: false, error: error.message };
            }
        }
        // Gemini STT path — mic audio also goes to Gemini STT
        if (geminiStt.isGeminiSTTActive()) {
            geminiStt.pushAudio(data);
            return { success: true };
        }
        if (!geminiSessionRef.current) return { success: false, error: 'No active session' };
        try {
            process.stdout.write(',');
            await geminiSessionRef.current.sendRealtimeInput({
                audio: { data: data, mimeType: mimeType },
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending mic audio:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-image-content', async (event, { data, prompt }) => {
        try {
            if (!data || typeof data !== 'string') {
                console.error('Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            const buffer = Buffer.from(data, 'base64');

            if (buffer.length < 1000) {
                console.error(`Image buffer too small: ${buffer.length} bytes`);
                return { success: false, error: 'Image buffer too small' };
            }

            process.stdout.write('!');

            if (currentProviderMode === 'cloud') {
                const sent = sendCloudImage(data);
                if (!sent) {
                    return { success: false, error: 'Cloud connection not active' };
                }
                return { success: true, model: 'cloud' };
            }

            if (currentProviderMode === 'local') {
                const result = await getLocalAi().sendLocalImage(data, prompt);
                return result;
            }

            // Use Azure if configured, otherwise fall back to Gemini
            if (hasAzureKey()) {
                const result = await sendImageToAzure(data, prompt);
                return result;
            }

            // Use HTTP API instead of realtime session
            const result = await sendImageToGeminiHttp(data, prompt);
            return result;
        } catch (error) {
            console.error('Error sending image:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-text-message', async (event, text, profile = null) => {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return { success: false, error: 'Invalid text message' };
        }

        // Resolve the active profile — prefer the passed-in profile, then
        // fall back to the current session profile, then to 'exam' for typed
        // input (a better default than 'interview' which asks for context).
        const resolvedProfile = profile || currentProfile || 'exam';

        // Capture whether profile changed BEFORE initializeNewSession mutates currentProfile.
        const profileChanged = resolvedProfile !== currentProfile;

        if (profileChanged) {
            initializeNewSession(resolvedProfile, currentCustomPrompt);
        }

        // Always keep currentSystemPrompt in sync with the resolved profile
        // so Groq / Azure / Gemma use the right instructions.
        if (!currentSystemPrompt || profileChanged) {
            const googleSearchEnabled = true; // conservative default for text queries
            currentSystemPrompt = getSystemPrompt(resolvedProfile, currentCustomPrompt || '', googleSearchEnabled, currentVoiceProfile);
        }

        if (currentProviderMode === 'cloud') {
            try {
                console.log('Sending text to cloud:', text);
                sendCloudText(text.trim());
                return { success: true };
            } catch (error) {
                console.error('Error sending cloud text:', error);
                return { success: false, error: error.message };
            }
        }

        if (currentProviderMode === 'local') {
            try {
                console.log('Sending text to local Ollama:', text, '| profile:', resolvedProfile);
                // Pass the resolved system prompt so Ollama uses the correct profile
                // even if the session was initialized with a different one.
                return await getLocalAi().sendLocalText(text.trim(), currentSystemPrompt);
            } catch (error) {
                console.error('Error sending local text:', error);
                return { success: false, error: error.message };
            }
        }

        // --- BYOK mode ---
        // Groq / Azure / Gemma can answer typed questions without a live
        // Gemini session.  Only forward to the live session when none of the
        // richer providers are configured.
        try {
            console.log('Sending text message via BYOK:', text, '| profile:', resolvedProfile);

            if (hasAzureKey()) {
                sendToAzure(text.trim());
                return { success: true };
            }

            if (hasGroqKey()) {
                sendToGroq(text.trim());
                return { success: true };
            }

            // Gemma (Gemini HTTP) — works without a live session
            if (getEffectiveApiKey()) {
                sendToGemma(text.trim());
                return { success: true };
            }

            // Last resort: try the live Gemini session
            if (!geminiSessionRef.current) {
                return { success: false, error: 'No active session. Please press Start or configure an API key.' };
            }
            await geminiSessionRef.current.sendRealtimeInput({ text: text.trim() });
            return { success: true };
        } catch (error) {
            console.error('Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async event => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            const success = await startMacOSAudioCapture(geminiSessionRef);
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async event => {
        try {
            stopMacOSAudioCapture();
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            stopMacOSAudioCapture();
            clearRuntimeProviderSecrets();

            if (currentProviderMode === 'cloud') {
                closeCloud();
                currentProviderMode = 'byok';
                return { success: true };
            }

            if (currentProviderMode === 'local') {
                getLocalAi().closeLocalSession();
                currentProviderMode = 'byok';
                return { success: true };
            }

            // Set flag to prevent reconnection attempts
            isUserClosing = true;
            sessionParams = null;

            // Stop Gemini STT if active
            if (geminiStt.isGeminiSTTActive()) {
                geminiStt.stopGeminiSTT();
            }

            // Cleanup Gemini session if present
            if (geminiSessionRef.current) {
                await geminiSessionRef.current.close();
                geminiSessionRef.current = null;
            }

            return { success: true };
        } catch (error) {
            console.error('Error closing session:', error);
            return { success: false, error: error.message };
        }
    });

    // Conversation history IPC handlers
    ipcMain.handle('get-current-session', async event => {
        try {
            return { success: true, data: getCurrentSessionData() };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async event => {
        try {
            initializeNewSession();
            return { success: true, sessionId: currentSessionId };
        } catch (error) {
            console.error('Error starting new session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-google-search-setting', async (event, enabled) => {
        try {
            console.log('Google Search setting updated to:', enabled);
            // The setting is already saved in localStorage by the renderer
            // This is just for logging/confirmation
            return { success: true };
        } catch (error) {
            console.error('Error updating Google Search setting:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    initializeGeminiSession,
    getEnabledTools,
    getStoredSetting,
    sendToRenderer,
    initializeNewSession,
    saveConversationTurn,
    getCurrentSessionData,
    killExistingSystemAudioDump,
    startMacOSAudioCapture,
    convertStereoToMono,
    stopMacOSAudioCapture,
    sendAudioToGemini,
    sendImageToGeminiHttp,
    setupGeminiIpcHandlers,
    formatSpeakerResults,
    clearRuntimeProviderSecrets,
};
