import { subscribeToGlobalState } from './content/flags';
import { injectStyles } from './content/styles';
import { extractFileMeta } from './content/file-meta';
import { createStudentWorkButton } from '../src/student_work/button';
import {
  extractAuthUserFromClassroomPath,
  buildDriveDownloadUrl,
  extractDriveIdFromClassroomUrl,
  isStudentWorkAttachmentUrl,
} from '../src/student_work/url-classifier';
import { registerButtonsInSubtree } from '../src/download-all/group-manager';
import { scheduleRefresh } from '../src/download-all/refresh';

const BY_STATUS_ROUTE_RE =
  /^\/(?:u\/\d+\/)?c\/[^/]+\/a\/[^/]+\/submissions\/by-status\/and-sort-name\/[^/]+\/[^/]+/;

const SCAN_DEBOUNCE_MS = 120;
const RESCAN_INTERVAL_MS = 2_000;
const SIDE_CAR_ATTR = 'data-cqd-sw-bs-processed';
const DOWNLOAD_ALL_HOST_ATTR = 'data-cqd-sw-bs-host';
const DOWNLOAD_ALL_HEADER_ATTR = 'data-cqd-sw-bs-header';
const DOWNLOAD_ALL_GROUP_ID = 'cqd-sw-bs-host';
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

let running = false;
let observer: MutationObserver | null = null;
let rescanIntervalId: number | null = null;
let pendingScanTimer: number | null = null;

function isByStatusRoute(pathname: string): boolean {
  return BY_STATUS_ROUTE_RE.test(pathname);
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

function isDriveOrDocsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    return parsed.hostname === 'drive.google.com' || parsed.hostname === 'docs.google.com';
  } catch {
    return false;
  }
}

function getAriaLabel(anchor: HTMLAnchorElement): string {
  return (anchor.getAttribute('aria-label') || '').toLowerCase();
}

function isMenuAnchor(anchor: HTMLAnchorElement): boolean {
  if (anchor.getAttribute('role') === 'menuitem') return true;
  return !!anchor.closest('[role="menu"], [role="menuitem"]');
}

function isOpenFolderLink(anchor: HTMLAnchorElement): boolean {
  const aria = getAriaLabel(anchor);
  return aria.includes('open folder');
}

function isSubmissionAttachmentAnchor(anchor: HTMLAnchorElement): boolean {
  if (!anchor.href) return false;
  if (!isStudentWorkAttachmentUrl(anchor.href)) return false;
  if (isMenuAnchor(anchor)) return false;
  if (isOpenFolderLink(anchor)) return false;
  const aria = getAriaLabel(anchor);
  if (aria.includes('attachment')) return true;
  return anchor.classList.contains('vwNuXe');
}

function isAttachmentUrl(rawUrl: string): boolean {
  return isStudentWorkAttachmentUrl(rawUrl) || isDriveOrDocsUrl(rawUrl);
}

function hasLocalAttachmentMarker(container: HTMLElement): boolean {
  const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));
  return anchors.some((anchor) => isSubmissionAttachmentAnchor(anchor)) ||
    container.hasAttribute('data-drive-id');
}

function countAttachmentMarkers(container: HTMLElement): number {
  let count = 0;

  if (container instanceof HTMLAnchorElement && container.href) {
    if (isSubmissionAttachmentAnchor(container)) count += 1;
  }

  if (container.hasAttribute('data-drive-id') && hasLocalAttachmentMarker(container)) count += 1;

  const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));
  for (const anchor of anchors) {
    if (anchor.href && isSubmissionAttachmentAnchor(anchor)) count += 1;
  }

  if (hasLocalAttachmentMarker(container)) {
    count += container.querySelectorAll('[data-drive-id]').length;
  }
  return count;
}

function findNearestAttachmentContainer(element: HTMLElement): HTMLElement {
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

function resolveContainer(element: HTMLElement): HTMLElement {
  const candidates = [
    element,
    element.closest<HTMLElement>('div[jsaction*="x2MKlc"]'),
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
    return findNearestAttachmentContainer(candidate);
  }

  return findNearestAttachmentContainer(element);
}

function getSourceUrlForButton(button: HTMLButtonElement): string {
  return (button.dataset.cqdSwSourceUrl || '').trim();
}

function hasButtonForAnchor(container: HTMLElement, anchor: HTMLAnchorElement): boolean {
  const buttons = container.querySelectorAll<HTMLButtonElement>(
    '.cqd-download-btn[data-cqd-sw-bs="true"]',
  );
  for (const button of buttons) {
    if (getSourceUrlForButton(button) === anchor.href) return true;
  }
  return false;
}

function hasButtonForSourceUrl(container: HTMLElement, sourceUrl: string): boolean {
  const buttons = container.querySelectorAll<HTMLButtonElement>(
    '.cqd-download-btn[data-cqd-sw-bs="true"]',
  );
  for (const button of buttons) {
    if (getSourceUrlForButton(button) === sourceUrl) return true;
  }
  return false;
}

function hasButtonForDriveId(container: HTMLElement, fileId: string): boolean {
  const buttons = container.querySelectorAll<HTMLButtonElement>(
    '.cqd-download-btn[data-cqd-sw-bs="true"]',
  );
  for (const button of buttons) {
    if ((button.dataset.cqdSwFileId || '').trim() === fileId) return true;
  }
  return false;
}

function cleanupLegacyButtons(root: ParentNode = document): void {
  const legacyButtons = root.querySelectorAll<HTMLButtonElement>(
    '.cqd-download-btn[data-cqd-sw="true"]:not([data-cqd-sw-bs="true"])',
  );
  legacyButtons.forEach((button) => button.remove());
}

function cleanupStudentWorkFlags(root: ParentNode = document): void {
  const artifacts = root.querySelectorAll<HTMLElement>(FLAG_ARTIFACT_SELECTOR);
  artifacts.forEach((node) => node.remove());

  const maybeFlagged = root.querySelectorAll<HTMLElement>(
    '[data-cqd-v2-flag], [data-cqd-v2-flag-verdict], [data-cqd-v2-flag-click], [data-cqd-injected], [data-cqd-comment-count], [data-cqd-edit-diff], [data-cqd-edit-tooltip], [data-cqd-comments-processed], [data-cqd-edited-processed], [data-cqd-edit-processed], [data-cqd-processed]',
  );
  for (const element of maybeFlagged) {
    for (const attr of FLAG_ARTIFACT_ATTRS) {
      if (element.hasAttribute(attr)) {
        element.removeAttribute(attr);
      }
    }
  }
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
      '.WkZsyc, [data-submission-attachment-id], div[jsaction*="x2MKlc"], [data-drive-id], [data-item-id]'
    );
    if (card && container.contains(card)) return card;
  }

  const fallbackCard = container.closest<HTMLElement>(
    '.WkZsyc, [data-submission-attachment-id], div[jsaction*="x2MKlc"], [data-item-id], [role="listitem"]',
  );
  if (fallbackCard) return fallbackCard;

  return container;
}

function deriveByStatusButtonFileKey(
  host: HTMLElement,
  sourceUrl: string,
  fallbackId?: string,
): string {
  const scopedId =
    host.getAttribute('data-submission-attachment-id') ||
    host.getAttribute('data-item-id') ||
    host.getAttribute('data-drive-id') ||
    fallbackId ||
    host.getAttribute('aria-label') ||
    '';
  return scopedId ? `${sourceUrl}::${scopedId}` : sourceUrl;
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

function placeButton(
  container: HTMLElement,
  anchor: HTMLAnchorElement | null,
  button: HTMLButtonElement,
): void {
  button.dataset.cqdSwBs = 'true';
  const host = resolveButtonHost(container, anchor);
  ensurePositionedContainer(host);
  host.appendChild(button);
}

function getAttachmentCards(root: ParentNode): HTMLElement[] {
  const cards = Array.from(root.querySelectorAll<HTMLElement>('.WkZsyc'));
  return cards.filter((card) =>
    Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]')).some((anchor) =>
      isSubmissionAttachmentAnchor(anchor),
    ),
  );
}

function findCommonAncestor(nodes: HTMLElement[]): HTMLElement | null {
  if (nodes.length === 0) return null;
  let current: HTMLElement | null = nodes[0];
  while (current) {
    if (nodes.every((node) => current && current.contains(node))) return current;
    current = current.parentElement;
  }
  return null;
}

function resolveDownloadAllHost(
  root: ParentNode,
): { host: HTMLElement; insertBefore: HTMLElement | null } | null {
  const cards = getAttachmentCards(root);
  if (cards.length > 0) {
    const initialHost = findCommonAncestor(cards) || cards[0].parentElement;
    if (!initialHost) return null;
    const host = expandHostForByStatusControls(initialHost, cards);
    const sharedParent = cards.every((card) => card.parentElement === cards[0].parentElement)
      ? cards[0].parentElement
      : null;
    return { host, insertBefore: sharedParent };
  }

  const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .filter((anchor) => isSubmissionAttachmentAnchor(anchor));
  if (anchors.length === 0) return null;
  const anchorParents = anchors.map((anchor) => anchor.parentElement).filter(Boolean) as HTMLElement[];
  if (anchorParents.length === 0) return null;
  const initialHost = findCommonAncestor(anchorParents) || anchorParents[0];
  const host = expandHostForByStatusControls(initialHost, []);
  return { host, insertBefore: null };
}

function isOpenFolderControlAnchor(anchor: HTMLAnchorElement): boolean {
  if (anchor.getAttribute('role') === 'menuitem') return false;
  const aria = getAriaLabel(anchor);
  return aria.includes('open folder');
}

function hasByStatusFolderControlBeforeCards(container: HTMLElement, cards: HTMLElement[]): boolean {
  const folderAnchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .filter((anchor) => isOpenFolderControlAnchor(anchor));
  if (folderAnchors.length === 0) return false;
  if (cards.length === 0) return true;

  const firstCard = cards[0];
  return folderAnchors.some((anchor) => {
    if (!container.contains(anchor)) return false;
    if (anchor.contains(firstCard) || firstCard.contains(anchor)) return false;
    const rel = anchor.compareDocumentPosition(firstCard);
    return !!(rel & Node.DOCUMENT_POSITION_FOLLOWING);
  });
}

function expandHostForByStatusControls(initialHost: HTMLElement, cards: HTMLElement[]): HTMLElement {
  let current: HTMLElement | null = initialHost;
  while (current && current !== document.body && current !== document.documentElement) {
    if (hasByStatusFolderControlBeforeCards(current, cards)) {
      return current;
    }
    current = current.parentElement;
  }
  return initialHost;
}

function findByStatusControlsRow(host: HTMLElement): HTMLElement | null {
  const cards = Array.from(host.querySelectorAll<HTMLElement>('.WkZsyc'));
  if (cards.length === 0) return null;

  const folderAnchors = Array.from(host.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .filter((anchor) => isOpenFolderControlAnchor(anchor));
  for (const anchor of folderAnchors) {
    let node: HTMLElement | null =
      anchor.closest<HTMLElement>('.pYTkkf-Bz112c-LgbsSe') ||
      anchor.parentElement;
    let fallback: HTMLElement | null = null;

    while (node && node !== host) {
      const containsCard = cards.some((card) => node?.contains(card));
      if (containsCard) {
        break;
      }
      fallback = node;
      node = node.parentElement;
    }

    if (fallback) {
      return fallback;
    }
  }

  return null;
}

function ensureDownloadAllHeader(
  host: HTMLElement,
  insertBefore: HTMLElement | null,
  controlsRow: HTMLElement | null,
): HTMLElement {
  const searchRoot = controlsRow || host;
  const existing = searchRoot.querySelector<HTMLElement>(`[${DOWNLOAD_ALL_HEADER_ATTR}="true"]`);
  if (existing) return existing;

  const header = document.createElement('div');
  header.dataset.cqdSwBsHeader = 'true';
  header.className = 'N5dSp';
  if (controlsRow) {
    ensurePositionedContainer(controlsRow);
    header.style.position = 'absolute';
    header.style.top = '50%';
    header.style.left = '50%';
    header.style.transform = 'translate(-50%, -50%)';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'center';
    header.style.width = 'max-content';
    header.style.zIndex = '7';
    controlsRow.appendChild(header);
  } else {
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'center';
    header.style.width = '100%';
    header.style.margin = '4px 0 8px';

    if (insertBefore && insertBefore.parentElement === host) {
      host.insertBefore(header, insertBefore);
    } else {
      host.insertBefore(header, host.firstChild);
    }
  }
  return header;
}

function cleanupStaleByStatusDownloadAllHosts(activeHost: HTMLElement): void {
  const staleHosts = Array.from(
    document.querySelectorAll<HTMLElement>(`[${DOWNLOAD_ALL_HOST_ATTR}="true"]`),
  ).filter((host) => host !== activeHost);

  for (const staleHost of staleHosts) {
    staleHost.removeAttribute(DOWNLOAD_ALL_HOST_ATTR);
    if (staleHost.getAttribute('data-stream-item-id') === DOWNLOAD_ALL_GROUP_ID) {
      staleHost.removeAttribute('data-stream-item-id');
    }
    const staleHeader = staleHost.querySelector<HTMLElement>(`[${DOWNLOAD_ALL_HEADER_ATTR}="true"]`);
    if (staleHeader) staleHeader.remove();
    const staleButtons = staleHost.querySelectorAll<HTMLButtonElement>('.cqd-download-all-btn');
    staleButtons.forEach((button) => button.remove());
  }
}

function dedupeDownloadAllButtons(host: HTMLElement): void {
  const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.cqd-download-all-btn'));
  if (buttons.length <= 1) return;
  for (let i = 1; i < buttons.length; i += 1) {
    buttons[i].remove();
  }
}

function ensureDownloadAllForByStatus(root: ParentNode = document): void {
  const resolved = resolveDownloadAllHost(root);
  if (!resolved) return;
  const { host, insertBefore } = resolved;
  const controlsRow = findByStatusControlsRow(host);

  cleanupStaleByStatusDownloadAllHosts(host);
  host.setAttribute(DOWNLOAD_ALL_HOST_ATTR, 'true');
  if (!host.hasAttribute('data-stream-item-id')) {
    host.setAttribute('data-stream-item-id', DOWNLOAD_ALL_GROUP_ID);
  }

  ensureDownloadAllHeader(host, insertBefore, controlsRow);
  dedupeDownloadAllButtons(host);
  registerButtonsInSubtree(host);
  scheduleRefresh();
}

export function scanStudentWorkByStatus(root: ParentNode = document): void {
  if (!running) return;
  if (!isByStatusRoute(window.location.pathname)) return;

  cleanupLegacyButtons(root);
  cleanupStudentWorkFlags(document);

  const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
  const authUser = getAuthUserParam();
  for (const anchor of anchors) {
    if (!anchor.href) continue;
    if (!isSubmissionAttachmentAnchor(anchor)) continue;
    const container = resolveContainer(anchor);
    if (!container) continue;

    const resolvedDriveId = resolveDriveIdForAnchor(anchor, container);
    const sourceUrl = resolvedDriveId
      ? buildDriveDownloadUrl(resolvedDriveId, authUser)
      : anchor.href;
    const hasButton = resolvedDriveId
      ? (hasButtonForDriveId(container, resolvedDriveId) || hasButtonForSourceUrl(container, sourceUrl))
      : (hasButtonForAnchor(container, anchor) || hasButtonForSourceUrl(container, sourceUrl));

    if (anchor.getAttribute(SIDE_CAR_ATTR) === 'true') {
      if (hasButton) continue;
      anchor.removeAttribute(SIDE_CAR_ATTR);
    }
    if (hasButton) {
      anchor.setAttribute(SIDE_CAR_ATTR, 'true');
      continue;
    }

    const fileMeta = extractFileMeta(container, sourceUrl);
    const button = createStudentWorkButton(sourceUrl, fileMeta);
    button.dataset.cqdSwSourceUrl = sourceUrl;
    button.dataset.cqdSwOriginalSourceUrl = anchor.href;
    if (resolvedDriveId) button.dataset.cqdSwFileId = resolvedDriveId;
    button.dataset.cqdName = sourceUrl;
    const host = resolveButtonHost(container, anchor);
    button.dataset.cqdFileKey = deriveByStatusButtonFileKey(host, sourceUrl, resolvedDriveId || undefined);
    placeButton(container, anchor, button);

    anchor.setAttribute(SIDE_CAR_ATTR, 'true');
  }

  const driveIdElements = Array.from(root.querySelectorAll<HTMLElement>('[data-drive-id]'));
  for (const element of driveIdElements) {
    const fileId = element.getAttribute('data-drive-id')?.trim();
    if (!fileId) continue;
    if (collectScopedDriveIds(element).length > 1) {
      element.setAttribute(SIDE_CAR_ATTR, 'true');
      continue;
    }
    if (!hasLocalAttachmentMarker(element)) {
      element.setAttribute(SIDE_CAR_ATTR, 'true');
      continue;
    }

    const container = resolveContainer(element);
    if (!container) continue;
    const host = resolveButtonHost(container, null);
    const hasButton = hasButtonForDriveId(container, fileId) || hasButtonForDriveId(host, fileId);
    if (element.getAttribute(SIDE_CAR_ATTR) === 'true') {
      if (hasButton) continue;
      element.removeAttribute(SIDE_CAR_ATTR);
    }
    if (hasButton) {
      element.setAttribute(SIDE_CAR_ATTR, 'true');
      continue;
    }

    const downloadUrl = buildDriveDownloadUrl(fileId, getAuthUserParam());
    const fileMeta = extractFileMeta(host, downloadUrl);
    const button = createStudentWorkButton(downloadUrl, fileMeta);
    button.dataset.cqdSwSourceUrl = downloadUrl;
    button.dataset.cqdSwFileId = fileId;
    button.dataset.cqdName = downloadUrl;
    button.dataset.cqdFileKey = deriveByStatusButtonFileKey(host, downloadUrl, fileId);
    placeButton(host, null, button);

    element.setAttribute(SIDE_CAR_ATTR, 'true');
  }

  ensureDownloadAllForByStatus(document);
}

export function setStudentWorkByStatusRunningForTest(value: boolean): void {
  running = value;
}

export function resetStudentWorkByStatusForTest(): void {
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

  const sidecarButtons = document.querySelectorAll<HTMLButtonElement>(
    '.cqd-download-btn[data-cqd-sw-bs="true"]',
  );
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
    scanStudentWorkByStatus(document);
  }, SCAN_DEBOUNCE_MS);
}

function startSidecar(): void {
  if (running) return;
  running = true;

  injectStyles();
  scanStudentWorkByStatus(document);

  observer = new MutationObserver((mutations) => {
    let shouldScan = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        shouldScan = true;
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          scanStudentWorkByStatus(node);
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
    scanStudentWorkByStatus(document);
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

  const sidecarButtons = document.querySelectorAll<HTMLButtonElement>(
    '.cqd-download-btn[data-cqd-sw-bs="true"]',
  );
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
