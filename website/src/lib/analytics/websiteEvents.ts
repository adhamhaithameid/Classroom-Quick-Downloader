import { WORKER_BASE_URL } from '$lib/config';
import { submitWebsiteEvents } from '$lib/api/publicSite';
import type { WebsiteEventAction, WebsiteEventPayload, WebsiteEventType } from '$lib/types/public';

const QUEUE_STORAGE_KEY = 'cqd.website.events.queue.v1';
const SESSION_STORAGE_KEY = 'cqd.website.events.session.v1';
const FLUSH_INTERVAL_MS = 15_000;
const MAX_QUEUE_SIZE = 240;
const MAX_BATCH_SIZE = 24;
const WEBSITE_EVENTS_SCHEMA_VERSION = '1' as const;

type WebsiteEventMeta = Record<string, string | number | boolean | null>;

type WebsiteEventInput = {
  eventType: WebsiteEventType;
  action: WebsiteEventAction;
  placement: string;
  pagePath?: string;
  meta?: WebsiteEventMeta;
};

let queue: WebsiteEventPayload[] = [];
let storageHydrated = false;
let initialized = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
let fallbackIdCounter = 0;

function canUseBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizePath(raw: string): string {
  const candidate = raw.trim();
  if (!candidate) return '/';
  return candidate.startsWith('/') ? candidate : `/${candidate}`;
}

function normalizePlacement(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  return normalized || 'unknown';
}

function safeMeta(meta: WebsiteEventMeta | undefined): WebsiteEventMeta | undefined {
  if (!meta) return undefined;
  const out: WebsiteEventMeta = {};
  const entries = Object.entries(meta);
  for (const [key, value] of entries.slice(0, 8)) {
    const cleanKey = key.trim().slice(0, 40);
    if (!cleanKey) continue;
    if (typeof value === 'string') {
      out[cleanKey] = value.slice(0, 120);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[cleanKey] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${secureRandomLikeSuffix(20)}`;
}

function secureRandomLikeSuffix(length: number): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function' &&
    Number.isFinite(length) &&
    length > 0
  ) {
    const byteLength = Math.ceil(length / 2);
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    let hex = '';
    for (const byte of bytes) {
      hex += byte.toString(16).padStart(2, '0');
    }
    return hex.slice(0, length);
  }

  fallbackIdCounter = (fallbackIdCounter + 1) % Number.MAX_SAFE_INTEGER;
  const nowPart = Date.now().toString(36);
  const counterPart = fallbackIdCounter.toString(36);
  const perfPart =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? Math.floor(performance.now() * 1000).toString(36)
      : '0';
  const base = `${nowPart}${counterPart}${perfPart}`;
  if (base.length >= length) return base.slice(base.length - length);
  return `${base}${'0'.repeat(length - base.length)}`;
}

function readStoredQueue(): WebsiteEventPayload[] {
  if (!canUseBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WebsiteEventPayload[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item?.eventId === 'string' && typeof item?.eventType === 'string' && typeof item?.action === 'string')
      .slice(0, MAX_QUEUE_SIZE);
  } catch {
    return [];
  }
}

function persistQueue(): void {
  if (!canUseBrowser()) return;
  try {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE_SIZE)));
  } catch {
    // Ignore storage errors in private mode.
  }
}

function ensureQueueHydrated(): void {
  if (storageHydrated) return;
  storageHydrated = true;
  queue = readStoredQueue();
}

function getSessionId(): string {
  if (!canUseBrowser()) return 'session-server';
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && existing.trim()) return existing;
    const created = `ws_${createEventId()}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return `ws_${createEventId()}`;
  }
}

function resolvePagePath(inputPath?: string): string {
  if (inputPath && inputPath.trim()) {
    return normalizePath(inputPath);
  }
  if (typeof window !== 'undefined') {
    return normalizePath(window.location.pathname || '/');
  }
  return '/';
}

function buildPayload(events: WebsiteEventPayload[]): string {
  return JSON.stringify({
    schemaVersion: WEBSITE_EVENTS_SCHEMA_VERSION,
    sessionId: getSessionId(),
    pagePath: resolvePagePath(),
    events
  });
}

function takeBatch(): WebsiteEventPayload[] {
  return queue.slice(0, MAX_BATCH_SIZE);
}

function dropBatch(count: number): void {
  if (count <= 0) return;
  queue = queue.slice(count);
  persistQueue();
}

function flushWithBeacon(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false;
  if (queue.length === 0) return true;

  const batch = takeBatch();
  if (batch.length === 0) return true;

  const payload = buildPayload(batch);
  const blob = new Blob([payload], { type: 'application/json' });
  const ok = navigator.sendBeacon(`${WORKER_BASE_URL}/api/public/website/events`, blob);
  if (ok) {
    dropBatch(batch.length);
  }
  return ok;
}

export async function flushWebsiteEvents(options: { beaconPreferred?: boolean } = {}): Promise<void> {
  if (!canUseBrowser()) return;
  ensureQueueHydrated();
  if (queue.length === 0 || flushing) return;

  if (options.beaconPreferred && flushWithBeacon()) {
    return;
  }

  flushing = true;
  try {
    const batch = takeBatch();
    if (batch.length === 0) return;
    const response = await submitWebsiteEvents({
      schemaVersion: WEBSITE_EVENTS_SCHEMA_VERSION,
      sessionId: getSessionId(),
      pagePath: resolvePagePath(),
      events: batch
    });
    if (response.ok) {
      dropBatch(batch.length);
    }
  } catch {
    // Keep events in queue for next retry tick.
  } finally {
    flushing = false;
  }
}

export function trackWebsiteEvent(input: WebsiteEventInput): void {
  if (!canUseBrowser()) return;
  ensureQueueHydrated();
  const pagePath = resolvePagePath(input.pagePath);

  const event: WebsiteEventPayload = {
    eventId: createEventId(),
    eventType: input.eventType,
    action: input.action,
    placement: normalizePlacement(input.placement),
    tsUtc: Date.now(),
    meta: safeMeta({
      pagePath,
      ...(input.meta || {})
    })
  };

  queue.push(event);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }
  persistQueue();

  if (queue.length >= MAX_BATCH_SIZE) {
    void flushWebsiteEvents();
  }
}

function handleVisibilityChange(): void {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden') {
    void flushWebsiteEvents({ beaconPreferred: true });
  }
}

function handlePageHide(): void {
  void flushWebsiteEvents({ beaconPreferred: true });
}

export function initWebsiteEventsClient(): () => void {
  if (!canUseBrowser()) return () => {};
  ensureQueueHydrated();

  if (!initialized) {
    initialized = true;
    flushTimer = setInterval(() => {
      void flushWebsiteEvents();
    }, FLUSH_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
  }

  return () => {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    initialized = false;
  };
}
