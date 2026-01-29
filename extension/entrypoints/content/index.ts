// filepath: entrypoints/content/index.ts
const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;
import {
  DOWNLOAD_ICON_SVG_URL,
  SUCCESS_ICON_SVG_URL,
  ERROR_ICON_SVG_URL,
  CANCEL_ICON_SVG_URL,
} from './icons';
import { injectStyles } from './styles';
import { t } from './i18n';
import { isPageDark } from './theme';
import { subscribeToGlobalState } from './flags';
import { getCancelHoldDelayMs } from '../utils/analytics';

/* -----------------------------------------------------
 * Constants
 * ---------------------------------------------------*/
const INJECTED_ATTR = 'data-cqd-injected';
const PROCESSED_ATTR = 'data-cqd-processed';
const RESCAN_INTERVAL_MS = 2000;
// Reduced debounce to make buttons appear snappier after scroll
const RESCAN_DEBOUNCE_MS = 150; 
const LOADING_MIN_MS = 600;
const FEEDBACK_SUCCESS_MS = 3000;
const FEEDBACK_ERROR_MS = 4000;

const DRIVE_ANCHOR_SELECTOR =
  'a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]';

const ATTACHMENT_CONTAINER_SELECTOR = [
  '.KlRXdf',
  '.z3vRcc',
  '.VfPpkd-aPP78e',
  '[data-drive-id]',
  '[data-id][data-item-id]',
].join(', ');

const DRIVE_URL_PATTERNS: RegExp[] = [
  /https:\/\/drive\.google\.com\/file\/d\//,
  /https:\/\/drive\.google\.com\/open\?/,
  /https:\/\/drive\.google\.com\/uc\?/,
  /https:\/\/classroom\.google\.com\/drive\//,
];

/* -----------------------------------------------------
 * Global State
 * ---------------------------------------------------*/
type QueryRoot = Document | HTMLElement | DocumentFragment;

let scanTimeoutId: number | null = null;
let observer: MutationObserver | null = null;
let rescanIntervalId: number | null = null;

type ButtonState = 'idle' | 'loading' | 'success' | 'error' | 'trying' | 'cancel' | 'cancelled';

type FileMeta = {
  name?: string;
  ext?: string;
  kind?: string;
};

type PendingButton = {
  button: HTMLButtonElement;
  requestId: string;
  fileMeta?: FileMeta;
  startedAt: number;
};

let nextRequestSeq = 1;
const pendingButtons = new Map<string, PendingButton>();

// Per-tab CQD state
let desiredEnabled = true; 
let effectiveEnabled = false; 
let initialized = false;

// Global ON/OFF flag
let globalEnabled = true;

// Cached cancel hold delay
let cancelHoldDelayMs = 1000;
getCancelHoldDelayMs().then((ms) => {
  cancelHoldDelayMs = ms;
}).catch(() => { /* ignore */ });

/* -----------------------------------------------------
 * Effective state broadcast
 * ---------------------------------------------------*/
function applyEffectiveState(enabled: boolean): void {
  effectiveEnabled = enabled;
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage({
        type: 'CQD_EFFECTIVE_STATE_CHANGED',
        enabled,
      });
    } catch {
      // ignore
    }
  }
}

function recomputeEffectiveStateFromFlags(): void {
  const shouldEnable = globalEnabled && desiredEnabled;
  if (shouldEnable) {
    startCQD();
  } else {
    stopCQD();
  }
}

/* -----------------------------------------------------
 * Environment / Page Checks
 * ---------------------------------------------------*/
function isGoogleClassroom(): boolean {
  if (typeof location === 'undefined') return false;
  if (location.hostname !== 'classroom.google.com') return false;
  return CLASSROOM_URL_PATTERN.test(location.href);
}

/* -----------------------------------------------------
 * Attach / Detach CQD for this tab
 * ---------------------------------------------------*/
function startCQD(): void {
  if (initialized) return;
  if (!isGoogleClassroom()) return;
  initialized = true;
  injectStyles();
  setupObservers();
  applyEffectiveState(true);
}

function stopCQD(): void {
  if (!initialized) return;
  initialized = false;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (scanTimeoutId !== null) {
    window.clearTimeout(scanTimeoutId);
    scanTimeoutId = null;
  }
  if (rescanIntervalId !== null) {
    window.clearInterval(rescanIntervalId);
    rescanIntervalId = null;
  }
  // Stop listening to scroll
  window.removeEventListener('scroll', scheduleScan);

  try {
    const injectedButtons = document.querySelectorAll<HTMLElement>(
      '.cqd-download-btn',
    );
    injectedButtons.forEach((btn) => btn.remove());
  } catch {
    // ignore
  }
  applyEffectiveState(false);
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
    scanForAttachments(document);
  }, RESCAN_DEBOUNCE_MS);
}

function setupObservers(): void {
  if (typeof document === 'undefined') return;
  if (!document.body) {
    window.addEventListener(
      'DOMContentLoaded',
      () => setupObservers(),
      { once: true },
    );
    return;
  }

  // 1. Scroll Listener (Crucial for hard scrolling)
  // Passive listener is better for performance
  window.addEventListener('scroll', scheduleScan, { passive: true });

  // 2. Mutation Observer
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    const roots = new Set<QueryRoot>();
    let shouldScan = false;
    for (const m of mutations) {
      // Watch for attribute changes on containers (recycled nodes)
      if (m.type === 'attributes' && m.target instanceof HTMLElement) {
        if (m.target.hasAttribute(PROCESSED_ATTR) && !hasInjectedButton(m.target)) {
          roots.add(m.target);
          shouldScan = true;
        }
        continue;
      }

      if (m.type !== 'childList') continue;

      const isInternal = Array.from(m.addedNodes).some(
        (n) =>
          n.nodeType === Node.ELEMENT_NODE &&
          (n as Element).hasAttribute(INJECTED_ATTR),
      );
      if (isInternal) continue;

      shouldScan = true;
      m.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          roots.add(node as HTMLElement);
        }
      });
      if (m.target instanceof HTMLElement) {
        roots.add(m.target);
      }
    }

    if (shouldScan) {
      if (roots.size === 0) {
        scheduleScan();
      } else {
        roots.forEach((root) => scanForAttachments(root));
        scheduleScan(); 
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-cqd-processed'], 
  });

  // 3. Interval Fallback (Safety net)
  if (rescanIntervalId == null) {
    rescanIntervalId = window.setInterval(() => {
      scheduleScan();
    }, RESCAN_INTERVAL_MS);
  }
  scheduleScan();
}

function scanForAttachments(root: QueryRoot = document): void {
  if (!isGoogleClassroom()) return;
  if (!effectiveEnabled) return; 
  injectSingleFileButtons(root);
}

/* -----------------------------------------------------
 * Single-file buttons
 * ---------------------------------------------------*/
function injectSingleFileButtons(root: QueryRoot = document): void {
  const anchors = Array.from(
    root.querySelectorAll<HTMLAnchorElement>(DRIVE_ANCHOR_SELECTOR),
  );

  for (const anchor of anchors) {
    const url = extractDriveUrlFromAnchor(anchor);
    if (!url) continue;

    const container =
      (anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) as HTMLElement | null) ||
      anchor.parentElement ||
      anchor;

    if (!container) continue;

    // FIX: If container is marked processed, check if button ACTUALLY exists.
    // If not, clear the flag so we can re-inject.
    if (container.hasAttribute(PROCESSED_ATTR)) {
      if (!hasInjectedButton(container)) {
        container.removeAttribute(PROCESSED_ATTR);
      } else {
        continue; // Truly skipped
      }
    }
    
    injectButtonIntoAttachment(container, url);
  }

  // Handle data-drive-id elements (previews)
  const metaElements = Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]',
    ),
  );

  for (const el of metaElements) {
    if (el.hasAttribute(PROCESSED_ATTR)) {
      if (!hasInjectedButton(el)) {
        el.removeAttribute(PROCESSED_ATTR);
      } else {
        continue;
      }
    }

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
  return DRIVE_URL_PATTERNS.some((re) => re.test(href)) ? href : null;
}

function findDriveUrl(element: HTMLElement): string | null {
  const nearAnchor =
    element.querySelector<HTMLAnchorElement>(DRIVE_ANCHOR_SELECTOR) ||
    (element.closest(DRIVE_ANCHOR_SELECTOR) as HTMLAnchorElement | null);

  if (nearAnchor) {
    const href = extractDriveUrlFromAnchor(nearAnchor);
    if (href) return href;
  }

  const driveId =
    element.getAttribute('data-drive-id') || element.getAttribute('data-id');
  if (driveId) {
    return toDownloadUrl(
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
        driveId,
      )}`,
    );
  }
  return null;
}

function getAuthUser(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has('authuser')) return params.get('authuser');
  if (params.has('u')) return params.get('u');
  const pathMatch = window.location.pathname.match(/\/u\/(\d+)\//);
  if (pathMatch) return pathMatch[1];
  return null;
}

function toDownloadUrl(originalUrl: string, depth = 0): string {
  if (depth > 3) return originalUrl;
  const authUser = getAuthUser();

  try {
    const parsed = new URL(originalUrl, location.href);
    const appendAuth = (u: string) => {
      if (!authUser) return u;
      const newU = new URL(u);
      if (!newU.searchParams.has('authuser')) {
        newU.searchParams.set('authuser', authUser);
      }
      return newU.toString();
    };

    if (parsed.hostname === 'drive.google.com') {
      if (parsed.pathname.startsWith('/auth_warmup')) {
        const cont = parsed.searchParams.get('continue');
        if (cont) return toDownloadUrl(cont, depth + 1);
        const id = parsed.searchParams.get('id');
        if (id)
          return appendAuth(
            `https://drive.google.com/uc?export=download&id=${id}`,
          );
        return appendAuth(originalUrl);
      }
      const fileMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
      if (fileMatch) {
        return appendAuth(
          `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`,
        );
      }
      if (parsed.pathname === '/open' || parsed.pathname === '/uc') {
        parsed.searchParams.set('export', 'download');
        if (authUser) parsed.searchParams.set('authuser', authUser);
        return parsed.toString();
      }
    }
    if (
      parsed.hostname === 'classroom.google.com' &&
      parsed.pathname.startsWith('/drive')
    ) {
      const id =
        parsed.searchParams.get('id') ||
        parsed.searchParams.get('resourceId') ||
        parsed.searchParams.get('fileId');
      if (id)
        return appendAuth(
          `https://drive.google.com/uc?export=download&id=${id}`,
        );
    }
    return appendAuth(originalUrl);
  } catch {
    return originalUrl;
  }
}

/* -----------------------------------------------------
 * File metadata extraction
 * ---------------------------------------------------*/
function cleanAttachmentName(rawName: string): string {
  if (!rawName) return '';
  let name = rawName.trim();
  const garbageLabels = [
    'Microsoft Excel',
    'Microsoft Word',
    'Microsoft PowerPoint',
    'Compressed archive',
    'Binary',
    'Unknown',
    'Google Sheets',
    'Google Docs',
    'Google Slides',
    'Text File',
    'PDF',
    'Video',
    'Image',
    'Audio',
    'Text',
    'Word',
    'Excel',
    'PowerPoint',
    'Archive',
    'Zip',
    'File',
    'Document',
    'Shortcut',
    'Code',
  ];

  for (const label of garbageLabels) {
    if (name.endsWith(label)) {
      const potential = name.slice(0, -label.length).trim();
      if (potential.length > 0) {
        name = potential;
        break;
      }
    }
  }

  if (name.length > 0 && name.length % 2 === 0) {
    const mid = name.length / 2;
    if (name.slice(0, mid) === name.slice(mid)) return name.slice(0, mid);
  }

  const repeatRegex = /\.([a-zA-Z0-9]{2,10})\1$/i;
  const repeatMatch = name.match(repeatRegex);
  if (repeatMatch) return name.slice(0, -repeatMatch[1].length).trim();

  return name;
}

function extractFileMeta(container: HTMLElement, url: string): FileMeta {
  let name: string | undefined;

  const tooltip =
    container.getAttribute('data-tooltip') ||
    container.getAttribute('aria-label') ||
    container.getAttribute('title');
  if (tooltip && tooltip.trim()) name = tooltip.trim();

  if (!name) {
    const text = (container.textContent || '').trim();
    if (text) {
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 0) name = lines[0];
    }
  }

  if (!name) {
    try {
      const u = new URL(url);
      const pathName = decodeURIComponent(u.pathname.split('/').pop() || '');
      if (pathName && pathName.includes('.')) name = pathName;
    } catch {}
  }

  if (name) name = cleanAttachmentName(name);

  let ext: string | undefined;
  if (name) {
    const m = name.match(/\.([a-zA-Z0-9]{2,10})$/);
    if (m) ext = m[1].toLowerCase();
  }

  return { name, ext, kind: 'other' };
}

/* -----------------------------------------------------
 * Button injection
 * ---------------------------------------------------*/
function injectButtonIntoAttachment(
  container: HTMLElement,
  url: string,
): void {
  if (!url) return;
  container.setAttribute(PROCESSED_ATTR, 'true');

  const computed = window.getComputedStyle(container);
  if (computed.position === 'static') container.style.position = 'relative';

  const directUrl = toDownloadUrl(url);
  const fileMeta = extractFileMeta(container, directUrl);

  const button = createDownloadButton(container, directUrl, fileMeta);
  const iconEl = button.querySelector<HTMLElement>('.cqd-download-icon');
  if (iconEl) iconEl.classList.add('cqd-icon-medium');

  container.appendChild(button);
}

/* -----------------------------------------------------
 * Button state helpers
 * ---------------------------------------------------*/
function getButtonState(button: HTMLButtonElement): ButtonState {
  if (button.classList.contains('cqd-loading')) return 'loading';
  if (button.classList.contains('cqd-trying')) return 'trying';
  if (button.classList.contains('cqd-cancel')) return 'cancel';
  if (button.classList.contains('cqd-cancelled')) return 'cancelled';
  if (button.classList.contains('cqd-success')) return 'success';
  if (button.classList.contains('cqd-error')) return 'error';
  return 'idle';
}

function setButtonState(
  button: HTMLButtonElement,
  state: ButtonState,
  options?: { userMessage?: string },
): void {
  const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
  const label = button.querySelector<HTMLSpanElement>('.cqd-label');
  const errorDetail = button.querySelector<HTMLSpanElement>('.cqd-error-detail');

  if (!icon || !label || !errorDetail) return;

  // Protect cancel state from being overridden by loading/trying
  // Only success, error, cancelled, and idle can override cancel state
  const currentState = getButtonState(button);
  if (currentState === 'cancel' && (state === 'loading' || state === 'trying')) {
    // Skip state change - cancel takes priority during hover
    return;
  }

  button.classList.remove(
    'cqd-loading',
    'cqd-trying',
    'cqd-success',
    'cqd-error',
    'cqd-cancel',
    'cqd-cancelled',
  );
  icon.classList.remove('cqd-spinner');
  icon.textContent = '';
  button.disabled = false;
  button.style.backgroundColor = '';
  label.textContent = t('download');
  errorDetail.textContent = '';
  icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
  icon.style.backgroundSize = '';

  switch (state) {
    case 'idle':
      break;
    case 'loading':
    case 'trying': {
      const isTrying = state === 'trying';
      button.classList.add(isTrying ? 'cqd-trying' : 'cqd-loading');
      button.disabled = true;
      label.textContent = isTrying ? t('trying') : t('downloading');
      icon.classList.add('cqd-spinner');
      icon.style.backgroundImage = 'none';
      break;
    }
    case 'cancel':
      button.classList.add('cqd-cancel');
      button.disabled = false; // Allow click to confirm cancel
      label.textContent = t('cancel');
      icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;
    case 'cancelled':
      button.classList.add('cqd-cancelled');
      button.disabled = true;
      label.textContent = t('cancelled');
      icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;
    case 'success':
      button.classList.add('cqd-success');
      label.textContent = t('downloaded');
      icon.style.backgroundImage = `url("${SUCCESS_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;
    case 'error':
      button.classList.add('cqd-error');
      label.textContent = t('error');
      icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      errorDetail.textContent = options?.userMessage || t('failed');
      break;
  }
}

function setPillProgress(button: HTMLButtonElement, fraction: number): void {
  const clamped = Math.max(0, Math.min(1, fraction || 0));
  button.style.setProperty('--cqd-progress', `${clamped * 100}%`);
}

/* -----------------------------------------------------
 * Button factory
 * ---------------------------------------------------*/
function createDownloadButton(
  _container: HTMLElement,
  url: string,
  fileMeta: FileMeta,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cqd-download-btn';
  if (isPageDark()) {
    button.classList.add('cqd-theme-dark');
  }
  button.setAttribute(INJECTED_ATTR, 'true');
  button.setAttribute(
    'aria-label',
    `${t('ariaDownload')} ${fileMeta.name || ''}`,
  );
  button.setAttribute('title', t('titleQuick'));

  try {
    if (url) (button.dataset as any).cqdUrl = url;
    if (fileMeta?.name) (button.dataset as any).cqdName = fileMeta.name;
    if (fileMeta?.ext) (button.dataset as any).cqdExt = fileMeta.ext;
  } catch {}

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'cqd-icon-wrapper';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'cqd-download-icon';
  iconWrapper.appendChild(iconSpan);

  const label = document.createElement('span');
  label.className = 'cqd-label';
  label.textContent = t('download');

  const errorDetail = document.createElement('span');
  errorDetail.className = 'cqd-error-detail';

  button.appendChild(iconWrapper);
  button.appendChild(label);
  button.appendChild(errorDetail);

  // Track if we're in loading state before hover changed it to cancel
  let wasLoadingBeforeHover = false;
  let hoverTimeout: number | undefined;

  // Hover handlers for loading → cancel state transition
  // Cancel button appears IMMEDIATELY on hover (no delay)
  button.addEventListener('mouseenter', () => {
    const state = getButtonState(button);
    if (state === 'loading' || state === 'trying') {
      // Show cancel immediately - user can cancel anytime
      wasLoadingBeforeHover = true;
      setButtonState(button, 'cancel');
    }
  });

  button.addEventListener('mouseleave', () => {
    if (hoverTimeout) {
      window.clearTimeout(hoverTimeout);
      hoverTimeout = undefined;
    }
    const state = getButtonState(button);
    if (state === 'cancel' && wasLoadingBeforeHover) {
      // Only revert if download is still pending
      const pending = findPendingButtonByElement(button);
      if (pending) {
        setButtonState(button, 'loading');
      }
      wasLoadingBeforeHover = false;
    }
  });

  const clickHandler = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentState = getButtonState(button);
    
    // If in cancel state, trigger cancellation
    if (currentState === 'cancel') {
      wasLoadingBeforeHover = false;
      await handleCancelClick(button);
      return;
    }
    
    // Normal download flow (only works from idle state)
    await handleSingleDownloadClick(button, url, fileMeta);
  };
  button.addEventListener('click', clickHandler);
  button.addEventListener('auxclick', (e) => {
    if (e.button === 1) clickHandler(e);
  });

  return button;
}

// Helper to find pending button entry by button element
function findPendingButtonByElement(button: HTMLButtonElement): PendingButton | undefined {
  for (const pending of pendingButtons.values()) {
    if (pending.button === button) {
      return pending;
    }
  }
  return undefined;
}

// Handle cancel button click
async function handleCancelClick(button: HTMLButtonElement): Promise<void> {
  const pending = findPendingButtonByElement(button);
  if (!pending) {
    // Already finished, just reset
    setButtonState(button, 'idle');
    return;
  }

  // Send cancel request to background
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage({
        type: 'CQD_CANCEL_DOWNLOAD',
        requestId: pending.requestId,
      });
    } catch {
      // Ignore errors
    }
  }

  // Remove from pending
  pendingButtons.delete(pending.requestId);

  // Show cancelled state briefly, then return to idle
  setButtonState(button, 'cancelled');
  await delay(1500);
  
  // Only reset if still in cancelled state
  if (getButtonState(button) === 'cancelled') {
    setButtonState(button, 'idle');
  }
}

/* -----------------------------------------------------
 * Download click handler
 * ---------------------------------------------------*/
async function handleSingleDownloadClick(
  button: HTMLButtonElement,
  url: string,
  fileMeta: FileMeta,
): Promise<void> {
  if (!url) return;
  if (getButtonState(button) !== 'idle') return;

  setPillProgress(button, 0);

  const requestId = `cqd-${Date.now()}-${nextRequestSeq++}`;
  const startedAt = Date.now();
  pendingButtons.set(requestId, { button, requestId, fileMeta, startedAt });

  setButtonState(button, 'loading');

  // Since the user just clicked, the mouse is still over the button.
  // Show cancel state immediately - no need to wait for mouseenter event.
  // Use requestAnimationFrame to ensure the button is in loading state first.
  requestAnimationFrame(() => {
    if (getButtonState(button) === 'loading' && pendingButtons.has(requestId)) {
      setButtonState(button, 'cancel');
    }
  });

  // *** PRE-DOWNLOAD DELAY ***
  // Wait for cancelHoldDelayMs before starting the actual download.
  // This gives users time to hover and cancel before the file starts downloading.
  if (cancelHoldDelayMs > 0) {
    await delay(cancelHoldDelayMs);
    
    // Check if user cancelled during the wait
    if (!pendingButtons.has(requestId)) {
      // User cancelled - don't start download
      return;
    }
    
    // Check if button is in cancel/cancelled state
    const currentState = getButtonState(button);
    if (currentState === 'cancelled' || currentState === 'idle') {
      // User cancelled or reset - don't start download
      return;
    }
  }

  const startResult = await startBackgroundDownload(requestId, url, fileMeta);
  if (!startResult.ok) {
    pendingButtons.delete(requestId);
    await ensureMinLoading(startedAt);
    await showErrorState(button, startResult.userMessage);
    return;
  }
}

function startBackgroundDownload(
  requestId: string,
  url: string,
  fileMeta: FileMeta,
): Promise<{ ok: boolean; userMessage?: string }> {
  const finalUrl = toDownloadUrl(url);
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve({ ok: false, userMessage: t('runtimeError') || 'Runtime not available.' });
      return;
    }
    try {

      chrome.runtime.sendMessage(
        { type: 'CQD_DOWNLOAD', url: finalUrl, requestId, fileMeta },
        (response: any) => {
          if (
            chrome.runtime.lastError ||
            !response ||
            response.started === false
          ) {
            resolve({
              ok: false,
              userMessage: response?.userMessage || t('startError') || 'Could not start.',
            });
          } else {
            resolve({ ok: true });
          }
        },
      );
    } catch {
      resolve({ ok: false, userMessage: t('commError') || 'Comm error.' });
    }
  });
}

/* -----------------------------------------------------
 * UI Utils
 * ---------------------------------------------------*/
async function showErrorState(
  button: HTMLButtonElement,
  userMessage?: string,
): Promise<void> {
  setButtonState(button, 'error', { userMessage });

  const earliestReset = Date.now() + FEEDBACK_ERROR_MS;
  while (true) {
    await delay(200);
    if (getButtonState(button) !== 'error') return;
    if (Date.now() < earliestReset) continue;

    if (!button.matches(':hover')) {
      setButtonState(button, 'idle');
      setPillProgress(button, 0);
      return;
    }
  }
}

async function ensureMinLoading(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < LOADING_MIN_MS) await delay(LOADING_MIN_MS - elapsed);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/* -----------------------------------------------------
 * Message handling: popup + download status
 * ---------------------------------------------------*/
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(
    (message: any, _sender: any, sendResponse: any): void | true => {
      if (!message) return;

      // Popup asks for this tab's state
      if (message.type === 'CQD_POPUP_QUERY_STATE') {
        try {
          sendResponse({ desiredEnabled, effectiveEnabled });
        } catch {
          // ignore
        }
        return true;
      }

      // Popup sets desired state for this tab
      if (message.type === 'CQD_POPUP_SET_DESIRED_STATE') {
        desiredEnabled = !!message.enabled;
        // NEW: go through the global+tab recompute instead of raw start/stop
        recomputeEffectiveStateFromFlags();
        try {
          sendResponse({ desiredEnabled, effectiveEnabled });
        } catch {
          // ignore
        }
        return true;
      }

      if (message.type === 'CQD_DOWNLOAD_STATUS') {
        const requestId = message.requestId as string | undefined;
        if (!requestId) return;

        const pending = pendingButtons.get(requestId);
        if (!pending) return;
        
        const { button, startedAt } = pending;
      (async () => {
          await ensureMinLoading(startedAt);

          const status = message.status as
            | ButtonState
            | 'blocked_html'
            | 'interrupted'
            | 'complete';
          const errorCode = message.errorCode as string | undefined;
          const userMessage = message.userMessage as string | undefined;

          if (status === 'trying') {
            setButtonState(button, 'trying', { userMessage });
            return;
          }

          if (status === 'success' || status === 'complete') {
            pendingButtons.delete(requestId);
            try {
              (button.dataset as any).cqdAllDone = 'true';
            } catch {
              /* ignore */
            }
            setPillProgress(button, 1);
            setButtonState(button, 'success');
            await waitForSuccessReset(button);
            return;
          }

          if (
            status === 'error' ||
            status === 'interrupted' ||
            status === 'blocked_html'
          ) {
            if (errorCode === 'AUTH_CHECK') {
              await showErrorState(button, userMessage);
              return;
            }
            pendingButtons.delete(requestId);
            setPillProgress(button, 0);
            await showErrorState(button, userMessage);
          }
        })();
        return;
      }
    },
  );
}

/* -----------------------------------------------------
 * Init
 * ---------------------------------------------------*/
function initContentScript(): void {
  if (!isGoogleClassroom()) return;

  // Subscribe to global enable/disable state.
  // This handles both initial state and dynamic changes.
  subscribeToGlobalState(
    () => {
      // Extension enabled
      globalEnabled = true;
      desiredEnabled = true;
      recomputeEffectiveStateFromFlags();
    },
    () => {
      // Extension disabled
      globalEnabled = false;
      stopCQD();
    }
  );
}

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    initContentScript();
  },
});

/* -----------------------------------------------------
 * Success-state reset logic
 * ---------------------------------------------------*/
async function waitForSuccessReset(button: HTMLButtonElement): Promise<void> {
  const earliestReset = Date.now() + FEEDBACK_SUCCESS_MS;

  while (true) {
    await delay(200);

    if (getButtonState(button) !== 'success') {
      return;
    }
    if (Date.now() < earliestReset) continue;

    const postRoot =
      button.closest<HTMLElement>('div[data-stream-item-id]') ||
      button.closest<HTMLElement>('main') ||
      button.closest<HTMLElement>('div[role="main"]');

    if (postRoot && postRoot.dataset.cqdGroupActive === '1') {
      continue;
    }

    if (button.matches(':hover')) continue;

    break;
  }

  setButtonState(button, 'idle');
  setPillProgress(button, 0);
  try {
    delete (button.dataset as any).cqdAllDone;
  } catch {
    /* ignore */
  }
}