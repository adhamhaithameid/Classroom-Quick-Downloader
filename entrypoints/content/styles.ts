// filepath: entrypoints/content/styles.ts
import { DOWNLOAD_ICON_SVG_URL } from './icons';

const STYLE_ID = 'cqd-style';
const SPINNER_SIZE_PX = 16;

// Shorter durations for snappier feel (~120–144ms)
const TRANSITION_MS = 150;

export function injectStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* SINGLE ATTACHMENT BUTTONS (circle -> pill on hover) */
    .cqd-download-btn {
      position: absolute;
      top: 50%;
      right: 8px;
      z-index: 5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 40px;
      width: 40px;
      max-width: calc(100% - 16px);
      border-radius: 9999px;
      border: none;
      padding: 0;
      background-color: #1a73e8;
      color: #ffffff;
      box-shadow: 0 0px 10px rgba(15, 23, 42, 0.22);
      cursor: pointer;
      transform: translateY(-50%) scale(1);
      will-change: transform, box-shadow, width, border-radius, padding-inline;
      transition:
        width ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1),
        padding-inline ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1),
        border-radius ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1),
        box-shadow ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1),
        transform ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1),
        background-color ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
    }

    .cqd-download-btn:hover {
      width: 120px;
      padding-inline: 12px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.30);
      justify-content: flex-start;
      transform: translateY(calc(-50% - 1px)) scale(1);
      border-radius: 20px;
    }

    .cqd-download-btn:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }

    .cqd-download-btn:active {
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3);
      transform: translateY(-50%) scale(0.97);
    }

    .cqd-download-btn .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition:
        opacity ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1),
        max-width ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1),
        margin-left ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1);
    }

    .cqd-download-btn:hover .cqd-label {
      opacity: 1;
      max-width: 100px;
      margin-left: 6px;
    }

    .cqd-download-btn .cqd-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cqd-download-icon {
      display: block;
      width: 24px;
      height: 24px;
      background-image: url("${DOWNLOAD_ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      flex-shrink: 0;
      transform-origin: center;
      transition:
        width ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1),
        height ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1),
        border-width ${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1);
    }

    .cqd-icon-small {
      width: 16px;
      height: 16px;
      background-size: 16px 16px;
    }

    .cqd-icon-medium {
      width: 24px;
      height: 24px;
      background-size: 24px 24px;
    }

    .cqd-icon-large {
      width: 32px;
      height: 32px;
      background-size: 32px 32px;
    }

    /* PILL STATES (loading / success / error) */
    .cqd-download-btn.cqd-loading,
    .cqd-download-btn.cqd-success,
    .cqd-download-btn.cqd-error {
      width: 150px;
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
      cursor: default;
    }

    .cqd-download-btn.cqd-success{
      width: 140px;
    }

    .cqd-download-btn.cqd-error {
      width: 90px;
    }

    .cqd-download-btn.cqd-loading .cqd-label,
    .cqd-download-btn.cqd-success .cqd-label,
    .cqd-download-btn.cqd-error .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-loading:hover,
    .cqd-download-btn.cqd-success:hover,
    .cqd-download-btn.cqd-error:hover {
      width: 150px;
      padding-inline: 12px;
      border-radius: 20px;
      transform: translateY(-50%) scale(1);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
    }

        .cqd-download-btn.cqd-success:hover{
        width: 140px;
        }

    .cqd-download-btn.cqd-error:hover {
      width: 90px;}

    .cqd-download-btn.cqd-loading:active,
    .cqd-download-btn.cqd-success:active,
    .cqd-download-btn.cqd-error:active {
      transform: translateY(-50%) scale(1);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
    }

    /* Spinner: circular arc on a circle, rotating. */
    .cqd-spinner {
      background-image: none;
      border-radius: 9999px;
      width: ${SPINNER_SIZE_PX}px;
      height: ${SPINNER_SIZE_PX}px;
      border-style: solid;
      border-width: 3px;
      border-color: rgba(255, 255, 255, 0.22);
      border-top-color: #ffffff;
      border-right-color: #ffffff;
      box-shadow: none;
      animation: cqd-spin 0.65s linear infinite;
    }

    @keyframes cqd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `.trim();

  (document.head || document.documentElement).appendChild(style);
}
