import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class AppHeader extends LitElement {
    static styles = css`
        * {
            font-family: var(--font);
            cursor: default;
            user-select: none;
        }

        .header {
            -webkit-app-region: drag;
            display: flex;
            align-items: center;
            padding: var(--header-padding);
            background: var(--header-background);
            border-bottom: 1px solid var(--border);
        }

        .header-title {
            flex: 1;
            font-size: var(--header-font-size);
            font-weight: 500;
            color: var(--text-primary);
            -webkit-app-region: drag;
        }

        .header-actions {
            display: flex;
            gap: var(--header-gap);
            align-items: center;
            -webkit-app-region: no-drag;
        }

        .header-actions span {
            font-size: var(--header-font-size-small);
            color: var(--text-secondary);
        }

        .button {
            background: transparent;
            color: var(--text-primary);
            border: 1px solid var(--border);
            padding: var(--header-button-padding);
            border-radius: 3px;
            font-size: var(--header-font-size-small);
            font-weight: 500;
            transition: background 0.1s ease;
        }

        .button:hover {
            background: var(--hover-background);
        }

        .icon-button {
            background: transparent;
            color: var(--text-secondary);
            border: none;
            padding: var(--header-icon-padding);
            border-radius: 3px;
            font-size: var(--header-font-size-small);
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.1s ease;
        }

        .icon {
            font-family: 'Material Symbols Rounded';
            font-weight: normal;
            font-style: normal;
            line-height: 1;
            font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            user-select: none;
        }

        .icon-button .icon {
            font-size: var(--icon-size, 16px);
        }

        .icon-button:hover {
            background: var(--hover-background);
            color: var(--text-primary);
        }

        :host([isclickthrough]) .button:hover,
        :host([isclickthrough]) .icon-button:hover {
            background: transparent;
        }

        .key {
            background: var(--key-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-family: var(--font-mono);
        }

        .click-through-indicator {
            font-size: 10px;
            color: var(--text-muted);
            background: var(--key-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--font-mono);
        }

        .update-button {
            background: transparent;
            color: #f14c4c;
            border: 1px solid #f14c4c;
            padding: var(--header-button-padding);
            border-radius: 3px;
            font-size: var(--header-font-size-small);
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.1s ease;
        }

        .update-button .icon {
            font-size: 16px;
        }

        .update-button:hover {
            background: rgba(241, 76, 76, 0.1);
        }
    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        onCustomizeClick: { type: Function },
        onHelpClick: { type: Function },
        onHistoryClick: { type: Function },
        onCloseClick: { type: Function },
        onBackClick: { type: Function },
        onHideToggleClick: { type: Function },
        isClickThrough: { type: Boolean, reflect: true },
        updateAvailable: { type: Boolean },
    };

    constructor() {
        super();
        this.currentView = 'main';
        this.statusText = '';
        this.startTime = null;
        this.onCustomizeClick = () => {};
        this.onHelpClick = () => {};
        this.onHistoryClick = () => {};
        this.onCloseClick = () => {};
        this.onBackClick = () => {};
        this.onHideToggleClick = () => {};
        this.isClickThrough = false;
        this.updateAvailable = false;
        this._timerInterval = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._startTimer();
        this._checkForUpdates();
    }

    async _checkForUpdates() {
        try {
            const currentVersion = await hintio.getVersion();
            const response = await fetch('https://raw.githubusercontent.com/sohzm/hintio/refs/heads/master/package.json');
            if (!response.ok) return;

            const remotePackage = await response.json();
            const remoteVersion = remotePackage.version;

            if (this._isNewerVersion(remoteVersion, currentVersion)) {
                this.updateAvailable = true;
            }
        } catch (err) {
            console.log('Update check failed:', err.message);
        }
    }

    _isNewerVersion(remote, current) {
        const remoteParts = remote.split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < Math.max(remoteParts.length, currentParts.length); i++) {
            const r = remoteParts[i] || 0;
            const c = currentParts[i] || 0;
            if (r > c) return true;
            if (r < c) return false;
        }
        return false;
    }

    async _openUpdatePage() {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('open-external', 'https://hintio.com');
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopTimer();
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // Start/stop timer based on view change
        if (changedProperties.has('currentView')) {
            if (this.currentView === 'assistant' && this.startTime) {
                this._startTimer();
            } else {
                this._stopTimer();
            }
        }

        // Start timer when startTime is set
        if (changedProperties.has('startTime')) {
            if (this.startTime && this.currentView === 'assistant') {
                this._startTimer();
            } else if (!this.startTime) {
                this._stopTimer();
            }
        }
    }

    _startTimer() {
        // Clear any existing timer
        this._stopTimer();

        // Only start timer if we're in assistant view and have a start time
        if (this.currentView === 'assistant' && this.startTime) {
            this._timerInterval = setInterval(() => {
                // Trigger a re-render by requesting an update
                this.requestUpdate();
            }, 1000); // Update every second
        }
    }

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    getViewTitle() {
        const titles = {
            onboarding: 'Welcome to Hintio',
            main: 'Hintio',
            customize: 'Customize',
            help: 'Help & Shortcuts',
            history: 'Conversation History',
            advanced: 'Advanced Tools',
            assistant: 'Hintio',
        };
        return titles[this.currentView] || 'Hintio';
    }

    getElapsedTime() {
        if (this.currentView === 'assistant' && this.startTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            if (elapsed >= 60) {
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                return `${minutes}m ${seconds}s`;
            }
            return `${elapsed}s`;
        }
        return '';
    }

    isNavigationView() {
        const navigationViews = ['customize', 'help', 'history', 'advanced'];
        return navigationViews.includes(this.currentView);
    }

    render() {
        const elapsedTime = this.getElapsedTime();

        return html`
            <div class="header">
                <div class="header-title">${this.getViewTitle()}</div>
                <div class="header-actions">
                    ${this.currentView === 'assistant'
                        ? html`
                              <span>${elapsedTime}</span>
                              <span>${this.statusText}</span>
                              ${this.isClickThrough ? html`<span class="click-through-indicator">click-through</span>` : ''}
                          `
                        : ''}
                    ${this.currentView === 'main'
                        ? html`
                              ${this.updateAvailable ? html`
                                  <button class="update-button" @click=${this._openUpdatePage}>
                                      <span class="icon">download</span>
                                      Update available
                                  </button>
                              ` : ''}
                              <button class="icon-button" @click=${this.onHistoryClick}>
                                  <span class="icon">history</span>
                              </button>
                              <button class="icon-button" @click=${this.onCustomizeClick}>
                                  <span class="icon">tune</span>
                              </button>
                              <button class="icon-button" @click=${this.onHelpClick}>
                                  <span class="icon">help</span>
                              </button>
                          `
                        : ''}
                    ${this.currentView === 'assistant'
                        ? html`
                              <button @click=${this.onHideToggleClick} class="button">
                                  Hide&nbsp;&nbsp;<span class="key" style="pointer-events: none;">${hintio.isMacOS ? 'Cmd' : 'Ctrl'}</span
                                  >&nbsp;&nbsp;<span class="key">&bsol;</span>
                              </button>
                              <button @click=${this.onCloseClick} class="icon-button window-close">
                                  <span class="icon">close</span>
                              </button>
                          `
                        : html`
                              <button @click=${this.isNavigationView() ? this.onBackClick : this.onCloseClick} class="icon-button window-close">
                                  <span class="icon">close</span>
                              </button>
                          `}
                </div>
            </div>
        `;
    }
}

customElements.define('app-header', AppHeader);
