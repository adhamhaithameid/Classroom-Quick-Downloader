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
const FEEDBACK_SUCCESS_MS = 2000;  // Reduced from 3000ms
const FEEDBACK_ERROR_MS = 3000;     // Reduced from 4000ms  
const FEEDBACK_CANCELLED_MS = 1500; // Cancelled state timeout
const MAX_TERMINAL_STATE_MS = 5000; // Force reset after 5s (reduced from 8s)

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

// State priority (higher number = higher priority)
const STATE_PRIORITY: Record<ButtonState, number> = {
  success: 7,    // Terminal state - highest priority
  error: 6,      // Terminal state
  cancelled: 5,  // Terminal state
  cancel: 4,     // Hover state - requires mouse over
  trying: 3,     // Active download with issues
  loading: 2,    // Active download
  idle: 1,       // Default state
};

function getButtonState(button: HTMLButtonElement): ButtonState {
  // Check terminal/priority states first
  if (button.classList.contains('cqd-success')) return 'success';
  if (button.classList.contains('cqd-error')) return 'error';
  if (button.classList.contains('cqd-cancelled')) return 'cancelled';
  
  // Check cancel before loading/trying! 
  // This ensures that if we have both classes (for visual override), we report 'cancel'
  if (button.classList.contains('cqd-cancel')) return 'cancel';
  
  if (button.classList.contains('cqd-loading')) return 'loading';
  if (button.classList.contains('cqd-trying')) return 'trying';
  
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

  const currentState = getButtonState(button);
  
  // Define state categories for better transition logic
  const HOVER_STATES = ['cancel'] as const;
  const TERMINAL_STATES = ['success', 'error', 'cancelled'] as const;
  const ACTIVE_STATES = ['loading', 'trying'] as const;
  
  // === STATE TRANSITION RULES ===
  
  // Rule 1: Always allow transition to idle (reset)
  if (state === 'idle') {
    // Allowed from any state
  }
  
  // Rule 2: Hover states (cancel) can exit to active states when mouse leaves
  else if ((HOVER_STATES as readonly string[]).includes(currentState) && (ACTIVE_STATES as readonly string[]).includes(state)) {
    const isMouseOver = (button.dataset as any).cqdMouseOver === 'true';
    if (isMouseOver) {
      // Mouse still hovering - block transition, stay in hover state
      return;
    }
    // Mouse left - allow transition back to active state
  }
  
  // Rule 3: Terminal states block all transitions except to idle
  else if ((TERMINAL_STATES as readonly string[]).includes(currentState) && state !== 'idle') {
    return; // Block transition
  }
  
  // Rule 4: Active states can transition to hover states, terminal states, or each other
  else if ((ACTIVE_STATES as readonly string[]).includes(currentState)) {
    // Allow: loading ↔ trying, loading → cancel, loading → success/error/cancelled
    // These are all valid
  }
  
  // Rule 5: Use priority as fallback for all other cases
  // (Fallthrough allows transition)

  // Rule 6: Apply new state
  button.classList.remove(
    'cqd-loading',
    'cqd-trying',
    'cqd-success',
    'cqd-error',
    'cqd-cancel',
    'cqd-cancelled',
  );
  icon.classList.remove('cqd-spinner', 'cqd-spin'); // Remove both potential spinner classes
  icon.className = 'cqd-download-icon'; // Reset to base class to be safe
  icon.textContent = '';
  button.disabled = false;
  button.style.backgroundColor = '';
  label.textContent = t('download');
  errorDetail.textContent = '';
  icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
  icon.style.backgroundSize = '';

  button.classList.add(`cqd-${state}`);

  switch (state) {
    case 'idle':
      break;
    case 'loading':
      if (icon) {
        icon.style.backgroundImage = 'none';
        icon.className = 'cqd-download-icon cqd-spinner';
      }
      if (label) label.textContent = t('downloading');
      button.disabled = false; // Allow interaction for cancel

      // CRITICAL FIX: If mouse is already over the button, show cancel state IMMEDIATELY
      // Do not wait for mouseleave/mouseenter cycle
      if ((button.dataset as any).cqdMouseOver === 'true') {
        const currentNow = getButtonState(button);
        // Only transition if we are truly in a cancellable state (loading/trying) OR if we just added the class
        // Note: getButtonState might now return 'loading' because we haven't added 'cqd-cancel' yet? 
        // No, we haven't added it yet.
        
        console.log('[CQD] Mouse already over active button - transitioning to cancel immediately');
        // Manually trigger the cancel visual state
        button.classList.add('cqd-cancel');
        if (label) label.textContent = t('cancel') || 'Cancel';
        if (icon) {
          icon.className = 'cqd-download-icon'; // Stop spin
          icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
          icon.style.backgroundSize = '20px 20px'; // Explicit size
        }
      }
      break;
    case 'trying':
      if (icon) {
        icon.style.backgroundImage = 'none';
        icon.className = 'cqd-download-icon cqd-spinner';
      }
      if (label) label.textContent = options?.userMessage || t('trying') || 'Retrying...';
      button.disabled = false; // Allow interaction for cancel

      // CRITICAL FIX: Same matching logic for 'trying' state
      if ((button.dataset as any).cqdMouseOver === 'true') {
         console.log('[CQD] Mouse over trying button - showing cancel');
         button.classList.add('cqd-cancel');
         if (label) label.textContent = t('cancel') || 'Cancel';
         if (icon) {
            icon.className = 'cqd-download-icon';
            icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
            icon.style.backgroundSize = '20px 20px';
         }
      }
      break;
    case 'cancel':
      button.disabled = false; // Allow click to confirm cancel
      label.textContent = t('cancel');
      icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;
    case 'cancelled':
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
  let hoverTimeout: number | undefined;

  // Hover handlers for loading → cancel state transition
  // Cancel button appears ONLY when hovering over loading  // --- Mouse Listeners ---

  // Track hover state persistently
  button.addEventListener('mouseenter', () => {
    (button.dataset as any).cqdMouseOver = 'true';
    const s = getButtonState(button);
    // If active (loading/trying), switch to cancel visual immediately
    if (s === 'loading' || s === 'trying') {
      button.classList.add('cqd-cancel');
      const label = button.querySelector<HTMLSpanElement>('.cqd-label');
      const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
      if (label) label.textContent = t('cancel') || 'Cancel';
      if (icon) {
        icon.className = 'cqd-download-icon'; // Stop spinning
        icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      }
    }
  });

  button.addEventListener('mouseleave', () => {
    (button.dataset as any).cqdMouseOver = 'false';
    const wasCancel = button.classList.contains('cqd-cancel');
    
    // Check underlying state explicitly via classes since getButtonState now prioritizes cancel
    const isUnderlyingLoading = button.classList.contains('cqd-loading');
    const isUnderlyingTrying = button.classList.contains('cqd-trying');
    
    // If we were showing cancel, revert to loading/trying visual
    if (wasCancel) {
      button.classList.remove('cqd-cancel');
      // Re-apply state visuals (spinner, text)
      const label = button.querySelector<HTMLSpanElement>('.cqd-label');
      const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
      
      if (isUnderlyingLoading) {
        if (label) label.textContent = t('downloading') || 'Downloading...';
        if (icon) {
            icon.className = 'cqd-download-icon cqd-spinner'; // Restoration of spinner class
            icon.style.backgroundImage = 'none';
        }
      } else if (isUnderlyingTrying) {
        if (label) label.textContent = t('trying') || 'Retrying...';
        if (icon) {
             icon.className = 'cqd-download-icon cqd-spinner';
             icon.style.backgroundImage = 'none';
        }
      }
    }
  });const clickHandler = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentState = getButtonState(button);
    
    // If in cancel state, trigger cancellation
    if (currentState === 'cancel') {
      delete (button.dataset as any).cqdMouseOver;
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
  // Find and cancel the pending download
  const pending = Array.from(pendingButtons.values()).find((p) => p.button === button);
  
  if (pending) {
    // Remove from pending (prevents background from continuing)
    pendingButtons.delete(pending.requestId);
    
    // Send cancel message to background to abort browser download
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          type: 'CQD_CANCEL_DOWNLOAD',
          requestId: pending.requestId,
        });
        console.log('[CQD] Sent cancel message for requestId:', pending.requestId);
      } catch (err) {
        console.warn('[CQD] Error sending cancel message:', err);
      }
    }
  }

  // Apply cancel click animation
  button.classList.add('cqd-cancel-click-anim');
  setTimeout(() => button.classList.remove('cqd-cancel-click-anim'), 400);

  // Show cancelled state briefly, then return to idle
  setButtonState(button, 'cancelled');
  
  // Wait for reset with max timeout
  const earliestReset = Date.now() + FEEDBACK_CANCELLED_MS;
  const maxReset = Date.now() + MAX_TERMINAL_STATE_MS;
  
  while (true) {
    await delay(200);
    
    // Check if state changed (user might have clicked again)
    if (getButtonState(button) !== 'cancelled') {
      return;
    }
    
    // Force reset after max time
    if (Date.now() >= maxReset) {
      break;
    }
    
    // Normal reset after earliest time and not hovering
    if (Date.now() >= earliestReset && !button.matches(':hover')) {
      break;
    }
  }
  
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

  // CRITICAL: Store requestId in button dataset for Cancel All to find it
  try {
    (button.dataset as any).cqdRequestId = requestId;
  } catch {
    // Ignore dataset errors
  }

  setButtonState(button, 'loading');

  // Note: Cancel state will only appear if user hovers over the button
  // No automatic cancel state - respects the new priority system

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
  const maxReset = Date.now() + MAX_TERMINAL_STATE_MS; // Force reset after max time
  
  while (true) {
    await delay(200);
    if (getButtonState(button) !== 'error') return;
    
    // Force reset if max time exceeded
    if (Date.now() >= maxReset) {
      setButtonState(button, 'idle');
      setPillProgress(button, 0);
      return;
    }
    
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
            // SPECIAL CASE: If button is already visually cancelled (e.g. by "Cancel All"),
            // ignore the "interrupted" or "error" message so we don't overwrite with "Error" state
            // and don't trigger a double/conflicting reset timer.
            if ((status === 'interrupted' || status === 'error') && button.classList.contains('cqd-cancelled')) {
               pendingButtons.delete(requestId);
               return;
            }

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

  // Request icon update to ensure colored icon on Classroom
  try {
    chrome.runtime.sendMessage({ type: 'CQD_UPDATE_ICON' });
  } catch {
    // Ignore errors
  }

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
  const maxReset = Date.now() + MAX_TERMINAL_STATE_MS; // Force reset after max time

  while (true) {
    await delay(200);

    if (getButtonState(button) !== 'success') {
      return;
    }
    
    // Force reset if max time exceeded - always allow re-download after 5s
    if (Date.now() >= maxReset) {
      break;
    }
    
    if (Date.now() < earliestReset) continue;

    // Only extend timeout if user is hovering (let them see the state)
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