const sdk = require('microsoft-cognitiveservices-speech-sdk');

let recognizer = null;
let pushStream = null;
let onTranscriptCallback = null;
let isStarted = false;

function extractRegion(endpoint) {
    // e.g. https://gurug-m7m5keep-eastus2.cognitiveservices.azure.com → eastus2
    const match = endpoint.match(/[a-z0-9-]+\.([\w]+)\.cognitiveservices\.azure\.com/i);
    return match ? match[1] : 'eastus';
}

function startAzureSTT(apiKey, endpoint, language, onTranscript) {
    if (isStarted) stopAzureSTT();

    // Validate credentials
    if (!apiKey || apiKey.trim() === '') {
        console.error('[AzureSTT] API key is empty or invalid');
        return;
    }
    if (!endpoint || endpoint.trim() === '') {
        console.error('[AzureSTT] Endpoint is empty or invalid');
        return;
    }

    onTranscriptCallback = onTranscript;

    const region = extractRegion(endpoint);
    console.log('[AzureSTT] Starting with region:', region, '| language:', language);
    console.log('[AzureSTT] Endpoint:', endpoint);
    console.log('[AzureSTT] API Key length:', apiKey.length, '| First 5 chars:', apiKey.substring(0, 5) + '***');

    const speechConfig = sdk.SpeechConfig.fromSubscription(apiKey, region);
    speechConfig.speechRecognitionLanguage = language || 'en-US';

    // PCM 16-bit mono 16kHz — resample from 24kHz happens below
    pushStream = sdk.AudioInputStream.createPushStream(
        sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
    );
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

    recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
            const text = e.result.text.trim();
            if (text && onTranscriptCallback) {
                console.log('[AzureSTT] Recognized:', text);
                onTranscriptCallback(text);
            }
        }
    };

    recognizer.recognizing = (s, e) => {
        // Partial transcripts — log only for debugging
        // console.log('[AzureSTT] Partial:', e.result.text);
    };

    recognizer.canceled = (s, e) => {
        console.error('[AzureSTT] Canceled:', e.errorDetails);
        if (e.reason === sdk.CancellationReason.Error) {
            console.error('[AzureSTT] Error code:', e.errorCode);
            console.error('[AzureSTT] Error details:', e.errorDetails);
            if (e.errorCode === sdk.CancellationErrorCode.Unauthorized) {
                console.error('[AzureSTT] Authentication failed — verify API key and region are correct');
            } else if (e.errorCode === sdk.CancellationErrorCode.ConnectionFailure) {
                console.error('[AzureSTT] Connection failed — check network and endpoint URL');
            }
        }
    };

    recognizer.sessionStopped = () => {
        console.log('[AzureSTT] Session stopped');
        isStarted = false;
    };

    recognizer.startContinuousRecognitionAsync(
        () => { console.log('[AzureSTT] Recognition started'); isStarted = true; },
        err => { console.error('[AzureSTT] Failed to start:', err); isStarted = false; }
    );
}

// Downsample 24kHz PCM Buffer → 16kHz PCM Buffer (Azure STT expects 16kHz)
function resample24to16(buf) {
    // Input: 24000 samples/sec 16-bit LE mono Buffer
    // Output: 16000 samples/sec 16-bit LE mono Buffer
    // Ratio: 16000/24000 = 2/3 → take every 3rd sample pair, keep 2
    const inSamples = buf.length / 2;
    const outSamples = Math.floor(inSamples * 16000 / 24000);
    const out = Buffer.alloc(outSamples * 2);
    for (let i = 0; i < outSamples; i++) {
        const srcIdx = Math.round(i * 24000 / 16000);
        const clampedIdx = Math.min(srcIdx, inSamples - 1);
        const sample = buf.readInt16LE(clampedIdx * 2);
        out.writeInt16LE(sample, i * 2);
    }
    return out;
}

function pushAudioToSTT(base64PcmData) {
    if (!pushStream || !isStarted) return;
    try {
        const raw = Buffer.from(base64PcmData, 'base64');
        const resampled = resample24to16(raw);
        pushStream.write(resampled);
    } catch (e) {
        console.error('[AzureSTT] Push error:', e.message);
    }
}

function stopAzureSTT() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(
            () => { recognizer.close(); recognizer = null; },
            err => { console.error('[AzureSTT] Stop error:', err); recognizer = null; }
        );
    }
    if (pushStream) {
        try { pushStream.close(); } catch {}
        pushStream = null;
    }
    isStarted = false;
    console.log('[AzureSTT] Stopped');
}

function isAzureSTTActive() {
    return isStarted;
}

module.exports = { startAzureSTT, pushAudioToSTT, stopAzureSTT, isAzureSTTActive };
