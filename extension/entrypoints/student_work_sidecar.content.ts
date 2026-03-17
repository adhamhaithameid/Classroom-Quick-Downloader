// filepath: extension/entrypoints/student_work_sidecar.content.ts

import { subscribeToGlobalState } from './content/flags';
import { injectStyles } from './content/styles';
import { extractFileMeta } from './content/file-meta';
import { createStudentWorkButton } from '../src/student_work/button';
import {
  extractAuthUserFromClassroomPath,
  buildDriveDownloadUrl,
  extractDriveIdFromClassroomUrl,
  isStudentWorkAttachmentUrl,
  isStudentWorkByStatusRoute,
  isStudentWorkRoute,
} from '../src/student_work/url-classifier';

// 120ms seems okay right? my mentor told me to add debounce to everything.
const SCAN_DEBOUNCE_MS = 120;
const RESCAN_INTERVAL_MS = 2_000;
const SIDE_CAR_ATTR = 'data-cqd-sw-processed';
const FLAG_ARTIFACT_SELECTOR = [
  '.cqd-flag',
  '.cqd-comment-badge',
  '.cqd-edited-badge',
  '.cqd-both-badge',
  '.cqd-overlay-container',
  '.cqd-v2-flag',
  '.cqd-v2-overlay',
].join(',');
const FLAG_ARTIFACT_ATTRS = [
  'data-cqd-v2-flag',
  'data-cqd-v2-flag-verdict',
  'data-cqd-v2-flag-click',
  'data-cqd-injected',
  'data-cqd-comments-processed',
  'data-cqd-edited-processed',
  'data-cqd-comment-count',
  'data-cqd-edit-diff',
  'data-cqd-edit-tooltip',
  'data-cqd-comments-processed',
  'data-cqd-edit-processed',
  'data-cqd-processed',
];

// super important state flags. plz do not delete!!1!
let running = false;
let observer: MutationObserver | null = null;
let rescanIntervalId: number | null = null;
let pendingScanTimer: number | null = null;

// this counts things. IDK why it needs to but it works so I'm not touching it.
function countAttachmentMarkers(container: HTMLElement): number {
  let count = 0;

  if (container instanceof HTMLAnchorElement && container.href) {
    if (isStudentWorkAttachmentUrl(container.href)) count += 1;
  }

  if (container.hasAttribute('data-drive-id')) count += 1;

  const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));
  for (const anchor of anchors) {
    if (anchor.href && isStudentWorkAttachmentUrl(anchor.href)) count += 1;
  }

  count += container.querySelectorAll('[data-drive-id]').length;
  return count;
}

function findNearestAttachmentContainer(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    if (current.tagName.toLowerCase() === 'a') {
      current = current.parentElement;
      continue;
    }

    const markerCount = countAttachmentMarkers(current);
    if (markerCount >= 1) return current;
    current = current.parentElement;
  }

  return element.parentElement ?? element;
}

// wow this is a long list of classes lol, gg google
function resolveContainer(element: HTMLElement): HTMLElement | null {
  const candidates = [
    element,
    element.closest<HTMLElement>('[data-submission-attachment-id]'),
    element.closest<HTMLElement>('[data-drive-id]'),
    element.closest<HTMLElement>('[data-item-id]'),
    element.closest<HTMLElement>('.nQ1Fvb'),
    element.closest<HTMLElement>('.ndfuHe'),
    element.closest<HTMLElement>('.KlRXdf'),
    element.closest<HTMLElement>('.luto0c'),
    element.closest<HTMLElement>('.gmNu1d'),
    element.closest<HTMLElement>('[data-stream-item-id]'),
    element.closest<HTMLElement>('[role="listitem"]'),
    element.parentElement,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const refined = findNearestAttachmentContainer(candidate);
    if (refined) return refined;
  }
  return findNearestAttachmentContainer(element);
}

function getAuthUserParam(): string | null {
  try {
    const parsed = new URL(window.location.href);
    const queryAuthUser = parsed.searchParams.get('authuser');
    if (queryAuthUser && queryAuthUser.trim().length > 0) return queryAuthUser.trim();
    return extractAuthUserFromClassroomPath(parsed.pathname);
  } catch {
    return null;
  }
}

// check if our button is already here so we don't spam it
function shouldInjectIntoContainer(container: HTMLElement): boolean {
  if (container.querySelector('.cqd-download-btn:not([data-cqd-sw="true"])')) {
    // Existing CQD button already owns this container.
    return false;
  }

  return !container.querySelector('.cqd-download-btn[data-cqd-sw="true"]');
}

function hasStudentWorkButton(container: HTMLElement): boolean {
  return !!container.querySelector('.cqd-download-btn[data-cqd-sw="true"]');
}

function ensurePositionedContainer(element: HTMLElement): void {
  const computed = window.getComputedStyle(element);
  if (computed.position === 'static' || !computed.position) {
    element.style.position = 'relative';
  }
}

function resolveButtonHost(
  container: HTMLElement,
  anchor: HTMLAnchorElement | null,
): HTMLElement {
  if (anchor) {
    const card = anchor.closest<HTMLElement>(
      '.WkZsyc, [data-submission-attachment-id], div[jsaction*="x2MKlc"], [data-item-id], [role="listitem"]',
    );
    if (card && container.contains(card)) return card;
  }

  const fallbackCard = container.closest<HTMLElement>(
    '.WkZsyc, [data-submission-attachment-id], div[jsaction*="x2MKlc"], [data-item-id], [role="listitem"]',
  );
  if (fallbackCard) return fallbackCard;

  return container;
}

function deriveFileKey(container: HTMLElement, sourceUrl: string, fallbackId?: string): string {
  const scopedId =
    container.getAttribute('data-submission-attachment-id') ||
    container.getAttribute('data-item-id') ||
    container.getAttribute('data-drive-id') ||
    fallbackId ||
    '';
  return scopedId ? `${sourceUrl}::${scopedId}` : sourceUrl;
}

// regex is hard, hope this one doesn't break in production 🤞🏻
function deriveAttachmentNameFromAnchor(anchor: HTMLAnchorElement): string | null {
  const aria = (anchor.getAttribute('aria-label') || '').trim();
  if (aria.length > 0) {
    const parts = aria.split(':').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 1];
      if (candidate && !/^attachment$/i.test(candidate)) return candidate;
    } else if (!/^attachment$/i.test(aria)) {
      return aria;
    }
  }

  const title = (anchor.getAttribute('title') || '').trim();
  if (title.length > 0 && !/^attachment$/i.test(title)) return title;

  const text = (anchor.textContent || '').trim();
  if (text.length > 0 && !/^attachment$/i.test(text)) return text;

  return null;
}

function applyAnchorNameHint(fileMeta: { name?: string; ext?: string }, anchor: HTMLAnchorElement): void {
  const derivedName = deriveAttachmentNameFromAnchor(anchor);
  if (!derivedName) return;
  fileMeta.name = derivedName;
  const extMatch = derivedName.match(/\.([a-zA-Z0-9]{2,10})$/);
  if (extMatch?.[1]) {
    fileMeta.ext = extMatch[1].toLowerCase();
  }
}

function collectScopedDriveIds(scope: ParentNode): string[] {
  const ids = new Set<string>();

  if (scope instanceof HTMLElement) {
    const ownId = scope.getAttribute('data-drive-id')?.trim() || '';
    if (ownId) ids.add(ownId);
  }

  const descendants = Array.from(scope.querySelectorAll<HTMLElement>('[data-drive-id]'));
  for (const element of descendants) {
    const id = element.getAttribute('data-drive-id')?.trim() || '';
    if (id) ids.add(id);
  }

  return Array.from(ids);
}

function resolveDriveIdForAnchor(anchor: HTMLAnchorElement, container: HTMLElement): string | null {
  const fromUrl = extractDriveIdFromClassroomUrl(anchor.href);
  if (fromUrl) return fromUrl;

  const anchorCarrier = anchor.closest<HTMLElement>('[data-drive-id]');
  if (anchorCarrier && container.contains(anchorCarrier)) {
    const anchorCarrierId = anchorCarrier.getAttribute('data-drive-id')?.trim() || '';
    if (anchorCarrierId) return anchorCarrierId;
  }

  const scopedCard = anchor.closest<HTMLElement>(
    '.WkZsyc, [data-submission-attachment-id], [data-item-id], div[jsaction*="x2MKlc"], [role="listitem"]',
  );
  if (scopedCard) {
    const scopedIds = collectScopedDriveIds(scopedCard);
    if (scopedIds.length === 1) return scopedIds[0];
  }

  const containerIds = collectScopedDriveIds(container);
  if (containerIds.length === 1) return containerIds[0];

  return null;
}

function cleanupStudentWorkFlags(root: ParentNode = document): void {
  const artifacts = root.querySelectorAll<HTMLElement>(FLAG_ARTIFACT_SELECTOR);
  artifacts.forEach((node) => node.remove());

  const maybeFlagged = root.querySelectorAll<HTMLElement>(
    '[data-cqd-v2-flag], [data-cqd-v2-flag-verdict], [data-cqd-v2-flag-click], [data-cqd-injected], [data-cqd-comments-processed], [data-cqd-edited-processed], [data-cqd-comment-count], [data-cqd-edit-diff], [data-cqd-edit-tooltip], [data-cqd-comments-processed], [data-cqd-edit-processed], [data-cqd-processed]',
  );
  for (const element of maybeFlagged) {
    for (const attr of FLAG_ARTIFACT_ATTRS) {
      if (element.hasAttribute(attr)) {
        element.removeAttribute(attr);
      }
    }
  }
}

function cleanupSidecarArtifacts(root: ParentNode = document): void {
  const sidecarButtons = root.querySelectorAll<HTMLButtonElement>(
    '.cqd-download-btn[data-cqd-sw="true"]:not([data-cqd-sw-bs="true"])',
  );
  sidecarButtons.forEach((button) => button.remove());

  const processedMarkers = root.querySelectorAll<HTMLElement>(`[${SIDE_CAR_ATTR}="true"]`);
  processedMarkers.forEach((element) => element.removeAttribute(SIDE_CAR_ATTR));
}

// the main gig. scan ALL the links and put buttons on them!!! vroom vroom
export function scanStudentWorkLinks(root: ParentNode = document): void {
  if (!running) return;
  const pathname = window.location.pathname;
  if (!isStudentWorkRoute(pathname)) return;
  if (isStudentWorkByStatusRoute(pathname)) {
    cleanupStudentWorkFlags(document);
    cleanupSidecarArtifacts(document);
    return;
  }

  cleanupStudentWorkFlags(document);

  const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
  for (const anchor of anchors) {
    if (!anchor.href) continue;
    if (!isStudentWorkAttachmentUrl(anchor.href)) continue;

    const container = resolveContainer(anchor);
    if (!container) continue;
    const host = resolveButtonHost(container, anchor);
    if (anchor.getAttribute(SIDE_CAR_ATTR) === 'true') {
      if (hasStudentWorkButton(host)) continue;
      anchor.removeAttribute(SIDE_CAR_ATTR);
    }
    if (!shouldInjectIntoContainer(host)) {
      anchor.setAttribute(SIDE_CAR_ATTR, 'true');
      continue;
    }

    const resolvedDriveId = resolveDriveIdForAnchor(anchor, container);
    const sourceUrl = resolvedDriveId
      ? buildDriveDownloadUrl(resolvedDriveId, getAuthUserParam())
      : anchor.href;

    const fileMeta = extractFileMeta(host, sourceUrl);
    applyAnchorNameHint(fileMeta, anchor);
    const button = createStudentWorkButton(sourceUrl, fileMeta);
    button.dataset.cqdSwSourceUrl = sourceUrl;
    if (resolvedDriveId) button.dataset.cqdSwFileId = resolvedDriveId;
    button.dataset.cqdFileKey = deriveFileKey(host, sourceUrl, resolvedDriveId || undefined);
    ensurePositionedContainer(host);
    host.appendChild(button);

    anchor.setAttribute(SIDE_CAR_ATTR, 'true');
  }

  const driveIdElements = Array.from(root.querySelectorAll<HTMLElement>('[data-drive-id]'));
  const authUser = getAuthUserParam();
  for (const element of driveIdElements) {
    const fileId = element.getAttribute('data-drive-id')?.trim();
    if (!fileId) continue;
    if (collectScopedDriveIds(element).length > 1) {
      element.setAttribute(SIDE_CAR_ATTR, 'true');
      continue;
    }

    const container = resolveContainer(element);
    if (!container) continue;
    const host = resolveButtonHost(container, null);
    if (element.getAttribute(SIDE_CAR_ATTR) === 'true') {
      if (hasStudentWorkButton(host)) continue;
      element.removeAttribute(SIDE_CAR_ATTR);
    }
    if (!shouldInjectIntoContainer(host)) {
      element.setAttribute(SIDE_CAR_ATTR, 'true');
      continue;
    }

    const downloadUrl = buildDriveDownloadUrl(fileId, authUser);
    const fileMeta = extractFileMeta(host, downloadUrl);
    const button = createStudentWorkButton(downloadUrl, fileMeta);
    button.dataset.cqdSwSourceUrl = downloadUrl;
    button.dataset.cqdSwFileId = fileId;
    button.dataset.cqdFileKey = deriveFileKey(host, downloadUrl, fileId);
    ensurePositionedContainer(host);
    host.appendChild(button);

    element.setAttribute(SIDE_CAR_ATTR, 'true');
  }
}

export function setStudentWorkSidecarRunningForTest(value: boolean): void {
  running = value;
}

export function resetStudentWorkSidecarForTest(): void {
  running = false;
  clearPendingScan();
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (rescanIntervalId != null) {
    window.clearInterval(rescanIntervalId);
    rescanIntervalId = null;
  }

  const sidecarButtons = document.querySelectorAll<HTMLButtonElement>('.cqd-download-btn[data-cqd-sw="true"]');
  sidecarButtons.forEach((button) => button.remove());

  const processedMarkers = document.querySelectorAll<HTMLElement>(`[${SIDE_CAR_ATTR}="true"]`);
  processedMarkers.forEach((element) => element.removeAttribute(SIDE_CAR_ATTR));
}

function clearPendingScan(): void {
  if (pendingScanTimer != null) {
    window.clearTimeout(pendingScanTimer);
    pendingScanTimer = null;
  }
}

function scheduleScan(): void {
  clearPendingScan();
  pendingScanTimer = window.setTimeout(() => {
    pendingScanTimer = null;
    scanStudentWorkLinks(document);
  }, SCAN_DEBOUNCE_MS);
}

function startSidecar(): void {
  // wait for changes and then FIRE the laser (scanner)
  if (running) return;
  running = true;

  injectStyles();
  scanStudentWorkLinks(document);

  observer = new MutationObserver((mutations) => {
    let shouldScan = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        shouldScan = true;
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          scanStudentWorkLinks(node);
        }
      } else if (mutation.type === 'attributes') {
        shouldScan = true;
      }
    }

    if (shouldScan) {
      scheduleScan();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'class', SIDE_CAR_ATTR],
  });

  rescanIntervalId = window.setInterval(() => {
    scanStudentWorkLinks(document);
  }, RESCAN_INTERVAL_MS);

  window.addEventListener('scroll', scheduleScan, { passive: true });
}

function stopSidecar(): void {
  if (!running) return;
  running = false;

  clearPendingScan();

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  if (rescanIntervalId != null) {
    window.clearInterval(rescanIntervalId);
    rescanIntervalId = null;
  }

  window.removeEventListener('scroll', scheduleScan);

  const sidecarButtons = document.querySelectorAll<HTMLButtonElement>('.cqd-download-btn[data-cqd-sw="true"]');
  sidecarButtons.forEach((button) => button.remove());

  const processedMarkers = document.querySelectorAll<HTMLElement>(`[${SIDE_CAR_ATTR}="true"]`);
  processedMarkers.forEach((element) => element.removeAttribute(SIDE_CAR_ATTR));
}

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    // pls work on first try🤞
    subscribeToGlobalState(
      () => startSidecar(),
      () => stopSidecar(),
    );
  },
});
