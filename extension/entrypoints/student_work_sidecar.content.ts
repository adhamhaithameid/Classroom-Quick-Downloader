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
  isStudentWorkRoute,
} from '../src/student_work/url-classifier';

const SCAN_DEBOUNCE_MS = 120;
const RESCAN_INTERVAL_MS = 2_000;
const SIDE_CAR_ATTR = 'data-cqd-sw-processed';

let running = false;
let observer: MutationObserver | null = null;
let rescanIntervalId: number | null = null;
let pendingScanTimer: number | null = null;

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
    if (markerCount <= 1) return current;
    current = current.parentElement;
  }

  return element.parentElement ?? element;
}

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

function deriveFileKey(container: HTMLElement, sourceUrl: string, fallbackId?: string): string {
  const scopedId =
    container.getAttribute('data-submission-attachment-id') ||
    container.getAttribute('data-item-id') ||
    container.getAttribute('data-drive-id') ||
    fallbackId ||
    '';
  return scopedId ? `${sourceUrl}::${scopedId}` : sourceUrl;
}

function resolveDriveIdForAnchor(anchor: HTMLAnchorElement, container: HTMLElement): string | null {
  const fromUrl = extractDriveIdFromClassroomUrl(anchor.href);
  if (fromUrl) return fromUrl;

  const localCarrier = anchor.closest<HTMLElement>('[data-drive-id]') ||
    container.closest<HTMLElement>('[data-drive-id]');
  const localId = localCarrier?.getAttribute('data-drive-id')?.trim() || '';
  return localId || null;
}

export function scanStudentWorkLinks(root: ParentNode = document): void {
  if (!running) return;
  if (!isStudentWorkRoute(window.location.pathname)) return;

  const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
  for (const anchor of anchors) {
    if (!anchor.href) continue;
    if (!isStudentWorkAttachmentUrl(anchor.href)) continue;

    const container = resolveContainer(anchor);
    if (!container) continue;
    if (anchor.getAttribute(SIDE_CAR_ATTR) === 'true') {
      if (hasStudentWorkButton(container)) continue;
      anchor.removeAttribute(SIDE_CAR_ATTR);
    }
    if (!shouldInjectIntoContainer(container)) {
      anchor.setAttribute(SIDE_CAR_ATTR, 'true');
      continue;
    }

    const resolvedDriveId = resolveDriveIdForAnchor(anchor, container);
    const sourceUrl = resolvedDriveId
      ? buildDriveDownloadUrl(resolvedDriveId, getAuthUserParam())
      : anchor.href;

    const fileMeta = extractFileMeta(container, sourceUrl);
    const button = createStudentWorkButton(sourceUrl, fileMeta);
    button.dataset.cqdSwSourceUrl = sourceUrl;
    if (resolvedDriveId) button.dataset.cqdSwFileId = resolvedDriveId;
    button.dataset.cqdFileKey = deriveFileKey(container, sourceUrl, resolvedDriveId || undefined);
    ensurePositionedContainer(container);
    container.appendChild(button);

    anchor.setAttribute(SIDE_CAR_ATTR, 'true');
  }

  const driveIdElements = Array.from(root.querySelectorAll<HTMLElement>('[data-drive-id]'));
  const authUser = getAuthUserParam();
  for (const element of driveIdElements) {
    const fileId = element.getAttribute('data-drive-id')?.trim();
    if (!fileId) continue;

    const container = resolveContainer(element);
    if (!container) continue;
    if (element.getAttribute(SIDE_CAR_ATTR) === 'true') {
      if (hasStudentWorkButton(container)) continue;
      element.removeAttribute(SIDE_CAR_ATTR);
    }
    if (!shouldInjectIntoContainer(container)) {
      element.setAttribute(SIDE_CAR_ATTR, 'true');
      continue;
    }

    const downloadUrl = buildDriveDownloadUrl(fileId, authUser);
    const fileMeta = extractFileMeta(container, downloadUrl);
    const button = createStudentWorkButton(downloadUrl, fileMeta);
    button.dataset.cqdSwSourceUrl = downloadUrl;
    button.dataset.cqdSwFileId = fileId;
    button.dataset.cqdFileKey = deriveFileKey(container, downloadUrl, fileId);
    ensurePositionedContainer(container);
    container.appendChild(button);

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
    subscribeToGlobalState(
      () => startSidecar(),
      () => stopSidecar(),
    );
  },
});
