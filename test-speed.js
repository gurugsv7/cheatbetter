// Azure OpenAI Speed Test
// Run: node test-speed.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const credPath = path.join(os.homedir(), 'AppData', 'Roaming', 'hintio-config', 'credentials.json');
const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));

const { azureApiKey, azureEndpoint, azureDeployment } = creds;

let baseEndpoint = azureEndpoint.replace(/\/$/, '').replace(/\/openai\/(responses|deployments|completions).*$/i, '');
const url = `${baseEndpoint}/openai/deployments/${azureDeployment}/chat/completions?api-version=2025-04-01-preview`;

// gpt-5-nano config for comparison
const NANO_ENDPOINT = baseEndpoint;
const NANO_DEPLOYMENT = 'gpt-5-nano';
const NANO_URL = `${NANO_ENDPOINT}/openai/deployments/${NANO_DEPLOYMENT}/chat/completions?api-version=2025-01-01-preview`;

const COMPACT_PROMPT = `You are an interview assistant helping a software professional in India. Give ready-to-speak answers in natural Indian English — direct, 3-5 spoken sentences, no bullet points, no markdown headers, no bold labels. Output ONLY the words the user will speak.`;

const OLD_PROMPT = `You are an AI-powered interview assistant, designed to act as a discreet on-screen teleprompter. Your mission is to help the user excel in their job interview by providing concise, natural, ready-to-speak answers. The user is in India — write all answers in natural Indian English the way a software professional in India would actually speak in a technical interview. Analyze the ongoing interview dialogue and, crucially, the 'User-provided context' below.

**CODING QUESTION STRATEGY (interviewer is listening):**
When asked a coding or technical question via voice, ALWAYS follow this two-part structure:
1. **Brief explanation first (2-4 sentences):** Explain your approach and why
2. **Then provide the code:** Clean, well-commented, production-quality code.

**RESPONSE FORMAT REQUIREMENTS — SPOKEN INTERVIEW ANSWER (Indian English style):**
Write EXACTLY as an Indian software professional would speak in a technical interview — direct, clear, conversational prose.
STRICT RULES:
- NO bullet points, NO numbered lists, NO dashes used as lists
- NO markdown headers
- Write in connected sentences
- Use natural Indian English spoken connectors: "so", "basically", "see", "actually"
- Keep it concise — 3 to 5 sentences is ideal

**OUTPUT INSTRUCTIONS:**
Write ONLY the words the user will speak out loud.`;

async function measureCall(label, systemPrompt, userMessage, historyTurns = [], reasoningEffort = null, overrideUrl = null) {
    const messages = [
        { role: 'system', content: systemPrompt },
        ...historyTurns,
        { role: 'user', content: userMessage },
    ];

    const body = {
        messages,
        stream: true,
        temperature: 1,
        max_completion_tokens: 350,
    };
    if (reasoningEffort) body.reasoning_effort = reasoningEffort;

    const start = Date.now();
    let firstTokenMs = null;
    let fullText = '';

    const resp = await fetch(overrideUrl || url, {
        method: 'POST',
        headers: { 'api-key': azureApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const err = await resp.text();
        console.error(`[${label}] HTTP ${resp.status}: ${err}`);
        return;
    }

    const reader = resp.body.getReader();
    const dec = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
                const json = JSON.parse(data);
                const token = json.choices?.[0]?.delta?.content || '';
                if (token) {
                    if (!firstTokenMs) firstTokenMs = Date.now() - start;
                    fullText += token;
                }
            } catch {}
        }
    }

    const totalMs = Date.now() - start;
    console.log(`\n[${ label }]`);
    console.log(`  System prompt chars : ${systemPrompt.length}`);
    console.log(`  History turns       : ${historyTurns.length / 2}`);
    console.log(`  Time to first token : ${firstTokenMs}ms`);
    console.log(`  Total response time : ${totalMs}ms`);
    console.log(`  Response length     : ${fullText.length} chars`);
    console.log(`  Answer preview      : ${fullText.substring(0, 120)}...`);
}

// Simulate a long history (10 turns = 20 messages)
const longHistory = [];
for (let i = 0; i < 10; i++) {
    longHistory.push({ role: 'user', content: 'Tell me about your experience with Java Spring Boot and microservices architecture.' });
    longHistory.push({ role: 'assistant', content: 'So basically I have been working with Spring Boot for about three years now and I have built several microservices that handle high traffic. The main thing I focus on is keeping services loosely coupled using REST APIs and event-driven communication with Kafka.' });
}

// Short history (3 turns = 6 messages)
const shortHistory = longHistory.slice(-6);

const question = 'What is the difference between HashMap and ConcurrentHashMap in Java?';

(async () => {
    console.log('=== Azure OpenAI Speed Test ===');
    console.log(`Endpoint : ${baseEndpoint}`);
    console.log(`Question : ${question}\n`);

    // Current best: gpt-5.2-chat with reasoning_effort=low
    await measureCall(`gpt-5.2-chat | reasoning_effort=low`, COMPACT_PROMPT, question, [], 'low');

    await new Promise(r => setTimeout(r, 1200));

    // gpt-5-nano: no reasoning_effort (it's a nano model, no reasoning params)
    await measureCall(`gpt-5-nano | no reasoning_effort`, COMPACT_PROMPT, question, [], null, NANO_URL);

    await new Promise(r => setTimeout(r, 1200));

    // gpt-5-nano: with reasoning_effort=low
    await measureCall(`gpt-5-nano | reasoning_effort=low`, COMPACT_PROMPT, question, [], 'low', NANO_URL);

    console.log('\n=== Done ===');
})();
