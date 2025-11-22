// filepath: entrypoints/content/index.ts

const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;

import {
  DOWNLOAD_ICON_SVG_URL,
  SUCCESS_ICON_SVG_URL,
  ERROR_ICON_SVG_URL,
} from './icons';

import { injectStyles } from './styles';
import { t } from './i18n';

const INJECTED_ATTR = 'data-cqd-injected';
const RESCAN_INTERVAL_MS = 2000;
const RESCAN_DEBOUNCE_MS = 250;
const LOADING_MIN_MS = 600;
const FEEDBACK_SUCCESS_MS = 2000;
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

let scanTimeoutId: number | null = null;
let observer: MutationObserver | null = null;

type ButtonState = 'idle' | 'loading' | 'success' | 'error' | 'trying';

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

/* -----------------------------------------------------
 * Environment / Page Checks
 * ---------------------------------------------------*/

function isGoogleClassroom(): boolean {
  if (typeof location === 'undefined') return false;
  if (location.hostname !== 'classroom.google.com') return false;
  return CLASSROOM_URL_PATTERN.test(location.href);
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
      () => setupObservers(),
      { once: true },
    );
    return;
  }
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    const hasChildListChange = mutations.some(
      (m) =>
        m.type === 'childList' &&
        (m.addedNodes.length > 0 || m.removedNodes.length > 0),
    );
    if (hasChildListChange) scheduleScan();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.setInterval(() => scheduleScan(), RESCAN_INTERVAL_MS);
  scheduleScan();
}

function scanForAttachments(): void {
  if (!isGoogleClassroom()) return;
  injectSingleFileButtons();
}

/* -----------------------------------------------------
 * Single-file buttons
 * ---------------------------------------------------*/

function injectSingleFileButtons(): void {
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
    if (!container || hasInjectedButton(container)) continue;
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

/**
 * Detects current user index (0, 1, 2, ...) to fix 403/Permission errors
 */
function getAuthUser(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Check URL Query Param (?authuser=1)
  const params = new URLSearchParams(window.location.search);
  if (params.has('authuser')) return params.get('authuser');
  if (params.has('u')) return params.get('u');

  // 2. Check URL Path (/u/1/...)
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

  // Deduplicate e.g. "filefile"
  if (name.length > 0 && name.length % 2 === 0) {
    const mid = name.length / 2;
    const firstHalf = name.slice(0, mid);
    const secondHalf = name.slice(mid);
    if (firstHalf === secondHalf) {
      return firstHalf;
    }
  }

  const repeatRegex = /\.([a-zA-Z0-9]{2,10})\1$/i;
  const repeatMatch = name.match(repeatRegex);
  if (repeatMatch) {
    return name.slice(0, -repeatMatch[1].length).trim();
  }

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

  let kind: string = 'other';
  if (ext) {
    switch (ext) {
      case 'pdf':
        kind = 'pdf';
        break;
      case 'doc':
      case 'docx':
      case 'txt':
      case 'rtf':
      case 'odt':
      case 'md':
      case 'tex':
      case 'cls':
      case 'emlx':
        kind = 'doc';
        break;
      case 'xls':
      case 'xlsx':
      case 'csv':
      case 'ods':
      case 'numbers':
        kind = 'sheet';
        break;
      case 'ppt':
      case 'pptx':
      case 'odp':
      case 'key':
        kind = 'slide';
        break;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
      case 'bmp':
      case 'ico':
      case 'avif':
      case 'fig':
      case 'psd':
      case 'ai':
        kind = 'image';
        break;
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
      case 'webm':
      case 'flv':
      case 'wmv':
      case 'm4v':
        kind = 'video';
        break;
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'm4a':
      case 'flac':
      case 'aac':
        kind = 'audio';
        break;
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
      case 'iso':
      case 'dmg':
      case 'pkg':
      case 'mht':
        kind = 'archive';
        break;
      case 'html':
      case 'htm':
      case 'xml':
      case 'css':
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'json':
      case 'php':
      case 'sql':
      case 'py':
      case 'c':
      case 'cpp':
      case 'cs':
      case 'java':
      case 'rb':
      case 'go':
      case 'sh':
      case 'bat':
      case 'ipynb':
      case 'pkt':
      case 'lock':
      case 'yml':
      case 'yaml':
        kind = 'code';
        break;
      case 'ttf':
      case 'otf':
      case 'woff':
      case 'woff2':
      case 'eot':
        kind = 'font';
        break;
      case 'exe':
      case 'msi':
      case 'apk':
      case 'app':
      case 'jar':
      case 'dll':
      case 'pdb':
      case 'lnk':
      case 'dat':
      case 'sqlite':
      case 'db':
      case 'drawio':
      case 'dmp':
        kind = 'binary';
        break;
      default:
        kind = 'other';
    }
  }

  return { name, ext, kind };
}

/* -----------------------------------------------------
 * Button injection
 * ---------------------------------------------------*/

function injectButtonIntoAttachment(container: HTMLElement, url: string): void {
  if (!url) return;
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

  // Reset to idle baseline
  button.classList.remove('cqd-loading', 'cqd-trying', 'cqd-success', 'cqd-error');
  icon.classList.remove('cqd-spinner');
  icon.textContent = '';
  button.disabled = false;
  button.style.backgroundColor = '#1a73e8';
  label.textContent = t('download');
  errorDetail.textContent = '';

  icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
  icon.style.backgroundSize = '';

  switch (state) {
    case 'idle':
      // Already reset above
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

    case 'success':
      button.classList.add('cqd-success');
      button.style.backgroundColor = '#188038';
      label.textContent = t('downloaded');
      icon.style.backgroundImage = `url("${SUCCESS_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;

    case 'error':
      button.classList.add('cqd-error');
      button.style.backgroundColor = '#e05952';
      label.textContent = t('error');
      icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      errorDetail.textContent = options?.userMessage || t('failed');
      break;
  }
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
  button.setAttribute(INJECTED_ATTR, 'true');
  button.setAttribute('aria-label', `${t('ariaDownload')} ${fileMeta.name || ''}`);
  button.setAttribute('title', t('titleQuick'));

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

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleSingleDownloadClick(button, url, fileMeta);
  });

  button.addEventListener('auxclick', async (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    await handleSingleDownloadClick(button, url, fileMeta);
  });

  return button;
}

/* -----------------------------------------------------
 * Download click handler (updated to rely on background)
 * ---------------------------------------------------*/

async function handleSingleDownloadClick(
  button: HTMLButtonElement,
  url: string,
  fileMeta: FileMeta,
): Promise<void> {
  if (!url) return;
  if (getButtonState(button) !== 'idle') return;

  const requestId = `cqd-${Date.now()}-${nextRequestSeq++}`;
  const startedAt = Date.now();

  // Register this button so background can update it via messages
  pendingButtons.set(requestId, {
    button,
    requestId,
    fileMeta,
    startedAt,
  });

  // Immediately show loading
  setButtonState(button, 'loading');

  const startResult = await startBackgroundDownload(requestId, url, fileMeta);

  if (!startResult.ok) {
    // Could not even start the download
    pendingButtons.delete(requestId);
    await ensureMinLoading(startedAt);
    await showErrorState(button, startResult.userMessage);
    return;
  }

  // If the download started, keep the button in "loading".
  // The background script will send CQD_DOWNLOAD_STATUS with either
  // "success" or "error" when it knows the final result.
}

function startBackgroundDownload(
  requestId: string,
  url: string,
  fileMeta: FileMeta,
): Promise<{ ok: boolean; userMessage?: string }> {
  const finalUrl = toDownloadUrl(url);
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve({ ok: false, userMessage: 'Extension runtime not available.' });
      return;
    }
    try {
      chrome.runtime.sendMessage(
        { type: 'CQD_DOWNLOAD', url: finalUrl, requestId, fileMeta },
        (response) => {
          if (chrome.runtime.lastError || !response || response.started === false) {
            resolve({
              ok: false,
              userMessage: response?.userMessage || 'Could not start download.',
            });
          } else {
            resolve({ ok: true });
          }
        },
      );
    } catch {
      resolve({ ok: false, userMessage: 'Extension communication error.' });
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
 * Listen for background status updates
 * ---------------------------------------------------*/

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'CQD_DOWNLOAD_STATUS') return;

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
        | undefined;
      const errorCode = message.errorCode as string | undefined;
      const userMessage = message.userMessage as string | undefined;

      // TRYING PATH (non-direct flows: authuser loop / virus bypass)
      if (status === 'trying') {
        setButtonState(button, 'trying', { userMessage });
        // Keep it pending so later "success" can override
        return;
      }

      // SUCCESS PATH
      if (status === 'success' || status === 'complete') {
        pendingButtons.delete(requestId);
        setButtonState(button, 'success');
        await delay(FEEDBACK_SUCCESS_MS);
        if (getButtonState(button) === 'success') {
          setButtonState(button, 'idle');
        }
        return;
      }

      // ERROR PATHS
      if (
        status === 'error' ||
        status === 'interrupted' ||
        status === 'blocked_html'
      ) {
        // AUTH_CHECK errors are "soft": we might still flip to success later
        if (errorCode === 'AUTH_CHECK') {
          await showErrorState(button, userMessage);
          // Keep pendingButtons so later "success" can override
          return;
        }

        // Any other error is final
        pendingButtons.delete(requestId);
        await showErrorState(button, userMessage);
      }

    })();
  });
}


/* -----------------------------------------------------
 * Entry
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