const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;

const ICON_SVG_RAW = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
  <path d="M5 20h14v-2H5v2z"/>
  <path d="M11 4v8.17L8.41 9.59 7 11l5 5 5-5-1.41-1.41L13 12.17V4h-2z"/>
</svg>
`.trim();

const ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(ICON_SVG_RAW)}`;

const STYLE_ID = "cqd-style";
const INJECTED_ATTR = "data-cqd-injected";
const RESCAN_INTERVAL_MS = 2000;
const RESCAN_DEBOUNCE_MS = 250;

// Spinner diameter (in pixels) — tweak this to change loader size
const SPINNER_SIZE_PX = 16;

const DRIVE_ANCHOR_SELECTOR =
  'a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]';

const ATTACHMENT_CONTAINER_SELECTOR = [
  ".KlRXdf", // common attachment card
  ".z3vRcc", // chip-like attachment
  ".VfPpkd-aPP78e", // Material card wrapper
  "[data-drive-id]", // Drive attachment
  "[data-id][data-item-id]", // metadata blocks
].join(", ");

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
  if (typeof location === "undefined") return false;
  if (location.hostname !== "classroom.google.com") return false;
  return CLASSROOM_URL_PATTERN.test(location.href);
}

/* -----------------------------------------------------
 * Style Injection
 * ---------------------------------------------------*/

function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* CARD / ATTACHMENT BUTTONS */
    .cqd-download-btn {
      position: absolute;
      top: 50%;               /* vertical center of attachment card */
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
      width: 120px; /* pill */
      padding-inline: 12px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.30);
      justify-content: flex-start;
      transform: translateY(calc(-50% - 1px)) scale(1.04); /* subtle lift + scale */
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

    /* Loading state: pill expanded, label always visible, spinner replaces icon.
       Width is fixed so transitions between normal/pill/loading all interpolate smoothly. */
    .cqd-download-btn.cqd-loading {
      width: 140px;
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
      cursor: default;
    }

    .cqd-download-btn.cqd-loading .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-loading:hover {
      /* Keep it stable while "loading" */
      width: 140px;
      padding-inline: 12px;
      border-radius: 20px;
      transform: translateY(-50%) scale(1);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
    }

    .cqd-download-btn.cqd-loading:active {
      transform: translateY(-50%) scale(1);
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
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
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
  if (typeof document === "undefined") return;

  if (!document.body) {
    window.addEventListener(
      "DOMContentLoaded",
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
      (m) => m.type === "childList" && (m.addedNodes.length > 0 || m.removedNodes.length > 0),
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
 * Main scan: attachments only.
 */
function scanForAttachments(): void {
  if (!isGoogleClassroom()) return;
  if (typeof document === "undefined") return;

  // 1. Attachment cards / chips with direct anchors
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

  // 2. Elements with Drive metadata (data-drive-id, etc.)
  const metaElements = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]",
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

  const driveId = element.getAttribute("data-drive-id") || element.getAttribute("data-id");
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

    if (hostname === "drive.google.com") {
      // auth_warmup unwrapping
      if (pathname.startsWith("/auth_warmup")) {
        const cont = parsed.searchParams.get("continue");
        if (cont) return toDownloadUrl(cont, depth + 1);

        const id = parsed.searchParams.get("id");
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

      if (pathname === "/open") {
        const id = parsed.searchParams.get("id");
        if (id) {
          return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
        }
      }

      if (pathname === "/uc") {
        parsed.searchParams.set("export", "download");
        return parsed.toString();
      }
    }

    if (hostname === "classroom.google.com" && pathname.startsWith("/drive")) {
      const id =
        parsed.searchParams.get("id") ||
        parsed.searchParams.get("resourceId") ||
        parsed.searchParams.get("fileId");
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
 * Button Injection
 * ---------------------------------------------------*/

function injectButtonIntoAttachment(container: HTMLElement, url: string): void {
  if (!url) return;

  const computed = window.getComputedStyle(container);
  if (computed.position === "static") {
    container.style.position = "relative";
  }

  const button = createDownloadButton(url);

  const iconEl = button.querySelector<HTMLElement>(".cqd-download-icon");
  if (iconEl) {
    iconEl.classList.add("cqd-icon-medium");
  }

  container.appendChild(button);
}

/* -----------------------------------------------------
 * Loading state helper
 * ---------------------------------------------------*/

function setButtonLoading(button: HTMLButtonElement, loading: boolean): void {
  const label = button.querySelector<HTMLSpanElement>(".cqd-label");
  const icon = button.querySelector<HTMLElement>(".cqd-download-icon");

  if (loading) {
    button.classList.add("cqd-loading");
    button.disabled = true;
    if (label) label.textContent = "Downloading…";
    if (icon) {
      icon.classList.add("cqd-spinner");
    }
  } else {
    button.classList.remove("cqd-loading");
    button.disabled = false;
    if (label) label.textContent = "Download";
    if (icon) {
      icon.classList.remove("cqd-spinner");
    }
  }
}

/* -----------------------------------------------------
 * Button factory
 * ---------------------------------------------------*/

function createDownloadButton(url: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cqd-download-btn";
  button.setAttribute(INJECTED_ATTR, "true");
  button.setAttribute("aria-label", "Quick download attachment");
  button.setAttribute("title", "Quick download");

  const iconWrapper = document.createElement("span");
  iconWrapper.className = "cqd-icon-wrapper";

  const iconSpan = document.createElement("span");
  iconSpan.className = "cqd-download-icon";
  iconWrapper.appendChild(iconSpan);

  const label = document.createElement("span");
  label.className = "cqd-label";
  label.textContent = "Download";

  button.appendChild(iconWrapper);
  button.appendChild(label);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    downloadFile(url, button);
  });

  button.addEventListener("auxclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button === 1) {
      downloadFile(url, button);
    }
  });

  return button;
}

/* -----------------------------------------------------
 * Download Logic
 *   - Prefer background via chrome.downloads (service worker)
 *   - Fallback: synthetic <a> click (opens tab)
 *   - Shows a "loading" state on the button while sending the request
 * ---------------------------------------------------*/

function downloadFile(rawUrl: string, button?: HTMLButtonElement): void {
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return;

  const finalUrl = toDownloadUrl(rawUrl);

  // Enter loading state immediately (regardless of hover)
  if (button) {
    setButtonLoading(button, true);
  }

  if (/https:\/\/drive\.google\.com\/auth_warmup/.test(finalUrl)) {
    if (button) setButtonLoading(button, false);
    return;
  }

  const hasChromeRuntime =
    typeof chrome !== "undefined" &&
    !!chrome.runtime &&
    typeof chrome.runtime.sendMessage === "function";

  if (hasChromeRuntime) {
    let responded = false;

    try {
      chrome.runtime.sendMessage(
        { type: "CQD_DOWNLOAD", url: finalUrl },
        (response?: { ok?: boolean; error?: string }) => {
          responded = true;
          const err = chrome.runtime.lastError;
          if (err) {
            console.warn("[CQD] sendMessage error:", err.message);
            fallbackAnchorDownload(finalUrl, button);
            return;
          }

          if (!response || response.ok === false) {
            if (response?.error) {
              console.warn("[CQD] background download error:", response.error);
            }
            fallbackAnchorDownload(finalUrl, button);
            return;
          }

          // Background accepted the download request; end loading state.
          if (button) {
            setButtonLoading(button, false);
          }
        },
      );

      // Safety: if background never responds, clear loading after a few seconds
      if (button) {
        window.setTimeout(() => {
          if (!responded) {
            setButtonLoading(button, false);
          }
        }, 4000);
      }

      return;
    } catch (e) {
      console.warn("[CQD] sendMessage threw:", e);
      fallbackAnchorDownload(finalUrl, button);
      return;
    }
  }

  // If no chrome.runtime, fallback directly
  fallbackAnchorDownload(finalUrl, button);
}

/**
 * Fallback: synthetic anchor click (may open tab, but still downloads).
 * End loading state immediately after triggering the click.
 */
function fallbackAnchorDownload(url: string, button?: HTMLButtonElement): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    anchor.remove();
    if (button) {
      setButtonLoading(button, false);
    }
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
  matches: ["https://classroom.google.com/*"],
  runAt: "document_idle",
  main() {
    initContentScript();
  },
});
