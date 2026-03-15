import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class MainView extends LitElement {
    static styles = css`
        * {
            font-family: var(--font);
            box-sizing: border-box;
            user-select: none;
        }

        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 100%;
            padding: 20px;
            background-image: radial-gradient(circle, rgba(0, 212, 255, 0.05) 1px, transparent 1px);
            background-size: 24px 24px;
            -webkit-app-region: no-drag;
        }

        .card {
            width: 100%;
            max-width: 420px;
            border: 1px solid rgba(0, 212, 255, 0.22);
            border-radius: 12px;
            background: rgba(8, 12, 18, 0.82);
            backdrop-filter: blur(8px);
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .title {
            font-size: 18px;
            font-weight: 600;
            color: #e8f8ff;
            letter-spacing: -0.01em;
            margin: 0;
        }

        .subtitle {
            font-size: 12px;
            color: rgba(0, 212, 255, 0.62);
            font-family: var(--font-mono);
            margin: 0;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 4px;
        }

        .form-label {
            font-size: 10px;
            font-weight: 600;
            color: rgba(0, 212, 255, 0.72);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            font-family: var(--font-mono);
        }

        input {
            -webkit-app-region: no-drag;
            width: 100%;
            background: rgba(15, 20, 28, 0.95);
            color: var(--text-primary);
            border: 1px solid rgba(0, 212, 255, 0.28);
            border-radius: 8px;
            padding: 11px 12px;
            font-size: 14px;
            transition: border-color 150ms ease, box-shadow 150ms ease;
        }

        input:focus {
            outline: none;
            border-color: rgba(0, 212, 255, 0.85);
            box-shadow: 0 0 0 1px rgba(0, 212, 255, 0.24), 0 0 14px rgba(0, 212, 255, 0.12);
        }

        input.error {
            border-color: rgba(239, 68, 68, 0.9);
        }

        .hint {
            font-size: 11px;
            color: rgba(180, 200, 214, 0.72);
            line-height: 1.45;
        }

        .error-alert {
            width: 100%;
            border: 1px solid rgba(239, 68, 68, 0.45);
            background: rgba(239, 68, 68, 0.12);
            color: #fecaca;
            border-radius: 8px;
            padding: 9px 10px;
            font-size: 12px;
            line-height: 1.45;
        }

        .actions {
            display: flex;
            justify-content: center;
            margin-top: 8px;
        }

        .start-button {
            -webkit-app-region: no-drag;
            width: 100%;
            max-width: 260px;
            border: 1px solid rgba(0, 212, 255, 0.72);
            border-radius: 9px;
            background: linear-gradient(135deg, #00d4ff 0%, #3b82f6 100%);
            color: #041018;
            font-size: 14px;
            font-weight: 700;
            padding: 11px 14px;
            cursor: pointer;
            transition: transform 120ms ease, filter 120ms ease, opacity 120ms ease;
            box-shadow: 0 10px 22px rgba(0, 212, 255, 0.2);
        }

        .start-button:hover {
            transform: translateY(-1px);
            filter: brightness(1.05);
        }

        .start-button:active {
            transform: translateY(0);
        }

        .start-button.disabled {
            opacity: 0.45;
            cursor: not-allowed;
            filter: none;
            transform: none;
        }
    `;

    static properties = {
        onStart: { type: Function },
        onExternalLink: { type: Function },
        selectedProfile: { type: String },
        onProfileChange: { type: Function },
        isInitializing: { type: Boolean },
        whisperDownloading: { type: Boolean },
        hasVoiceProfile: { type: Boolean },
        onResetVoiceProfile: { type: Function },
        onRecalibrate: { type: Function },
        _token: { state: true },
        _tokenErrorMessage: { state: true },
    };

    constructor() {
        super();
        this.onStart = () => {};
        this.onExternalLink = () => {};
        this.selectedProfile = 'interview';
        this.onProfileChange = () => {};
        this.isInitializing = false;
        this.whisperDownloading = false;
        this.hasVoiceProfile = false;
        this.onResetVoiceProfile = () => {};
        this.onRecalibrate = () => {};

        this._token = '';
        this._tokenErrorMessage = '';

        this.boundKeydownHandler = this._handleKeydown.bind(this);
        this._loadFromStorage();
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('keydown', this.boundKeydownHandler);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keydown', this.boundKeydownHandler);
    }

    _handleKeydown(e) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            this._handleStart();
        }
    }

    async _loadFromStorage() {
        try {
            const creds = await cheatingDaddy.storage.getCredentials().catch(() => ({}));
            this._token = creds.cloudToken || '';
            this.requestUpdate();
        } catch (error) {
            console.error('Error loading MainView storage:', error);
        }
    }

    async _saveToken(val) {
        this._token = val;
        this._tokenErrorMessage = '';
        await cheatingDaddy.storage.setAccessToken(val);
        this.requestUpdate();
    }

    _handleStart() {
        if (this.isInitializing) return;

        if (!this._token.trim()) {
            this._tokenErrorMessage = 'Access token is required.';
            this.requestUpdate();
            return;
        }

        this._startWithPersistedCredentials();
    }

    async _startWithPersistedCredentials() {
        try {
            await cheatingDaddy.storage.setAccessToken(this._token.trim());
            this.onStart();
        } catch (error) {
            console.error('Failed to persist access token before start:', error);
            this._tokenErrorMessage = 'Failed to save access token. Please try again.';
            this.requestUpdate();
        }
    }

    triggerApiKeyError(message = 'Access token is invalid or expired.') {
        this._tokenErrorMessage = message;
        this.requestUpdate();
    }

    render() {
        return html`
            <div class="card">
                <h1 class="title">GSV</h1>
                <p class="subtitle">Enter your access token to start session</p>

                <div class="form-group">
                    <label class="form-label">Access Token</label>
                    <input
                        type="password"
                        placeholder="Enter your access token"
                        .value=${this._token}
                        @input=${e => this._saveToken(e.target.value)}
                        class=${this._tokenErrorMessage ? 'error' : ''}
                    />
                    <div class="hint">Use any valid SKI access token from your generated key list</div>
                </div>

                ${this._tokenErrorMessage ? html`<div class="error-alert">${this._tokenErrorMessage}</div>` : ''}

                <div class="actions">
                    <button class="start-button ${this.isInitializing ? 'disabled' : ''}" @click=${() => this._handleStart()}>
                        Start Session
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('main-view', MainView);
