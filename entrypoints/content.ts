// filepath: entrypoints/content.ts
// Classroom Quick Downloader - content script (single-file buttons only)
//
// - Runs only on classroom.google.com
// - Injects Material-style download buttons on attachments
// - Each button has states: idle → loading → success/error → back to idle
//   * idle: circle + download icon
//   * loading: pill + spinner + "Downloading…"
//   * success: pill + ✅ + green background
//   * error: pill + ❌ + red background

const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;

/**
 * Material-style download icon (arrow down onto a bar),
 * delivered via data: URL to satisfy "icon from URL" requirement.
 */
const ICON_SVG_RAW = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
  <path d="M5 20h14v-2H5v2z"/>
  <path d="M11 4v8.17L8.41 9.59 7 11l5 5 5-5-1.41-1.41L13 12.17V4h-2z"/>
</svg>
`.trim();

const ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(ICON_SVG_RAW)}`;

const STYLE_ID = 'cqd-style';
const INJECTED_ATTR = 'data-cqd-injected';
const RESCAN_INTERVAL_MS = 2000;
const RESCAN_DEBOUNCE_MS = 250;

// Spinner diameter (in pixels) — tweak this to control loader size
const SPINNER_SIZE_PX = 16;

// Loading / feedback durations (ms)
const LOADING_MIN_MS = 600;
const FEEDBACK_SUCCESS_MS = 1500;
const FEEDBACK_ERROR_MS = 1400;

const DRIVE_ANCHOR_SELECTOR =
  'a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]';

const ATTACHMENT_CONTAINER_SELECTOR = [
  '.KlRXdf', // common attachment card
  '.z3vRcc', // chip-like attachment
  '.VfPpkd-aPP78e', // Material card wrapper
  '[data-drive-id]', // Drive attachment
  '[data-id][data-item-id]', // metadata blocks
].join(', ');

const DRIVE_URL_PATTERNS: RegExp[] = [
  /https:\/\/drive\.google\.com\/file\/d\//,
  /https:\/\/drive\.google\.com\/open\?/,
  /https:\/\/drive\.google\.com\/uc\?/,
  /https:\/\/classroom\.google\.com\/drive\//,
];

let scanTimeoutId: number | null = null;
let observer: MutationObserver | null = null;

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

/* -----------------------------------------------------
 * Environment / Page Checks
 * ---------------------------------------------------*/

function isGoogleClassroom(): boolean {
  if (typeof location === 'undefined') return false;
  if (location.hostname !== 'classroom.google.com') return false;
  return CLASSROOM_URL_PATTERN.test(location.href);
}

/* -----------------------------------------------------
 * Style Injection
 * ---------------------------------------------------*/

function injectStyles(): void {
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
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.22);
      cursor: pointer;
      transform: translateY(-50%) scale(1);
      will-change: transform, box-shadow, width, border-radius, padding-inline;
      transition:
        width 220ms cubic-bezier(0.2, 0, 0, 1),
        padding-inline 220ms cubic-bezier(0.2, 0, 0, 1),
        border-radius 220ms cubic-bezier(0.2, 0, 0, 1),
        box-shadow 220ms cubic-bezier(0.2, 0, 0, 1),
        transform 220ms cubic-bezier(0.2, 0, 0, 1),
        background-color 220ms cubic-bezier(0.2, 0, 0, 1);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
    }

    .cqd-download-btn:hover {
      width: 120px;
      padding-inline: 12px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.30);
      justify-content: flex-start;
      transform: translateY(calc(-50% - 1px)) scale(1.04);
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
        opacity 200ms cubic-bezier(0.2, 0, 0, 1),
        max-width 200ms cubic-bezier(0.2, 0, 0, 1),
        margin-left 200ms cubic-bezier(0.2, 0, 0, 1);
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
      background-image: url("${ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.35));
      flex-shrink: 0;
      transform-origin: center;
      transition:
        width 200ms cubic-bezier(0.2, 0, 0, 1),
        height 200ms cubic-bezier(0.2, 0, 0, 1),
        border-width 200ms cubic-bezier(0.2, 0, 0, 1);
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
      width: 140px;
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
      cursor: default;
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
      width: 140px;
      padding-inline: 12px;
      border-radius: 20px;
      transform: translateY(-50%) scale(1);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
    }

    .cqd-download-btn.cqd-loading:active,
    .cqd-download-btn.cqd-success:active,
    .cqd-download-btn.cqd-error:active {
      transform: translateY(-50%) scale(1);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
    }

    /* Material-like circular spinner: arc on a circle, rotating.
       The diameter is controlled by SPINNER_SIZE_PX. */
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
      animation: cqd-spin 0.9s linear infinite;
    }

    @keyframes cqd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Success / error icons using emoji, no background image */
    .cqd-icon-check,
    .cqd-icon-cross {
      background-image: none;
      width: 18px;
      height: 18px;
      box-shadow: none;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cqd-icon-cross {
      font-size: 15px;
    }
  `.trim();

  (document.head || document.documentElement).appendChild(style);
}

/* -----------------------------------------------------
 * Scanning / Observers
 * ---------------------------------------------------*/

function scheduleScan(): void {
  if (scanTimeoutId !== null) {
    window.clearTimeout(scanTimeoutId);
  }
  scanTimeoutId = window.setTimeout(() => {
    scanTimeoutId = null;
    scanForAttachments();
  }, RESCAN_DEBOUNCE_MS);
}

function setupObservers(): void {
  if (typeof document === 'undefined') return;

  if (!document.body) {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        setupObservers();
      },
      { once: true },
    );
    return;
  }

  if (observer) return;

  observer = new MutationObserver((mutations) => {
    const hasChildListChange = mutations.some(
      (m) => m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0),
    );
    if (hasChildListChange) {
      scheduleScan();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.setInterval(() => {
    scheduleScan();
  }, RESCAN_INTERVAL_MS);

  scheduleScan();
}

/**
 * Main scan: inject single-file buttons.
 */
function scanForAttachments(): void {
  if (!isGoogleClassroom()) return;
  if (typeof document === 'undefined') return;

  injectSingleFileButtons();
}

/* -----------------------------------------------------
 * Single-file buttons
 * ---------------------------------------------------*/

function injectSingleFileButtons(): void {
  // Anchors with Drive URLs
  const anchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>(DRIVE_ANCHOR_SELECTOR),
  );

  for (const anchor of anchors) {
    const url = extractDriveUrlFromAnchor(anchor);
    if (!url) continue;

    const container =
      (anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) as HTMLElement | null) ||
      anchor.parentElement ||
      anchor;

    if (!container) continue;
    if (hasInjectedButton(container)) continue;

    injectButtonIntoAttachment(container, url);
  }

  // Elements with Drive metadata
  const metaElements = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]',
    ),
  );

  for (const el of metaElements) {
    if (hasInjectedButton(el)) continue;
    const url = findDriveUrl(el);
    if (!url) continue;

    injectButtonIntoAttachment(el, url);
  }
}

/* -----------------------------------------------------
 * URL / DOM Helpers
 * ---------------------------------------------------*/

function hasInjectedButton(container: HTMLElement): boolean {
  return !!container.querySelector(`[${INJECTED_ATTR}="true"]`);
}

function extractDriveUrlFromAnchor(anchor: HTMLAnchorElement): string | null {
  const href = anchor.href;
  if (!href) return null;
  const isDriveUrl = DRIVE_URL_PATTERNS.some((re) => re.test(href));
  return isDriveUrl ? href : null;
}

function findDriveUrl(element: HTMLElement): string | null {
  const nearAnchor =
    element.querySelector<HTMLAnchorElement>(DRIVE_ANCHOR_SELECTOR) ||
    (element.closest(DRIVE_ANCHOR_SELECTOR) as HTMLAnchorElement | null);

  if (nearAnchor) {
    const href = extractDriveUrlFromAnchor(nearAnchor);
    if (href) return href;
  }

  const driveId = element.getAttribute('data-drive-id') || element.getAttribute('data-id');
  if (driveId) {
    const anchorWithId =
      document.querySelector<HTMLAnchorElement>(`a[data-drive-id="${driveId}"]`) ||
      document.querySelector<HTMLAnchorElement>(`a[data-id="${driveId}"]`) ||
      document.querySelector<HTMLAnchorElement>(`a[href*="${driveId}"]`);

    if (anchorWithId) {
      const href = extractDriveUrlFromAnchor(anchorWithId);
      if (href) return href;
    }

    // Fallback: best-effort direct download URL from Drive ID
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
  }

  return null;
}

/**
 * Convert any view / classroom-proxy URL to a direct download URL when possible.
 */
function toDownloadUrl(originalUrl: string, depth = 0): string {
  if (depth > 3) return originalUrl;

  try {
    const parsed = new URL(originalUrl, location.href);
    const hostname = parsed.hostname;
    const pathname = parsed.pathname;

    if (hostname === 'drive.google.com') {
      // auth_warmup unwrapping
      if (pathname.startsWith('/auth_warmup')) {
        const cont = parsed.searchParams.get('continue');
        if (cont) return toDownloadUrl(cont, depth + 1);

        const id = parsed.searchParams.get('id');
        if (id) {
          return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
        }
        return originalUrl;
      }

      const fileMatch = pathname.match(/^\/file\/d\/([^/]+)/);
      if (fileMatch) {
        const id = fileMatch[1];
        return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
      }

      if (pathname === '/open') {
        const id = parsed.searchParams.get('id');
        if (id) {
          return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
        }
      }

      if (pathname === '/uc') {
        parsed.searchParams.set('export', 'download');
        return parsed.toString();
      }
    }

    if (hostname === 'classroom.google.com' && pathname.startsWith('/drive')) {
      const id =
        parsed.searchParams.get('id') ||
        parsed.searchParams.get('resourceId') ||
        parsed.searchParams.get('fileId');
      if (id) {
        return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
      }
    }

    return originalUrl;
  } catch {
    return originalUrl;
  }
}

/* -----------------------------------------------------
 * Button injection
 * ---------------------------------------------------*/

function injectButtonIntoAttachment(container: HTMLElement, url: string): void {
  if (!url) return;

  const computed = window.getComputedStyle(container);
  if (computed.position === 'static') {
    container.style.position = 'relative';
  }

  const button = createDownloadButton(url);

  const iconEl = button.querySelector<HTMLElement>('.cqd-download-icon');
  if (iconEl) {
    iconEl.classList.add('cqd-icon-medium');
  }

  container.appendChild(button);
}

/* -----------------------------------------------------
 * Button state helpers
 * ---------------------------------------------------*/

function getButtonState(button: HTMLButtonElement): ButtonState {
  if (button.classList.contains('cqd-loading')) return 'loading';
  if (button.classList.contains('cqd-success')) return 'success';
  if (button.classList.contains('cqd-error')) return 'error';
  return 'idle';
}

function setButtonState(button: HTMLButtonElement, state: ButtonState): void {
  const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
  const label = button.querySelector<HTMLSpanElement>('.cqd-label');
  if (!icon || !label) return;

  // Reset all state classes / styles
  button.classList.remove('cqd-loading', 'cqd-success', 'cqd-error');
  icon.classList.remove('cqd-spinner', 'cqd-icon-check', 'cqd-icon-cross');
  icon.textContent = '';
  button.disabled = false;
  button.style.backgroundColor = '#1a73e8';
  label.textContent = 'Download';

  switch (state) {
    case 'idle':
      // default circle + download icon via background-image
      break;

    case 'loading':
      button.classList.add('cqd-loading');
      button.disabled = true;
      label.textContent = 'Downloading…';
      icon.classList.add('cqd-spinner');
      break;

    case 'success':
      button.classList.add('cqd-success');
      button.style.backgroundColor = '#188038'; // Google green
      label.textContent = 'Downloaded';
      icon.classList.add('cqd-icon-check');
      icon.textContent = '✅';
      break;

    case 'error':
      button.classList.add('cqd-error');
      button.style.backgroundColor = '#d93025'; // bright red
      label.textContent = 'Error';
      icon.classList.add('cqd-icon-cross');
      icon.textContent = '❌';
      break;
  }
}

/* -----------------------------------------------------
 * Button factory
 * ---------------------------------------------------*/

function createDownloadButton(url: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cqd-download-btn';
  button.setAttribute(INJECTED_ATTR, 'true');
  button.setAttribute('aria-label', 'Quick download attachment');
  button.setAttribute('title', 'Quick download');

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'cqd-icon-wrapper';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'cqd-download-icon';
  iconWrapper.appendChild(iconSpan);

  const label = document.createElement('span');
  label.className = 'cqd-label';
  label.textContent = 'Download';

  button.appendChild(iconWrapper);
  button.appendChild(label);

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await handleSingleDownloadClick(button, url);
  });

  button.addEventListener('auxclick', async (event) => {
    if (event.button !== 1) return; // middle-click only
    event.preventDefault();
    event.stopPropagation();
    await handleSingleDownloadClick(button, url);
  });

  return button;
}

/* -----------------------------------------------------
 * Single download flow with states
 * ---------------------------------------------------*/

async function handleSingleDownloadClick(
  button: HTMLButtonElement,
  url: string,
): Promise<void> {
  if (!url) return;
  if (getButtonState(button) === 'loading') return;

  setButtonState(button, 'loading');
  const start = Date.now();

  const ok = await downloadFile(url);

  const elapsed = Date.now() - start;
  if (elapsed < LOADING_MIN_MS) {
    await delay(LOADING_MIN_MS - elapsed);
  }

  if (ok) {
    setButtonState(button, 'success');
    await delay(FEEDBACK_SUCCESS_MS);
  } else {
    setButtonState(button, 'error');
    await delay(FEEDBACK_ERROR_MS);
  }

  setButtonState(button, 'idle');
}

/* -----------------------------------------------------
 * Download logic (background + fallback)
 * ---------------------------------------------------*/

function downloadFile(rawUrl: string): Promise<boolean> {
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return Promise.resolve(false);

  const finalUrl = toDownloadUrl(rawUrl);

  // Offline? we know this will likely fail.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.resolve(false);
  }

  // If we somehow still have auth_warmup at this point, treat as failure.
  if (/https:\/\/drive\.google\.com\/auth_warmup/.test(finalUrl)) {
    return Promise.resolve(false);
  }

  const hasChromeRuntime =
    typeof chrome !== 'undefined' &&
    !!chrome.runtime &&
    typeof chrome.runtime.sendMessage === 'function';

  if (hasChromeRuntime) {
    return new Promise<boolean>((resolve) => {
      let resolved = false;

      try {
        chrome.runtime.sendMessage(
          { type: 'CQD_DOWNLOAD', url: finalUrl },
          (response?: { ok?: boolean; error?: string }) => {
            const err = chrome.runtime.lastError;
            if (err) {
              console.warn('[CQD] sendMessage error:', err.message);
              fallbackAnchorDownload(finalUrl);
              if (!resolved) {
                resolved = true;
                resolve(true);
              }
              return;
            }

            if (!response || response.ok === false) {
              if (response?.error) {
                console.warn('[CQD] background download error:', response.error);
              }
              fallbackAnchorDownload(finalUrl);
              if (!resolved) {
                resolved = true;
                resolve(true);
              }
              return;
            }

            if (!resolved) {
              resolved = true;
              resolve(true);
            }
          },
        );

        // Safety timeout: if background never responds, fallback + resolve.
        window.setTimeout(() => {
          if (!resolved) {
            fallbackAnchorDownload(finalUrl);
            resolved = true;
            resolve(true);
          }
        }, 4000);
      } catch (e) {
        console.warn('[CQD] sendMessage threw:', e);
        fallbackAnchorDownload(finalUrl);
        if (!resolved) resolve(true);
      }
    });
  }

  // No background available: just open anchor in new tab; treat as success.
  fallbackAnchorDownload(finalUrl);
  return Promise.resolve(true);
}

/**
 * Fallback: synthetic anchor click (may open tab, but still downloads).
 */
function fallbackAnchorDownload(url: string): void {
  if (typeof document === 'undefined') return;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    anchor.remove();
  }, 0);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/* -----------------------------------------------------
 * Init
 * ---------------------------------------------------*/

function initContentScript(): void {
  if (!isGoogleClassroom()) return;
  injectStyles();
  setupObservers();
}

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    initContentScript();
  },
});
