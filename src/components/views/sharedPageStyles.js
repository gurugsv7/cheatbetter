import { css } from '../../assets/lit-core-2.7.4.min.js';

export const unifiedPageStyles = css`
    * {
        box-sizing: border-box;
        font-family: var(--font);
        cursor: default;
        user-select: none;
    }

    :host {
        display: block;
        height: auto;
        min-height: 100%;
    }

    /* ── Futuristic animated keyframes ── */

    @keyframes grid-pan {
        0% { background-position: 0 0; }
        100% { background-position: 40px 40px; }
    }

    @keyframes border-glow-pulse {
        0%, 100% { box-shadow: 0 0 8px rgba(0, 212, 255, 0.15), inset 0 0 8px rgba(0, 212, 255, 0.04); }
        50%       { box-shadow: 0 0 18px rgba(0, 212, 255, 0.3),  inset 0 0 14px rgba(0, 212, 255, 0.08); }
    }

    @keyframes scan-line {
        0%   { top: -4px; opacity: 0.6; }
        100% { top: 100%; opacity: 0; }
    }

    @keyframes title-flicker {
        0%, 95%, 100% { opacity: 1; }
        96% { opacity: 0.85; }
        97% { opacity: 1; }
        98% { opacity: 0.9; }
    }

    @keyframes corner-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
    }

    @keyframes fade-up {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Page shell ── */

    .unified-page {
        height: auto;
        min-height: 100%;
        overflow-y: auto;
        padding: var(--space-lg);
        background: var(--bg-app);
        position: relative;
        /* Subtle dot-grid overlay */
        background-image:
            radial-gradient(circle, rgba(0, 212, 255, 0.06) 1px, transparent 1px);
        background-size: 24px 24px;
        animation: grid-pan 12s linear infinite;
    }

    .unified-page::before {
        content: '';
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
            linear-gradient(180deg, rgba(0,212,255,0.03) 0%, transparent 30%),
            linear-gradient(0deg,   rgba(127,90,240,0.03) 0%, transparent 30%);
        z-index: 0;
    }

    .unified-wrap {
        width: 100%;
        max-width: 1160px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        position: relative;
        z-index: 1;
        animation: fade-up 0.35s ease both;
    }

    /* ── Page header ── */

    .page-title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        background: linear-gradient(90deg, #e8e8e8 0%, #00d4ff 60%, #7f5af0 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 4px;
        letter-spacing: -0.02em;
        animation: title-flicker 8s ease-in-out infinite;
    }

    .page-subtitle {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
        font-family: var(--font-mono);
        letter-spacing: 0.02em;
    }

    /* ── Surface cards ── */

    .surface {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(0, 212, 255, 0.18);
        border-radius: var(--radius-md);
        background: rgba(17, 17, 17, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        padding: var(--space-md);
        animation: border-glow-pulse 4s ease-in-out infinite;
        transition: border-color 0.25s, box-shadow 0.25s;
    }

    .surface:hover {
        border-color: rgba(0, 212, 255, 0.35);
        box-shadow: 0 0 24px rgba(0, 212, 255, 0.12), 0 4px 40px rgba(0,0,0,0.4);
        animation: none;
    }

    /* Scan line sweep on hover */
    .surface::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent);
        top: -4px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .surface:hover::after {
        animation: scan-line 1.4s ease-in-out;
        opacity: 0.7;
    }

    /* Corner accent */
    .surface::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 32px;
        height: 32px;
        border-top: 2px solid rgba(0, 212, 255, 0.45);
        border-left: 2px solid rgba(0, 212, 255, 0.45);
        border-radius: var(--radius-md) 0 0 0;
        pointer-events: none;
    }

    .surface-title {
        color: #e8e8e8;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 4px;
        font-family: var(--font-mono);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .surface-title::before {
        content: '//';
        color: rgba(0, 212, 255, 0.55);
        font-size: 10px;
    }

    .surface-subtitle {
        color: var(--text-muted);
        font-size: var(--font-size-xs);
        margin-bottom: var(--space-md);
        font-family: var(--font-mono);
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
        color: rgba(0, 212, 255, 0.75);
        font-size: 10px;
        font-family: var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .form-help {
        color: var(--text-muted);
        font-size: var(--font-size-xs);
        line-height: 1.4;
        font-family: var(--font-mono);
    }

    /* ── Inputs & Selects ── */

    .control {
        width: 200px;
        background: rgba(25, 25, 25, 0.9);
        color: var(--text-primary);
        border: 1px solid rgba(0, 212, 255, 0.2);
        border-radius: var(--radius-sm);
        padding: 8px 12px;
        font-size: var(--font-size-sm);
        transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        font-family: var(--font);
    }

    .control:hover:not(:focus) {
        border-color: rgba(0, 212, 255, 0.4);
        background: rgba(30, 30, 30, 0.95);
    }

    .control:focus {
        outline: none;
        border-color: rgba(0, 212, 255, 0.8);
        box-shadow: 0 0 0 1px rgba(0,212,255,0.3), 0 0 12px rgba(0,212,255,0.15);
        background: rgba(0, 20, 30, 0.9);
    }

    select.control {
        appearance: none;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2300d4ff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
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
        line-height: 1.45;
        font-family: var(--font-mono);
        font-size: var(--font-size-xs);
        color: rgba(0, 212, 255, 0.9);
    }

    textarea.control::placeholder {
        color: rgba(0, 212, 255, 0.25);
    }

    /* ── Chip / Pill ── */

    .chip {
        display: inline-flex;
        align-items: center;
        border-radius: var(--radius-sm);
        background: rgba(0, 212, 255, 0.08);
        border: 1px solid rgba(0, 212, 255, 0.2);
        color: rgba(0, 212, 255, 0.8);
        padding: 2px 8px;
        font-size: var(--font-size-xs);
        font-family: var(--font-mono);
    }

    .pill {
        border: 1px solid rgba(0, 212, 255, 0.2);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: var(--font-size-xs);
        color: rgba(0, 212, 255, 0.55);
        font-family: var(--font-mono);
    }

    .muted { color: var(--text-muted); }
    .danger { color: var(--danger); }

    /* ── Scrollbar ── */

    .unified-page::-webkit-scrollbar { width: 4px; }
    .unified-page::-webkit-scrollbar-track { background: transparent; }
    .unified-page::-webkit-scrollbar-thumb {
        background: rgba(0, 212, 255, 0.2);
        border-radius: 2px;
    }
    .unified-page::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 212, 255, 0.4);
    }

    @media (max-width: 640px) {
        .unified-page { padding: var(--space-md); }
    }
`;
