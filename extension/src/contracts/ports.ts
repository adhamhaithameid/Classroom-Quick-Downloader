// filepath: extension/src/contracts/ports.ts
/**
 * ============================================================================
 * PORTS — the only seams roles may touch the world through (ADR-0007)
 * ============================================================================
 *
 * Spec: extension/docs/ENGINE_V4_SYSTEM_DESIGN.md §12 and
 * docs/adr/0007-pure-core-ports-and-adapters.md.
 *
 * A port is an interface owned by the consumer side. Real adapters live in
 * `src/adapters/`, test fakes in `tests/fakes/`; both must satisfy these
 * shapes (see tests/contracts/ports-conformance.test.ts). No port method may
 * leak a global type that core would then need: where a DOM type is
 * unavoidable (Node, MutationRecord) it is used structurally, and core code
 * still may not import globals itself.
 */
import type { RequestId } from './topics';

// ============================================================================
// Shared vocabulary
// ============================================================================

/** Unsubscribe handle. Idempotent: calling it more than once is a no-op. */
export type Unsubscribe = () => void;

// ============================================================================
// ClockPort — time and timers, injected everywhere Date.now/timers would be
// ============================================================================

/** Opaque timer handle returned by ClockPort.setTimeout. */
export type TimerHandle = unknown;

export interface ClockPort {
  /** Current time in ms. The only "clock" a role may read. */
  now(): number;
  /** Schedule a callback. Returns a handle for clearTimeout. */
  setTimeout(callback: () => void, ms: number): TimerHandle;
  /** Cancel a pending timeout. Safe on unknown handles. */
  clearTimeout(handle: TimerHandle): void;
}

// ============================================================================
// SchedulerPort — work deferral, so nothing hammers the main thread
// ============================================================================

export interface SchedulerPort {
  /**
   * Run callback when the context is idle. Implementations must fall back to
   * a timed timeout when requestIdleCallback is unavailable (Firefox).
   */
  scheduleIdle(callback: () => void): Unsubscribe;
}

// ============================================================================
// LogPort — the only way a role reports
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogPort {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// NetworkPort — the only way any non-adapter code fetches (ADR-0007)
// ============================================================================

export interface NetworkPort {
  /** Fetch a resource. Adapters enforce scheme and host policy before this. */
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

// ============================================================================
// DomPort — DOM reads and the single MutationObserver seam (design §4)
// ============================================================================

export interface DomPort {
  /** The document this port serves. */
  readonly document: Document;
  /** Query elements; root defaults to the port's document. */
  querySelectorAll<T extends Element = Element>(
    selector: string,
    root?: ParentNode,
  ): T[];
  /**
   * Observe DOM mutations. CQD allows exactly ONE live MutationObserver per
   * page; whoever owns the DetectEngine is the only caller allowed here.
   * Returns an idempotent disconnect handle.
   */
  observe(
    options: MutationObserverInit,
    callback: (mutations: MutationRecord[]) => void,
  ): Unsubscribe;
}

// ============================================================================
// BrowserPort — the extension host surface (downloads, tabs, filenames)
// ============================================================================

export interface DownloadOptions {
  url: string;
  filename?: string;
  conflictAction?: 'uniquify' | 'overwrite' | 'prompt';
  saveAs?: boolean;
}

/** chrome.downloads.onChanged delta, narrowed to what CQD consumes. */
export interface DownloadChangedEvent {
  id: number;
  state?: { current?: string; previous?: string };
  error?: { current?: string };
}

/** Info the browser asks for while determining a filename (Firefox path). */
export interface DeterminingFilenameItem {
  url: string;
  suggestedFilename?: string;
}

/**
 * S13: request for an OAuth identity token (Classroom API assist).
 *
 * The result carries the answer, not the failure mode: denial, absent
 * identity API, and errors all resolve to null. A port that can throw for
 * denial would push callers into try/catch consent probing — the seam is
 * honest instead.
 */
export interface IdentityTokenRequest {
  /** OAuth scopes to request. Empty means the manifest-declared scopes. */
  scopes: string[];
}

export interface BrowserPort {
  /** Human-readable family, e.g. 'chrome' | 'firefox'. Adapters decide. */
  readonly browserName: 'chrome' | 'firefox';
  /** Start a download; resolves with the browser download id. */
  download(options: DownloadOptions): Promise<number>;
  /** Cancel a started download. Safe on unknown ids. */
  cancelDownload(downloadId: number): Promise<void>;
  /** Listen for download state changes. Returns an idempotent unsubscribe. */
  onDownloadChanged(listener: (event: DownloadChangedEvent) => void): Unsubscribe;
  /** Firefox-family only: intercept filename determination. No-op elsewhere. */
  onDeterminingFilename?(
    listener: (item: DeterminingFilenameItem) => string | undefined,
  ): Unsubscribe;
  /** Open a tab (used by the bypass-tab strategy). */
  createTab(options: { url: string; active: boolean }): Promise<{ id?: number }>;
  /** Close a tab. Safe on unknown ids. */
  removeTab(tabId: number): Promise<void>;
  /**
   * S13: non-interactive OAuth token for the API-assist strategy.
   *
   * Optional because hosts without an identity API simply omit it — callers
   * must treat the method's absence exactly like a resolved null. Never
   * rejects: denial, missing API, and errors all resolve null. Never
   * prompts: interactive acquisition is a consent-flow decision, not this
   * port's business.
   */
  getIdentityToken?(request: IdentityTokenRequest): Promise<string | null>;
}

// ============================================================================
// BridgePort — the ONE async hop between the page bus and the worker bus
// ============================================================================

/** A request crossing the bridge, correlated by id (design §2, §7). */
export interface BridgeRequest {
  requestId: RequestId;
  payload: unknown;
}

export interface BridgePort {
  /** Page side: forward a request payload to the worker context. */
  send(request: BridgeRequest): void;
  /** Worker side: answer a received request by id. */
  respond(requestId: RequestId, response: unknown): void;
  /** Worker side: receive requests. One handler at a time; returns the off fn. */
  onRequest(handler: (request: BridgeRequest) => void): Unsubscribe;
  /** Page side: receive responses for previously sent requests. */
  onResponse(handler: (requestId: RequestId, response: unknown) => void): Unsubscribe;
}
