import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { MainView } from '../views/MainView.js';
import { ResizeHandles } from './ResizeHandles.js';
import { CustomizeView } from '../views/CustomizeView.js';
import { HelpView } from '../views/HelpView.js';
import { HistoryView } from '../views/HistoryView.js';
import { AssistantView } from '../views/AssistantView.js';
import { OnboardingView } from '../views/OnboardingView.js';
import { AICustomizeView } from '../views/AICustomizeView.js';
import { FeedbackView } from '../views/FeedbackView.js';
import { CalibrationView } from '../views/CalibrationView.js';

export class CheatingDaddyApp extends LitElement {
    static styles = css`
        * {
            box-sizing: border-box;
            font-family: var(--font);
            margin: 0;
            padding: 0;
            cursor: default;
            user-select: none;
        }

        /* ── Animations ── */

        @keyframes rail-fade-in {
            from { opacity: 0; transform: translateX(-8px); }
            to   { opacity: 1; transform: translateX(0); }
        }

        @keyframes icon-scan {
            0%   { background-position: 0 -100%; }
            100% { background-position: 0 200%; }
        }

        @keyframes status-blink {
            0%,100% { opacity: 1; }
            50%      { opacity: 0.3; }
        }

        @keyframes update-pulse {
            0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
            50%      { box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }

        /* ── Host ── */

        :host {
            display: block;
            width: 100%;
            height: 100vh;
            background: var(--bg-app);
            color: var(--text-primary);
        }

        /* ── App shell: icon-rail + content ── */

        .app-shell {
            display: flex;
            height: 100vh;
            overflow: hidden;
        }

        /* ── Thin invisible drag strip ── */

        .drag-strip {
            position: fixed;
            top: 0;
            left: 56px;
            right: 0;
            height: 20px;
            -webkit-app-region: drag;
            z-index: 9999;
            pointer-events: all;
        }

        .drag-strip.hidden {
            display: none;
        }

        /* ── Icon rail (new sidebar) ── */

        .icon-rail {
            width: 56px;
            min-width: 56px;
            height: 100vh;
            background: rgba(8, 8, 10, 0.97);
            border-right: 1px solid rgba(0, 212, 255, 0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 12px 0 10px;
            gap: 0;
            position: relative;
            z-index: 100;
            -webkit-app-region: no-drag;
            animation: rail-fade-in 0.3s ease both;
        }

        /* vertical scan-line on rail */
        .icon-rail::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 1px;
            height: 100%;
            background: linear-gradient(
                180deg,
                transparent 0%,
                rgba(0,212,255,0.35) 30%,
                rgba(0,212,255,0.35) 70%,
                transparent 100%
            );
        }

        .icon-rail.hidden {
            display: none;
        }

        /* ── Brand mark ── */

        .rail-brand {
            width: 34px;
            height: 34px;
            border-radius: 8px;
            border: 1px solid rgba(0, 212, 255, 0.3);
            background: rgba(0, 212, 255, 0.07);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 700;
            color: #00d4ff;
            letter-spacing: -0.05em;
            margin-bottom: 14px;
            box-shadow: 0 0 12px rgba(0,212,255,0.12);
            flex-shrink: 0;
            font-family: var(--font-mono);
        }

        /* ── Nav icons ── */

        .rail-nav {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            width: 100%;
        }

        .rail-item {
            position: relative;
            width: 100%;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            background: none;
            color: rgba(255,255,255,0.22);
            cursor: pointer;
            padding: 0;
            transition: color 0.18s;
        }

        .rail-item svg {
            width: 18px;
            height: 18px;
            transition: color 0.18s;
        }

        .rail-item:hover {
            color: rgba(0, 212, 255, 0.85);
        }

        .rail-item:hover::after {
            content: attr(data-label);
            position: absolute;
            left: calc(100% + 10px);
            top: 50%;
            transform: translateY(-50%);
            background: rgba(8,8,10,0.95);
            border: 1px solid rgba(0,212,255,0.3);
            color: #e8e8e8;
            font-size: 11px;
            font-family: var(--font-mono);
            white-space: nowrap;
            padding: 4px 10px;
            border-radius: 4px;
            pointer-events: none;
            z-index: 999;
            box-shadow: 0 0 12px rgba(0,212,255,0.1);
        }

        /* Active state: left neon bar */
        .rail-item.active {
            color: #00d4ff;
        }

        .rail-item.active::before {
            content: '';
            position: absolute;
            left: 0;
            top: 20%;
            height: 60%;
            width: 2px;
            background: #00d4ff;
            border-radius: 0 2px 2px 0;
            box-shadow: 0 0 8px rgba(0,212,255,0.7), 0 0 16px rgba(0,212,255,0.3);
        }

        /* ── Rail footer — window controls ── */

        .rail-footer {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding-bottom: 4px;
            width: 100%;
        }

        .version-badge {
            font-size: 9px;
            color: rgba(255,255,255,0.14);
            font-family: var(--font-mono);
            text-align: center;
            letter-spacing: 0.04em;
            padding: 3px 0 6px;
        }

        /* ── Window control buttons (custom, no macOS dots) ── */

        .wc-btn {
            width: 32px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            border: 1px solid transparent;
            background: transparent;
            cursor: pointer;
            transition: all 0.15s;
            font-family: var(--font-mono);
            font-size: 11px;
            letter-spacing: 0.03em;
        }

        .wc-btn.minimize {
            color: rgba(254, 188, 46, 0.45);
            border-color: rgba(254, 188, 46, 0.18);
        }

        .wc-btn.minimize:hover {
            color: #febc2e;
            border-color: rgba(254,188,46,0.6);
            background: rgba(254,188,46,0.08);
            box-shadow: 0 0 8px rgba(254,188,46,0.2);
        }

        .wc-btn.close {
            color: rgba(239, 68, 68, 0.45);
            border-color: rgba(239, 68, 68, 0.18);
        }

        .wc-btn.close:hover {
            color: #ef4444;
            border-color: rgba(239,68,68,0.6);
            background: rgba(239,68,68,0.08);
            box-shadow: 0 0 8px rgba(239,68,68,0.2);
            animation: update-pulse 1.2s ease infinite;
        }

        /* ── Fixed top-right window controls ── */

        .window-controls {
            position: fixed;
            top: 10px;
            right: 12px;
            z-index: 9999;
            display: flex;
            gap: 6px;
            align-items: center;
            -webkit-app-region: no-drag;
        }

        .window-controls.hidden {
            display: none;
        }

        .update-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--danger);
            box-shadow: 0 0 6px rgba(239,68,68,0.8);
            animation: status-blink 2s ease-in-out infinite;
            margin-bottom: 2px;
        }

        /* ── Main content area ── */

        .content {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--bg-app);
            position: relative;
        }

        /* ── Live mode top bar ── */

        .live-bar {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            background: rgba(8,8,10,0.96);
            border-bottom: 1px solid rgba(0,212,255,0.12);
            height: 34px;
            -webkit-app-region: drag;
            flex-shrink: 0;
        }

        .live-bar-left {
            display: flex;
            align-items: center;
            gap: 10px;
            -webkit-app-region: no-drag;
            z-index: 1;
        }

        .live-bar-back {
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(239,68,68,0.55);
            cursor: pointer;
            background: none;
            border: 1px solid rgba(239,68,68,0.2);
            padding: 3px 8px;
            border-radius: 3px;
            transition: all 0.15s;
            font-size: 10px;
            font-family: var(--font-mono);
            letter-spacing: 0.06em;
            text-transform: uppercase;
            gap: 4px;
        }

        .live-bar-back:hover {
            color: #ef4444;
            border-color: rgba(239,68,68,0.5);
            background: rgba(239,68,68,0.08);
        }

        .live-bar-back svg {
            width: 12px;
            height: 12px;
        }

        .live-profile-tag {
            font-size: 10px;
            font-family: var(--font-mono);
            color: rgba(0,212,255,0.55);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            border: 1px solid rgba(0,212,255,0.15);
            border-radius: 3px;
            padding: 2px 8px;
        }

        .live-bar-center {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 6px;
            pointer-events: none;
        }

        .live-session-dot {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 6px rgba(34,197,94,0.8);
            animation: status-blink 2s ease-in-out infinite;
        }

        .live-session-label {
            font-size: 10px;
            font-family: var(--font-mono);
            color: rgba(34,197,94,0.7);
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .live-bar-right {
            display: flex;
            align-items: center;
            gap: 12px;
            -webkit-app-region: no-drag;
            z-index: 1;
        }

        .live-bar-text {
            font-size: 10px;
            color: rgba(255,255,255,0.3);
            font-family: var(--font-mono);
            white-space: nowrap;
        }

        .live-bar-text.hot {
            color: rgba(0,212,255,0.6);
        }

        .live-bar-text.clickable {
            cursor: pointer;
            border: 1px solid rgba(0,212,255,0.15);
            border-radius: 3px;
            padding: 2px 8px;
            transition: all 0.15s;
            color: rgba(0,212,255,0.5);
        }

        .live-bar-text.clickable:hover {
            color: #00d4ff;
            border-color: rgba(0,212,255,0.5);
            background: rgba(0,212,255,0.06);
        }

        /* ── Content inner ── */

        .content-inner {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }

        .content-inner.live {
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        /* ── Onboarding fullscreen ── */

        .fullscreen {
            position: fixed;
            inset: 0;
            z-index: 100;
            background: var(--bg-app);
        }

        /* ── Scrollbar ── */

        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
            background: rgba(0,212,255,0.15);
            border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: rgba(0,212,255,0.35);
        }
    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        isRecording: { type: Boolean },
        sessionActive: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        _awaitingNewResponse: { state: true },
        shouldAnimateResponse: { type: Boolean },
        _storageLoaded: { state: true },
        _updateAvailable: { state: true },
        _whisperDownloading: { state: true },
        _awaitingScreenAnalysis: { state: true },
        _errorContent: { state: true },
        _hasVoiceProfile: { state: true },
    };

    constructor() {
        super();
        this.currentView = 'main';
        this.statusText = '';
        this.startTime = null;
        this.isRecording = false;
        this.sessionActive = false;
        this.selectedProfile = 'interview';
        this.selectedLanguage = 'en-US';
        this.selectedScreenshotInterval = '5';
        this.selectedImageQuality = 'medium';
        this.layoutMode = 'normal';
        this.responses = [];
        this.currentResponseIndex = -1;
        this._viewInstances = new Map();
        this._isClickThrough = false;
        this._awaitingNewResponse = false;
        this._currentResponseIsComplete = true;
        this.shouldAnimateResponse = false;
        this._storageLoaded = false;
        this._timerInterval = null;
        this._updateAvailable = false;
        this._whisperDownloading = false;
        this._localVersion = '';
        this._awaitingScreenAnalysis = false;
        this._errorContent = '';
        this._hasVoiceProfile = false;
        this._layoutRepositioned = false;

        this._loadFromStorage();
        this._checkForUpdates();
    }

    async _checkForUpdates() {
        try {
            this._localVersion = await cheatingDaddy.getVersion();
            this.requestUpdate();

            const res = await fetch('https://raw.githubusercontent.com/sohzm/cheating-daddy/refs/heads/master/package.json');
            if (!res.ok) return;
            const remote = await res.json();
            const remoteVersion = remote.version;

            const toNum = v => v.split('.').map(Number);
            const [rMaj, rMin, rPatch] = toNum(remoteVersion);
            const [lMaj, lMin, lPatch] = toNum(this._localVersion);

            if (rMaj > lMaj || (rMaj === lMaj && rMin > lMin) || (rMaj === lMaj && rMin === lMin && rPatch > lPatch)) {
                this._updateAvailable = true;
                this.requestUpdate();
            }
        } catch (e) {
            // silently ignore
        }
    }

    async _loadFromStorage() {
        try {
            const [config, prefs, voiceProfile] = await Promise.all([
                cheatingDaddy.storage.getConfig(),
                cheatingDaddy.storage.getPreferences(),
                cheatingDaddy.storage.getVoiceProfile(),
            ]);

            this.currentView = config.onboarded ? 'main' : 'onboarding';
            this.selectedProfile = prefs.selectedProfile || 'interview';
            this.selectedLanguage = prefs.selectedLanguage || 'en-US';
            this.selectedScreenshotInterval = prefs.selectedScreenshotInterval || '5';
            this.selectedImageQuality = prefs.selectedImageQuality || 'medium';
            this.layoutMode = config.layout || 'normal';
            this._hasVoiceProfile = !!voiceProfile;

            this._storageLoaded = true;
            this.requestUpdate();
        } catch (error) {
            console.error('Error loading from storage:', error);
            this._storageLoaded = true;
            this.requestUpdate();
        }
    }

    connectedCallback() {
        super.connectedCallback();

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('new-response', (_, response) => this.addNewResponse(response));
            ipcRenderer.on('update-response', (_, response) => this.updateCurrentResponse(response));
            ipcRenderer.on('update-status', (_, status) => this.setStatus(status));
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => { this._isClickThrough = isEnabled; });
            ipcRenderer.on('reconnect-failed', (_, data) => this.addNewResponse(data.message));
            ipcRenderer.on('whisper-downloading', (_, downloading) => { this._whisperDownloading = downloading; });
            ipcRenderer.on('screen-analysis-triggered', () => {
                this._awaitingScreenAnalysis = true;
                this._layoutRepositioned = false;
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopTimer();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('new-response');
            ipcRenderer.removeAllListeners('update-response');
            ipcRenderer.removeAllListeners('update-status');
            ipcRenderer.removeAllListeners('click-through-toggled');
            ipcRenderer.removeAllListeners('reconnect-failed');
            ipcRenderer.removeAllListeners('whisper-downloading');
        }
    }

    // ── Timer ──

    _startTimer() {
        this._stopTimer();
        if (this.startTime) {
            this._timerInterval = setInterval(() => this.requestUpdate(), 1000);
        }
    }

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    getElapsedTime() {
        if (!this.startTime) return '0:00';
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const h = Math.floor(elapsed / 3600);
        const m = Math.floor((elapsed % 3600) / 60);
        const s = elapsed % 60;
        const pad = n => String(n).padStart(2, '0');
        if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
        return `${m}:${pad(s)}`;
    }

    // ── Status & Responses ──

    setStatus(text) {
        this.statusText = text;
        if (text.includes('Ready') || text.includes('Listening') || text.includes('Error')) {
            this._currentResponseIsComplete = true;
        }
    }

    addNewResponse(response) {
        const wasOnLatest = this.currentResponseIndex === this.responses.length - 1;
        const cleaned = this._extractScreenAnalysisMarkers(response);
        this.responses = [...this.responses, cleaned];
        if (wasOnLatest || this.currentResponseIndex === -1) {
            this.currentResponseIndex = this.responses.length - 1;
        }
        this._awaitingNewResponse = false;
        this.requestUpdate();
    }

    updateCurrentResponse(response) {
        if (this.responses.length > 0) {
            const cleaned = this._extractScreenAnalysisMarkers(response);
            this.responses = [...this.responses.slice(0, -1), cleaned];
        } else {
            this.addNewResponse(response);
        }
        this.requestUpdate();
    }

    _extractScreenAnalysisMarkers(text) {
        if (!this._awaitingScreenAnalysis) return text;

        let cleaned = text;

        // Extract layout hint
        const layoutMatch = cleaned.match(/===LAYOUT:(left|right|center|top-left|top-right|bottom-left|bottom-right)===/i);
        if (layoutMatch && !this._layoutRepositioned) {
            this._layoutRepositioned = true;
            const hint = layoutMatch[1].toLowerCase();
            if (window.cheatingDaddy?.repositionWindow) {
                window.cheatingDaddy.repositionWindow(hint);
            }
        }
        cleaned = cleaned.replace(/\n?===LAYOUT:[a-z-]+===\n?/gi, '');

        // Extract code issue
        const issueMatch = cleaned.match(/===CODE_ISSUE_START===\n?([\s\S]*?)\n?===CODE_ISSUE_END===/i);
        if (issueMatch) {
            this._errorContent = issueMatch[1].trim();
        }
        cleaned = cleaned.replace(/\n?===CODE_ISSUE_START===\n?[\s\S]*?\n?===CODE_ISSUE_END===\n?/gi, '');

        // Once status goes to Listening/Ready, analysis is done
        if (this.statusText?.includes('Listening') || this.statusText?.includes('Ready')) {
            this._awaitingScreenAnalysis = false;
        }

        return cleaned.trim();
    }

    // ── Navigation ──

    navigate(view) {
        this.currentView = view;
        this.requestUpdate();
    }

    async handleClose() {
        if (this.currentView === 'assistant') {
            cheatingDaddy.stopCapture();
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('close-session');
            }
            this.sessionActive = false;
            this._stopTimer();
            this.currentView = 'main';
        } else if (this.currentView === 'calibration') {
            // Go back to main from calibration
            this.currentView = 'main';
        } else {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('quit-application');
            }
        }
    }

    async _handleMinimize() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('window-minimize');
        }
    }

    async handleHideToggle() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('toggle-window-visibility');
        }
    }

    // ── Session start ──

    async handleStart() {
        // If no voice profile, go to calibration first
        if (!this._hasVoiceProfile) {
            this.currentView = 'calibration';
            this.requestUpdate();
            return;
        }

        await this._startSession();
    }

    async handleCalibrationComplete(voiceProfile) {
        if (voiceProfile) {
            await cheatingDaddy.storage.saveVoiceProfile(voiceProfile);
            this._hasVoiceProfile = true;
        }
        // Proceed to start session
        await this._startSession();
    }

    handleCalibrationSkip() {
        // Skip calibration, start session without voice profile
        this._startSession();
    }

    async handleResetVoiceProfile() {
        await cheatingDaddy.storage.deleteVoiceProfile();
        this._hasVoiceProfile = false;
        this.requestUpdate();
    }

    async _startSession() {
        const prefs = await cheatingDaddy.storage.getPreferences();
        const providerMode = prefs.providerMode || 'cloud';

        if (providerMode === 'cloud') {
            const creds = await cheatingDaddy.storage.getCredentials();
            if (!creds.cloudToken || creds.cloudToken.trim() === '') {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerApiKeyError) {
                    mainView.triggerApiKeyError();
                }
                return;
            }

            const success = await cheatingDaddy.initializeCloud(this.selectedProfile);
            if (!success) {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerApiKeyError) {
                    mainView.triggerApiKeyError();
                }
                return;
            }
        } else if (providerMode === 'local') {
            const success = await cheatingDaddy.initializeLocal(this.selectedProfile);
            if (!success) {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerApiKeyError) {
                    mainView.triggerApiKeyError();
                }
                return;
            }
        } else {
            const apiKey = await cheatingDaddy.storage.getApiKey();
            if (!apiKey || apiKey === '') {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerApiKeyError) {
                    mainView.triggerApiKeyError();
                }
                return;
            }

            await cheatingDaddy.initializeGemini(this.selectedProfile, this.selectedLanguage);
        }

        cheatingDaddy.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
        this.responses = [];
        this.currentResponseIndex = -1;
        this.startTime = Date.now();
        this.sessionActive = true;
        this.currentView = 'assistant';
        this._startTimer();
    }

    async handleAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', 'https://cheatingdaddy.com/help/api-key');
        }
    }

    async handleGroqAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', 'https://console.groq.com/keys');
        }
    }

    // ── Settings handlers ──

    async handleProfileChange(profile) {
        this.selectedProfile = profile;
        await cheatingDaddy.storage.updatePreference('selectedProfile', profile);
    }

    async handleLanguageChange(language) {
        this.selectedLanguage = language;
        await cheatingDaddy.storage.updatePreference('selectedLanguage', language);
    }

    async handleScreenshotIntervalChange(interval) {
        this.selectedScreenshotInterval = interval;
        await cheatingDaddy.storage.updatePreference('selectedScreenshotInterval', interval);
    }

    async handleImageQualityChange(quality) {
        this.selectedImageQuality = quality;
        await cheatingDaddy.storage.updatePreference('selectedImageQuality', quality);
    }

    async handleLayoutModeChange(layoutMode) {
        this.layoutMode = layoutMode;
        await cheatingDaddy.storage.updateConfig('layout', layoutMode);
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-sizes');
            } catch (error) {
                console.error('Failed to update sizes:', error);
            }
        }
        this.requestUpdate();
    }

    async handleExternalLinkClick(url) {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', url);
        }
    }

    async handleSendText(message) {
        const result = await window.cheatingDaddy.sendTextMessage(message);
        if (!result.success) {
            this.setStatus('Error sending message: ' + result.error);
        } else {
            this.setStatus('Message sent...');
            this._awaitingNewResponse = true;
        }
    }

    handleResponseIndexChanged(e) {
        this.currentResponseIndex = e.detail.index;
        this.shouldAnimateResponse = false;
        this.requestUpdate();
    }

    handleOnboardingComplete() {
        this.currentView = 'main';
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('currentView') && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('view-changed', this.currentView);
        }
    }

    // ── Helpers ──

    _isLiveMode() {
        return this.currentView === 'assistant';
    }

    // ── Render ──

    renderCurrentView() {
        switch (this.currentView) {
            case 'onboarding':
                return html`
                    <onboarding-view
                        .onComplete=${() => this.handleOnboardingComplete()}
                        .onClose=${() => this.handleClose()}
                    ></onboarding-view>
                `;

            case 'main':
                return html`
                    <main-view
                        .selectedProfile=${this.selectedProfile}
                        .onProfileChange=${p => this.handleProfileChange(p)}
                        .onStart=${() => this.handleStart()}
                        .onExternalLink=${url => this.handleExternalLinkClick(url)}
                        .whisperDownloading=${this._whisperDownloading}
                        .hasVoiceProfile=${this._hasVoiceProfile}
                        .onResetVoiceProfile=${() => this.handleResetVoiceProfile()}
                        .onRecalibrate=${() => { this.currentView = 'calibration'; this.requestUpdate(); }}
                    ></main-view>
                `;

            case 'calibration':
                return html`
                    <calibration-view
                        .language=${this.selectedLanguage}
                        .onComplete=${(profile) => this.handleCalibrationComplete(profile)}
                        .onSkip=${() => this.handleCalibrationSkip()}
                    ></calibration-view>
                `;

            case 'ai-customize':
                return html`
                    <ai-customize-view
                        .selectedProfile=${this.selectedProfile}
                        .onProfileChange=${p => this.handleProfileChange(p)}
                    ></ai-customize-view>
                `;

            case 'customize':
                return html`
                    <customize-view
                        .selectedProfile=${this.selectedProfile}
                        .selectedLanguage=${this.selectedLanguage}
                        .selectedScreenshotInterval=${this.selectedScreenshotInterval}
                        .selectedImageQuality=${this.selectedImageQuality}
                        .layoutMode=${this.layoutMode}
                        .onProfileChange=${p => this.handleProfileChange(p)}
                        .onLanguageChange=${l => this.handleLanguageChange(l)}
                        .onScreenshotIntervalChange=${i => this.handleScreenshotIntervalChange(i)}
                        .onImageQualityChange=${q => this.handleImageQualityChange(q)}
                        .onLayoutModeChange=${lm => this.handleLayoutModeChange(lm)}
                    ></customize-view>
                `;

            case 'feedback':
                return html`<feedback-view></feedback-view>`;

            case 'help':
                return html`<help-view .onExternalLinkClick=${url => this.handleExternalLinkClick(url)}></help-view>`;

            case 'history':
                return html`<history-view></history-view>`;

            case 'assistant':
                return html`
                    <assistant-view
                        .responses=${this.responses}
                        .currentResponseIndex=${this.currentResponseIndex}
                        .selectedProfile=${this.selectedProfile}
                        .onSendText=${msg => this.handleSendText(msg)}
                        .shouldAnimateResponse=${this.shouldAnimateResponse}
                        .errorContent=${this._errorContent}
                        @response-index-changed=${this.handleResponseIndexChanged}
                        @response-animation-complete=${() => {
                            this.shouldAnimateResponse = false;
                            this._currentResponseIsComplete = true;
                            this.requestUpdate();
                        }}
                        @screen-analysis-triggered=${() => {
                            this._awaitingScreenAnalysis = true;
                            this._layoutRepositioned = false;
                            this._errorContent = '';
                        }}
                        @dismiss-error-panel=${() => {
                            this._errorContent = '';
                            this.requestUpdate();
                        }}
                    ></assistant-view>
                `;

            default:
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }

    renderSidebar() {
        const items = [
            {
                id: 'main',
                label: 'Home',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m19 8.71l-5.333-4.148a2.666 2.666 0 0 0-3.274 0L5.059 8.71a2.67 2.67 0 0 0-1.029 2.105v7.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.2c0-.823-.38-1.6-1.03-2.105"/><path d="M16 15c-2.21 1.333-5.792 1.333-8 0"/></g></svg>`,
            },
            {
                id: 'ai-customize',
                label: 'AI Context',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 3v7h6l-8 11v-7H5z"/></svg>`,
            },
            {
                id: 'history',
                label: 'History',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 20.777a9 9 0 0 1-2.48-.969M14 3.223a9.003 9.003 0 0 1 0 17.554m-9.421-3.684a9 9 0 0 1-1.227-2.592M3.124 10.5c.16-.95.468-1.85.9-2.675l.169-.305m2.714-2.941A9 9 0 0 1 10 3.223"/><path d="M12 8v4l3 3"/></g></svg>`,
            },
            {
                id: 'customize',
                label: 'Settings',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19.875 6.27A2.23 2.23 0 0 1 21 8.218v7.284c0 .809-.443 1.555-1.158 1.948l-6.75 4.27a2.27 2.27 0 0 1-2.184 0l-6.75-4.27A2.23 2.23 0 0 1 3 15.502V8.217c0-.809.443-1.554 1.158-1.947l6.75-3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/></g></svg>`,
            },
            {
                id: 'feedback',
                label: 'Feedback',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM9.5 9h.01m4.99 0h.01"/><path d="M9.5 13a3.5 3.5 0 0 0 5 0"/></g></svg>`,
            },
            {
                id: 'help',
                label: 'Help',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9s-9-1.8-9-9s1.8-9 9-9m0 13v.01"/><path d="M12 13a2 2 0 0 0 .914-3.782a1.98 1.98 0 0 0-2.414.483"/></g></svg>`,
            },
        ];

        return html`
            <div class="icon-rail ${this._isLiveMode() ? 'hidden' : ''}">
                <!-- Brand mark -->
                <div class="rail-brand">G</div>

                <!-- Nav icons -->
                <nav class="rail-nav">
                    ${items.map(item => html`
                        <button
                            class="rail-item ${this.currentView === item.id ? 'active' : ''}"
                            data-label="${item.label}"
                            @click=${() => this.navigate(item.id)}
                        >${item.icon}</button>
                    `)}
                </nav>

                <!-- Footer: version + update dot only -->
                <div class="rail-footer">
                    ${this._updateAvailable ? html`<div class="update-dot" title="Update available"></div>` : ''}
                    <div class="version-badge">${this._localVersion ? 'v' + this._localVersion : ''}</div>
                </div>
            </div>
        `;
    }

    renderLiveBar() {
        if (!this._isLiveMode()) return '';

        const profileLabels = {
            interview: 'Interview',
            sales: 'Sales Call',
            meeting: 'Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
            exam: 'Exam',
        };

        return html`
            <div class="live-bar">
                <div class="live-bar-left">
                    <button class="live-bar-back" @click=${() => this.handleClose()} title="End session">
                        ← END
                    </button>
                    <span class="live-profile-tag">${profileLabels[this.selectedProfile] || 'Session'}</span>
                </div>
                <div class="live-bar-center">
                    <span class="live-session-dot"></span>
                    <span class="live-session-label">LIVE</span>
                </div>
                <div class="live-bar-right">
                    ${this.statusText ? html`<span class="live-bar-text hot">${this.statusText}</span>` : ''}
                    <span class="live-bar-text">${this.getElapsedTime()}</span>
                    ${this._isClickThrough ? html`<span class="live-bar-text">[pass-thru]</span>` : ''}
                    <span class="live-bar-text clickable" @click=${() => this.handleHideToggle()}>[hide]</span>
                </div>
            </div>
        `;
    }

    render() {
        // Onboarding is fullscreen, no sidebar
        if (this.currentView === 'onboarding') {
            return html`
                <div class="fullscreen">
                    ${this.renderCurrentView()}
                </div>
            `;
        }

        const isLive = this._isLiveMode();

        return html`
            <div class="app-shell">
                <!-- Thin invisible drag strip replaces macOS traffic-light bar -->
                <div class="drag-strip ${isLive ? 'hidden' : ''}"></div>

                <!-- Fixed top-right window controls -->
                <div class="window-controls ${isLive ? 'hidden' : ''}">
                    <button class="wc-btn minimize" @click=${() => this._handleMinimize()} title="Minimise">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button class="wc-btn close" @click=${() => this.handleClose()} title="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
                    </button>
                </div>

                <!-- Icon rail sidebar -->
                ${this.renderSidebar()}

                <div class="content">
                    ${isLive ? this.renderLiveBar() : ''}
                    <div class="content-inner ${isLive ? 'live' : ''}">
                        ${this.renderCurrentView()}
                        <resize-handles></resize-handles>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('cheating-daddy-app', CheatingDaddyApp);
