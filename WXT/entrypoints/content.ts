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
    .cqd-download-btn {
      position: absolute;
      top: 8px;
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
      /* Realistic default elevation: soft, slightly offset shadow */
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.22);
      cursor: pointer;
      transition:
        width 180ms ease,
        border-radius 180ms ease,
        box-shadow 180ms ease,
        background-color 180ms ease,
        transform 120ms ease;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
    }

    /* Card pill state on hover: higher, softer shadow like lifting up */
    .cqd-download-btn:hover {
      width: 120px; /* pill */
      padding-inline: 12px;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.28);
      justify-content: flex-start;
      transform: translateY(-1px);

      border-radius: 20px; /* <-- smooth pill shadow */
    }

    .cqd-download-btn:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }

    /* Active: pressed state, shadow tighter and closer to button */
    .cqd-download-btn:active {
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3);
      transform: translateY(0);
    }

    .cqd-download-btn .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition:
        opacity 160ms ease,
        max-width 160ms ease,
        margin-left 160ms ease;
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

    /* Icon drawn via background-image so layout can't corrupt it */
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

    /* Viewer pill: always pill-like, label visible even without hover */
    .cqd-viewer-btn {
      width: auto;
      min-width: 120px;
      padding-inline: 12px;
      justify-content: flex-start;
    }

    .cqd-viewer-btn .cqd-label {
      opacity: 1;
      max-width: 120px;
      margin-left: 6px;
    }

    .cqd-viewer-btn:hover {
      width: auto;
      padding-inline: 12px;
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

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  window.setInterval(() => {
    scheduleScan();
  }, RESCAN_INTERVAL_MS);

  scheduleScan();
}

/**
 * Main scan: attachments + viewer area.
 */
function scanForAttachments(): void {
  if (!isGoogleClassroom()) return;
  if (typeof document === 'undefined') return;

  // 1. Attachment cards / chips
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

  // 2. Viewer pill inside view state
  scanForViewerButtons();
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

    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
  }

  return null;
}

/**
 * Convert any view / preview / Classroom-Drive URL to a direct download URL when possible.
 */
function toDownloadUrl(originalUrl: string): string {
  try {
    const parsed = new URL(originalUrl, location.href);

    if (parsed.hostname === 'drive.google.com') {
      const fileMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
      if (fileMatch) {
        const id = fileMatch[1];
        return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
      }

      if (parsed.pathname === '/open') {
        const id = parsed.searchParams.get('id');
        if (id) {
          return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
        }
      }

      if (parsed.pathname === '/uc') {
        parsed.searchParams.set('export', 'download');
        return parsed.toString();
      }
    }

    if (parsed.hostname === 'classroom.google.com' && parsed.pathname.startsWith('/drive')) {
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
 * Button Injection (cards/chips)
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
    iconEl.classList.add('cqd-icon-medium'); // fixed crisp size
  }

  container.appendChild(button);
}

/**
 * Viewer buttons: add a pill inside the "view" state (file viewer).
 * Always pill, always label visible.
 */
function scanForViewerButtons(): void {
  const viewerIframes = Array.from(
    document.querySelectorAll<HTMLIFrameElement>(
      'iframe[src*="https://drive.google.com/file/"], iframe[src*="https://drive.google.com/uc"], iframe[src*="https://docs.google.com"]',
    ),
  );

  for (const iframe of viewerIframes) {
    const container =
      iframe.closest<HTMLElement>('.pco8Kc, .qq2eQd, .I9rrLb') || iframe.parentElement;
    if (!container) continue;
    if (hasInjectedButton(container)) continue;

    const src = iframe.src;
    if (!src) continue;

    const url = toDownloadUrl(src);
    injectViewerButton(container, url);
  }
}

function injectViewerButton(container: HTMLElement, url: string): void {
  if (!url) return;

  const computed = window.getComputedStyle(container);
  if (computed.position === 'static') {
    container.style.position = 'relative';
  }

  const button = createDownloadButton(url);
  button.classList.add('cqd-viewer-btn');

  const iconEl = button.querySelector<HTMLElement>('.cqd-download-icon');
  if (iconEl) {
    iconEl.classList.remove('cqd-icon-small', 'cqd-icon-large');
    iconEl.classList.add('cqd-icon-medium');
  }

  container.appendChild(button);
}

/**
 * Create the M3-style button (circle + hover pill).
 */
function createDownloadButton(url: string): HTMLElement {
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

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    downloadFile(url);
  });

  button.addEventListener('auxclick', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button === 1) {
      downloadFile(url);
    }
  });

  return button;
}

/* -----------------------------------------------------
 * Download Logic
 * ---------------------------------------------------*/

function downloadFile(url: string): void {
  if (!url || !/^https?:\/\//i.test(url)) return;

  const finalUrl = toDownloadUrl(url);

  const anchor = document.createElement('a');
  anchor.href = finalUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    anchor.remove();
  }, 0);
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
