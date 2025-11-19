// filepath: entrypoints/index.ts
const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;

import {
  DOWNLOAD_ICON_SVG_URL,
  SUCCESS_ICON_SVG_URL,
  ERROR_ICON_SVG_URL,
} from './icons';

import { injectStyles } from './styles';

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

let scanTimeoutId: number | null = null;
let observer: MutationObserver | null = null;

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

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
    window.addEventListener('DOMContentLoaded', () => setupObservers(), { once: true });
    return;
  }
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    const hasChildListChange = mutations.some(
      (m) => m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0),
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
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>(DRIVE_ANCHOR_SELECTOR));
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

  const driveId = element.getAttribute('data-drive-id') || element.getAttribute('data-id');
  if (driveId) {
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
  }
  return null;
}

function toDownloadUrl(originalUrl: string, depth = 0): string {
  if (depth > 3) return originalUrl;
  try {
    const parsed = new URL(originalUrl, location.href);
    if (parsed.hostname === 'drive.google.com') {
      if (parsed.pathname.startsWith('/auth_warmup')) {
        const cont = parsed.searchParams.get('continue');
        if (cont) return toDownloadUrl(cont, depth + 1);
        const id = parsed.searchParams.get('id');
        return id ? `https://drive.google.com/uc?export=download&id=${id}` : originalUrl;
      }
      const fileMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
      if (fileMatch) {
        return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
      }
      if (parsed.pathname === '/open' || parsed.pathname === '/uc') {
        parsed.searchParams.set('export', 'download');
        return parsed.toString();
      }
    }
    if (parsed.hostname === 'classroom.google.com' && parsed.pathname.startsWith('/drive')) {
       const id = parsed.searchParams.get('id') || parsed.searchParams.get('resourceId') || parsed.searchParams.get('fileId');
       if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
    }
    return originalUrl;
  } catch {
    return originalUrl;
  }
}

/* -----------------------------------------------------
 * File metadata extraction (Universal Support)
 * ---------------------------------------------------*/

/**
 * 🚀 FIXED CLEANER: Handles Name + Name + Label
 * Order of operations:
 * 1. Remove garbage labels ("Microsoft Excel", "Binary", "Unknown")
 * 2. THEN check for full string duplication ("init.phpinit.php")
 * 3. THEN check for suffix duplication ("file.pdfPDF")
 */
function cleanAttachmentName(rawName: string): string {
  if (!rawName) return '';
  let name = rawName.trim();

  // 1. LABEL CLEANUP (Must be first to expose the duplication)
  // Longest labels first to avoid partial matches (e.g. "Microsoft Excel" before "Excel")
  const garbageLabels = [
    'Microsoft Excel', 'Microsoft Word', 'Microsoft PowerPoint', 'Compressed archive', 
    'Binary', 'Unknown', 'Google Sheets', 'Google Docs', 'Google Slides', 'Text File',
    'PDF', 'Video', 'Image', 'Audio', 'Text', 'Word', 'Excel', 'PowerPoint', 
    'Archive', 'Zip', 'File', 'Document', 'Shortcut', 'Code'
  ];

  for (const label of garbageLabels) {
    if (name.endsWith(label)) {
      // Try stripping it
      const potential = name.slice(0, -label.length).trim();
      
      // Only accept the strip if we aren't left with an empty string
      if (potential.length > 0) {
         name = potential;
         // We break after the first match to avoid over-stripping 
         // (e.g. "File File" -> "File") unless your UI stacks them, 
         // but usually it's just one label.
         break;
      }
    }
  }

  // 2. EXACT HALF SPLIT (The "init.phpinit.php" or "HashMapHashMap" Fix)
  // Now that "Binary" is gone, "HashMapHashMap" will be split correctly.
  if (name.length > 0 && name.length % 2 === 0) {
    const mid = name.length / 2;
    const firstHalf = name.slice(0, mid);
    const secondHalf = name.slice(mid);
    if (firstHalf === secondHalf) {
       return firstHalf;
    }
  }

  // 3. REGEX SUFFIX REPEAT (The "file.pdfPDF" Fix)
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
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
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

  // 🧹 Apply the new logic
  if (name) name = cleanAttachmentName(name);

  // 🔍 Extract Extension
  let ext: string | undefined;
  if (name) {
    const m = name.match(/\.([a-zA-Z0-9]{2,10})$/); 
    if (m) ext = m[1].toLowerCase();
  }

  // 📂 Determine Kind (Fully expanded for your list)
  let kind: string = 'other';
  if (ext) {
    switch (ext) {
      // Docs
      case 'pdf': kind = 'pdf'; break;
      case 'doc': case 'docx': case 'txt': case 'rtf': case 'odt': case 'md': case 'tex': case 'cls': case 'emlx': kind = 'doc'; break;
      case 'xls': case 'xlsx': case 'csv': case 'ods': case 'numbers': kind = 'sheet'; break;
      case 'ppt': case 'pptx': case 'odp': case 'key': kind = 'slide'; break;
      
      // Media
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg': case 'bmp': case 'ico': case 'avif': case 'fig': case 'psd': case 'ai': kind = 'image'; break;
      case 'mp4': case 'mov': case 'avi': case 'mkv': case 'webm': case 'flv': case 'wmv': case 'm4v': kind = 'video'; break;
      case 'mp3': case 'wav': case 'ogg': case 'm4a': case 'flac': case 'aac': kind = 'audio'; break;
      
      // Archives
      case 'zip': case 'rar': case '7z': case 'tar': case 'gz': case 'iso': case 'dmg': case 'pkg': case 'mht': kind = 'archive'; break;
      
      // Code / Web
      case 'html': case 'htm': case 'xml': case 'css': case 'js': case 'ts': case 'jsx': case 'tsx': case 'json': case 'php': case 'sql': case 'py': case 'c': case 'cpp': case 'cs': case 'java': case 'rb': case 'go': case 'sh': case 'bat': case 'ipynb': case 'pkt': case 'lock': case 'yml': case 'yaml': kind = 'code'; break;
      
      // Fonts
      case 'ttf': case 'otf': case 'woff': case 'woff2': case 'eot': kind = 'font'; break;

      // System / Misc
      case 'exe': case 'msi': case 'apk': case 'app': case 'jar': case 'dll': case 'pdb': case 'lnk': case 'dat': case 'sqlite': case 'db': case 'drawio': case 'dmp': kind = 'binary'; break;
      
      default: kind = 'other';
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
  if (button.classList.contains('cqd-success')) return 'success';
  if (button.classList.contains('cqd-error')) return 'error';
  return 'idle';
}

function setButtonState(button: HTMLButtonElement, state: ButtonState, options?: { userMessage?: string }): void {
  const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
  const label = button.querySelector<HTMLSpanElement>('.cqd-label');
  const errorDetail = button.querySelector<HTMLSpanElement>('.cqd-error-detail');
  if (!icon || !label || !errorDetail) return;

  button.classList.remove('cqd-loading', 'cqd-success', 'cqd-error');
  icon.classList.remove('cqd-spinner');
  icon.textContent = '';
  button.disabled = false;
  button.style.backgroundColor = '#1a73e8';
  label.textContent = 'Download';
  errorDetail.textContent = '';

  icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
  icon.style.backgroundSize = '';

  switch (state) {
    case 'idle': break;
    case 'loading':
      button.classList.add('cqd-loading');
      button.disabled = true;
      label.textContent = 'Downloading…';
      icon.classList.add('cqd-spinner');
      icon.style.backgroundImage = 'none';
      break;
    case 'success':
      button.classList.add('cqd-success');
      button.style.backgroundColor = '#188038';
      label.textContent = 'Downloaded';
      icon.style.backgroundImage = `url("${SUCCESS_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;
    case 'error':
      button.classList.add('cqd-error');
      button.style.backgroundColor = '#e05952';
      label.textContent = 'Error';
      icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      errorDetail.textContent = options?.userMessage || 'Download failed.';
      break;
  }
}

/* -----------------------------------------------------
 * Button factory
 * ---------------------------------------------------*/

function createDownloadButton(_container: HTMLElement, url: string, fileMeta: FileMeta): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cqd-download-btn';
  button.setAttribute(INJECTED_ATTR, 'true');
  button.setAttribute('aria-label', `Download ${fileMeta.name || 'attachment'}`);
  button.setAttribute('title', 'Quick download');

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'cqd-icon-wrapper';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'cqd-download-icon';
  iconWrapper.appendChild(iconSpan);

  const label = document.createElement('span');
  label.className = 'cqd-label';
  label.textContent = 'Download';
  const errorDetail = document.createElement('span');
  errorDetail.className = 'cqd-error-detail';

  button.appendChild(iconWrapper);
  button.appendChild(label);
  button.appendChild(errorDetail);

  button.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    await handleSingleDownloadClick(button, url, fileMeta);
  });
  return button;
}

async function handleSingleDownloadClick(button: HTMLButtonElement, url: string, fileMeta: FileMeta): Promise<void> {
  if (!url) return;
  if (getButtonState(button) !== 'idle') return;

  const requestId = `cqd-${Date.now()}-${nextRequestSeq++}`;
  const startedAt = Date.now();
  setButtonState(button, 'loading');

  const startResult = await startBackgroundDownload(requestId, url, fileMeta);
  await ensureMinLoading(startedAt);

  if (!startResult.ok) {
    await showErrorState(button, startResult.userMessage);
    return;
  }
  setButtonState(button, 'success');
  await delay(FEEDBACK_SUCCESS_MS);
  if (getButtonState(button) === 'success') setButtonState(button, 'idle');
}

function startBackgroundDownload(requestId: string, url: string, fileMeta: FileMeta): Promise<{ ok: boolean; userMessage?: string }> {
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
            resolve({ ok: false, userMessage: response?.userMessage || 'Could not start download.' });
          } else {
            resolve({ ok: true });
          }
        }
      );
    } catch {
      resolve({ ok: false, userMessage: 'Extension communication error.' });
    }
  });
}

/* -----------------------------------------------------
 * UI Utils
 * ---------------------------------------------------*/

async function showErrorState(button: HTMLButtonElement, userMessage?: string): Promise<void> {
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

function initContentScript(): void {
  if (!isGoogleClassroom()) return;
  injectStyles();
  setupObservers();
}

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() { initContentScript(); },
});