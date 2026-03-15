import { css } from '../../assets/lit-core-2.7.4.min.js';

export const unifiedPageStyles = css`
    * {
        box-sizing: border-box;
        font-family: var(--font);
        cursor: default;
        user-select: none;
    }

    /* Re-declare tokens — CSS vars don't auto-inherit into shadow DOM */
    :host {
        --accent:         #6366F1;
        --accent-hover:   #4F46E5;
        --accent-subtle:  rgba(99, 102, 241, 0.08);
        --bg-app:         #09090B;
        --bg-surface:     #0F0F12;
        --bg-elevated:    #18181B;
        --bg-hover:       #1E1E24;
        --text-primary:   #FAFAFA;
        --text-secondary: #A1A1AA;
        --text-muted:     #52525B;
        --border:         #27272A;
        --border-strong:  #3F3F46;
        --success:        #22C55E;
        --danger:         #EF4444;
        --radius-sm:      6px;
        --radius-md:      10px;
        --radius-lg:      16px;
        --space-xs:       4px;
        --space-sm:       8px;
        --space-md:       16px;
        --space-lg:       24px;
        --transition:     160ms ease;
        --font:           'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        --font-mono:      'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
        --font-size-xs:   11px;
        --font-size-sm:   13px;
        --font-size-base: 14px;
        --font-size-lg:   16px;
        --font-size-xl:   20px;
        --font-weight-medium:    500;
        --font-weight-semibold:  600;
        --font-weight-bold:      700;

        display: block;
        height: 100%;
        min-height: 0;
    }

    /* ── Keyframes ── */

    @keyframes fade-up {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Page shell ── */

    .unified-page {
        height: 100%;
        min-height: 0;
        overflow-y: auto;
        padding: var(--space-lg);
        background: var(--bg-app);
        position: relative;
    }

    .unified-wrap {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        min-height: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        position: relative;
        z-index: 1;
        animation: fade-up 0.3s ease both;
    }

    /* ── Page header ── */

    .page-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin-bottom: 2px;
        letter-spacing: -0.02em;
    }

    .page-subtitle {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
    }

    /* ── Surface cards ── */

    .surface {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        padding: var(--space-md);
        transition: border-color var(--transition), box-shadow var(--transition);
    }

    .surface:hover {
        border-color: var(--border-strong);
        box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }

    .surface-title {
        color: var(--text-primary);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .surface-subtitle {
        color: var(--text-muted);
        font-size: var(--font-size-xs);
        margin-bottom: var(--space-md);
    }

    /* ── Form layout ── */

    .form-grid {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
    }

    .form-row {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
    }

    .form-group {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
    }

    .form-group.vertical {
        flex-direction: column;
        align-items: stretch;
    }

    .form-label {
        color: var(--text-secondary);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .form-help {
        color: var(--text-muted);
        font-size: var(--font-size-xs);
        line-height: 1.4;
    }

    /* ── Inputs & Selects ── */

    .control {
        width: 200px;
        background: var(--bg-elevated);
        color: var(--text-primary);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 8px 12px;
        font-size: var(--font-size-sm);
        transition: border-color var(--transition), box-shadow var(--transition);
        font-family: var(--font);
    }

    .control:hover:not(:focus) {
        border-color: var(--border-strong);
    }

    .control:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
    }

    select.control {
        appearance: none;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23A1A1AA' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
        background-position: right 8px center;
        background-repeat: no-repeat;
        background-size: 12px;
        padding-right: 28px;
        cursor: pointer;
    }

    textarea.control {
        width: 100%;
        min-height: 100px;
        resize: vertical;
        line-height: 1.5;
        font-size: var(--font-size-sm);
        color: var(--text-primary);
    }

    textarea.control::placeholder {
        color: var(--text-muted);
    }

    /* ── Chip / Pill ── */

    .chip {
        display: inline-flex;
        align-items: center;
        border-radius: var(--radius-sm);
        background: var(--accent-subtle);
        border: 1px solid rgba(99,102,241,0.25);
        color: var(--accent);
        padding: 2px 8px;
        font-size: var(--font-size-xs);
    }

    .pill {
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: var(--font-size-xs);
        color: var(--text-muted);
    }

    .muted { color: var(--text-muted); }
    .danger { color: var(--danger); }

    /* ── Scrollbar ── */

    .unified-page::-webkit-scrollbar { width: 4px; }
    .unified-page::-webkit-scrollbar-track { background: transparent; }
    .unified-page::-webkit-scrollbar-thumb {
        background: var(--border-strong);
        border-radius: 2px;
    }
    .unified-page::-webkit-scrollbar-thumb:hover {
        background: #52525B;
    }

    @media (max-width: 640px) {
        .unified-page { padding: var(--space-md); }
    }
`;
