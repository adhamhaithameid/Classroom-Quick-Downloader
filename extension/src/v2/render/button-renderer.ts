// filepath: extension/src/v2/render/button-renderer.ts
/**
 * ============================================================================
 * BUTTON RENDERER — Idempotent Download Button Injection
 * ============================================================================
 *
 * This replaces V1's createDownloadButton() and injectButtonIntoAttachment().
 *
 * The key improvements:
 *
 * 1. TEMPLATE CLONING: V1 created 3 child elements per button with
 *    createElement. V2 pre-builds a template once and uses cloneNode(true)
 *    for each button. This is ~10× faster on large pages.
 *
 * 2. DELEGATED EVENTS: V1 attached mouseenter, mouseleave, click, and
 *    auxclick handlers to EVERY button. V2 uses a single delegated click
 *    handler on the post root. Mouse events are handled purely in CSS.
 *
 * 3. CSS-ONLY HOVER: V1 swapped textContent, backgroundImage, and className
 *    on every mouseenter. V2 uses CSS pseudo-classes and ::after content —
 *    zero JS on hover. See button-styles.ts for the CSS.
 *
 * 4. IDEMPOTENT: Safe to call renderButton() multiple times for the same
 *    file. Uses data-cqd-file-id to prevent duplicates.
 *
 * 5. PLACEMENT-AGNOSTIC: The renderer doesn't decide WHERE to put buttons.
 *    It receives PlacementDecisions from file-placement.ts and follows them.
 *
 * @author Adham — cloneNode(true) was the best perf win I've ever had
 * @since v4.0.0
 */

import type { PlacementDecision } from '../../engines/types';
import type { ScannedFile } from '../model/dom-scanner';
import { getFileIdAttr, getInjectedAttr } from '../decision/file-placement';
import { injectV2Styles } from './button-styles';
import { resolveDownloadUrl } from '../decision/download-url';

/**
 * The user-facing markup contract (z57 S1): v2 buttons carry the SAME class
 * names and inner structure V1's renderer produced — `button.cqd-download-btn`
 * with .cqd-download-icon / .cqd-label / .cqd-error-detail, and
 * `button.cqd-download-all-btn` with .cqd-download-all-main /
 * .cqd-download-all-sub — because that surface is the product contract the QA
 * journeys pin (qa-01/02/05/06 SELECTORS). V2 ownership of the pipeline does
 * not change the user-visible button.
 */

/** Selector the delegated click dispatcher matches buttons by. */
export const V2_BUTTON_SELECTOR = '.cqd-download-btn, .cqd-download-all-btn';

// ============================================================================
// HELPERS — CSS.escape polyfill for jsdom
// ============================================================================

/**
 * Safe CSS.escape fallback for jsdom environments.
 * Same pattern used in file-placement.ts — jsdom doesn't provide CSS.escape.
 */
function safeCssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

// ============================================================================
// TEMPLATE — Pre-built once, cloned for each button
// ============================================================================

/** The pre-built button template. Created lazily on first use. */
let buttonTemplate: HTMLButtonElement | null = null;

/**
 * Create the button template that will be cloned for each button instance.
 *
 * Structure (V1 markup contract — qa SELECTORS pin `button.cqd-download-btn`):
 *   <button class="cqd-download-btn" data-cqd-injected="true" data-cqd-file-id="...">
 *     <span class="cqd-download-icon"></span>
 *     <span class="cqd-label">Download</span>
 *     <span class="cqd-error-detail"></span>
 *   </button>
 */
function getButtonTemplate(): HTMLButtonElement {
  if (buttonTemplate) return buttonTemplate;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cqd-download-btn';
  btn.setAttribute(getInjectedAttr(), 'true');

  const icon = document.createElement('span');
  icon.className = 'cqd-download-icon';

  const label = document.createElement('span');
  label.className = 'cqd-label';
  label.textContent = 'Download';

  const errorDetail = document.createElement('span');
  errorDetail.className = 'cqd-error-detail';

  btn.appendChild(icon);
  btn.appendChild(label);
  btn.appendChild(errorDetail);

  buttonTemplate = btn;
  return btn;
}

/** Pre-built template for Download All button */
let downloadAllTemplate: HTMLButtonElement | null = null;

/**
 * Create the Download All button template.
 *
 * Structure (V1 markup contract — qa SELECTORS pin `button.cqd-download-all-btn`):
 *   <button class="cqd-download-all-btn" data-cqd-injected="true" data-cqd-file-id="download-all:...">
 *     <span class="cqd-icon-wrapper cqd-download-all-icon-wrapper">
 *       <span class="cqd-download-all-icon"></span>
 *     </span>
 *     <span class="cqd-download-all-main">Download all</span>
 *     <span class="cqd-download-all-sub">0 files</span>
 *   </button>
 */
function getDownloadAllTemplate(): HTMLButtonElement {
  if (downloadAllTemplate) return downloadAllTemplate;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cqd-download-all-btn';
  btn.setAttribute(getInjectedAttr(), 'true');

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'cqd-icon-wrapper cqd-download-all-icon-wrapper';
  const icon = document.createElement('span');
  icon.className = 'cqd-download-all-icon';
  iconWrapper.appendChild(icon);

  const main = document.createElement('span');
  main.className = 'cqd-download-all-main';
  main.textContent = 'Download all';

  const sub = document.createElement('span');
  sub.className = 'cqd-download-all-sub';

  btn.appendChild(iconWrapper);
  btn.appendChild(main);
  btn.appendChild(sub);

  downloadAllTemplate = btn;
  return btn;
}

// ============================================================================
// DARK MODE — Detect once, apply to all buttons
// ============================================================================

/**
 * Detect if the page is using dark mode.
 *
 * We check multiple signals:
 * 1. Google's own dark mode class on <body> or <html>
 * 2. The prefers-color-scheme media query
 * 3. Background color brightness analysis
 *
 * This is checked once per render batch, not per button.
 */
export function detectDarkMode(): boolean {
  if (typeof document === 'undefined') return false;

  // Google Classroom adds a specific attribute when in dark mode
  const body = document.body;
  if (!body) return false;

  // Check for Google's dark mode attribute
  if (body.getAttribute('data-theme') === 'dark') return true;

  // Check for common dark mode class names
  const darkClasses = ['dark-theme', 'dark-mode', 'theme-dark'];
  for (const cls of darkClasses) {
    if (body.classList.contains(cls) || document.documentElement.classList.contains(cls)) {
      return true;
    }
  }

  // Check prefers-color-scheme
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) {
    // Also check that the page is actually using dark colors
    // (user might prefer dark but page might not support it)
    const bg = getComputedStyle(body).backgroundColor;
    if (bg) {
      const match = bg.match(/\d+/g);
      if (match && match.length >= 3) {
        const brightness = (parseInt(match[0]) + parseInt(match[1]) + parseInt(match[2])) / 3;
        if (brightness < 128) return true;
      }
    }
  }

  return false;
}

// ============================================================================
// RENDER API — Creating and injecting buttons
// ============================================================================

/**
 * Render a single download button for a file.
 *
 * Creates a button from the template, sets the file-specific data attributes,
 * and inserts it into the DOM at the position specified by the PlacementDecision.
 *
 * @param decision - Where to place the button (from file-placement.ts)
 * @param file - The file this button is for
 * @param isDark - Whether dark mode is active (detected once per batch)
 * @returns The created button element, or null if already placed
 */
export function renderButton(
  decision: PlacementDecision,
  file: ScannedFile,
  isDark: boolean = false,
): HTMLButtonElement | null {
  // Ensure styles are injected
  injectV2Styles();

  // Idempotent check — don't create duplicate buttons. The scope is the
  // target's PARENT because buttons may land as siblings of the anchor
  // (header 'before', anchor 'after'), where a query on the target misses them.
  const dedupeScope = decision.targetElement.parentElement ?? decision.targetElement;
  const existingBtn = dedupeScope.querySelector(
    `[${getFileIdAttr()}="${safeCssEscape(file.canonicalId)}"]`,
  );
  if (existingBtn) return null;

  // Clone the template
  const btn = getButtonTemplate().cloneNode(true) as HTMLButtonElement;

  // Set file-specific attributes
  btn.setAttribute(getFileIdAttr(), file.canonicalId);
  btn.setAttribute('aria-label', `Download ${file.name || 'file'}`);
  btn.title = file.name || 'Download';

  // Store file metadata on the button for the click handler. The URL is the
  // CONVERTED direct-download URL (qa-01 pins data-cqd-url on docs buttons as
  // drive.usercontent.google.com/download?id=…); resolveDownloadUrl is
  // idempotent, so an already-converted discovery URL passes through.
  btn.dataset.cqdUrl = file.downloadUrl ? resolveDownloadUrl(file.downloadUrl) : '';
  btn.dataset.cqdName = file.name || '';
  btn.dataset.cqdExt = file.ext || '';

  // Apply dark mode
  if (isDark) {
    btn.classList.add('cqd-theme-dark');
  }

  // Insert at the position specified by the decision. V1 outcome parity:
  // a button never lands INSIDE an <a> (nested interactive content) — an
  // append-onto an anchor degrades to insert-after, keeping the button inside
  // the attachment container like V1's injectButtonIntoAttachment.
  const point =
    decision.insertionPoint === 'append' &&
    decision.targetElement.tagName === 'A'
      ? 'after'
      : decision.insertionPoint;
  insertAtPosition(btn, decision.targetElement, point);

  return btn;
}

/**
 * Render a batch of buttons for multiple files.
 *
 * More efficient than calling renderButton() in a loop because:
 * 1. Dark mode detection happens once for the batch
 * 2. Style injection is guaranteed before any buttons
 * 3. Uses DocumentFragment for batched DOM insertion where possible
 *
 * @param decisions - Placement decisions from file-placement.ts
 * @param files - Map of canonical file ID → ScannedFile
 * @returns Array of created button elements
 */
export function renderBatch(
  decisions: PlacementDecision[],
  files: Map<string, ScannedFile>,
): HTMLButtonElement[] {
  if (decisions.length === 0) return [];

  // Ensure styles are injected
  injectV2Styles();

  // Detect dark mode once for the whole batch
  const isDark = detectDarkMode();

  const rendered: HTMLButtonElement[] = [];

  for (const decision of decisions) {
    // Check if this is a Download All decision
    const isDownloadAll = decision.fileId.startsWith('download-all:');

    if (isDownloadAll) {
      const postId = decision.fileId.replace('download-all:', '');
      const postFiles = Array.from(files.values());
      const btn = renderDownloadAllButton(decision, postFiles, isDark);
      if (btn) rendered.push(btn);
    } else {
      const file = files.get(decision.fileId);
      if (file) {
        const btn = renderButton(decision, file, isDark);
        if (btn) rendered.push(btn);
      }
    }
  }

  return rendered;
}

/**
 * Render a "Download All" button for a post.
 *
 * @param decision - Placement decision from file-placement.ts
 * @param files - All files in the post
 * @param isDark - Whether dark mode is active
 * @returns The created button element, or null if already placed
 */
export function renderDownloadAllButton(
  decision: PlacementDecision,
  files: ScannedFile[],
  isDark: boolean = false,
): HTMLButtonElement | null {
  // Ensure styles are injected
  injectV2Styles();

  // Idempotent check (parent scope — the button may be a header SIBLING when
  // the recipe inserts 'before', so a query on the target alone misses it).
  const dedupeScope = decision.targetElement.parentElement ?? decision.targetElement;
  const existingBtn = dedupeScope.querySelector(
    `[${getFileIdAttr()}="${safeCssEscape(decision.fileId)}"]`,
  );
  if (existingBtn) return null;

  // Clone the Download All template
  const btn = getDownloadAllTemplate().cloneNode(true) as HTMLButtonElement;

  // Set attributes
  btn.setAttribute(getFileIdAttr(), decision.fileId);
  btn.setAttribute('aria-label', `Download all ${files.length} files`);
  btn.title = `Download All (${files.length} files)`;

  // Add extra class from recipe if specified
  for (const code of decision.reasonCodes) {
    if (code === 'DOWNLOAD_ALL_BUTTON') continue;
    // Recipe-specific classes are added via the decision
  }

  // Seed the group sub-text with the file count (V1 parity: "N files")
  const subEl = btn.querySelector('.cqd-download-all-sub');
  if (subEl) {
    subEl.textContent = `${files.length} ${files.length === 1 ? 'file' : 'files'}`;
  }
  // The group machine's reset restores the idle sub-text from this count.
  btn.dataset.cqdGroupCount = String(files.length);

  // Apply dark mode
  if (isDark) {
    btn.classList.add('cqd-theme-dark');
  }

  // Insert at the position specified by the decision
  insertAtPosition(btn, decision.targetElement, decision.insertionPoint);

  return btn;
}

/**
 * Remove stale buttons from a post.
 *
 * Called when files are removed or when a post is re-scanned.
 * Removes any button whose file ID is not in the valid set.
 *
 * @param postEl - The post element to clean up
 * @param validFileIds - Set of canonical file IDs that should have buttons
 */
export function removeStaleButtons(
  postEl: HTMLElement,
  validFileIds: Set<string>,
): void {
  const allButtons = postEl.querySelectorAll<HTMLButtonElement>(
    `[${getInjectedAttr()}][${getFileIdAttr()}]`,
  );

  for (const btn of allButtons) {
    const fileId = btn.getAttribute(getFileIdAttr());
    if (fileId && !validFileIds.has(fileId)) {
      btn.remove();
    }
  }
}

/**
 * Remove ALL V2-injected buttons from the document or a subtree.
 *
 * Called on engine destroy or mode switch. Scoped to buttons carrying the
 * v2 file-id attribute (plus the retired `.cqd-v2-btn` marker) — V1's own
 * buttons share the `cqd-download-btn` class in shadow mode and must survive
 * a v2 teardown.
 */
export function removeAllV2Buttons(scope: HTMLElement | Document = document): void {
  const allButtons = scope.querySelectorAll<HTMLElement>(
    `[${getInjectedAttr()}][${getFileIdAttr()}], .cqd-v2-btn`,
  );
  for (const btn of allButtons) {
    btn.remove();
  }
}

// ============================================================================
// DELEGATED EVENT HANDLING
// ============================================================================

/** Set of post roots that already have delegated handlers */
const delegatedRoots = new WeakSet<HTMLElement>();

/**
 * Set up a delegated click handler on a post root.
 *
 * Instead of attaching click handlers to every button, we attach ONE handler
 * to the post root and use event delegation. When a v2 download button
 * (.cqd-download-btn / .cqd-download-all-btn) is clicked, we extract the file
 * data from the button's dataset and dispatch accordingly.
 *
 * @param postEl - The post element to set up delegation on
 * @param onSingleClick - Callback for single file download clicks
 * @param onDownloadAllClick - Callback for Download All clicks
 */
export function setupDelegatedClickHandler(
  postEl: HTMLElement,
  onSingleClick: (fileId: string, url: string, name: string, ext: string, button: HTMLButtonElement) => void,
  onDownloadAllClick: (postId: string, button: HTMLButtonElement) => void,
): void {
  // Skip if already set up (using WeakSet so cleanup is automatic via GC)
  if (delegatedRoots.has(postEl)) return;

  postEl.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>(V2_BUTTON_SELECTOR);
    if (!button) return;

    // Prevent the click from propagating to Google's UI
    e.preventDefault();
    e.stopPropagation();

    const fileId = button.getAttribute(getFileIdAttr());
    if (!fileId) return;

    if (fileId.startsWith('download-all:')) {
      const postId = fileId.replace('download-all:', '');
      onDownloadAllClick(postId, button);
    } else {
      const url = button.dataset.cqdUrl || '';
      const name = button.dataset.cqdName || '';
      const ext = button.dataset.cqdExt || '';
      onSingleClick(fileId, url, name, ext, button);
    }
  });

  delegatedRoots.add(postEl);
}

// ============================================================================
// HELPERS — DOM insertion
// ============================================================================

/**
 * Insert an element at a specific position relative to a target.
 *
 * @param element - The element to insert
 * @param target - The reference element
 * @param position - Where to insert relative to target
 */
function insertAtPosition(
  element: HTMLElement,
  target: HTMLElement,
  position: PlacementDecision['insertionPoint'],
): void {
  switch (position) {
    case 'append':
      target.appendChild(element);
      break;
    case 'prepend':
      target.insertBefore(element, target.firstChild);
      break;
    case 'before':
      target.parentElement?.insertBefore(element, target);
      break;
    case 'after':
      target.parentElement?.insertBefore(element, target.nextSibling);
      break;
  }
}

/**
 * Reset the button template cache.
 * Useful for testing to ensure a clean state.
 */
export function resetTemplates(): void {
  buttonTemplate = null;
  downloadAllTemplate = null;
}
