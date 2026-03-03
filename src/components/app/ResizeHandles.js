import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class ResizeHandles extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 99999;
    }
    .handle {
      position: absolute;
      pointer-events: auto;
      background: var(--accent, #3B82F6);
      opacity: 0.7;
      border-radius: 2px;
      transition: opacity 0.15s;
    }
    .handle:hover {
      opacity: 1;
    }
    .handle-h {
      height: 8px;
      left: 0;
      right: 0;
      cursor: ns-resize;
    }
    .handle-v {
      width: 8px;
      top: 0;
      bottom: 0;
      cursor: ew-resize;
    }
    .handle-t { top: -4px; }
    .handle-b { bottom: -4px; }
    .handle-l { left: -4px; }
    .handle-r { right: -4px; }
    .handle-corner {
      width: 16px;
      height: 16px;
      z-index: 100000;
      background: var(--accent, #3B82F6);
      opacity: 0.9;
      cursor: nwse-resize;
    }
    .handle-tl { top: -8px; left: -8px; cursor: nwse-resize; }
    .handle-tr { top: -8px; right: -8px; cursor: nesw-resize; }
    .handle-bl { bottom: -8px; left: -8px; cursor: nesw-resize; }
    .handle-br { bottom: -8px; right: -8px; cursor: nwse-resize; }
  `;

  render() {
    return html`
      <div class="handle handle-h handle-t"></div>
      <div class="handle handle-h handle-b"></div>
      <div class="handle handle-v handle-l"></div>
      <div class="handle handle-v handle-r"></div>
      <div class="handle handle-corner handle-tl"></div>
      <div class="handle handle-corner handle-tr"></div>
      <div class="handle handle-corner handle-bl"></div>
      <div class="handle handle-corner handle-br"></div>
    `;
  }
}

customElements.define('resize-handles', ResizeHandles);
