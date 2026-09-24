// filepath: extension/src/v2/render/classroom-download-controller.ts
/**
 * ============================================================================
 * CLASSROOM DOWNLOAD CONTROLLER — "Download All Classroom" (csaa.6, v1)
 * ============================================================================
 *
 * The whole-classroom download button: rendered on classwork routes
 * (CLASSWORK_LIST / CLASSWORK_TOPIC) whenever EngineV3 is active (which by
 * registry construction means API-beta consent #398 + isApiConfigured).
 * One click → enumerate the course's Drive files through the rate-limited
 * inventory (csaa.5) → staggered download:requested publishes over the page
 * bus → the existing bridge relay + worker download machine acquires them
 * exactly like any other CQD download (browser-session Drive fetches — zero
 * Classroom API quota per file).
 *
 * Gating is structural, not checked here: the ONLY caller of
 * ensureClassroomButton is EngineV3 (v3 mode ⇒ configured ⇒ consented), and
 * resolveClassroomApiRouteContext supplies the courseId only on classwork
 * routes. Firefox/unconfigured installs never construct EngineV3, never see
 * the button, and their DOM features are untouched.
 *
 * Failure contract (R7): inventory failure → transient "Couldn't list
 * files" state, DOM untouched. A click mid-run is a stop — no new requests
 * are issued; in-flight files settle on their own.
 */

import type { EventBus, Unsubscribe } from '../../bus/event-bus';
import type {
  NameHint,
  PageTopicMap,
  RequestId,
} from '../../contracts/topics';
import { findHeaderContainer } from '../../download-all/button-controller';
import {
  CourseInventoryService,
  GoogleClassroomApiClient,
  sharedClassroomRateLimiter,
  ChromeIdentityTokenProvider,
  resolveClassroomApiRouteContext,
} from '../../engines/v3/api';
import { ViewKind } from '../../engines/types';

/** Per-file pacing — v2 group parity (PER_FILE_STAGGER_MS). */
export const CLASSROOM_STAGGER_MS = 1000;
/** How long a terminal state stays visible before resetting (V1 parity). */
export const CLASSROOM_FEEDBACK_MS = 3000;

export interface ClassroomDownloadDeps {
  bus: EventBus<PageTopicMap>;
  /** Clock injection for deterministic tests. */
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  /** Test seam: override the inventory service (production builds the real one). */
  createInventory?: () => CourseInventoryService;
}

interface ClassroomRun {
  courseId: string;
  button: HTMLButtonElement;
  stopRequested: boolean;
  total: number;
  settled: number;
  failed: number;
  requestIds: Set<RequestId>;
  resetTimer: ReturnType<typeof setTimeout> | null;
}

const BUTTON_ID = 'cqd-classroom-dl-btn';
const STYLE_ID = 'cqd-classroom-dl-style';

let deps: ClassroomDownloadDeps | null = null;
let inventory: CourseInventoryService | null = null;
let run: ClassroomRun | null = null;
let offSettled: Unsubscribe | null = null;
let sequence = 0;

// ============================================================================
// INSTALL / UNINSTALL (bootstrap wiring)
// ============================================================================

export function installClassroomDownloadController(
  injectedDeps: ClassroomDownloadDeps,
): () => void {
  deps = injectedDeps;
  inventory = injectedDeps.createInventory
    ? injectedDeps.createInventory()
    : new CourseInventoryService(
        new GoogleClassroomApiClient(new ChromeIdentityTokenProvider(), {
          beforeCall: () => limiter.acquire(),
        }),
      );
  ensureStyle();
  offSettled = injectedDeps.bus.subscribe('download:settled', handleSettled);
  return uninstallClassroomDownloadController;
}

export function uninstallClassroomDownloadController(): void {
  offSettled?.();
  offSettled = null;
  deps = null;
  inventory = null;
  run = null;
  removeClassroomButton();
}

/** Test hook: drop module state without touching the DOM. */
export function resetClassroomDownloadController(): void {
  if (run?.resetTimer && deps) deps.clearTimeoutFn!(run.resetTimer);
  run = null;
}

// ============================================================================
// BUTTON LIFECYCLE — driven by EngineV3 (init + fullScan)
// ============================================================================

/** The shared csaa.5 budget — one window for every v3 API caller. */
const limiter = sharedClassroomRateLimiter;

/**
 * Ensure the button exists on the current classwork page, and remove it when
 * the route is no longer classwork. Idempotent; safe to call every scan.
 * Called ONLY by EngineV3 (see the gating note in the header). The href
 * parameter is a test seam — production resolves the live location.
 */
export function ensureClassroomButton(href: string = window.location.href): void {
  if (!deps) return;
  const context = resolveClassroomApiRouteContext(href);
  const isClasswork =
    context !== null &&
    (context.viewKind === ViewKind.CLASSWORK_LIST ||
      context.viewKind === ViewKind.CLASSWORK_TOPIC);
  if (!isClasswork || !context) {
    removeClassroomButton();
    return;
  }

  const existing = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (existing) {
    if (existing.dataset.cqdCourseId !== context.courseId) {
      // Navigated between classes — a stale run's button dies with the page.
      existing.dataset.cqdCourseId = context.courseId;
    }
    return;
  }

  const header = findHeaderContainer(document.body);
  if (!header) return;

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.className = 'cqd-classroom-dl';
  button.dataset.cqdCourseId = context.courseId;
  button.setAttribute('aria-live', 'polite');
  button.textContent = 'Download all classroom files';
  button.addEventListener('click', () => {
    void handleClassroomClick();
  });

  header.appendChild(button);
}

export function removeClassroomButton(): void {
  document.getElementById(BUTTON_ID)?.remove();
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}

// ============================================================================
// CLICK FLOW
// ============================================================================

export async function handleClassroomClick(href: string = window.location.href): Promise<void> {
  if (!deps || !inventory) return;
  const context = resolveClassroomApiRouteContext(href);
  if (!context) return;

  // Mid-run click = stop issuing new requests.
  if (run && !run.stopRequested) {
    run.stopRequested = true;
    setLabel(`Stopping… (${run.settled}/${run.total})`);
    return;
  }

  if (run) resetRun(run);

  const nextRun: ClassroomRun = {
    courseId: context.courseId,
    button: document.getElementById(BUTTON_ID) as HTMLButtonElement,
    stopRequested: false,
    total: 0,
    settled: 0,
    failed: 0,
    requestIds: new Set(),
    resetTimer: null,
  };
  if (!nextRun.button) return;
  run = nextRun;
  nextRun.button.classList.add('cqd-classroom-dl-busy');
  setLabel('Listing classroom files…');

  const snapshot = await inventory.getInventory(
    context.courseId,
    context.authUser,
  );
  const currentButton = document.getElementById(BUTTON_ID);
  if (!currentButton || currentButton !== nextRun.button) return;

  if (!snapshot || snapshot.files.length === 0) {
    nextRun.button.classList.remove('cqd-classroom-dl-busy');
    setLabel(snapshot ? 'No downloadable files found' : "Couldn't list files");
    scheduleReset(nextRun);
    return;
  }

  nextRun.total = snapshot.files.length;
  for (const file of snapshot.files) {
    if (nextRun.stopRequested) break;
    publishDownload(nextRun, file);
    await delay(CLASSROOM_STAGGER_MS);
    // The button (or the page) may have died during the stagger wait.
    if (!document.getElementById(BUTTON_ID)) return;
  }

  if (nextRun.stopRequested) {
    nextRun.button.classList.remove('cqd-classroom-dl-busy');
    setLabel(`Stopped (${nextRun.settled}/${nextRun.total})`);
    scheduleReset(nextRun);
  }
}

function publishDownload(
  currentRun: ClassroomRun,
  file: { driveId: string; title: string; downloadUrl: string },
): void {
  if (!deps) return;
  sequence += 1;
  const requestId: RequestId = `cqd-classroom-${sequence}-${Date.now()}`;
  const extMatch = file.title.match(/\.([a-zA-Z0-9]{2,10})$/);
  const ext = extMatch?.[1]?.toLowerCase() ?? '';
  const nameHint: NameHint = {
    preferredStem: file.title.replace(/\.[a-zA-Z0-9]{2,10}$/, '') || file.title,
    ext,
    source: 'drive-meta',
  };
  currentRun.requestIds.add(requestId);
  deps.bus.publish('download:requested', {
    requestId,
    file: { fileId: file.driveId, url: file.downloadUrl, name: file.title },
    nameHint,
  });
  setLabel(`Downloading… (${currentRun.settled}/${currentRun.total})`);
}

function handleSettled(payload: PageTopicMap['download:settled']): void {
  if (!run || !run.requestIds.has(payload.requestId)) return;
  run.requestIds.delete(payload.requestId);
  run.settled += 1;
  if (payload.outcome.status !== 'saved') run.failed += 1;

  if (run.settled >= run.total) {
    run.button.classList.remove('cqd-classroom-dl-busy');
    const summary = run.failed > 0 ? `${run.settled - run.failed}/${run.total} downloaded` : `All ${run.total} files downloaded`;
    setLabel(summary);
    scheduleReset(run);
  } else if (!run.stopRequested) {
    setLabel(`Downloading… (${run.settled}/${run.total})`);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function scheduleReset(currentRun: ClassroomRun): void {
  const setTimeoutFn = deps?.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = deps?.clearTimeoutFn ?? clearTimeout;
  if (currentRun.resetTimer) clearTimeoutFn(currentRun.resetTimer);
  currentRun.resetTimer = setTimeoutFn(() => {
    if (run === currentRun) {
      currentRun.button.classList.remove('cqd-classroom-dl-busy');
      setLabel('Download all classroom files');
      run = null;
    }
  }, CLASSROOM_FEEDBACK_MS);
}

function resetRun(currentRun: ClassroomRun): void {
  const clearTimeoutFn = deps?.clearTimeoutFn ?? clearTimeout;
  if (currentRun.resetTimer) clearTimeoutFn(currentRun.resetTimer);
  run = null;
}

function setLabel(text: string): void {
  const button = document.getElementById(BUTTON_ID);
  if (button) button.textContent = text;
}

function delay(ms: number): Promise<void> {
  const setTimeoutFn = deps?.setTimeoutFn ?? setTimeout;
  return new Promise((resolve) => setTimeoutFn(resolve, ms));
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cqd-classroom-dl {
  display: inline-flex; align-items: center; gap: 6px;
  margin-left: 12px; padding: 8px 16px;
  border: none; border-radius: 999px; cursor: pointer;
  background: #16a34a; color: #fff;
  font: 600 13px/1.2 'Google Sans', Roboto, Arial, sans-serif;
  box-shadow: 0 1px 3px rgba(13, 12, 34, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.cqd-classroom-dl:hover {
  background: #15803d; transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(13, 12, 34, 0.28);
}
.cqd-classroom-dl:focus-visible { outline: 2px solid #0d0c22; outline-offset: 2px; }
.cqd-classroom-dl-busy { opacity: 0.85; cursor: progress; }
`;
  document.head.appendChild(style);
}
