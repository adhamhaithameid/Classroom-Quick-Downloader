// filepath: cloudflare-worker/src/downloads_do.ts

import {
  Counters,
  RetryState,
  QuotaDescriptor,
  StoredEvent,
  EnvSnapshot,
  OracleBatch,
  TimeBucket,
  BucketTotals,
  BucketCounters,
  DOStateBatch,
  BatchSummary,
  ChangelogEntry,
  ChangelogRevision,
  ChangelogConfig,
  ChangelogApplyMode,
  ChangelogSyncStatus,
} from "./types";
import { resolveOracleEndpoint } from "./oracle-endpoint";

export interface Env {
  ORACLE_ENDPOINT: string;
  ALLOW_INSECURE_ORACLE_ENDPOINT?: string;
  DO_SHARED_SECRET: string;
  MAX_BATCH_EVENTS: string;
  ALERT_WEBHOOK_URL?: string;
}

type DurableStateShape = {
  totalEvents: number;
  totalDownloads: number;
  totalSuccess: number;
  totalFail: number;
  totalCancelled: number;
  pendingEvents: number;
  lastEventAt: number | null;
  lastFlushAt: number | null;
  counters: Counters;
  retryState: RetryState | null;

  // daily request counting for quota awareness
  reqCountToday: number;
  reqCountDate: string | null; // "YYYY-MM-DD" UTC
  reqDailyCounts: Record<string, number>;

  // admin switch: when true, remote analytics is forced OFF
  hardRemoteOff: boolean;

  // Buffered events waiting to be flushed to Oracle
  buffer: StoredEvent[];
  
  // Monotonically increasing batch sequence number for stable batchId across retries
  // Only incremented after successful flush to Oracle
  batchSeq: number;

  // Monotonic sequence for event commit tracking
  eventSeq: number;

  // Highest event sequence confirmed committed to Oracle
  committedSeq: number;

  // Durable queue of aggregated batches waiting for Oracle
  pendingBatches: PendingOracleBatch[];

  // End-to-end delivery metrics chain (accepted -> stored -> forwarded -> committed)
  deliveryMetrics: DeliveryMetricsState;

  // Structured failure sink rollups (persisted in DO, forwarded to Oracle on successful flush)
  failureRollups: FailureRollupState[];

  // --- Privacy / Anti-Abuse ---
  // IP tracking is disabled for privacy compliance. These fields are kept
  // for backward compatibility but are always cleared.
  ipCounts: Record<string, number>;
  
  // Legacy cached size (always 0 when IP tracking is disabled)
  ipCountsSize: number;
  
  // Derived counter (always 0 when IP tracking is disabled)
  uniqueRequestsToday: number;
  
  // Set of recently processed event IDs for O(1) idempotency lookup
  processedIds: string[];
  
  // Burst tracking (legacy, kept for compatibility)
  burstCounts: Record<string, { count: number; minute: number }>;

  // Login attempts for rate limiting
  loginAttempts: Record<string, { attempts: number; firstAttemptAt: number }>;

  // IP Allowlist configuration
  ipAllowlistEnabled: boolean;
  ipAllowlist: string[];
  ipAllowlistStepUpBypassEnabled: boolean;
  dangerActionAuditLogs: DangerActionAuditRecord[];

  // Track endpoint rate limiting (per-IP, per-minute)
  trackRates: Record<string, { count: number; minute: number }>;

  // =========================================================================
  // CHANGELOG & CONFIG
  // =========================================================================
  changelog: ChangelogEntry[];
  changelogRevisions: ChangelogRevision[];
  changelogConfig: ChangelogConfig;
  changelogDraft: ChangelogDraftState | null;

  // Public website metrics snapshot refreshed on a fixed UTC schedule.
  publicSiteMetricsSnapshot: PublicSiteMetricsSnapshot | null;
  websitePublicSyncEnabled: boolean;
  websiteManualFlushAt: number | null;
  websiteOverrideEnabled: boolean;
  websiteOverrideDownloads: number;
  websiteOverrideCountries: PublicSiteCountryCount[];
  websiteTelemetryQueue: WebsiteTelemetryQueuedBatch[];
  websiteTelemetryDeadLetter: WebsiteTelemetryQueuedBatch[];
  websiteTelemetrySeenEventIds: string[];
  websiteTelemetryLastBatchCreatedAt: number | null;
  websiteTelemetryLastBatchSentAt: number | null;
  websiteTelemetryLastBatchAckAt: number | null;
  websiteTelemetryLastBatchID: string | null;
  websiteTelemetryLastCorrelationID: string | null;
  websiteTelemetryLastError: string | null;

  // =========================================================================
  // REMOTE CONFIG - Controllable from Cloudflare Dashboard
  // =========================================================================
  
  // Config schema version for migrations
  configVersion: number;

  // Extension batching: downloads per request (default: 50)
  configBatchSize: number;
  
  // Extension rate limit: max requests per day (default: 50)
  configMaxDailyRequests: number;
  
  // Extension retry: max retries before dropping event (default: 5)
  configMaxRetry: number;
  
  // Worker validation: max events per request (default: 5000)
  configMaxEventsPerRequest: number;
  
  // Worker buffer: max events in buffer (default: 50000)
  configMaxBufferSize: number;
  
  // Flush mode: 'next_day' | 'time_based' (default: 'next_day')
  // next_day: Flush in a daily UTC window
  // time_based: Flush based on timeFlushMinutes
  configFlushMode: 'next_day' | 'time_based';

  // Daily flush window (UTC)
  configDailyFlushWindowStartUtc: number;
  configDailyFlushWindowMinutes: number;
  
  // Time-based flush intervals (only used if flushMode is 'time_based')
  configTimeFlushMinutes: {
    low: number;   // queue < 15 events
    mid: number;   // 15-35 events  
    high: number;  // 35+ events
  };

  // Cancel hold delay: time in ms before cancel button becomes active (default: 1000ms)
  // Range: 0-10000ms. Configurable from dashboard to prevent accidental cancels.
  configCancelHoldDelayMs: number;

  // Legacy compatibility: allow missing/invalid event IDs by assigning new IDs
  // Default: true (temporary migration support)
  configAllowLegacyEvents: boolean;

  // Pipeline health thresholds (configurable from dashboard)
  configHealthWarnPendingBatches: number;
  configHealthCriticalPendingBatches: number;
  configHealthWarnFailures: number;
  configHealthCriticalFailures: number;
  configHealthWarnStaleMs: number;
  configHealthCriticalStaleMs: number;
  configHealthWarnBufferUtil: number;
  configHealthCriticalBufferUtil: number;
  configHealthNotifyWarnIntervalMs: number;
  configHealthNotifyCritIntervalMs: number;

  // Pipeline health notification state
  lastHealthStatus?: PipelineHealthStatus;
  lastHealthNotifyAt?: number | null;
};

type ChangelogDraftState = {
  markdown: string;
  markdownUrl?: string;
  entries: ChangelogEntry[];
  errors: string[];
  valid: boolean;
  updatedAt: number;
  source: "manual" | "github" | "import";
};

type PendingOracleBatch = {
  batch: OracleBatch;
  weightedCount: number;
  maxSeq: number;
  attempts: number;
  createdAt: number;
};

type DeliveryStage = "accepted" | "stored" | "forwarded" | "committed";

type DeliveryMetricsState = {
  totals: {
    accepted: number;
    stored: number;
    forwarded: number;
    committed: number;
  };
  recent: Array<{
    deliveryId: string;
    batchId: string;
    accepted: number;
    stored: number;
    forwarded: number;
    committed: number;
    status: "pending" | "forwarded" | "committed";
    createdAt: number;
    updatedAt: number;
  }>;
};

type FailureRollupState = {
  key: string;
  source: "cloudflare-do";
  stage: string;
  errorCode: string;
  errorDetail: string;
  sampleCount: number;
  unsentCount: number;
  firstTs: number;
  lastTs: number;
};

type PublicSiteCountryCount = {
  countryCode: string;
  count: number;
};

type PublicSiteMetricsSnapshot = {
  slotKey: string;
  snapshotAtUtc: number;
  downloads: number;
  countries: PublicSiteCountryCount[];
};

type WebsiteTelemetryQueuedBatch = {
  schemaVersion: typeof WEBSITE_EVENTS_SCHEMA_VERSION;
  batchId: string;
  correlationId: string;
  generatedAtUtc: number;
  sessionId: string;
  pagePath: string;
  events: WebsiteEventPayload[];
  attempt: number;
  nextRetryAtUtc: number | null;
  lastError: string | null;
};

type DangerActionAuditRecord = {
  id: string;
  tsUtc: number;
  actorIp: string;
  action: string;
  path: string;
  result: "ok" | "error";
  correlationId: string;
  detail: string | null;
};

const DEFAULT_RETRY_STATE: RetryState = {
  consecutiveFailures: 0,
};

const MAX_RECENT_DELIVERIES = 300;
const MAX_FAILURE_ROLLUPS = 500;
const MAX_FAILURE_EXPORT_PER_BATCH = 100;
const FAILURE_DETAIL_MAX_LEN = 240;
const FAILURE_ROLLUP_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function createEmptyDeliveryMetrics(): DeliveryMetricsState {
  return {
    totals: {
      accepted: 0,
      stored: 0,
      forwarded: 0,
      committed: 0,
    },
    recent: [],
  };
}

function createEmptyCounters(): Counters {
  return {
    byStatus: {},
    byType: {},
    byBrowser: {},
    byOs: {},
    byExtVersion: {},
    byLanguage: {},
    byCountry: {},
    byErrorType: {},
  };
}

function cloneCounterMap(input: Record<string, number> | undefined): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  return { ...input };
}

const CONFIG_VERSION = 2;
const DEFAULT_DAILY_FLUSH_WINDOW_START_UTC = 23;
const DEFAULT_DAILY_FLUSH_WINDOW_MINUTES = 120;
const WEBSITE_EVENTS_BODY_LIMIT_BYTES = 128 * 1024;
const WEBSITE_EVENTS_MAX_BATCH = 64;
const WEBSITE_EVENTS_SCHEMA_VERSION = "1" as const;
const WEBSITE_EVENTS_MAX_SESSION_ID_LEN = 96;
const WEBSITE_EVENTS_MAX_PAGE_PATH_LEN = 200;
const WEBSITE_EVENTS_MAX_PLACEMENT_LEN = 64;
const WEBSITE_EVENTS_MAX_META_KEYS = 8;
const WEBSITE_EVENTS_MAX_META_KEY_LEN = 40;
const WEBSITE_EVENTS_MAX_META_VALUE_STRING_LEN = 120;
const WEBSITE_EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{6,120}$/;
const WEBSITE_EVENT_TYPE_VALUES = ["cta", "map"] as const;
const WEBSITE_EVENT_ACTION_VALUES = [
  "install_click",
  "download_click",
  "map_yes",
  "map_no",
] as const;
const WEBSITE_EVENT_ACTION_TO_TYPE: Record<(typeof WEBSITE_EVENT_ACTION_VALUES)[number], (typeof WEBSITE_EVENT_TYPE_VALUES)[number]> = {
  install_click: "cta",
  download_click: "cta",
  map_yes: "map",
  map_no: "map",
};
const WEBSITE_EVENT_ROOT_KEYS = new Set(["schemaVersion", "sessionId", "pagePath", "events"]);
const WEBSITE_EVENT_KEYS = new Set(["eventId", "eventType", "action", "placement", "tsUtc", "meta"]);
const MAX_DANGER_AUDIT_LOGS = 500;
const WEBSITE_TELEMETRY_MAX_QUEUE_BATCHES = 4000;
const WEBSITE_TELEMETRY_MAX_DLQ_BATCHES = 1000;
const WEBSITE_TELEMETRY_MAX_DEDUPE_IDS = 50_000;
const WEBSITE_TELEMETRY_MAX_RETRY_ATTEMPTS = 5;
const WEBSITE_TELEMETRY_RETRY_BASE_MS = 60_000;
const WEBSITE_TELEMETRY_RETRY_MAX_MS = 6 * 60 * 60 * 1000;

// Quota thresholds (approx. Cloudflare daily request quotas)
const QUOTA_VERY_SOFT_LIMIT = 30_000;
const QUOTA_SOFT_LIMIT = 40_000;
const QUOTA_VERY_NORMAL_LIMIT = 50_000;
const QUOTA_NORMAL_LIMIT = 60_000;
const QUOTA_HARD_NORMAL_LIMIT = 70_000;
const QUOTA_HARD_LIMIT = 80_000;
const QUOTA_VERY_HARD_LIMIT = 90_000;

// Backpressure thresholds to prevent cascading failures
const REMOTE_DISABLE_BUFFER_UTIL = 0.9;
const REMOTE_DISABLE_FAILURES = 5;
const COMPACT_TRIGGER_UTIL = 0.8;
const COMPACT_TARGET_UTIL = 0.5;
const COMPACT_MAX_BATCH = 5000;
const MAX_PENDING_BATCHES = 50;
const MAX_ROLLUP_COUNT = 100_000;

const HEALTH_WARN_PENDING_BATCHES = 10;
const HEALTH_CRIT_PENDING_BATCHES = 25;
const HEALTH_WARN_FAILURES = 3;
const HEALTH_CRIT_FAILURES = 5;
const HEALTH_WARN_STALE_MS = 6 * 60 * 60 * 1000;
const HEALTH_CRIT_STALE_MS = 24 * 60 * 60 * 1000;
const HEALTH_WARN_BUFFER_UTIL = 0.8;
const HEALTH_CRIT_BUFFER_UTIL = 0.95;
const HEALTH_NOTIFY_WARN_INTERVAL_MS = 30 * 60 * 1000;
const HEALTH_NOTIFY_CRIT_INTERVAL_MS = 10 * 60 * 1000;

// Track endpoint rate limits (per IP per minute)
const TRACK_RATE_LIMIT_PER_MIN = 120;
const TRACK_RATE_PRUNE_AFTER_MIN = 10;
const TRACK_RATE_MAX_KEYS = 5000;
const REQUEST_HISTORY_DAYS = 400;
const PUBLIC_SITE_METRICS_REFRESH_HOURS_UTC = [3, 6, 9, 12, 15, 18, 21] as const;
const MAX_PUBLIC_SITE_COUNTRIES = 300;
const ISO_ALPHA2_PATTERN = /^[A-Z]{2}$/;
const USER_FRIENDLY_CHANGELOG_GITHUB_URL =
  "https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/user-friendly-changelog.md";
const CHANGELOG_DEFAULT_APPLY_MODE: ChangelogApplyMode = "manual";
const CHANGELOG_DEFAULT_AUTO_SYNC_ENABLED = false;
const CHANGELOG_DEFAULT_AUTO_SYNC_INTERVAL_MINUTES = 60;
const CHANGELOG_MIN_AUTO_SYNC_INTERVAL_MINUTES = 5;
const CHANGELOG_MAX_AUTO_SYNC_INTERVAL_MINUTES = 1440;

function defaultExtensionChangelogEntries(): ChangelogEntry[] {
  return [
    {
      id: "release-138",
      version: "1.3.8",
      date: "2026-03-02T00:00:00.000Z",
      isImportant: true,
      changes: [
        "Changelog delivery is now revision-aware so users receive same-version updates.",
        "Version-pill state now refreshes against latest Cloudflare changelog data.",
        "Improved sync reliability between published release data and extension UI."
      ]
    },
    {
      id: "release-137",
      version: "1.3.7",
      date: "2026-02-28T00:00:00.000Z",
      isImportant: true,
      changes: [
        "New cleaner release notes experience so updates are easier to read.",
        "Better download flow stability in large classes with many files.",
        "Polished install and version messaging for non-technical users."
      ]
    },
    {
      id: "release-136",
      version: "1.3.6",
      date: "2026-02-20T00:00:00.000Z",
      changes: [
        "Improved reliability when batch downloads include mixed file types.",
        "Reduced stuck-progress cases after tab wake or network hiccups.",
        "Small security hardening updates across extension internals."
      ]
    },
    {
      id: "release-135",
      version: "1.3.5",
      date: "2026-02-19T00:00:00.000Z",
      changes: [
        "Smoother keyboard and popup interactions for faster navigation.",
        "More consistent status updates while downloads are running.",
        "General bug fixes focused on everyday classroom workflows."
      ]
    },
    {
      id: "release-134",
      version: "1.3.4",
      date: "2026-02-18T00:00:00.000Z",
      changes: [
        "Safer handling around internal requests and validation checks.",
        "Improved compatibility with current Chromium and Firefox builds.",
        "UI polish for clearer feedback in the extension popup."
      ]
    },
    {
      id: "release-133",
      version: "1.3.3",
      date: "2026-02-12T00:00:00.000Z",
      changes: [
        "Faster response when starting multi-file downloads.",
        "Better recovery when a tab refreshes mid-download.",
        "Reduced noisy errors in normal successful runs."
      ]
    },
    {
      id: "release-132",
      version: "1.3.2",
      date: "2026-02-08T00:00:00.000Z",
      changes: [
        "Improved analytics reliability without collecting personal data.",
        "More accurate completion tracking for partial/cancelled actions.",
        "Refined background logic for steadier long sessions."
      ]
    },
    {
      id: "release-131",
      version: "1.3.1",
      date: "2026-02-04T00:00:00.000Z",
      changes: [
        "First stability wave for the 1.3 series with faster queue handling.",
        "Improved extension behavior on heavy Google Classroom pages.",
        "General fixes and cleanup for a smoother daily experience."
      ]
    }
  ];
}

type UserFriendlyRelease = {
  version: string;
  summary: string;
  added: string[];
  changed: string[];
  fixed: string[];
};

type ParsedUserFriendlyChangelog = {
  releases: UserFriendlyRelease[];
  errors: string[];
};

function normalizeReleaseVersion(raw: string): string {
  const value = raw.trim().replace(/^v/i, "");
  if (!value) return "";
  return value.replace(/\s+/g, "");
}

function parseUserFriendlyChangelogMarkdown(markdown: string): ParsedUserFriendlyChangelog {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const errors: string[] = [];
  const releases: UserFriendlyRelease[] = [];

  let current: UserFriendlyRelease | null = null;
  let activeSection: "summary" | "added" | "changed" | "fixed" | null = null;

  const pushCurrent = () => {
    if (!current) return;
    current.summary = current.summary.trim();
    if (!current.version) {
      errors.push("Found a release block without a version heading.");
      current = null;
      return;
    }
    if (!current.summary) {
      const fallback = current.added[0] || current.changed[0] || current.fixed[0] || "";
      current.summary = fallback.trim();
    }
    if (!current.summary) {
      errors.push(`Release v${current.version} is missing a Summary section.`);
      current = null;
      return;
    }
    releases.push({
      version: current.version,
      summary: current.summary,
      added: [...current.added],
      changed: [...current.changed],
      fixed: [...current.fixed],
    });
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const releaseMatch = line.match(/^##\s+v?([A-Za-z0-9._-]+)\s*$/i);
    if (releaseMatch) {
      pushCurrent();
      const version = normalizeReleaseVersion(releaseMatch[1] || "");
      current = {
        version,
        summary: "",
        added: [],
        changed: [],
        fixed: [],
      };
      activeSection = null;
      continue;
    }

    if (!current) {
      // Ignore preamble text outside release blocks.
      continue;
    }

    if (/^###\s+summary\s*$/i.test(line)) {
      activeSection = "summary";
      continue;
    }
    if (/^###\s+added\s*$/i.test(line)) {
      activeSection = "added";
      continue;
    }
    if (/^###\s+changed\s*$/i.test(line)) {
      activeSection = "changed";
      continue;
    }
    if (/^###\s+fixed\s*$/i.test(line)) {
      activeSection = "fixed";
      continue;
    }

    const bullet = line.match(/^-\s+(.+)$/);
    const value = trimAndLimitString((bullet ? bullet[1] : line), 400);
    if (!value) continue;

    if (activeSection === "summary") {
      current.summary = current.summary ? `${current.summary} ${value}` : value;
      continue;
    }
    if (activeSection === "added") {
      current.added.push(value);
      continue;
    }
    if (activeSection === "changed") {
      current.changed.push(value);
      continue;
    }
    if (activeSection === "fixed") {
      current.fixed.push(value);
      continue;
    }

    // If no section heading was set, treat as summary continuation.
    current.summary = current.summary ? `${current.summary} ${value}` : value;
  }

  pushCurrent();
  return { releases, errors };
}

function buildReleaseMarkdown(entry: UserFriendlyRelease): string {
  const lines: string[] = [];
  lines.push(`## v${entry.version}`);
  lines.push("### Summary");
  lines.push(entry.summary);
  lines.push("### Added");
  for (const point of entry.added) lines.push(`- ${point}`);
  lines.push("### Changed");
  for (const point of entry.changed) lines.push(`- ${point}`);
  lines.push("### Fixed");
  for (const point of entry.fixed) lines.push(`- ${point}`);
  return lines.join("\n");
}

function buildLegacyChanges(entry: UserFriendlyRelease): string[] {
  const out: string[] = [];
  out.push(`Summary: ${entry.summary}`);
  for (const point of entry.added) out.push(`Added: ${point}`);
  for (const point of entry.changed) out.push(`Changed: ${point}`);
  for (const point of entry.fixed) out.push(`Fixed: ${point}`);
  return out.slice(0, 24);
}

function toStructuredChangelogEntries(
  parsed: ParsedUserFriendlyChangelog,
  source: "manual" | "github" | "import",
  nowMs: number,
): ChangelogEntry[] {
  return parsed.releases.map((release, idx) => ({
    id: `release-${release.version.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || String(nowMs + idx)}`,
    version: release.version,
    date: new Date(nowMs - idx * 1000).toISOString(),
    summary: release.summary,
    added: [...release.added],
    changed: [...release.changed],
    fixed: [...release.fixed],
    markdown: buildReleaseMarkdown(release),
    source,
    changes: buildLegacyChanges(release),
    isImportant: idx === 0,
  }));
}

function sanitizeIncomingChangelogEntries(input: unknown): ChangelogEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      if (!isPlainObject(row)) return null;
      const source = row as Record<string, unknown>;
      const id = trimAndLimitString(source.id, 160);
      const version = normalizeReleaseVersion(trimAndLimitString(source.version, 64));
      const dateRaw = trimAndLimitString(source.date, 64);
      const parsedDate = dateRaw ? Date.parse(dateRaw) : NaN;
      const date = Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : new Date().toISOString();
      if (!id || !version) return null;
      const summary = trimAndLimitString(source.summary, 600);
      const added = Array.isArray(source.added)
        ? source.added.map((item) => trimAndLimitString(item, 300)).filter((item) => item.length > 0).slice(0, 20)
        : [];
      const changed = Array.isArray(source.changed)
        ? source.changed.map((item) => trimAndLimitString(item, 300)).filter((item) => item.length > 0).slice(0, 20)
        : [];
      const fixed = Array.isArray(source.fixed)
        ? source.fixed.map((item) => trimAndLimitString(item, 300)).filter((item) => item.length > 0).slice(0, 20)
        : [];
      const markdown = trimAndLimitString(source.markdown, 12000);
      const changes = Array.isArray(source.changes)
        ? source.changes.map((item) => trimAndLimitString(item, 300)).filter((item) => item.length > 0).slice(0, 40)
        : [];
      const release: UserFriendlyRelease = {
        version,
        summary: summary || "",
        added,
        changed,
        fixed,
      };
      const derivedChanges = changes.length > 0 ? changes : buildLegacyChanges(release);
      return {
        id,
        version,
        date,
        summary: summary || undefined,
        added,
        changed,
        fixed,
        markdown: markdown || (summary ? buildReleaseMarkdown(release) : undefined),
        source:
          source.source === "github" || source.source === "import" || source.source === "manual"
            ? source.source
            : "manual",
        changes: derivedChanges,
        isImportant: source.isImportant === true,
      } as ChangelogEntry;
    })
    .filter((entry): entry is ChangelogEntry => entry !== null);
}

function normalizeChangelogApplyMode(value: unknown): ChangelogApplyMode {
  return value === "auto_github" ? "auto_github" : CHANGELOG_DEFAULT_APPLY_MODE;
}

function normalizeChangelogSyncStatus(value: unknown): ChangelogSyncStatus {
  if (value === "ok" || value === "error") return value;
  return "idle";
}

function normalizeRuleTarget(value: unknown): string {
  const raw = trimAndLimitString(value, 64).toLowerCase();
  if (!raw) return "";
  if (raw === "all") return "all";
  return normalizeReleaseVersion(raw);
}

function sanitizeNotificationRules(input: unknown): ChangelogConfig["rules"] {
  if (!Array.isArray(input)) return [];
  const byTarget = new Map<string, ChangelogConfig["rules"][number]>();
  for (const row of input) {
    if (!isPlainObject(row)) continue;
    const source = row as Record<string, unknown>;
    const target = normalizeRuleTarget(source.target);
    if (!target) continue;
    const priority =
      source.priority === "major" || source.priority === "minor" || source.priority === "normal"
        ? source.priority
        : "normal";
    const effect = source.effect === "glow" || source.effect === "pulse" || source.effect === "none"
      ? source.effect
      : "none";
    const id = trimAndLimitString(source.id, 80) || `rule-${target.replace(/[^a-z0-9]+/g, "-")}`;
    byTarget.set(target, { id, target, priority, effect });
  }
  return [...byTarget.values()].slice(0, 200);
}

function normalizeAutoSyncIntervalMinutes(value: unknown): number {
  return clampInt(
    value,
    CHANGELOG_MIN_AUTO_SYNC_INTERVAL_MINUTES,
    CHANGELOG_MAX_AUTO_SYNC_INTERVAL_MINUTES,
    CHANGELOG_DEFAULT_AUTO_SYNC_INTERVAL_MINUTES,
  );
}

function computeChangelogLiveHash(entries: ChangelogEntry[]): string {
  const stable = entries
    .map((entry) => ({
      version: normalizeReleaseVersion(entry.version),
      summary: trimAndLimitString(entry.summary, 2000),
      added: Array.isArray(entry.added) ? entry.added.map((row) => trimAndLimitString(row, 400)) : [],
      changed: Array.isArray(entry.changed) ? entry.changed.map((row) => trimAndLimitString(row, 400)) : [],
      fixed: Array.isArray(entry.fixed) ? entry.fixed.map((row) => trimAndLimitString(row, 400)) : [],
      changes: Array.isArray(entry.changes) ? entry.changes.map((row) => trimAndLimitString(row, 400)) : [],
    }))
    .filter((entry) => entry.version.length > 0)
    .sort((a, b) => a.version.localeCompare(b.version));
  return JSON.stringify(stable);
}

function sanitizeLoadedChangelogDraft(raw: unknown): ChangelogDraftState | null {
  if (!isPlainObject(raw)) return null;
  const source = raw as Record<string, unknown>;
  const markdown = trimAndLimitString(source.markdown, 750_000);
  const markdownUrl = trimAndLimitString(source.markdownUrl, 600);
  const entries = sanitizeIncomingChangelogEntries(source.entries);
  const errors = Array.isArray(source.errors)
    ? source.errors
        .filter((item): item is string => typeof item === "string")
        .map((item) => trimAndLimitString(item, 240))
        .filter((item) => item.length > 0)
        .slice(0, 20)
    : [];
  const valid = source.valid === true;
  const updatedAt = clampInt(source.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0);
  const draftSource =
    source.source === "github" || source.source === "import" || source.source === "manual"
      ? source.source
      : "manual";
  if (!markdown && entries.length === 0) return null;
  return {
    markdown,
    markdownUrl: markdownUrl || undefined,
    entries,
    errors,
    valid,
    updatedAt: updatedAt > 0 ? updatedAt : Date.now(),
    source: draftSource,
  };
}

// Storage key inside DO storage
const STORAGE_KEY = "analytics_state";

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function currentUtcHour(ts: number): number {
  return new Date(ts).getUTCHours();
}

function makeSlotKey(ts: number): string {
  const now = new Date(ts);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}`;
}

function normalizePublicCountryCode(input: string): string | null {
  const normalized = input.trim().toUpperCase();
  if (!ISO_ALPHA2_PATTERN.test(normalized)) return null;
  if (normalized === "XX" || normalized === "ZZ") return null;
  if (normalized === "UN" || normalized === "EU") return null;
  return normalized;
}

function normalizeCountryCountsForPublicMap(
  byCountry: Record<string, number> | undefined,
): PublicSiteCountryCount[] {
  if (!byCountry || typeof byCountry !== "object") return [];

  const merged = new Map<string, number>();
  for (const [rawCountry, rawCount] of Object.entries(byCountry)) {
    const count = clampInt(rawCount, 0, Number.MAX_SAFE_INTEGER, 0);
    if (count <= 0) continue;
    const code = normalizePublicCountryCode(rawCountry);
    if (!code) continue;
    merged.set(code, (merged.get(code) ?? 0) + count);
  }

  const countries = [...merged.entries()].map(([countryCode, count]) => ({ countryCode, count }));
  countries.sort((a, b) => {
    if (a.count === b.count) return a.countryCode.localeCompare(b.countryCode);
    return b.count - a.count;
  });
  return countries.slice(0, MAX_PUBLIC_SITE_COUNTRIES);
}

function normalizePublicSiteCountryList(input: unknown): PublicSiteCountryCount[] {
  if (!Array.isArray(input)) return [];
  const merged = new Map<string, number>();
  for (const row of input) {
    if (!isPlainObject(row)) continue;
    const raw = row as Record<string, unknown>;
    const code = normalizePublicCountryCode(typeof raw.countryCode === "string" ? raw.countryCode : "");
    if (!code) continue;
    const count = clampInt(raw.count, 0, Number.MAX_SAFE_INTEGER, 0);
    if (count <= 0) continue;
    merged.set(code, (merged.get(code) ?? 0) + count);
  }
  const countries = [...merged.entries()].map(([countryCode, count]) => ({ countryCode, count }));
  countries.sort((a, b) => {
    if (a.count === b.count) return a.countryCode.localeCompare(b.countryCode);
    return b.count - a.count;
  });
  return countries.slice(0, MAX_PUBLIC_SITE_COUNTRIES);
}

function shiftUtcDateByDays(dateKey: string, deltaDays: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const dt = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function normalizeReqDailyCounts(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const n = clampInt(raw, 0, Number.MAX_SAFE_INTEGER, 0);
    out[key] = n;
  }
  return out;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

type WebsiteEventType = (typeof WEBSITE_EVENT_TYPE_VALUES)[number];
type WebsiteEventAction = (typeof WEBSITE_EVENT_ACTION_VALUES)[number];
type WebsiteEventMetaValue = string | number | boolean | null;

type WebsiteEventPayload = {
  eventId: string;
  eventType: WebsiteEventType;
  action: WebsiteEventAction;
  placement: string;
  tsUtc?: number;
  meta?: Record<string, WebsiteEventMetaValue>;
};

type WebsiteEventsRequest = {
  schemaVersion: typeof WEBSITE_EVENTS_SCHEMA_VERSION;
  sessionId: string;
  pagePath: string;
  events: WebsiteEventPayload[];
};

type WebsiteEventsBatchRequest = {
  schemaVersion: typeof WEBSITE_EVENTS_SCHEMA_VERSION;
  batchId: string;
  batchChecksum?: string;
  expectedEventCount?: number;
  generatedAtUtc: number;
  attempt: number;
  sessionId: string;
  pagePath: string;
  events: WebsiteEventPayload[];
};

type WebsiteEventsErrorCode =
  | "invalid_content_type"
  | "payload_too_large"
  | "invalid_json"
  | "invalid_payload"
  | "schema_version_required"
  | "unknown_field"
  | "event_unknown_field"
  | "events_required"
  | "events_batch_too_large"
  | "invalid_event_id"
  | "invalid_event_type"
  | "invalid_event_action"
  | "event_action_type_mismatch"
  | "invalid_placement"
  | "invalid_ts_utc"
  | "invalid_meta"
  | "internal_misconfigured"
  | "upstream_unavailable"
  | "upstream_rejected"
  | "upstream_invalid_response";

type WebsiteEventsErrorResponse = {
  ok: false;
  schemaVersion: typeof WEBSITE_EVENTS_SCHEMA_VERSION;
  error: {
    code: WebsiteEventsErrorCode;
    message: string;
    retryable: boolean;
  };
};

async function computeWebsiteEventsBatchChecksum(input: {
  batchId: string;
  generatedAtUtc: number;
  sessionId: string;
  pagePath: string;
  events: WebsiteEventPayload[];
}): Promise<string> {
  if (
    typeof crypto === "undefined" ||
    !crypto.subtle ||
    typeof crypto.subtle.digest !== "function"
  ) {
    return "";
  }

  const lines: string[] = [];
  lines.push(WEBSITE_EVENTS_SCHEMA_VERSION);
  lines.push(input.batchId || "");
  lines.push(String(Math.max(0, Math.trunc(input.generatedAtUtc || 0))));
  lines.push(input.sessionId || "");
  lines.push(input.pagePath || "/");
  lines.push(String(Array.isArray(input.events) ? input.events.length : 0));

  for (const event of input.events || []) {
    lines.push(event.eventId || "");
    lines.push(event.eventType || "");
    lines.push(event.action || "");
    lines.push(event.placement || "");
    lines.push(String(typeof event.tsUtc === "number" ? Math.max(0, Math.trunc(event.tsUtc)) : 0));
  }

  const payload = lines.join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const bytes = new Uint8Array(digest);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function isWebsiteEventType(value: string): value is WebsiteEventType {
  return (WEBSITE_EVENT_TYPE_VALUES as readonly string[]).includes(value);
}

function isWebsiteEventAction(value: string): value is WebsiteEventAction {
  return (WEBSITE_EVENT_ACTION_VALUES as readonly string[]).includes(value);
}

function websiteEventsError(
  code: WebsiteEventsErrorCode,
  message: string,
  status: number,
  retryable = false,
): Response {
  const payload: WebsiteEventsErrorResponse = {
    ok: false,
    schemaVersion: WEBSITE_EVENTS_SCHEMA_VERSION,
    error: {
      code,
      message,
      retryable,
    },
  };
  return json(payload, { status });
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return false;
  }
  return true;
}

function normalizeWebsiteEventsPagePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized.length <= WEBSITE_EVENTS_MAX_PAGE_PATH_LEN
    ? normalized
    : normalized.slice(0, WEBSITE_EVENTS_MAX_PAGE_PATH_LEN);
}

function sanitizeWebsiteEventMeta(raw: unknown): Record<string, WebsiteEventMetaValue> | null | undefined {
  if (raw == null) return undefined;
  if (!isPlainObject(raw)) return null;
  const out: Record<string, WebsiteEventMetaValue> = {};
  const entries = Object.entries(raw);
  if (entries.length > WEBSITE_EVENTS_MAX_META_KEYS) {
    return null;
  }
  for (const [key, value] of entries) {
    const cleanKey = key.trim();
    if (!cleanKey || cleanKey.length > WEBSITE_EVENTS_MAX_META_KEY_LEN) {
      return null;
    }
    if (typeof value === "string") {
      out[cleanKey] = value.slice(0, WEBSITE_EVENTS_MAX_META_VALUE_STRING_LEN);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      out[cleanKey] = value;
      continue;
    }
    return null;
  }
  return out;
}

function parseWebsiteEventsRequest(raw: unknown): { ok: true; value: WebsiteEventsRequest } | { ok: false; response: Response } {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      response: websiteEventsError("invalid_payload", "Request body must be a JSON object.", 400, false),
    };
  }
  if (!hasOnlyAllowedKeys(raw, WEBSITE_EVENT_ROOT_KEYS)) {
    return {
      ok: false,
      response: websiteEventsError("unknown_field", "Request body contains unsupported fields.", 400, false),
    };
  }

  if (raw.schemaVersion !== WEBSITE_EVENTS_SCHEMA_VERSION) {
    return {
      ok: false,
      response: websiteEventsError("schema_version_required", "schemaVersion must be \"1\".", 400, false),
    };
  }

  const sessionId = typeof raw.sessionId === "string" ? raw.sessionId.trim() : "";
  if (!sessionId || sessionId.length > WEBSITE_EVENTS_MAX_SESSION_ID_LEN) {
    return {
      ok: false,
      response: websiteEventsError("invalid_payload", "sessionId is required and must be <= 96 characters.", 400, false),
    };
  }

  const pagePathRaw = typeof raw.pagePath === "string" ? raw.pagePath : "/";
  const pagePath = normalizeWebsiteEventsPagePath(pagePathRaw);

  if (!Array.isArray(raw.events) || raw.events.length === 0) {
    return {
      ok: false,
      response: websiteEventsError("events_required", "events must be a non-empty array.", 400, false),
    };
  }

  if (raw.events.length > WEBSITE_EVENTS_MAX_BATCH) {
    return {
      ok: false,
      response: websiteEventsError(
        "events_batch_too_large",
        `events length must be <= ${WEBSITE_EVENTS_MAX_BATCH}.`,
        413,
        false,
      ),
    };
  }

  const events: WebsiteEventPayload[] = [];
  for (const entry of raw.events) {
    if (!isPlainObject(entry)) {
      return {
        ok: false,
        response: websiteEventsError("invalid_payload", "Each event must be an object.", 400, false),
      };
    }
    if (!hasOnlyAllowedKeys(entry, WEBSITE_EVENT_KEYS)) {
      return {
        ok: false,
        response: websiteEventsError("event_unknown_field", "Event contains unsupported fields.", 400, false),
      };
    }

    const eventId = typeof entry.eventId === "string" ? entry.eventId.trim() : "";
    if (!WEBSITE_EVENT_ID_PATTERN.test(eventId)) {
      return {
        ok: false,
        response: websiteEventsError("invalid_event_id", "eventId must match the expected format.", 400, false),
      };
    }

    const rawEventType = typeof entry.eventType === "string" ? entry.eventType.trim().toLowerCase() : "";
    if (!isWebsiteEventType(rawEventType)) {
      return {
        ok: false,
        response: websiteEventsError("invalid_event_type", "eventType must be one of: cta, map.", 400, false),
      };
    }
    const eventType: WebsiteEventType = rawEventType;

    const rawAction = typeof entry.action === "string" ? entry.action.trim().toLowerCase() : "";
    if (!isWebsiteEventAction(rawAction)) {
      return {
        ok: false,
        response: websiteEventsError(
          "invalid_event_action",
          "action must be one of: install_click, download_click, map_yes, map_no.",
          400,
          false,
        ),
      };
    }
    const action: WebsiteEventAction = rawAction;
    if (WEBSITE_EVENT_ACTION_TO_TYPE[action] !== eventType) {
      return {
        ok: false,
        response: websiteEventsError("event_action_type_mismatch", "action does not match eventType.", 400, false),
      };
    }

    const placement = typeof entry.placement === "string" ? entry.placement.trim().toLowerCase() : "";
    if (!placement || placement.length > WEBSITE_EVENTS_MAX_PLACEMENT_LEN) {
      return {
        ok: false,
        response: websiteEventsError("invalid_placement", "placement is required and must be <= 64 characters.", 400, false),
      };
    }

    let tsUtc: number | undefined;
    if (entry.tsUtc !== undefined) {
      if (typeof entry.tsUtc !== "number" || !Number.isFinite(entry.tsUtc) || entry.tsUtc <= 0) {
        return {
          ok: false,
          response: websiteEventsError("invalid_ts_utc", "tsUtc must be a positive Unix ms timestamp.", 400, false),
        };
      }
      tsUtc = Math.floor(entry.tsUtc);
    }

    const meta = sanitizeWebsiteEventMeta(entry.meta);
    if (meta === null) {
      return {
        ok: false,
        response: websiteEventsError("invalid_meta", "meta must be a small object of primitive values.", 400, false),
      };
    }

    events.push({
      eventId,
      eventType,
      action,
      placement,
      ...(tsUtc ? { tsUtc } : {}),
      ...(meta ? { meta } : {}),
    });
  }

  return {
    ok: true,
    value: {
      schemaVersion: WEBSITE_EVENTS_SCHEMA_VERSION,
      sessionId,
      pagePath,
      events,
    },
  };
}

function trimAndLimitString(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, Math.max(0, maxLen));
}

function sanitizeWebsiteTelemetrySessionID(value: unknown): string {
  return trimAndLimitString(value, WEBSITE_EVENTS_MAX_SESSION_ID_LEN);
}

function sanitizeWebsiteTelemetryPagePath(value: unknown): string {
  if (typeof value !== "string") return "/";
  return normalizeWebsiteEventsPagePath(value);
}

function sanitizeLoadedChangelogRevision(raw: unknown): ChangelogRevision | null {
  if (!isPlainObject(raw)) return null;
  const source = raw as Record<string, unknown>;
  const id = trimAndLimitString(source.id, 160);
  const createdAt = clampInt(source.createdAt, 1, Number.MAX_SAFE_INTEGER, 0);
  const actor = trimAndLimitString(source.actor, 120);
  const sourceTypeRaw = trimAndLimitString(source.source, 24).toLowerCase();
  const sourceType: "manual" | "github" | "github_auto" | "api" =
    sourceTypeRaw === "github" || sourceTypeRaw === "github_auto" || sourceTypeRaw === "api"
      ? sourceTypeRaw
      : "manual";
  const markdownUrl = trimAndLimitString(source.markdownUrl, 600);
  const markdownLength = clampInt(source.markdownLength, 0, 2_000_000, 0);
  const releases = clampInt(source.releases, 0, 2000, 0);
  const valid = source.valid === true;
  const errors = Array.isArray(source.errors)
    ? source.errors
        .filter((item): item is string => typeof item === "string")
        .map((item) => trimAndLimitString(item, 240))
        .filter((item) => item.length > 0)
        .slice(0, 8)
    : [];
  if (!id || createdAt <= 0) return null;
  return {
    id,
    source: sourceType,
    createdAt,
    actor: actor || "unknown",
    markdownUrl: markdownUrl || undefined,
    markdownLength,
    releases,
    valid,
    errors: errors.length > 0 ? errors : undefined,
  };
}

function sanitizeLoadedWebsiteTelemetryBatch(raw: unknown): WebsiteTelemetryQueuedBatch | null {
  if (!isPlainObject(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (source.schemaVersion !== WEBSITE_EVENTS_SCHEMA_VERSION) return null;
  const batchId = trimAndLimitString(source.batchId, 160);
  const correlationId =
    trimAndLimitString(source.correlationId, 160);
  const generatedAtUtc = clampInt(source.generatedAtUtc, 1, Number.MAX_SAFE_INTEGER, 0);
  const sessionId = sanitizeWebsiteTelemetrySessionID(source.sessionId);
  const pagePath = sanitizeWebsiteTelemetryPagePath(source.pagePath);
  const attempt = clampInt(source.attempt, 0, 100, 0);
  const nextRetryAtUtc = (() => {
    const value = clampInt(source.nextRetryAtUtc, 0, Number.MAX_SAFE_INTEGER, 0);
    return value > 0 ? value : null;
  })();
  const lastError = (() => {
    if (typeof source.lastError !== "string") return null;
    const normalized = trimAndLimitString(source.lastError, 280);
    return normalized || null;
  })();
  if (!batchId || !correlationId || generatedAtUtc <= 0 || sessionId === "" || pagePath === "") {
    return null;
  }
  if (!Array.isArray(source.events) || source.events.length === 0 || source.events.length > WEBSITE_EVENTS_MAX_BATCH) {
    return null;
  }
  const normalizedEvents: WebsiteEventPayload[] = [];
  for (const eventRaw of source.events) {
    if (!isPlainObject(eventRaw)) continue;
    const eventSource = eventRaw as Record<string, unknown>;
    const eventId = typeof eventSource.eventId === "string" ? eventSource.eventId.trim() : "";
    const eventType = typeof eventSource.eventType === "string" ? eventSource.eventType.trim().toLowerCase() : "";
    const action = typeof eventSource.action === "string" ? eventSource.action.trim().toLowerCase() : "";
    const placement = typeof eventSource.placement === "string" ? eventSource.placement.trim().toLowerCase() : "";
    if (!WEBSITE_EVENT_ID_PATTERN.test(eventId)) continue;
    if (!isWebsiteEventType(eventType)) continue;
    if (!isWebsiteEventAction(action)) continue;
    if (WEBSITE_EVENT_ACTION_TO_TYPE[action] !== eventType) continue;
    if (!placement || placement.length > WEBSITE_EVENTS_MAX_PLACEMENT_LEN) continue;
    const tsUtc = clampInt(eventSource.tsUtc, 1, Number.MAX_SAFE_INTEGER, generatedAtUtc);
    const meta = sanitizeWebsiteEventMeta(eventSource.meta);
    if (meta === null) continue;
    normalizedEvents.push({
      eventId,
      eventType,
      action,
      placement,
      tsUtc,
      ...(meta ? { meta } : {}),
    });
  }
  if (normalizedEvents.length === 0) return null;
  return {
    schemaVersion: WEBSITE_EVENTS_SCHEMA_VERSION,
    batchId,
    correlationId,
    generatedAtUtc,
    sessionId,
    pagePath,
    events: normalizedEvents,
    attempt,
    nextRetryAtUtc,
    lastError,
  };
}

function sanitizeString(
  value: unknown,
  maxLen: number,
  pattern?: RegExp,
  fallback = "unknown",
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > maxLen) return fallback;
  if (pattern && !pattern.test(trimmed)) return fallback;
  return trimmed;
}

const FIELD_PATTERNS = {
  generic: /^[a-z0-9._-]+$/,
  language: /^[a-z0-9-]+$/,
};

type ParsedIp = { kind: "v4" | "v6"; value: bigint };
type ParsedCidr = { ip: ParsedIp; prefix: number };

function normalizeIp(input: string): string {
  const ip = (input || "").trim();
  if (!ip) return "";
  if (ip.startsWith("[")) {
    const end = ip.indexOf("]");
    if (end > 0) {
      return ip.slice(1, end);
    }
  }
  const colonCount = (ip.match(/:/g) || []).length;
  if (colonCount === 1 && ip.includes(".") && ip.includes(":")) {
    return ip.split(":")[0];
  }
  return ip;
}

function parseIPv4Bytes(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return -1;
    const num = Number(part);
    return num >= 0 && num <= 255 ? num : -1;
  });
  if (nums.some((n) => n < 0)) return null;
  return nums;
}

function parseIPv4(ip: string): ParsedIp | null {
  const bytes = parseIPv4Bytes(ip);
  if (!bytes) return null;
  const value =
    (bytes[0] << 24) +
    (bytes[1] << 16) +
    (bytes[2] << 8) +
    bytes[3];
  return { kind: "v4", value: BigInt(value >>> 0) };
}

function parseIPv6(input: string): ParsedIp | null {
  let ip = input.toLowerCase();
  const zoneIdx = ip.indexOf("%");
  if (zoneIdx !== -1) {
    ip = ip.slice(0, zoneIdx);
  }

  // IPv4-mapped IPv6 (e.g., ::ffff:192.0.2.1)
  if (ip.includes(".")) {
    const lastColon = ip.lastIndexOf(":");
    if (lastColon === -1) return null;
    const v4Part = ip.slice(lastColon + 1);
    const bytes = parseIPv4Bytes(v4Part);
    if (!bytes) return null;
    const part1 = ((bytes[0] << 8) | bytes[1]).toString(16);
    const part2 = ((bytes[2] << 8) | bytes[3]).toString(16);
    ip = `${ip.slice(0, lastColon)}:${part1}:${part2}`;
  }

  const pieces = ip.split("::");
  if (pieces.length > 2) return null;
  const head = pieces[0] ? pieces[0].split(":").filter(Boolean) : [];
  const tail = pieces[1] ? pieces[1].split(":").filter(Boolean) : [];
  if (pieces.length === 1 && head.length !== 8) return null;

  const missing = 8 - (head.length + tail.length);
  if (missing < 0) return null;
  const full = [...head, ...Array(missing).fill("0"), ...tail];
  if (full.length !== 8) return null;

  let value = 0n;
  for (const part of full) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
    const num = Number.parseInt(part, 16);
    if (!Number.isFinite(num) || num < 0 || num > 0xffff) return null;
    value = (value << 16n) + BigInt(num);
  }
  return { kind: "v6", value };
}

function parseIp(input: string): ParsedIp | null {
  const normalized = normalizeIp(input);
  if (!normalized) return null;
  if (normalized.includes(":")) {
    return parseIPv6(normalized);
  }
  return parseIPv4(normalized);
}

function parseCidr(entry: string): ParsedCidr | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  const [ipPart, prefixPart] = trimmed.split("/");
  const parsed = parseIp(ipPart);
  if (!parsed) return null;
  const bits = parsed.kind === "v4" ? 32 : 128;
  const prefix = prefixPart == null || prefixPart === ""
    ? bits
    : Number(prefixPart);
  if (!Number.isFinite(prefix) || prefix < 0 || prefix > bits) return null;
  return { ip: parsed, prefix: Math.floor(prefix) };
}

function cidrContains(cidr: ParsedCidr, ip: ParsedIp): boolean {
  if (cidr.ip.kind !== ip.kind) return false;
  const bits = cidr.ip.kind === "v4" ? 32 : 128;
  const prefix = cidr.prefix;
  if (prefix <= 0) return true;
  const shift = BigInt(bits - prefix);
  const fullMask = (1n << BigInt(bits)) - 1n;
  const mask = fullMask ^ ((1n << shift) - 1n);
  return (cidr.ip.value & mask) === (ip.value & mask);
}

function normalizeAllowlistEntry(entry: unknown): string | null {
  if (typeof entry !== "string") return null;
  const trimmed = entry.trim();
  if (!trimmed) return null;
  return trimmed;
}

function isIpAllowed(ip: string, allowlist: string[]): boolean {
  const parsedIp = parseIp(ip);
  if (!parsedIp) return false;
  for (const entry of allowlist) {
    const parsedCidr = parseCidr(entry);
    if (!parsedCidr) continue;
    if (cidrContains(parsedCidr, parsedIp)) {
      return true;
    }
  }
  return false;
}

type PipelineHealthStatus = "ok" | "warn" | "critical";

type PipelineHealthResponse = {
  ok: boolean;
  status: PipelineHealthStatus;
  reasons: string[];
  now: number;
  bufferSize: number;
  maxBufferSize: number;
  bufferUtilization: number;
  pendingBatches: number;
  oldestPendingAgeMs: number | null;
  consecutiveFailures: number;
  lastFlushAt: number | null;
  lastEventAt: number | null;
  committedSeq: number;
  lastHealthNotifyAt: number | null;
  thresholds: {
    warnPendingBatches: number;
    criticalPendingBatches: number;
    warnFailures: number;
    criticalFailures: number;
    warnStaleMs: number;
    criticalStaleMs: number;
    warnBufferUtil: number;
    criticalBufferUtil: number;
  };
  websiteTelemetry?: {
    pendingBatches: number;
    deadLetterBatches: number;
    retryCount: number;
    lastBatchCreatedAtUtc: number | null;
    lastBatchSentAtUtc: number | null;
    lastBatchAckAtUtc: number | null;
    lastBatchId: string | null;
    lastCorrelationId: string | null;
    lastError: string | null;
    nextRetryAtUtc: number | null;
  };
};

type PipelineHealthNotification = PipelineHealthResponse & {
  previousStatus?: PipelineHealthStatus;
  notifiedAt: number;
  source: "pipeline-health";
};

async function readJsonBody<T>(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: T } | { ok: false; error: "invalid_json" | "body_too_large"; size?: number }> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > maxBytes) {
      return { ok: false, error: "body_too_large", size };
    }
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await request.arrayBuffer();
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  if (buffer.byteLength > maxBytes) {
    return { ok: false, error: "body_too_large", size: buffer.byteLength };
  }

  const text = new TextDecoder().decode(buffer);
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

/**
 * Decide quota level, mode label, remoteEnabled and batchSizeSuggestion
 * from the current daily request count.
 */
function computeQuotaDescriptor(
  requestsToday: number,
  hardRemoteOff: boolean,
): QuotaDescriptor {
  let quotaLevel = "BELOW_LIMITS";
  let modeLabel = "chill";
  let batchSizeSuggestion = 50;
  let remoteEnabled = !hardRemoteOff;

  if (requestsToday >= QUOTA_VERY_SOFT_LIMIT) {
    quotaLevel = "QUOTA_VERY_SOFT_LIMIT";
    modeLabel = "kinda easy";
    batchSizeSuggestion = 100;
  }
  if (requestsToday >= QUOTA_SOFT_LIMIT) {
    quotaLevel = "QUOTA_SOFT_LIMIT";
    modeLabel = "normal";
    batchSizeSuggestion = 150;
  }
  if (requestsToday >= QUOTA_VERY_NORMAL_LIMIT) {
    quotaLevel = "QUOTA_VERY_NORMAL_LIMIT";
    modeLabel = "slightly busy";
    batchSizeSuggestion = 200;
  }
  if (requestsToday >= QUOTA_NORMAL_LIMIT) {
    quotaLevel = "QUOTA_NORMAL_LIMIT";
    modeLabel = "kinda busy";
    batchSizeSuggestion = 250;
  }
  if (requestsToday >= QUOTA_HARD_NORMAL_LIMIT) {
    quotaLevel = "QUOTA_HARD_NORMAL_LIMIT";
    modeLabel = "busy";
    batchSizeSuggestion = 300;
  }
  if (requestsToday >= QUOTA_HARD_LIMIT) {
    quotaLevel = "QUOTA_HARD_LIMIT";
    modeLabel = "very busy";
    batchSizeSuggestion = 500;
  }
  if (requestsToday >= QUOTA_VERY_HARD_LIMIT) {
    quotaLevel = "QUOTA_VERY_HARD_LIMIT";
    modeLabel = "emergency";
    // At this point, we effectively "cut power" to remote analytics.
    remoteEnabled = false;
  }

  if (hardRemoteOff) {
    // Admin override / Danger Zone toggle.
    remoteEnabled = false;
    if (requestsToday < QUOTA_VERY_HARD_LIMIT) {
      quotaLevel = "ADMIN_REMOTE_OFF";
      modeLabel = "admin-cut-power";
    }
  }

  return {
    requestsToday,
    quotaLevel,
    modeLabel,
    remoteEnabled,
    batchSizeSuggestion,
  };
}

function computeRemoteEnabled(
  quotaEnabled: boolean,
  bufferLen: number,
  maxBuffer: number,
  retryState: RetryState | null,
): { enabled: boolean; reason: string } {
  if (!quotaEnabled) {
    return { enabled: false, reason: "quota_or_admin" };
  }
  if (maxBuffer > 0 && bufferLen >= maxBuffer * REMOTE_DISABLE_BUFFER_UTIL) {
    return { enabled: false, reason: "buffer_high" };
  }
  if (retryState && retryState.consecutiveFailures >= REMOTE_DISABLE_FAILURES) {
    return { enabled: false, reason: "oracle_failures" };
  }
  return { enabled: true, reason: "ok" };
}

function json<T>(obj: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(obj), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

/**
 * Best-effort timing-safe string comparison for JavaScript.
 *
 * IMPORTANT: JavaScript does not guarantee constant-time execution.
 * JIT compilers, garbage collection, and branch prediction can all
 * introduce timing variations. This implementation minimizes the
 * most obvious timing channels (early exit on length mismatch,
 * character-by-character short-circuit) but is NOT equivalent to
 * crypto.subtle.timingSafeEqual (unavailable in Workers runtime for
 * arbitrary strings).
 *
 * For password verification, prefer bcrypt/scrypt which have their
 * own timing-safe comparison built in.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  let mismatch = a.length ^ b.length;
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i += 1) {
    const aCode = i < a.length ? a.charCodeAt(i) : 0;
    const bCode = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= aCode ^ bCode;
  }
  return mismatch === 0;
}

type LogLevel = "info" | "warn" | "error";

function logEvent(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...fields,
  };
  console.log(JSON.stringify(payload));
}

function generateAckId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `ack-${crypto.randomUUID()}`;
    }
  } catch {
    // ignore and fallback
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `ack-${Date.now().toString(36)}-${rand}`;
}

function generateEventId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `legacy-${crypto.randomUUID()}`;
    }
  } catch {
    // ignore and fallback
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `legacy-${Date.now().toString(36)}-${rand}`;
}

function normalizeFailureDetail(input: unknown): string {
  const raw = typeof input === "string" ? input : String(input ?? "");
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return "n/a";
  return collapsed.slice(0, FAILURE_DETAIL_MAX_LEN);
}

// ---------------------------------------------------------------------------
// Durable Object class
// ---------------------------------------------------------------------------

export class DownloadsDurable {
  private state: DurableObjectState;
  private env: Env;
  private data: DurableStateShape | null = null;
  private loaded: Promise<void>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.loaded = this.load();
  }

  // ---------------------------------------------------------------------------
  // Loading & persistence
  // ---------------------------------------------------------------------------

  private async load(): Promise<void> {
    const stored = await this.state.storage.get<DurableStateShape>(STORAGE_KEY);

    const base: DurableStateShape = {
      totalEvents: 0,
      totalDownloads: 0,
      totalSuccess: 0,
      totalFail: 0,
      totalCancelled: 0,
      pendingEvents: 0,
      lastEventAt: null,
      lastFlushAt: null,
      counters: createEmptyCounters(),
      retryState: { ...DEFAULT_RETRY_STATE },

      reqCountToday: 0,
      reqCountDate: null,
      reqDailyCounts: {},
      hardRemoteOff: false,

      buffer: [],
      batchSeq: 0,
      eventSeq: 0,
      committedSeq: 0,
      pendingBatches: [],
      deliveryMetrics: createEmptyDeliveryMetrics(),
      failureRollups: [],
      
      ipCounts: {},
      ipCountsSize: 0,
      uniqueRequestsToday: 0,
      processedIds: [],
      burstCounts: {},

      // Auth-related state
      loginAttempts: {},
      ipAllowlistEnabled: false,
      ipAllowlist: [],
      ipAllowlistStepUpBypassEnabled: true,
      dangerActionAuditLogs: [],
      trackRates: {},

      // Remote config defaults
      configVersion: CONFIG_VERSION,
      configBatchSize: 50,
      configMaxDailyRequests: 50,
      configMaxRetry: 5,
      configMaxEventsPerRequest: 5000,
      configMaxBufferSize: 50000,
      configFlushMode: 'next_day',
      configDailyFlushWindowStartUtc: DEFAULT_DAILY_FLUSH_WINDOW_START_UTC,
      configDailyFlushWindowMinutes: DEFAULT_DAILY_FLUSH_WINDOW_MINUTES,
      configTimeFlushMinutes: { low: 1440, mid: 1440, high: 1440 }, // 1440 = 24h = next day
      configCancelHoldDelayMs: 1000, // 1 second default
      configAllowLegacyEvents: true,
      configHealthWarnPendingBatches: HEALTH_WARN_PENDING_BATCHES,
      configHealthCriticalPendingBatches: HEALTH_CRIT_PENDING_BATCHES,
      configHealthWarnFailures: HEALTH_WARN_FAILURES,
      configHealthCriticalFailures: HEALTH_CRIT_FAILURES,
      configHealthWarnStaleMs: HEALTH_WARN_STALE_MS,
      configHealthCriticalStaleMs: HEALTH_CRIT_STALE_MS,
      configHealthWarnBufferUtil: HEALTH_WARN_BUFFER_UTIL,
      configHealthCriticalBufferUtil: HEALTH_CRIT_BUFFER_UTIL,
      configHealthNotifyWarnIntervalMs: HEALTH_NOTIFY_WARN_INTERVAL_MS,
      configHealthNotifyCritIntervalMs: HEALTH_NOTIFY_CRIT_INTERVAL_MS,

      // Changelog defaults
      changelog: defaultExtensionChangelogEntries(),
      changelogRevisions: [],
      changelogConfig: {
        rules: [],
        applyMode: CHANGELOG_DEFAULT_APPLY_MODE,
        autoSyncEnabled: CHANGELOG_DEFAULT_AUTO_SYNC_ENABLED,
        autoSyncIntervalMinutes: CHANGELOG_DEFAULT_AUTO_SYNC_INTERVAL_MINUTES,
        lastAutoSyncStatus: "idle",
        liveHash: computeChangelogLiveHash(defaultExtensionChangelogEntries()),
        markdownSourceUrl: USER_FRIENDLY_CHANGELOG_GITHUB_URL,
        markdownHelpUrl: USER_FRIENDLY_CHANGELOG_GITHUB_URL,
        lastUpdated: Date.now(),
      },
      changelogDraft: null,
      publicSiteMetricsSnapshot: null,
      websitePublicSyncEnabled: true,
      websiteManualFlushAt: null,
      websiteOverrideEnabled: false,
      websiteOverrideDownloads: 0,
      websiteOverrideCountries: [],
      websiteTelemetryQueue: [],
      websiteTelemetryDeadLetter: [],
      websiteTelemetrySeenEventIds: [],
      websiteTelemetryLastBatchCreatedAt: null,
      websiteTelemetryLastBatchSentAt: null,
      websiteTelemetryLastBatchAckAt: null,
      websiteTelemetryLastBatchID: null,
      websiteTelemetryLastCorrelationID: null,
      websiteTelemetryLastError: null,

      lastHealthStatus: "ok",
      lastHealthNotifyAt: null,
    };

    if (!stored) {
      this.data = base;
      return;
    }

    // Merge stored with defaults to be robust to schema changes.
    const stepUpBypassNeedsMigration =
      typeof stored.ipAllowlistStepUpBypassEnabled !== "boolean";
    const changelogRevisionNeedsMigration = !Array.isArray(
      (stored as unknown as Record<string, unknown>).changelogRevisions,
    );
    const changelogConfigNeedsMigration = (() => {
      if (!isPlainObject(stored.changelogConfig)) return true;
      const cfg = stored.changelogConfig as Record<string, unknown>;
      if (cfg.applyMode !== "manual" && cfg.applyMode !== "auto_github") return true;
      if (typeof cfg.autoSyncEnabled !== "boolean") return true;
      if (typeof cfg.autoSyncIntervalMinutes !== "number") return true;
      if (cfg.lastAutoSyncStatus !== "idle" && cfg.lastAutoSyncStatus !== "ok" && cfg.lastAutoSyncStatus !== "error") return true;
      if (typeof cfg.liveHash !== "string" || cfg.liveHash.trim() === "") return true;
      return false;
    })();
    const changelogDraftNeedsMigration = (() => {
      const draftRaw = (stored as unknown as Record<string, unknown>).changelogDraft;
      if (typeof draftRaw === "undefined" || draftRaw === null) return false;
      return !isPlainObject(draftRaw);
    })();
    this.data = {
      totalEvents: stored.totalEvents ?? base.totalEvents,
      totalDownloads: stored.totalDownloads ?? base.totalDownloads,
      totalSuccess: stored.totalSuccess ?? base.totalSuccess,
      totalFail: stored.totalFail ?? base.totalFail,
      totalCancelled: stored.totalCancelled ?? base.totalCancelled,
      pendingEvents: stored.pendingEvents ?? base.pendingEvents,
      lastEventAt: stored.lastEventAt ?? base.lastEventAt,
      lastFlushAt: stored.lastFlushAt ?? base.lastFlushAt,
      counters: {
        byStatus: cloneCounterMap(stored.counters?.byStatus),
        byType: cloneCounterMap(stored.counters?.byType),
        byBrowser: cloneCounterMap(stored.counters?.byBrowser),
        byOs: cloneCounterMap(stored.counters?.byOs),
        byExtVersion: cloneCounterMap(stored.counters?.byExtVersion),
        byLanguage: cloneCounterMap(stored.counters?.byLanguage),
        byCountry: cloneCounterMap(stored.counters?.byCountry),
        byErrorType: cloneCounterMap(stored.counters?.byErrorType),
      },
      retryState: stored.retryState ?? { ...DEFAULT_RETRY_STATE },

      reqCountToday: stored.reqCountToday ?? 0,
      reqCountDate: stored.reqCountDate ?? null,
      reqDailyCounts: normalizeReqDailyCounts(stored.reqDailyCounts),
      hardRemoteOff: stored.hardRemoteOff ?? false,

      buffer: Array.isArray(stored.buffer) ? stored.buffer : [],
      batchSeq: stored.batchSeq ?? 0,
      eventSeq: stored.eventSeq ?? 0,
      committedSeq: stored.committedSeq ?? 0,
      pendingBatches: Array.isArray(stored.pendingBatches) ? stored.pendingBatches : [],
      deliveryMetrics: (() => {
        const src = isPlainObject((stored as unknown as Record<string, unknown>).deliveryMetrics)
          ? ((stored as unknown as Record<string, unknown>).deliveryMetrics as Record<string, unknown>)
          : {};
        const totals = isPlainObject(src.totals) ? (src.totals as Record<string, unknown>) : {};
        const recentRaw = Array.isArray(src.recent) ? src.recent : [];
        const recent = recentRaw
          .filter((item) => isPlainObject(item))
          .map((item) => {
            const row = item as Record<string, unknown>;
            const statusRaw = typeof row.status === "string" ? row.status : "pending";
            const status: "pending" | "forwarded" | "committed" =
              statusRaw === "committed" || statusRaw === "forwarded" ? statusRaw : "pending";
            return {
              deliveryId: typeof row.deliveryId === "string" ? row.deliveryId : "",
              batchId: typeof row.batchId === "string" ? row.batchId : "",
              accepted: clampInt(row.accepted, 0, Number.MAX_SAFE_INTEGER, 0),
              stored: clampInt(row.stored, 0, Number.MAX_SAFE_INTEGER, 0),
              forwarded: clampInt(row.forwarded, 0, Number.MAX_SAFE_INTEGER, 0),
              committed: clampInt(row.committed, 0, Number.MAX_SAFE_INTEGER, 0),
              status,
              createdAt: clampInt(row.createdAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
              updatedAt: clampInt(row.updatedAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
            };
          })
          .filter((row) => row.deliveryId && row.batchId);
        return {
          totals: {
            accepted: clampInt(totals.accepted, 0, Number.MAX_SAFE_INTEGER, 0),
            stored: clampInt(totals.stored, 0, Number.MAX_SAFE_INTEGER, 0),
            forwarded: clampInt(totals.forwarded, 0, Number.MAX_SAFE_INTEGER, 0),
            committed: clampInt(totals.committed, 0, Number.MAX_SAFE_INTEGER, 0),
          },
          recent: recent.slice(0, MAX_RECENT_DELIVERIES),
        };
      })(),
      failureRollups: (() => {
        const src = (stored as unknown as Record<string, unknown>).failureRollups;
        if (!Array.isArray(src)) return [];
        return src
          .filter((item) => isPlainObject(item))
          .map((item) => {
            const row = item as Record<string, unknown>;
            return {
              key: typeof row.key === "string" ? row.key : "",
              source: "cloudflare-do" as const,
              stage: sanitizeString(row.stage, 64, FIELD_PATTERNS.generic, "unknown_stage"),
              errorCode: sanitizeString(row.errorCode, 64, FIELD_PATTERNS.generic, "unknown_error"),
              errorDetail: normalizeFailureDetail(row.errorDetail),
              sampleCount: clampInt(row.sampleCount, 0, Number.MAX_SAFE_INTEGER, 0),
              unsentCount: clampInt(row.unsentCount, 0, Number.MAX_SAFE_INTEGER, 0),
              firstTs: clampInt(row.firstTs, 0, Number.MAX_SAFE_INTEGER, Date.now()),
              lastTs: clampInt(row.lastTs, 0, Number.MAX_SAFE_INTEGER, Date.now()),
            };
          })
          .filter((row) => row.key);
      })(),

      ipCounts: {},
      ipCountsSize: 0,
      uniqueRequestsToday: 0,
      processedIds: Array.isArray(stored.processedIds) ? stored.processedIds : [],
      burstCounts: stored.burstCounts ?? {},

      // Auth-related state
      loginAttempts: stored.loginAttempts ?? base.loginAttempts,
      ipAllowlistEnabled: stored.ipAllowlistEnabled ?? base.ipAllowlistEnabled,
      ipAllowlist: Array.isArray(stored.ipAllowlist) ? stored.ipAllowlist : base.ipAllowlist,
      ipAllowlistStepUpBypassEnabled:
        typeof stored.ipAllowlistStepUpBypassEnabled === "boolean"
          ? stored.ipAllowlistStepUpBypassEnabled
          : base.ipAllowlistStepUpBypassEnabled,
      dangerActionAuditLogs: (() => {
        const source = (stored as unknown as Record<string, unknown>).dangerActionAuditLogs;
        if (!Array.isArray(source)) return [];
        return source
          .filter((entry) => isPlainObject(entry))
          .map((entry) => {
            const row = entry as Record<string, unknown>;
            const resultRaw = typeof row.result === "string" ? row.result : "ok";
            const result: "ok" | "error" = resultRaw === "error" ? "error" : "ok";
            return {
              id: trimAndLimitString(row.id, 120) || "",
              tsUtc: clampInt(row.tsUtc, 0, Number.MAX_SAFE_INTEGER, 0),
              actorIp: trimAndLimitString(row.actorIp, 120) || "unknown",
              action: trimAndLimitString(row.action, 80) || "unknown",
              path: trimAndLimitString(row.path, 120) || "",
              result,
              correlationId: trimAndLimitString(row.correlationId, 160) || "",
              detail: (() => {
                const value = trimAndLimitString(row.detail, 280);
                return value || null;
              })(),
            };
          })
          .filter((entry) => entry.id !== "" && entry.tsUtc > 0)
          .slice(0, MAX_DANGER_AUDIT_LOGS);
      })(),
      trackRates: stored.trackRates && typeof stored.trackRates === "object" ? stored.trackRates : base.trackRates,

      // Remote config - preserve stored values or use defaults
      configVersion: stored.configVersion ?? base.configVersion,
      configBatchSize: stored.configBatchSize ?? base.configBatchSize,
      configMaxDailyRequests: stored.configMaxDailyRequests ?? base.configMaxDailyRequests,
      configMaxRetry: stored.configMaxRetry ?? base.configMaxRetry,
      configMaxEventsPerRequest: stored.configMaxEventsPerRequest ?? base.configMaxEventsPerRequest,
      configMaxBufferSize: stored.configMaxBufferSize ?? base.configMaxBufferSize,
      configFlushMode: stored.configFlushMode ?? base.configFlushMode,
      configDailyFlushWindowStartUtc: stored.configDailyFlushWindowStartUtc ?? base.configDailyFlushWindowStartUtc,
      configDailyFlushWindowMinutes: stored.configDailyFlushWindowMinutes ?? base.configDailyFlushWindowMinutes,
      configTimeFlushMinutes: stored.configTimeFlushMinutes ?? base.configTimeFlushMinutes,
      configCancelHoldDelayMs: stored.configCancelHoldDelayMs ?? base.configCancelHoldDelayMs,
      configAllowLegacyEvents:
        typeof stored.configAllowLegacyEvents === "boolean"
          ? stored.configAllowLegacyEvents
          : base.configAllowLegacyEvents,
      configHealthWarnPendingBatches:
        stored.configHealthWarnPendingBatches ?? base.configHealthWarnPendingBatches,
      configHealthCriticalPendingBatches:
        stored.configHealthCriticalPendingBatches ?? base.configHealthCriticalPendingBatches,
      configHealthWarnFailures:
        stored.configHealthWarnFailures ?? base.configHealthWarnFailures,
      configHealthCriticalFailures:
        stored.configHealthCriticalFailures ?? base.configHealthCriticalFailures,
      configHealthWarnStaleMs:
        stored.configHealthWarnStaleMs ?? base.configHealthWarnStaleMs,
      configHealthCriticalStaleMs:
        stored.configHealthCriticalStaleMs ?? base.configHealthCriticalStaleMs,
      configHealthWarnBufferUtil:
        stored.configHealthWarnBufferUtil ?? base.configHealthWarnBufferUtil,
      configHealthCriticalBufferUtil:
        stored.configHealthCriticalBufferUtil ?? base.configHealthCriticalBufferUtil,
      configHealthNotifyWarnIntervalMs:
        stored.configHealthNotifyWarnIntervalMs ?? base.configHealthNotifyWarnIntervalMs,
      configHealthNotifyCritIntervalMs:
        stored.configHealthNotifyCritIntervalMs ?? base.configHealthNotifyCritIntervalMs,

      changelog:
        (() => {
          if (!Array.isArray(stored.changelog) || stored.changelog.length === 0) return base.changelog;
          const sanitized = sanitizeIncomingChangelogEntries(stored.changelog);
          return sanitized.length > 0 ? sanitized : base.changelog;
        })(),
      changelogRevisions: Array.isArray((stored as unknown as Record<string, unknown>).changelogRevisions)
        ? ((stored as unknown as Record<string, unknown>).changelogRevisions as unknown[])
            .map((row) => sanitizeLoadedChangelogRevision(row))
            .filter((row): row is ChangelogRevision => row !== null)
            .slice(0, 100)
        : [],
      changelogConfig: (() => {
        const config = isPlainObject(stored.changelogConfig)
          ? (stored.changelogConfig as ChangelogConfig)
          : base.changelogConfig;
        return {
          ...base.changelogConfig,
          ...config,
          rules: sanitizeNotificationRules(config.rules),
          applyMode: normalizeChangelogApplyMode(config.applyMode),
          autoSyncEnabled:
            typeof config.autoSyncEnabled === "boolean"
              ? config.autoSyncEnabled
              : CHANGELOG_DEFAULT_AUTO_SYNC_ENABLED,
          autoSyncIntervalMinutes: normalizeAutoSyncIntervalMinutes(config.autoSyncIntervalMinutes),
          lastAutoSyncAt: clampInt(config.lastAutoSyncAt, 0, Number.MAX_SAFE_INTEGER, 0) || undefined,
          lastAutoSyncStatus: normalizeChangelogSyncStatus(config.lastAutoSyncStatus),
          lastAutoSyncError: trimAndLimitString(config.lastAutoSyncError, 320) || undefined,
          nextAutoSyncAt: clampInt(config.nextAutoSyncAt, 0, Number.MAX_SAFE_INTEGER, 0) || undefined,
          liveHash:
            trimAndLimitString(config.liveHash, 2_000_000) ||
            computeChangelogLiveHash(
              Array.isArray(stored.changelog) && stored.changelog.length > 0
                ? (() => {
                    const sanitized = sanitizeIncomingChangelogEntries(stored.changelog);
                    return sanitized.length > 0 ? sanitized : base.changelog;
                  })()
                : base.changelog,
            ),
          markdownSourceUrl: trimAndLimitString(config.markdownSourceUrl, 600) || USER_FRIENDLY_CHANGELOG_GITHUB_URL,
          markdownHelpUrl: trimAndLimitString(config.markdownHelpUrl, 600) || USER_FRIENDLY_CHANGELOG_GITHUB_URL,
        };
      })(),
      changelogDraft: sanitizeLoadedChangelogDraft(
        (stored as unknown as Record<string, unknown>).changelogDraft,
      ),
      publicSiteMetricsSnapshot: (() => {
        const snapshot = (stored as unknown as Record<string, unknown>).publicSiteMetricsSnapshot;
        if (!isPlainObject(snapshot)) return null;
        const countriesRaw = Array.isArray(snapshot.countries) ? snapshot.countries : [];
        const countries = countriesRaw
          .filter((entry) => isPlainObject(entry))
          .map((entry) => {
            const row = entry as Record<string, unknown>;
            return {
              countryCode: normalizePublicCountryCode(typeof row.countryCode === "string" ? row.countryCode : "") ?? "",
              count: clampInt(row.count, 0, Number.MAX_SAFE_INTEGER, 0),
            };
          })
          .filter((entry) => entry.countryCode !== "" && entry.count > 0);
        countries.sort((a, b) => {
          if (a.count === b.count) return a.countryCode.localeCompare(b.countryCode);
          return b.count - a.count;
        });

        const snapshotAtUtc = clampInt(snapshot.snapshotAtUtc, 0, Number.MAX_SAFE_INTEGER, 0);
        const slotKey = typeof snapshot.slotKey === "string" ? snapshot.slotKey.slice(0, 32) : "";
        const downloads = clampInt(snapshot.downloads, 0, Number.MAX_SAFE_INTEGER, 0);
        if (!slotKey || snapshotAtUtc <= 0) return null;
        return { slotKey, snapshotAtUtc, downloads, countries };
      })(),
      websitePublicSyncEnabled:
        typeof (stored as unknown as Record<string, unknown>).websitePublicSyncEnabled === "boolean"
          ? Boolean((stored as unknown as Record<string, unknown>).websitePublicSyncEnabled)
          : base.websitePublicSyncEnabled,
      websiteManualFlushAt: (() => {
        const value = clampInt(
          (stored as unknown as Record<string, unknown>).websiteManualFlushAt,
          0,
          Number.MAX_SAFE_INTEGER,
          0,
        );
        return value > 0 ? value : null;
      })(),
      websiteOverrideEnabled:
        typeof (stored as unknown as Record<string, unknown>).websiteOverrideEnabled === "boolean"
          ? Boolean((stored as unknown as Record<string, unknown>).websiteOverrideEnabled)
          : base.websiteOverrideEnabled,
      websiteOverrideDownloads: clampInt(
        (stored as unknown as Record<string, unknown>).websiteOverrideDownloads,
        0,
        Number.MAX_SAFE_INTEGER,
        0,
      ),
      websiteOverrideCountries: normalizePublicSiteCountryList(
        (stored as unknown as Record<string, unknown>).websiteOverrideCountries,
      ),
      websiteTelemetryQueue: (() => {
        const raw = (stored as unknown as Record<string, unknown>).websiteTelemetryQueue;
        if (!Array.isArray(raw)) return [];
        return raw
          .map((row) => sanitizeLoadedWebsiteTelemetryBatch(row))
          .filter((row): row is WebsiteTelemetryQueuedBatch => row !== null)
          .slice(0, WEBSITE_TELEMETRY_MAX_QUEUE_BATCHES);
      })(),
      websiteTelemetryDeadLetter: (() => {
        const raw = (stored as unknown as Record<string, unknown>).websiteTelemetryDeadLetter;
        if (!Array.isArray(raw)) return [];
        return raw
          .map((row) => sanitizeLoadedWebsiteTelemetryBatch(row))
          .filter((row): row is WebsiteTelemetryQueuedBatch => row !== null)
          .slice(0, WEBSITE_TELEMETRY_MAX_DLQ_BATCHES);
      })(),
      websiteTelemetrySeenEventIds: (() => {
        const raw = (stored as unknown as Record<string, unknown>).websiteTelemetrySeenEventIds;
        if (!Array.isArray(raw)) return [];
        const normalized = raw
          .filter((value) => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => WEBSITE_EVENT_ID_PATTERN.test(value));
        if (normalized.length <= WEBSITE_TELEMETRY_MAX_DEDUPE_IDS) return normalized;
        return normalized.slice(normalized.length - WEBSITE_TELEMETRY_MAX_DEDUPE_IDS);
      })(),
      websiteTelemetryLastBatchCreatedAt: (() => {
        const value = clampInt(
          (stored as unknown as Record<string, unknown>).websiteTelemetryLastBatchCreatedAt,
          0,
          Number.MAX_SAFE_INTEGER,
          0,
        );
        return value > 0 ? value : null;
      })(),
      websiteTelemetryLastBatchSentAt: (() => {
        const value = clampInt(
          (stored as unknown as Record<string, unknown>).websiteTelemetryLastBatchSentAt,
          0,
          Number.MAX_SAFE_INTEGER,
          0,
        );
        return value > 0 ? value : null;
      })(),
      websiteTelemetryLastBatchAckAt: (() => {
        const value = clampInt(
          (stored as unknown as Record<string, unknown>).websiteTelemetryLastBatchAckAt,
          0,
          Number.MAX_SAFE_INTEGER,
          0,
        );
        return value > 0 ? value : null;
      })(),
      websiteTelemetryLastBatchID: (() => {
        const value = trimAndLimitString(
          (stored as unknown as Record<string, unknown>).websiteTelemetryLastBatchID,
          160,
        );
        return value || null;
      })(),
      websiteTelemetryLastCorrelationID: (() => {
        const value = trimAndLimitString(
          (stored as unknown as Record<string, unknown>).websiteTelemetryLastCorrelationID,
          160,
        );
        return value || null;
      })(),
      websiteTelemetryLastError: (() => {
        const value = trimAndLimitString(
          (stored as unknown as Record<string, unknown>).websiteTelemetryLastError,
          280,
        );
        return value || null;
      })(),

      lastHealthStatus: stored.lastHealthStatus ?? base.lastHealthStatus,
      lastHealthNotifyAt: stored.lastHealthNotifyAt ?? base.lastHealthNotifyAt,
    };

    if (this.data.reqCountDate && /^\d{4}-\d{2}-\d{2}$/.test(this.data.reqCountDate)) {
      const existing = this.data.reqDailyCounts[this.data.reqCountDate];
      if (typeof existing === "number" && Number.isFinite(existing) && existing >= 0) {
        this.data.reqCountToday = existing;
      } else {
        this.data.reqDailyCounts[this.data.reqCountDate] = this.data.reqCountToday;
      }
      this.compactRequestHistory(this.data.reqCountDate);
    }

    if (Array.isArray(this.data.pendingBatches)) {
      this.data.pendingBatches = this.data.pendingBatches
        .filter((b) => b && typeof b === "object" && b.batch)
        .map((b) => ({
          ...b,
          weightedCount:
            typeof (b as Partial<PendingOracleBatch>).weightedCount === "number"
              ? Math.max(0, Math.floor((b as Partial<PendingOracleBatch>).weightedCount || 0))
              : typeof (b as unknown as { eventCount?: number }).eventCount === "number"
                ? Math.max(0, Math.floor((b as unknown as { eventCount?: number }).eventCount || 0))
                : Math.max(0, Math.floor((b.batch?.summary?.totals?.totalDownloads as number) || 0)),
          attempts: typeof b.attempts === "number" ? b.attempts : 0,
          createdAt: typeof b.createdAt === "number" ? b.createdAt : Date.now(),
        }));
    } else {
      this.data.pendingBatches = [];
    }
    const pendingBefore = this.data.pendingBatches.length;
    this.mergePendingBatchesIfNeeded();
    const pendingCompacted = this.data.pendingBatches.length !== pendingBefore;

    const failureBefore = this.data.failureRollups.length;
    this.pruneFailureRollups();
    const failurePruned = this.data.failureRollups.length !== failureBefore;

    // Normalize config values and ensure schema version
    let configDirty = false;
    if (!Number.isFinite(this.data.configVersion) || this.data.configVersion < CONFIG_VERSION) {
      this.data.configVersion = CONFIG_VERSION;
      configDirty = true;
    }
    this.data.configBatchSize = clampInt(this.data.configBatchSize, 1, 1000, base.configBatchSize);
    this.data.configMaxDailyRequests = clampInt(this.data.configMaxDailyRequests, 1, 1000, base.configMaxDailyRequests);
    this.data.configMaxRetry = clampInt(this.data.configMaxRetry, 0, 20, base.configMaxRetry);
    this.data.configMaxEventsPerRequest = clampInt(this.data.configMaxEventsPerRequest, 1, 50_000, base.configMaxEventsPerRequest);
    this.data.configMaxBufferSize = clampInt(this.data.configMaxBufferSize, 1, 500_000, base.configMaxBufferSize);
    this.data.configDailyFlushWindowStartUtc = clampInt(
      this.data.configDailyFlushWindowStartUtc,
      0,
      23,
      base.configDailyFlushWindowStartUtc
    );
    this.data.configDailyFlushWindowMinutes = clampInt(
      this.data.configDailyFlushWindowMinutes,
      1,
      24 * 60,
      base.configDailyFlushWindowMinutes
    );
    if (typeof this.data.configAllowLegacyEvents !== "boolean") {
      this.data.configAllowLegacyEvents = base.configAllowLegacyEvents;
      configDirty = true;
    }
    if (!this.data.configTimeFlushMinutes || typeof this.data.configTimeFlushMinutes !== "object") {
      this.data.configTimeFlushMinutes = { ...base.configTimeFlushMinutes };
      configDirty = true;
    } else {
      const tfm = this.data.configTimeFlushMinutes;
      const nextLow = clampInt(tfm.low, 1, 10080, base.configTimeFlushMinutes.low);
      const nextMid = clampInt(tfm.mid, 1, 10080, base.configTimeFlushMinutes.mid);
      const nextHigh = clampInt(tfm.high, 1, 10080, base.configTimeFlushMinutes.high);
      if (nextLow !== tfm.low || nextMid !== tfm.mid || nextHigh !== tfm.high) {
        this.data.configTimeFlushMinutes = { low: nextLow, mid: nextMid, high: nextHigh };
        configDirty = true;
      }
    }
    const nextCancelHold = clampInt(
      this.data.configCancelHoldDelayMs,
      0,
      10000,
      base.configCancelHoldDelayMs
    );
    if (nextCancelHold !== this.data.configCancelHoldDelayMs) {
      this.data.configCancelHoldDelayMs = nextCancelHold;
      configDirty = true;
    }

    const warnPending = clampInt(
      this.data.configHealthWarnPendingBatches,
      0,
      1000,
      base.configHealthWarnPendingBatches,
    );
    const critPending = clampInt(
      this.data.configHealthCriticalPendingBatches,
      0,
      2000,
      base.configHealthCriticalPendingBatches,
    );
    const warnFailures = clampInt(
      this.data.configHealthWarnFailures,
      0,
      100,
      base.configHealthWarnFailures,
    );
    const critFailures = clampInt(
      this.data.configHealthCriticalFailures,
      0,
      100,
      base.configHealthCriticalFailures,
    );
    const warnStaleMs = clampInt(
      this.data.configHealthWarnStaleMs,
      0,
      30 * 24 * 60 * 60 * 1000,
      base.configHealthWarnStaleMs,
    );
    const critStaleMs = clampInt(
      this.data.configHealthCriticalStaleMs,
      0,
      30 * 24 * 60 * 60 * 1000,
      base.configHealthCriticalStaleMs,
    );
    const warnBuffer = clampFloat(
      this.data.configHealthWarnBufferUtil,
      0,
      1,
      base.configHealthWarnBufferUtil,
    );
    const critBuffer = clampFloat(
      this.data.configHealthCriticalBufferUtil,
      0,
      1,
      base.configHealthCriticalBufferUtil,
    );
    const warnNotify = clampInt(
      this.data.configHealthNotifyWarnIntervalMs,
      60 * 1000,
      24 * 60 * 60 * 1000,
      base.configHealthNotifyWarnIntervalMs,
    );
    const critNotify = clampInt(
      this.data.configHealthNotifyCritIntervalMs,
      60 * 1000,
      24 * 60 * 60 * 1000,
      base.configHealthNotifyCritIntervalMs,
    );

    const pendingOk = warnPending <= critPending;
    const failuresOk = warnFailures <= critFailures;
    const staleOk = warnStaleMs <= critStaleMs;
    const bufferOk = warnBuffer <= critBuffer;
    const notifyOk = warnNotify >= critNotify;

    if (!pendingOk || !failuresOk || !staleOk || !bufferOk || !notifyOk) {
      this.data.configHealthWarnPendingBatches = base.configHealthWarnPendingBatches;
      this.data.configHealthCriticalPendingBatches = base.configHealthCriticalPendingBatches;
      this.data.configHealthWarnFailures = base.configHealthWarnFailures;
      this.data.configHealthCriticalFailures = base.configHealthCriticalFailures;
      this.data.configHealthWarnStaleMs = base.configHealthWarnStaleMs;
      this.data.configHealthCriticalStaleMs = base.configHealthCriticalStaleMs;
      this.data.configHealthWarnBufferUtil = base.configHealthWarnBufferUtil;
      this.data.configHealthCriticalBufferUtil = base.configHealthCriticalBufferUtil;
      this.data.configHealthNotifyWarnIntervalMs = base.configHealthNotifyWarnIntervalMs;
      this.data.configHealthNotifyCritIntervalMs = base.configHealthNotifyCritIntervalMs;
      configDirty = true;
    } else {
      if (warnPending !== this.data.configHealthWarnPendingBatches) {
        this.data.configHealthWarnPendingBatches = warnPending;
        configDirty = true;
      }
      if (critPending !== this.data.configHealthCriticalPendingBatches) {
        this.data.configHealthCriticalPendingBatches = critPending;
        configDirty = true;
      }
      if (warnFailures !== this.data.configHealthWarnFailures) {
        this.data.configHealthWarnFailures = warnFailures;
        configDirty = true;
      }
      if (critFailures !== this.data.configHealthCriticalFailures) {
        this.data.configHealthCriticalFailures = critFailures;
        configDirty = true;
      }
      if (warnStaleMs !== this.data.configHealthWarnStaleMs) {
        this.data.configHealthWarnStaleMs = warnStaleMs;
        configDirty = true;
      }
      if (critStaleMs !== this.data.configHealthCriticalStaleMs) {
        this.data.configHealthCriticalStaleMs = critStaleMs;
        configDirty = true;
      }
      if (warnBuffer !== this.data.configHealthWarnBufferUtil) {
        this.data.configHealthWarnBufferUtil = warnBuffer;
        configDirty = true;
      }
      if (critBuffer !== this.data.configHealthCriticalBufferUtil) {
        this.data.configHealthCriticalBufferUtil = critBuffer;
        configDirty = true;
      }
      if (warnNotify !== this.data.configHealthNotifyWarnIntervalMs) {
        this.data.configHealthNotifyWarnIntervalMs = warnNotify;
        configDirty = true;
      }
      if (critNotify !== this.data.configHealthNotifyCritIntervalMs) {
        this.data.configHealthNotifyCritIntervalMs = critNotify;
        configDirty = true;
      }
    }

    if (this.data.configFlushMode !== "next_day" && this.data.configFlushMode !== "time_based") {
      this.data.configFlushMode = base.configFlushMode;
      configDirty = true;
    }

    if (
      this.data.configBatchSize !== stored.configBatchSize ||
      this.data.configMaxDailyRequests !== stored.configMaxDailyRequests ||
      this.data.configMaxRetry !== stored.configMaxRetry ||
      this.data.configMaxEventsPerRequest !== stored.configMaxEventsPerRequest ||
      this.data.configMaxBufferSize !== stored.configMaxBufferSize ||
      this.data.configDailyFlushWindowStartUtc !== stored.configDailyFlushWindowStartUtc ||
      this.data.configDailyFlushWindowMinutes !== stored.configDailyFlushWindowMinutes ||
      this.data.configCancelHoldDelayMs !== stored.configCancelHoldDelayMs ||
      this.data.configAllowLegacyEvents !== stored.configAllowLegacyEvents ||
      this.data.configFlushMode !== stored.configFlushMode ||
      JSON.stringify(this.data.configTimeFlushMinutes) !== JSON.stringify(stored.configTimeFlushMinutes) ||
      this.data.configHealthWarnPendingBatches !== stored.configHealthWarnPendingBatches ||
      this.data.configHealthCriticalPendingBatches !== stored.configHealthCriticalPendingBatches ||
      this.data.configHealthWarnFailures !== stored.configHealthWarnFailures ||
      this.data.configHealthCriticalFailures !== stored.configHealthCriticalFailures ||
      this.data.configHealthWarnStaleMs !== stored.configHealthWarnStaleMs ||
      this.data.configHealthCriticalStaleMs !== stored.configHealthCriticalStaleMs ||
      this.data.configHealthWarnBufferUtil !== stored.configHealthWarnBufferUtil ||
      this.data.configHealthCriticalBufferUtil !== stored.configHealthCriticalBufferUtil ||
      this.data.configHealthNotifyWarnIntervalMs !== stored.configHealthNotifyWarnIntervalMs ||
      this.data.configHealthNotifyCritIntervalMs !== stored.configHealthNotifyCritIntervalMs
    ) {
      configDirty = true;
    }

    // PRIVACY: IP tracking disabled. Clear any persisted IP data on load.
    const hadLegacyIps = !!stored.ipCounts && Object.keys(stored.ipCounts).length > 0;
    this.data.ipCounts = {};
    this.data.ipCountsSize = 0;
    this.data.uniqueRequestsToday = 0;

    // Strip any persisted ip_address fields from buffered events
    let strippedEventIps = false;
    if (Array.isArray(this.data.buffer)) {
      for (const ev of this.data.buffer) {
        if (ev && typeof ev === "object" && "ip_address" in ev) {
          delete ev.ip_address;
          strippedEventIps = true;
        }
      }
    }

    if (
      hadLegacyIps ||
      strippedEventIps ||
      configDirty ||
      pendingCompacted ||
      failurePruned ||
      stepUpBypassNeedsMigration ||
      changelogRevisionNeedsMigration ||
      changelogConfigNeedsMigration ||
      changelogDraftNeedsMigration
    ) {
      await this.persist();
    }

    // Ensure daily Oracle flush alarm is scheduled.
    await this.scheduleNextMidnightAlarm();
    const changelogAlarmDirty = await this.ensureChangelogAutoSyncAlarm(Date.now());
    if (changelogAlarmDirty) {
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    if (!this.data) return;
    await this.state.storage.put(STORAGE_KEY, this.data);
  }

  private get d(): DurableStateShape {
    if (!this.data) {
      throw new Error("DurableObject state not loaded yet");
    }
    return this.data;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Ensure reqCountToday is for the current UTC day. Resets counters
   * when the day changes.
   * 
   * LIFECYCLE CRITICAL: This method manages daily-bounded state variables.
   * IP tracking is disabled for privacy. We still reset legacy fields to
   * guarantee no stale IP data persists across days.
   */
  private ensureRequestDay(): void {
    const today = todayUtcDate();
    if (this.d.reqCountDate !== today) {
      this.d.reqCountDate = today;
      this.d.reqCountToday = 0;
      
      // PRIVACY RESET: Clear legacy IP tracking fields every day
      this.d.ipCounts = {};
      this.d.ipCountsSize = 0;
      this.d.uniqueRequestsToday = 0;
      this.d.trackRates = {};
      
      // hardRemoteOff is NOT reset automatically here.
    }

    if (!this.d.reqDailyCounts || typeof this.d.reqDailyCounts !== "object") {
      this.d.reqDailyCounts = {};
    }

    const todayCount = this.d.reqDailyCounts[today];
    if (typeof todayCount === "number" && Number.isFinite(todayCount) && todayCount >= 0) {
      this.d.reqCountToday = todayCount;
    } else {
      this.d.reqDailyCounts[today] = this.d.reqCountToday;
    }

    this.compactRequestHistory(today);
  }

  private compactRequestHistory(today: string): void {
    const cutoff = shiftUtcDateByDays(today, -(REQUEST_HISTORY_DAYS - 1));
    if (!cutoff) return;
    for (const key of Object.keys(this.d.reqDailyCounts)) {
      if (key < cutoff) {
        delete this.d.reqDailyCounts[key];
      }
    }
  }

  private sumRecentRequestHistory(days: number): number {
    if (days <= 0) return 0;
    this.ensureRequestDay();
    const today = this.d.reqCountDate || todayUtcDate();
    let total = 0;
    for (let i = 0; i < days; i += 1) {
      const dateKey = shiftUtcDateByDays(today, -i);
      if (!dateKey) break;
      total += this.d.reqDailyCounts[dateKey] ?? 0;
    }
    return total;
  }

  private getClientIp(request: Request): string {
    return request.headers.get("CF-Connecting-IP") || "unknown";
  }

  private buildDangerAuditID(now: number): string {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `wdaudit-${now}-${crypto.randomUUID()}`;
      }
    } catch {
      // Fallback handled below.
    }
    return `wdaudit-${now}-${Math.random().toString(36).slice(2, 12)}`;
  }

  private buildDangerAuditCorrelationID(now: number): string {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `wdcorr-${now}-${crypto.randomUUID()}`;
      }
    } catch {
      // Fallback handled below.
    }
    return `wdcorr-${now}-${Math.random().toString(36).slice(2, 12)}`;
  }

  private appendDangerAudit(
    request: Request,
    action: string,
    path: string,
    result: "ok" | "error",
    detail?: string,
  ): void {
    const now = Date.now();
    const entry: DangerActionAuditRecord = {
      id: this.buildDangerAuditID(now),
      tsUtc: now,
      actorIp: trimAndLimitString(this.getClientIp(request), 120) || "unknown",
      action: trimAndLimitString(action, 80) || "unknown",
      path: trimAndLimitString(path, 120) || "",
      result,
      correlationId: this.buildDangerAuditCorrelationID(now),
      detail: (() => {
        const value = trimAndLimitString(detail, 280);
        return value || null;
      })(),
    };
    this.d.dangerActionAuditLogs.push(entry);
    if (this.d.dangerActionAuditLogs.length > MAX_DANGER_AUDIT_LOGS) {
      this.d.dangerActionAuditLogs = this.d.dangerActionAuditLogs.slice(
        this.d.dangerActionAuditLogs.length - MAX_DANGER_AUDIT_LOGS,
      );
    }
  }

  private checkTrackRateLimit(ip: string, nowMs: number): { allowed: boolean; retryAfterSec?: number } {
    const minute = Math.floor(nowMs / 60000);
    const entry = this.d.trackRates[ip];

    if (!entry || entry.minute !== minute) {
      this.d.trackRates[ip] = { count: 1, minute };
    } else {
      entry.count += 1;
      if (entry.count > TRACK_RATE_LIMIT_PER_MIN) {
        const nextMinuteMs = (minute + 1) * 60000;
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((nextMinuteMs - nowMs) / 1000)) };
      }
    }

    // Prune old entries to prevent unbounded growth.
    if (Object.keys(this.d.trackRates).length > TRACK_RATE_MAX_KEYS) {
      const minMinute = minute - TRACK_RATE_PRUNE_AFTER_MIN;
      for (const [k, v] of Object.entries(this.d.trackRates)) {
        if (!v || v.minute < minMinute) {
          delete this.d.trackRates[k];
        }
      }
      if (Object.keys(this.d.trackRates).length > TRACK_RATE_MAX_KEYS) {
        // Emergency reset to avoid unbounded memory growth under abuse.
        this.d.trackRates = {};
      }
    }

    return { allowed: true };
  }

  private isAuthorizedAdmin(request: Request): boolean {
    const header = request.headers.get("X-Admin-Secret") || "";
    const expected = this.env.DO_SHARED_SECRET;
    if (!expected) return false;
    return timingSafeStringEqual(header, expected);
  }

  // ---------------------------------------------------------------------------
  // Core fetch router
  // ---------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    await this.loaded;

    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/track" && request.method === "POST") {
      return this.handleTrack(request);
    }

    if (pathname === "/stats" && request.method === "GET") {
      return this.handleStats();
    }

    if (pathname === "/config" && request.method === "GET") {
      return this.handleConfig();
    }

    if (pathname === "/health" && request.method === "GET") {
      return this.handleHealth();
    }

    if (pathname === "/pipeline-health" && request.method === "GET") {
      return this.handlePipelineHealth(request);
    }

    if (pathname === "/debug/flush" && request.method === "POST") {
      // Require admin auth for debug endpoints
      if (!this.isAuthorizedAdmin(request)) {
        return json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      return this.handleDebugFlush(request);
    }

    if (pathname === "/debug/reset" && request.method === "POST") {
      // Require admin auth for debug endpoints
      if (!this.isAuthorizedAdmin(request)) {
        return json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      return this.handleDebugReset(request);
    }

    if (pathname === "/admin/force-flush" && request.method === "POST") {
      return this.handleAdminForceFlush(request);
    }

    if (pathname === "/admin/cut-power" && request.method === "POST") {
      return this.handleAdminCutPower(request);
    }

    if (pathname === "/admin/restore-power" && request.method === "POST") {
      return this.handleAdminRestorePower(request);
    }

    // Admin endpoint to update remote config (batchSize, maxDailyRequests, etc.)
    if (pathname === "/admin/update-config" && request.method === "POST") {
      return this.handleAdminUpdateConfig(request);
    }

    if (pathname === "/admin/full-sync" && request.method === "POST") {
      return this.handleAdminFullSync(request);
    }

    if (pathname === "/admin/website/status" && request.method === "GET") {
      return this.handleAdminWebsiteStatus(request);
    }

    if (pathname === "/admin/website/flush-now" && request.method === "POST") {
      return this.handleAdminWebsiteFlushNow(request);
    }

    if (pathname === "/admin/website/replay-dlq" && request.method === "POST") {
      return this.handleAdminWebsiteReplayDLQ(request);
    }

    if (pathname === "/admin/website/override" && request.method === "POST") {
      return this.handleAdminWebsiteOverride(request);
    }

    if (pathname === "/admin/website/refresh-toggle" && request.method === "POST") {
      return this.handleAdminWebsiteRefreshToggle(request);
    }

    // Public Changelog
    if (pathname === "/changelog" && request.method === "GET") {
      return this.handleGetChangelog();
    }

    if (pathname === "/public/site-metrics" && request.method === "GET") {
      return this.handlePublicSiteMetrics();
    }

    if (pathname === "/api/public/website/events" && request.method === "POST") {
      return this.handlePublicWebsiteEvents(request);
    }

    // Admin Changelog Update
    if (pathname === "/admin/changelog" && request.method === "POST") {
      return this.handleAdminUpdateChangelog(request);
    }
    if (pathname === "/admin/changelog" && request.method === "GET") {
      return this.handleAdminGetChangelogState(request);
    }
    if (pathname === "/admin/changelog/parse" && request.method === "POST") {
      return this.handleAdminParseChangelog(request);
    }
    if (pathname === "/admin/changelog/history" && request.method === "GET") {
      return this.handleAdminChangelogHistory(request);
    }
    if (pathname === "/admin/changelog/rules" && request.method === "POST") {
      return this.handleAdminSaveChangelogRules(request);
    }
    if (pathname === "/admin/changelog/draft" && request.method === "POST") {
      return this.handleAdminSaveChangelogDraft(request);
    }
    if (pathname === "/admin/changelog/publish" && request.method === "POST") {
      return this.handleAdminPublishChangelogDraft(request);
    }
    if (pathname === "/admin/changelog/mode" && request.method === "POST") {
      return this.handleAdminSetChangelogMode(request);
    }
    if (pathname === "/admin/changelog/sync-now" && request.method === "POST") {
      return this.handleAdminSyncChangelogNow(request);
    }

    // Login rate limiting - used by worker to check/record attempts
    if (pathname === "/auth/login-attempt" && request.method === "POST") {
      return this.handleLoginAttempt(request);
    }

    // IP Allowlist check - used by worker before login
    if (pathname === "/auth/check-ip-allowlist" && request.method === "POST") {
      return this.handleCheckIpAllowlist(request);
    }

    // Admin IP Allowlist management
    if (pathname === "/admin/ip-allowlist" && request.method === "POST") {
      return this.handleAdminIpAllowlist(request);
    }
    if (pathname === "/admin/ip-allowlist" && request.method === "GET") {
      return this.handleGetIpAllowlist(request);
    }

    return new Response("Not found (DO)", { status: 404 });
  }

  // ---------------------------------------------------------------------------
  // Alarms for retry / backoff AND scheduled daily flush
  // ---------------------------------------------------------------------------

  async alarm(): Promise<void> {
    await this.loaded;
    const now = Date.now();
    this.ensureRequestDay();

    // =========================================================================
    // SCHEDULED MIDNIGHT FLUSH TO ORACLE
    // At 00:00-00:15, flush all buffered events to Oracle
    // This happens before extensions wake up at 1:00 AM
    // =========================================================================
    const currentHour = new Date().getUTCHours();
    if (this.d.buffer.length > 0 && currentHour === 0) {
      logEvent("info", "alarm_midnight_flush", { bufferedEvents: this.d.buffer.length });
      await this.flushToOracle(true);
    }

    // Schedule next midnight alarm
    await this.scheduleNextMidnightAlarm();

    // Retry failed Oracle flushes
    if (this.d.retryState && this.d.retryState.nextRetryAt && now >= this.d.retryState.nextRetryAt) {
      await this.flushToOracle(false);
    }

    const health = this.buildPipelineHealthPayload(now);
    this.state.waitUntil(this.notifyHealthIfNeeded(health).catch(() => {}));
  }

  /**
   * Schedule an alarm for the next midnight (00:00 UTC).
   * Called after each alarm to ensure continuous scheduling.
   */
  private async scheduleNextMidnightAlarm(): Promise<void> {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0); // Midnight UTC tomorrow

    const alarmTime = tomorrow.getTime();
    
    // Only set if no alarm is scheduled or if this is earlier
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm || currentAlarm > alarmTime) {
      await this.state.storage.setAlarm(alarmTime);
      logEvent("info", "alarm_scheduled_next_midnight_flush", { at: tomorrow.toISOString() });
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private async handleTrack(request: Request): Promise<Response> {
    // Update daily request counters (for dashboard monitoring only)
    this.ensureRequestDay();
    const today = this.d.reqCountDate || todayUtcDate();
    const nextReqCount = (this.d.reqDailyCounts[today] ?? this.d.reqCountToday ?? 0) + 1;
    this.d.reqCountToday = nextReqCount;
    this.d.reqDailyCounts[today] = nextReqCount;

    const now = Date.now();
    const clientIp = this.getClientIp(request);

    const rate = this.checkTrackRateLimit(clientIp, now);
    if (!rate.allowed) {
      this.recordFailure("track_ingest", "rate_limited", `ip=${clientIp}`, 1, now);
      await this.persist();
      return json(
        { ok: false, error: "rate_limited", retryAfterSec: rate.retryAfterSec ?? 60 },
        { status: 429 },
      );
    }

    // --- Country from CF header ---
    const countryHeader =
      request.headers.get("CF-IPCountry") ||
      request.headers.get("X-Geo-Country");
    const countryFromRequest =
      countryHeader && countryHeader.length > 0 && countryHeader !== "XX"
        ? countryHeader
        : undefined;

    // =========================================================================
    // LAYER 1: PAYLOAD VALIDATION
    // =========================================================================
    const MAX_TRACK_BODY_BYTES = 5 * 1024 * 1024; // 5MB hard limit before parsing
    const parsedBody = await readJsonBody<{ events?: StoredEvent[]; clientBatchId?: string }>(
      request,
      MAX_TRACK_BODY_BYTES,
    );
    if (!parsedBody.ok) {
      if (parsedBody.error === "body_too_large") {
        logEvent("warn", "track_body_too_large", { size: parsedBody.size ?? -1, maxBytes: MAX_TRACK_BODY_BYTES });
        this.recordFailure("track_ingest", "body_too_large", `size=${parsedBody.size ?? -1}`, 1, now);
        await this.persist();
        return json(
          { ok: false, error: "body_too_large", maxBytes: MAX_TRACK_BODY_BYTES },
          { status: 413 },
        );
      }
      logEvent("warn", "track_invalid_json");
      this.recordFailure("track_ingest", "invalid_json", "track payload json parse failed", 1, now);
      await this.persist();
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }
    const body = parsedBody.value;

    if (!isPlainObject(body) || !Array.isArray(body.events)) {
      logEvent("warn", "track_invalid_payload");
      this.recordFailure("track_ingest", "invalid_payload", "missing events array", 1, now);
      await this.persist();
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const events = body.events;
    const clientBatchId =
      typeof body.clientBatchId === "string" && body.clientBatchId.length <= 200
        ? body.clientBatchId
        : undefined;
    if (events.length === 0) {
      await this.persist();
      return json(
        {
          ok: true,
          accepted: 0,
          clientBatchId,
          ackId: generateAckId(),
          receivedAt: now,
        },
        { status: 202 },
      );
    }

    for (const ev of events) {
      if (!isPlainObject(ev)) {
        logEvent("warn", "track_invalid_event_payload");
        this.recordFailure("track_ingest", "invalid_event_payload", "event must be object", 1, now);
        await this.persist();
        return json({ ok: false, error: "invalid_event_payload" }, { status: 400 });
      }
    }

    // Allow large batches to support next-day consolidation (extension sends all pending at once)
    const MAX_EVENTS_PER_REQUEST = this.d.configMaxEventsPerRequest || 5000;
    const MAX_BUFFER_SIZE = this.d.configMaxBufferSize || 50_000;

    if (events.length > MAX_EVENTS_PER_REQUEST) {
      logEvent("warn", "track_too_many_events", { count: events.length, max: MAX_EVENTS_PER_REQUEST });
      this.recordFailure(
        "track_ingest",
        "too_many_events",
        `count=${events.length},max=${MAX_EVENTS_PER_REQUEST}`,
        events.length,
        now,
      );
      await this.persist();
      return json(
        { ok: false, error: "too_many_events", max: MAX_EVENTS_PER_REQUEST, message: `Max ${MAX_EVENTS_PER_REQUEST} events per request.` },
        { status: 400 }
      );
    }

    // =========================================================================
    // LAYER 2: EVENT SIZE VALIDATION (Prevent memory exhaustion via oversized payloads)
    // =========================================================================
    const MAX_EVENT_SIZE_BYTES = 10 * 1024; // 10KB per event
    const encoder = new TextEncoder();
    for (const ev of events) {
      try {
        const eventSize = encoder.encode(JSON.stringify(ev)).length;
        if (eventSize > MAX_EVENT_SIZE_BYTES) {
          this.recordFailure("track_ingest", "event_too_large", `max=${MAX_EVENT_SIZE_BYTES}`, 1, now);
          await this.persist();
          return json(
            { ok: false, error: "event_too_large", maxBytes: MAX_EVENT_SIZE_BYTES },
            { status: 400 }
          );
        }
      } catch {
        this.recordFailure("track_ingest", "invalid_event_structure", "failed to stringify event", 1, now);
        await this.persist();
        return json(
          { ok: false, error: "invalid_event_structure" },
          { status: 400 }
        );
      }
    }

    if (this.d.buffer.length + events.length > MAX_BUFFER_SIZE) {
      logEvent("warn", "track_buffer_full", { bufferSize: this.d.buffer.length, incoming: events.length, max: MAX_BUFFER_SIZE });
      this.recordFailure(
        "track_ingest",
        "buffer_full",
        `buffer=${this.d.buffer.length},incoming=${events.length},max=${MAX_BUFFER_SIZE}`,
        events.length,
        now,
      );
      await this.persist();
      return json(
        { ok: false, error: "buffer_full", bufferSize: this.d.buffer.length },
        { status: 503 }
      );
    }

    // =========================================================================
    // LAYER 3: ROBUST IDEMPOTENCY (Set-based O(1) lookup + timestamp validation)
    // =========================================================================
    // const MAX_PROCESSED_IDS = 5000;
    const MAX_FUTURE_DRIFT_MS = 7 * 24 * 60 * 60 * 1000; // used for clamping, not rejection

    // Use Set for O(1) lookup
    const processedSet = new Set(this.d.processedIds);
    let acceptedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    const acceptedIds: string[] = [];
    const duplicateIds: string[] = [];
    const invalidIds: string[] = [];
    const acceptedSeqs: Array<[string, number]> = [];

    for (const ev of events) {
      // ----- VALIDATION: Event ID required -----
      const hasValidId =
        typeof ev.id === "string" && ev.id.length >= 6 && ev.id.length <= 200;
      if (!hasValidId) {
        if (this.d.configAllowLegacyEvents) {
          ev.id = generateEventId();
        } else {
          const weight = this.normalizeEventCount(ev.count);
          invalidCount += weight;
          if (typeof ev.id === "string") invalidIds.push(ev.id);
          continue;
        }
      }
      const eventId = typeof ev.id === "string" ? ev.id : undefined;
      if (!eventId) {
        const weight = this.normalizeEventCount(ev.count);
        invalidCount += weight;
        continue;
      }

      const eventCount = this.normalizeEventCount(ev.count);
      if (eventCount !== 1) {
        ev.count = eventCount;
        ev.rollup = true;
      }

      // ----- IDEMPOTENCY: Skip duplicates -----
      if (processedSet.has(eventId)) {
        duplicateCount += eventCount;
        duplicateIds.push(eventId);
        continue;
      }

      // ----- VALIDATION: Timestamp sanity -----
      if (typeof ev.timestamp !== "number" || !Number.isFinite(ev.timestamp)) {
        ev.timestamp = now;
      }
      if (ev.timestamp > now + MAX_FUTURE_DRIFT_MS) {
        ev.timestamp = now;
      }

      // ----- VALIDATION: Required fields -----
      if (!ev.status || (ev.status !== "success" && ev.status !== "fail" && ev.status !== "cancelled")) {
        invalidCount += eventCount;
        invalidIds.push(eventId);
        continue;
      }

      // Add to processed set and array
      processedSet.add(eventId);
      this.d.processedIds.push(eventId);

      this.d.eventSeq += 1;
      ev.seq = this.d.eventSeq;

      // Hydrate country from CF geo if missing
      if (!ev.country && countryFromRequest) {
        ev.country = countryFromRequest;
      }

      // Sanitize high-cardinality fields to prevent unbounded growth
      ev.file_type = sanitizeString(ev.file_type, 24, FIELD_PATTERNS.generic);
      ev.browser = sanitizeString(ev.browser, 24, FIELD_PATTERNS.generic);
      ev.os = sanitizeString(ev.os, 24, FIELD_PATTERNS.generic);
      ev.language = sanitizeString(ev.language, 10, FIELD_PATTERNS.language);
      ev.ext_version = sanitizeString(ev.ext_version, 32, FIELD_PATTERNS.generic, "0.0.0");
      if (ev.error_type) {
        ev.error_type = sanitizeString(ev.error_type, 32, FIELD_PATTERNS.generic);
      }
      if (ev.source) {
        ev.source = sanitizeString(ev.source, 32, FIELD_PATTERNS.generic);
      }
      if (ev.country) {
        ev.country = sanitizeString(ev.country, 2, FIELD_PATTERNS.language);
      }

      // PRIVACY: Never persist IPs. Strip any client-provided ip_address.
      delete ev.ip_address;

      this.d.buffer.push(ev);
      this.d.totalEvents += eventCount;
      acceptedCount += eventCount;
      acceptedIds.push(eventId);
      acceptedSeqs.push([eventId, ev.seq]);
      
      // totalDownloads = all download attempts (success + fail)
      this.d.totalDownloads += eventCount;

      if (ev.status === "success") {
        this.d.totalSuccess += eventCount;
      } else if (ev.status === "cancelled") {
        this.d.totalCancelled += eventCount;
      } else {
        this.d.totalFail += eventCount;
      }

      this.d.pendingEvents += eventCount;
      this.d.lastEventAt = ev.timestamp ?? Date.now();

      // Update counters
      const c = this.d.counters;
      c.byStatus[ev.status] = (c.byStatus[ev.status] || 0) + eventCount;

      const type = (ev.file_type || "unknown").toLowerCase();
      c.byType[type] = (c.byType[type] || 0) + eventCount;

      const browser = (ev.browser || "unknown").toLowerCase();
      c.byBrowser[browser] = (c.byBrowser[browser] || 0) + eventCount;

      const os = (ev.os || "unknown").toLowerCase();
      c.byOs[os] = (c.byOs[os] || 0) + eventCount;

      const extVersion = ev.ext_version;
      c.byExtVersion[extVersion] =
        (c.byExtVersion[extVersion] || 0) + eventCount;

      const lang = (ev.language || "unknown").toLowerCase();
      c.byLanguage[lang] = (c.byLanguage[lang] || 0) + eventCount;

      // --- CHANGED: use request geo as fallback before "unknown" ---
      const effectiveCountry = (
        ev.country ||
        countryFromRequest ||
        "unknown"
      ).toLowerCase();
      c.byCountry[effectiveCountry] =
        (c.byCountry[effectiveCountry] || 0) + eventCount;

      // NEW: error-type counter (only for fails)
      if (ev.status === "fail") {
        const errKey = (ev.error_type || "unknown").toLowerCase();
        c.byErrorType[errKey] = (c.byErrorType[errKey] || 0) + eventCount;
      }
    }

    // =========================================================================
    // CLEANUP - Trim processedIds to prevent unbounded growth
    // =========================================================================
    const MAX_PROCESSED_IDS_TRIM = 5000;
    if (this.d.processedIds.length > MAX_PROCESSED_IDS_TRIM) {
      // Keep newest IDs (from end)
      this.d.processedIds = this.d.processedIds.slice(-MAX_PROCESSED_IDS_TRIM);
    }

    if (invalidCount > 0) {
      this.recordFailure(
        "track_validation",
        "invalid_events_filtered",
        `invalid=${invalidCount}`,
        invalidCount,
        now,
      );
    }

    this.maybeCompactBuffer();
    await this.persist();

    // Size-based flush to Oracle
    const maxBatch =
      parseInt(this.env.MAX_BATCH_EVENTS || "10000", 10) || 10000;

    if (this.d.buffer.length >= maxBatch) {
      await this.flushToOracle(false);
    }

    const acceptedSeqRange = acceptedSeqs.length
      ? {
          min: Math.min(...acceptedSeqs.map((entry) => entry[1])),
          max: Math.max(...acceptedSeqs.map((entry) => entry[1])),
        }
      : null;

    return json({ 
      ok: true, 
      accepted: acceptedCount,
      duplicates: duplicateCount,
      invalid: invalidCount,
      acceptedIds,
      duplicateIds,
      invalidIds,
      acceptedSeqs,
      committedSeq: this.d.committedSeq ?? 0,
      acceptedSeqRange,
      clientBatchId,
      ackId: generateAckId(),
      receivedAt: now,
    }, { status: 202 });
  }

  private computeNextPublicMetricsRefreshAt(now: number): number {
    const sortedHours = [...PUBLIC_SITE_METRICS_REFRESH_HOURS_UTC].sort((a, b) => a - b);
    const current = new Date(now);
    for (const hour of sortedHours) {
      const candidate = new Date(current);
      candidate.setUTCHours(hour, 0, 0, 0);
      if (candidate.getTime() > now) {
        return candidate.getTime();
      }
    }

    const nextDay = new Date(current);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    nextDay.setUTCHours(sortedHours[0], 0, 0, 0);
    return nextDay.getTime();
  }

  private buildPublicSiteMetricsSnapshot(now: number, slotKey: string): PublicSiteMetricsSnapshot {
    return {
      slotKey,
      snapshotAtUtc: now,
      downloads: clampInt(this.d.totalDownloads, 0, Number.MAX_SAFE_INTEGER, 0),
      countries: normalizeCountryCountsForPublicMap(this.d.counters?.byCountry),
    };
  }

  private shouldRefreshPublicSiteSnapshot(now: number, currentSlotKey: string): boolean {
    const snapshot = this.d.publicSiteMetricsSnapshot;
    if (!this.d.websitePublicSyncEnabled) {
      return !snapshot;
    }
    if (!snapshot) return true;

    const hour = currentUtcHour(now);
    const refreshHour = PUBLIC_SITE_METRICS_REFRESH_HOURS_UTC.includes(hour as (typeof PUBLIC_SITE_METRICS_REFRESH_HOURS_UTC)[number]);
    if (!refreshHour) {
      return false;
    }

    return snapshot.slotKey !== currentSlotKey;
  }

  private resolveEffectivePublicSiteSnapshot(baseSnapshot: PublicSiteMetricsSnapshot): PublicSiteMetricsSnapshot {
    if (!this.d.websiteOverrideEnabled) {
      return baseSnapshot;
    }
    return {
      slotKey: baseSnapshot.slotKey,
      snapshotAtUtc: baseSnapshot.snapshotAtUtc,
      downloads: clampInt(this.d.websiteOverrideDownloads, 0, Number.MAX_SAFE_INTEGER, 0),
      countries: normalizePublicSiteCountryList(this.d.websiteOverrideCountries),
    };
  }

  private async handlePublicSiteMetrics(): Promise<Response> {
    const now = Date.now();
    const slotKey = makeSlotKey(now);

    if (this.shouldRefreshPublicSiteSnapshot(now, slotKey)) {
      this.d.publicSiteMetricsSnapshot = this.buildPublicSiteMetricsSnapshot(now, slotKey);
      await this.persist();
    }

    const snapshot = this.d.publicSiteMetricsSnapshot ?? this.buildPublicSiteMetricsSnapshot(now, slotKey);
    const effectiveSnapshot = this.resolveEffectivePublicSiteSnapshot(snapshot);
    const activeHour = currentUtcHour(now);
    const isRefreshWindow = PUBLIC_SITE_METRICS_REFRESH_HOURS_UTC.includes(activeHour as (typeof PUBLIC_SITE_METRICS_REFRESH_HOURS_UTC)[number]);

    return json({
      ok: true,
      source: "cloudflare-worker",
      dataSource: this.d.websiteOverrideEnabled ? "override" : "snapshot",
      generatedAt: now,
      snapshotAtUtc: effectiveSnapshot.snapshotAtUtc,
      totals: {
        downloads: effectiveSnapshot.downloads,
        countries: effectiveSnapshot.countries.length,
      },
      countries: effectiveSnapshot.countries,
      schedule: {
        refreshHoursUtc: PUBLIC_SITE_METRICS_REFRESH_HOURS_UTC,
        activeHourUtc: activeHour,
        isRefreshWindow,
        autoRefreshEnabled: this.d.websitePublicSyncEnabled,
        overrideEnabled: this.d.websiteOverrideEnabled,
        lastRefreshAtUtc: snapshot.snapshotAtUtc,
        nextRefreshAtUtc: this.computeNextPublicMetricsRefreshAt(now),
      },
    });
  }

  private async handleAdminWebsiteStatus(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const now = Date.now();
    const slotKey = makeSlotKey(now);
    const snapshot = this.d.publicSiteMetricsSnapshot ?? this.buildPublicSiteMetricsSnapshot(now, slotKey);
    const effectiveSnapshot = this.resolveEffectivePublicSiteSnapshot(snapshot);
    const activeHour = currentUtcHour(now);
    const isRefreshWindow = PUBLIC_SITE_METRICS_REFRESH_HOURS_UTC.includes(activeHour as (typeof PUBLIC_SITE_METRICS_REFRESH_HOURS_UTC)[number]);
    return json({
      ok: true,
      generatedAt: now,
      website: {
        refreshEnabled: this.d.websitePublicSyncEnabled,
        overrideEnabled: this.d.websiteOverrideEnabled,
        overrideDownloads: clampInt(this.d.websiteOverrideDownloads, 0, Number.MAX_SAFE_INTEGER, 0),
        overrideCountries: normalizePublicSiteCountryList(this.d.websiteOverrideCountries),
        lastSnapshotAtUtc: snapshot.snapshotAtUtc,
        lastManualFlushAtUtc: this.d.websiteManualFlushAt ?? null,
        refreshHoursUtc: PUBLIC_SITE_METRICS_REFRESH_HOURS_UTC,
        activeHourUtc: activeHour,
        isRefreshWindow,
        nextRefreshAtUtc: this.computeNextPublicMetricsRefreshAt(now),
      },
      publicSnapshot: {
        source: this.d.websiteOverrideEnabled ? "override" : "snapshot",
        snapshotAtUtc: effectiveSnapshot.snapshotAtUtc,
        totals: {
          downloads: effectiveSnapshot.downloads,
          countries: effectiveSnapshot.countries.length,
        },
        countries: effectiveSnapshot.countries,
      },
    });
  }

  private async handleAdminWebsiteFlushNow(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const now = Date.now();
    const slotKey = makeSlotKey(now);
    this.d.publicSiteMetricsSnapshot = this.buildPublicSiteMetricsSnapshot(now, slotKey);
    this.d.websiteManualFlushAt = now;
    await this.persist();

    const effectiveSnapshot = this.resolveEffectivePublicSiteSnapshot(this.d.publicSiteMetricsSnapshot);
    return json({
      ok: true,
      flushedAtUtc: now,
      source: this.d.websiteOverrideEnabled ? "override" : "snapshot",
      snapshotAtUtc: effectiveSnapshot.snapshotAtUtc,
      totals: {
        downloads: effectiveSnapshot.downloads,
        countries: effectiveSnapshot.countries.length,
      },
      countries: effectiveSnapshot.countries,
    });
  }

  private async handleAdminWebsiteRefreshToggle(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }
    if (!isPlainObject(body) || typeof body.enabled !== "boolean") {
      return json({ ok: false, error: "invalid_payload", field: "enabled" }, { status: 400 });
    }

    this.d.websitePublicSyncEnabled = body.enabled;
    await this.persist();
    return json({
      ok: true,
      refreshEnabled: this.d.websitePublicSyncEnabled,
    });
  }

  private async handleAdminWebsiteOverride(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }
    if (!isPlainObject(body)) {
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    if ("enabled" in body) {
      if (typeof body.enabled !== "boolean") {
        return json({ ok: false, error: "invalid_payload", field: "enabled" }, { status: 400 });
      }
      this.d.websiteOverrideEnabled = body.enabled;
    }

    if ("downloads" in body) {
      if (typeof body.downloads !== "number" || !Number.isFinite(body.downloads)) {
        return json({ ok: false, error: "invalid_payload", field: "downloads" }, { status: 400 });
      }
      this.d.websiteOverrideDownloads = clampInt(body.downloads, 0, Number.MAX_SAFE_INTEGER, 0);
    }

    if ("countries" in body) {
      this.d.websiteOverrideCountries = normalizePublicSiteCountryList(body.countries);
    }

    await this.persist();
    const now = Date.now();
    const slotKey = makeSlotKey(now);
    const snapshot = this.d.publicSiteMetricsSnapshot ?? this.buildPublicSiteMetricsSnapshot(now, slotKey);
    const effectiveSnapshot = this.resolveEffectivePublicSiteSnapshot(snapshot);

    return json({
      ok: true,
      override: {
        enabled: this.d.websiteOverrideEnabled,
        downloads: clampInt(this.d.websiteOverrideDownloads, 0, Number.MAX_SAFE_INTEGER, 0),
        countries: normalizePublicSiteCountryList(this.d.websiteOverrideCountries),
      },
      publicSnapshot: {
        source: this.d.websiteOverrideEnabled ? "override" : "snapshot",
        snapshotAtUtc: effectiveSnapshot.snapshotAtUtc,
        totals: {
          downloads: effectiveSnapshot.downloads,
          countries: effectiveSnapshot.countries.length,
        },
        countries: effectiveSnapshot.countries,
      },
    });
  }

  private async handleStats(): Promise<Response> {
    this.ensureRequestDay();
    const quota = computeQuotaDescriptor(
      this.d.reqCountToday,
      this.d.hardRemoteOff,
    );

    const envSnapshot: EnvSnapshot = {
      maxBatchEvents: this.env.MAX_BATCH_EVENTS || "n/a",
      oracleEndpoint: this.env.ORACLE_ENDPOINT || "unknown",
    };

    // Get next scheduled alarm time
    const nextAlarm = await this.state.storage.getAlarm();
    const nextAlarmAt = nextAlarm ? new Date(nextAlarm).toISOString() : null;

    // Remote config with null-safe values for dashboard display
    const remoteConfig = {
      configVersion: this.d.configVersion ?? CONFIG_VERSION,
      batchSize: this.d.configBatchSize ?? 50,
      maxDailyRequests: this.d.configMaxDailyRequests ?? 50,
      maxRetry: this.d.configMaxRetry ?? 5,
      maxEventsPerRequest: this.d.configMaxEventsPerRequest ?? 5000,
      maxBufferSize: this.d.configMaxBufferSize ?? 50000,
      flushMode: this.d.configFlushMode ?? 'next_day',
      timeFlushMinutes: this.d.configTimeFlushMinutes ?? { low: 1440, mid: 1440, high: 1440 },
      dailyFlushWindowStartUtc: this.d.configDailyFlushWindowStartUtc ?? DEFAULT_DAILY_FLUSH_WINDOW_START_UTC,
      dailyFlushWindowMinutes: this.d.configDailyFlushWindowMinutes ?? DEFAULT_DAILY_FLUSH_WINDOW_MINUTES,
      cancelHoldDelayMs: this.d.configCancelHoldDelayMs ?? 1000,
      allowLegacyEvents: this.d.configAllowLegacyEvents ?? true,
      healthThresholds: {
        warnPendingBatches: this.d.configHealthWarnPendingBatches ?? HEALTH_WARN_PENDING_BATCHES,
        criticalPendingBatches: this.d.configHealthCriticalPendingBatches ?? HEALTH_CRIT_PENDING_BATCHES,
        warnFailures: this.d.configHealthWarnFailures ?? HEALTH_WARN_FAILURES,
        criticalFailures: this.d.configHealthCriticalFailures ?? HEALTH_CRIT_FAILURES,
        warnStaleMs: this.d.configHealthWarnStaleMs ?? HEALTH_WARN_STALE_MS,
        criticalStaleMs: this.d.configHealthCriticalStaleMs ?? HEALTH_CRIT_STALE_MS,
        warnBufferUtil: this.d.configHealthWarnBufferUtil ?? HEALTH_WARN_BUFFER_UTIL,
        criticalBufferUtil: this.d.configHealthCriticalBufferUtil ?? HEALTH_CRIT_BUFFER_UTIL,
      },
      healthNotifyIntervalsMs: {
        warn: this.d.configHealthNotifyWarnIntervalMs ?? HEALTH_NOTIFY_WARN_INTERVAL_MS,
        critical: this.d.configHealthNotifyCritIntervalMs ?? HEALTH_NOTIFY_CRIT_INTERVAL_MS,
      },
      remoteEnabledReason: "ok",
      hardRemoteOff: this.d.hardRemoteOff ?? false,
    };

    const remoteGate = computeRemoteEnabled(
      quota.remoteEnabled,
      this.d.buffer?.length ?? 0,
      remoteConfig.maxBufferSize,
      this.d.retryState ?? null,
    );
    quota.remoteEnabled = remoteGate.enabled;
    quota.remoteEnabledReason = remoteGate.reason;
    remoteConfig.remoteEnabledReason = remoteGate.reason;

    // Buffer status for dashboard
    const bufferStatus = {
      currentSize: this.d.buffer?.length ?? 0,
      maxSize: remoteConfig.maxBufferSize,
      utilizationPercent: ((this.d.buffer?.length ?? 0) / remoteConfig.maxBufferSize * 100).toFixed(2),
    };
    const uniqueCountriesAllTime = Object.keys(this.d.counters?.byCountry ?? {}).filter((country) => {
      const normalized = country.trim().toLowerCase();
      return normalized !== "" && normalized !== "xx" && normalized !== "unknown";
    }).length;

    const payload = {
      ok: true,
      totalEvents: this.d.totalEvents ?? 0,
      totalDownloads: this.d.totalDownloads ?? 0,
      totalSuccess: this.d.totalSuccess ?? 0,
      totalFail: this.d.totalFail ?? 0,
      totalCancelled: this.d.totalCancelled ?? 0,
      pendingEvents: this.d.pendingEvents ?? 0,
      lastEventAt: this.d.lastEventAt ?? null,
      lastFlushAt: this.d.lastFlushAt ?? null,
      counters: this.d.counters ?? {},
      retryState: this.d.retryState ?? null,
      quota,
      envSnapshot,
      
      // NEW: Remote config for dashboard display
      remoteConfig,
      bufferStatus,
      nextAlarmAt,
      
      // Request tracking (for monitoring)
      requestsToday: this.d.reqCountToday ?? 0,
      requestDate: this.d.reqCountDate ?? null,
      uniqueRequestsToday: this.d.uniqueRequestsToday ?? 0,
      // BACKWARDS COMPATIBILITY: Legacy dashboard uses uniqueIpsToday
      uniqueIpsToday: this.d.uniqueRequestsToday ?? 0,
      uniqueCountriesAllTime,
      // IP tracking disabled -> unique counts are not approximated
      isApproximated: false,
      
      // NEW: Changelog data
      changelog: this.d.changelog,
      changelogConfig: this.d.changelogConfig,

      // Delivery observability chain
      deliveryMetrics: this.d.deliveryMetrics,
      deliveryHealth: {
        acceptedMinusCommitted:
          (this.d.deliveryMetrics.totals.accepted || 0) -
          (this.d.deliveryMetrics.totals.committed || 0),
        forwardedMinusCommitted:
          (this.d.deliveryMetrics.totals.forwarded || 0) -
          (this.d.deliveryMetrics.totals.committed || 0),
      },

      // Structured failure sink snapshot
      failureSink: {
        totalRollups: this.d.failureRollups.length,
        unsentRollups: this.d.failureRollups.filter((item) => item.unsentCount > 0).length,
        recent: [...this.d.failureRollups]
          .sort((a, b) => b.lastTs - a.lastTs)
          .slice(0, 20),
      },
    };

    return json(payload);
  }

  /**
   * Config endpoint used by the extension to adapt batching / flush behaviour.
   * All these values are controllable from Cloudflare dashboard via admin endpoints.
   */
  private async handleConfig(): Promise<Response> {
    this.ensureRequestDay();
    const quota = computeQuotaDescriptor(
      this.d.reqCountToday,
      this.d.hardRemoteOff,
    );
    const remoteGate = computeRemoteEnabled(
      quota.remoteEnabled,
      this.d.buffer?.length ?? 0,
      this.d.configMaxBufferSize ?? 50000,
      this.d.retryState ?? null,
    );

    // Return all remote-controllable config values
    const config = {
      ok: true,
      configVersion: this.d.configVersion ?? CONFIG_VERSION,
      
      // Batching config
      batchSize: this.d.configBatchSize,
      maxDailyRequests: this.d.configMaxDailyRequests,
      maxRetry: this.d.configMaxRetry,
      maxEventsPerRequest: this.d.configMaxEventsPerRequest,
      
      // Flush mode: 'next_day' (default) or 'time_based'
      flushMode: this.d.configFlushMode,

      // Daily flush window (UTC)
      dailyFlushWindowStartUtc: this.d.configDailyFlushWindowStartUtc,
      dailyFlushWindowMinutes: this.d.configDailyFlushWindowMinutes,
      
      // Time-based flush intervals (only used if flushMode is 'time_based')
      timeFlushMinutes: this.d.configTimeFlushMinutes,
      
      // Remote enabled (can be disabled for emergencies or backpressure)
      remoteEnabled: remoteGate.enabled,
      remoteEnabledReason: remoteGate.reason,
      
      // Cancel hold delay: time before cancel becomes active (default 1000ms)
      cancelHoldDelayMs: this.d.configCancelHoldDelayMs,

      // Legacy acceptance flag (worker-side only, exposed for visibility)
      allowLegacyEvents: this.d.configAllowLegacyEvents,

      // Pipeline health thresholds (dashboard-configurable)
      healthThresholds: {
        warnPendingBatches: this.d.configHealthWarnPendingBatches ?? HEALTH_WARN_PENDING_BATCHES,
        criticalPendingBatches: this.d.configHealthCriticalPendingBatches ?? HEALTH_CRIT_PENDING_BATCHES,
        warnFailures: this.d.configHealthWarnFailures ?? HEALTH_WARN_FAILURES,
        criticalFailures: this.d.configHealthCriticalFailures ?? HEALTH_CRIT_FAILURES,
        warnStaleMs: this.d.configHealthWarnStaleMs ?? HEALTH_WARN_STALE_MS,
        criticalStaleMs: this.d.configHealthCriticalStaleMs ?? HEALTH_CRIT_STALE_MS,
        warnBufferUtil: this.d.configHealthWarnBufferUtil ?? HEALTH_WARN_BUFFER_UTIL,
        criticalBufferUtil: this.d.configHealthCriticalBufferUtil ?? HEALTH_CRIT_BUFFER_UTIL,
      },
      healthNotifyIntervalsMs: {
        warn: this.d.configHealthNotifyWarnIntervalMs ?? HEALTH_NOTIFY_WARN_INTERVAL_MS,
        critical: this.d.configHealthNotifyCritIntervalMs ?? HEALTH_NOTIFY_CRIT_INTERVAL_MS,
      },

      // Server UTC time for drift correction
      serverTimeUtc: Date.now(),

      // Highest committed event sequence
      committedSeq: this.d.committedSeq ?? 0,
      
      // Quota info for extension awareness
      quota,
      
      // NEW: Changelog config for extension
      changelogConfig: this.d.changelogConfig,
    };

    return json(config);
  }

  private async handleHealth(): Promise<Response> {
    this.ensureRequestDay();
    return json({
      ok: true,
      pendingEvents: this.d.pendingEvents,
      lastEventAt: this.d.lastEventAt,
      lastFlushAt: this.d.lastFlushAt,
    });
  }

  private buildPipelineHealthPayload(nowOverride?: number): PipelineHealthResponse {
    const now = typeof nowOverride === "number" ? nowOverride : Date.now();
    const bufferLen = this.d.buffer.length;
    const maxBuffer = this.d.configMaxBufferSize || 50000;
    const bufferUtil = maxBuffer > 0 ? bufferLen / maxBuffer : 0;
    const pendingBatches = this.d.pendingBatches.length;
    const oldestPending = pendingBatches
      ? Math.min(...this.d.pendingBatches.map((b) => b.createdAt || now))
      : null;
    const oldestAgeMs = oldestPending != null ? Math.max(0, now - oldestPending) : null;
    const failures = this.d.retryState?.consecutiveFailures ?? 0;
    const lastFlushAt = this.d.lastFlushAt ?? null;
    const lastEventAt = this.d.lastEventAt ?? null;
    const sinceFlushMs = lastFlushAt != null ? now - lastFlushAt : null;

    const warnPending = this.d.configHealthWarnPendingBatches ?? HEALTH_WARN_PENDING_BATCHES;
    const critPending = this.d.configHealthCriticalPendingBatches ?? HEALTH_CRIT_PENDING_BATCHES;
    const warnFailures = this.d.configHealthWarnFailures ?? HEALTH_WARN_FAILURES;
    const critFailures = this.d.configHealthCriticalFailures ?? HEALTH_CRIT_FAILURES;
    const warnStaleMs = this.d.configHealthWarnStaleMs ?? HEALTH_WARN_STALE_MS;
    const critStaleMs = this.d.configHealthCriticalStaleMs ?? HEALTH_CRIT_STALE_MS;
    const warnBufferUtil = this.d.configHealthWarnBufferUtil ?? HEALTH_WARN_BUFFER_UTIL;
    const critBufferUtil = this.d.configHealthCriticalBufferUtil ?? HEALTH_CRIT_BUFFER_UTIL;

    const reasons: string[] = [];
    let status: PipelineHealthStatus = "ok";

    const addWarn = (reason: string) => {
      if (status === "ok") status = "warn";
      reasons.push(reason);
    };
    const addCritical = (reason: string) => {
      status = "critical";
      reasons.push(reason);
    };

    if (pendingBatches >= critPending) {
      addCritical("pending_batches_high");
    } else if (pendingBatches >= warnPending) {
      addWarn("pending_batches_elevated");
    }

    if (failures >= critFailures) {
      addCritical("oracle_failures_high");
    } else if (failures >= warnFailures) {
      addWarn("oracle_failures_elevated");
    }

    if (sinceFlushMs != null) {
      if (sinceFlushMs >= critStaleMs) {
        addCritical("flush_stale");
      } else if (sinceFlushMs >= warnStaleMs) {
        addWarn("flush_delayed");
      }
    }

    if (bufferUtil >= critBufferUtil) {
      addCritical("buffer_util_high");
    } else if (bufferUtil >= warnBufferUtil) {
      addWarn("buffer_util_elevated");
    }

    return {
      ok: true,
      status,
      reasons,
      now,
      bufferSize: bufferLen,
      maxBufferSize: maxBuffer,
      bufferUtilization: Number(bufferUtil.toFixed(3)),
      pendingBatches,
      oldestPendingAgeMs: oldestAgeMs,
      consecutiveFailures: failures,
      lastFlushAt,
      lastEventAt,
      committedSeq: this.d.committedSeq,
      lastHealthNotifyAt: this.d.lastHealthNotifyAt ?? null,
      thresholds: {
        warnPendingBatches: warnPending,
        criticalPendingBatches: critPending,
        warnFailures,
        criticalFailures: critFailures,
        warnStaleMs,
        criticalStaleMs: critStaleMs,
        warnBufferUtil,
        criticalBufferUtil: critBufferUtil,
      },
    };
  }

  private async handlePipelineHealth(request: Request): Promise<Response> {
    this.ensureRequestDay();
    const payload = this.buildPipelineHealthPayload();
    if (this.isAuthorizedAdmin(request)) {
      this.state.waitUntil(this.notifyHealthIfNeeded(payload).catch(() => {}));
    }
    return json(payload);
  }

  private async notifyHealthIfNeeded(payload: PipelineHealthResponse): Promise<void> {
    const webhook = this.env.ALERT_WEBHOOK_URL;
    if (!webhook) return;

    const prevStatus = this.d.lastHealthStatus ?? "ok";
    const lastNotifyAt = this.d.lastHealthNotifyAt ?? 0;
    const now = Date.now();
    const interval =
      payload.status === "critical"
        ? (this.d.configHealthNotifyCritIntervalMs ?? HEALTH_NOTIFY_CRIT_INTERVAL_MS)
        : (this.d.configHealthNotifyWarnIntervalMs ?? HEALTH_NOTIFY_WARN_INTERVAL_MS);
    const shouldNotify =
      payload.status !== "ok" &&
      (payload.status !== prevStatus || now - lastNotifyAt >= interval);
    const shouldRecoverNotify = payload.status === "ok" && prevStatus !== "ok";

    if (!shouldNotify && !shouldRecoverNotify) {
      if (payload.status !== prevStatus) {
        this.d.lastHealthStatus = payload.status;
        await this.persist();
      }
      return;
    }

    const notification: PipelineHealthNotification = {
      ...payload,
      previousStatus: prevStatus,
      notifiedAt: now,
      source: "pipeline-health",
    };

    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification),
    });

    if (!res.ok) {
      logEvent("warn", "health_webhook_failed", { status: res.status });
      this.recordFailure("alerting", "health_webhook_failed", `status=${res.status}`, 1, now);
      await this.persist();
      return;
    }

    this.d.lastHealthStatus = payload.status;
    this.d.lastHealthNotifyAt = now;
    await this.persist();
  }

  private async handleDebugFlush(): Promise<Response> {
    const before = this.d.buffer.length;
    return json({
      ok: true,
      message: "debug flush not implemented in this step",
      bufferSize: before,
    });
  }

  private async handleDebugReset(): Promise<Response> {
    const today = todayUtcDate();
    // Preserve config settings during reset
    const preservedConfig = {
      configVersion: this.d.configVersion ?? CONFIG_VERSION,
      configBatchSize: this.d.configBatchSize ?? 50,
      configMaxDailyRequests: this.d.configMaxDailyRequests ?? 50,
      configMaxRetry: this.d.configMaxRetry ?? 5,
      configMaxEventsPerRequest: this.d.configMaxEventsPerRequest ?? 5000,
      configMaxBufferSize: this.d.configMaxBufferSize ?? 50000,
      configFlushMode: this.d.configFlushMode ?? 'next_day' as const,
      configDailyFlushWindowStartUtc: this.d.configDailyFlushWindowStartUtc ?? DEFAULT_DAILY_FLUSH_WINDOW_START_UTC,
      configDailyFlushWindowMinutes: this.d.configDailyFlushWindowMinutes ?? DEFAULT_DAILY_FLUSH_WINDOW_MINUTES,
      configTimeFlushMinutes: this.d.configTimeFlushMinutes ?? { low: 1440, mid: 1440, high: 1440 },
      configCancelHoldDelayMs: this.d.configCancelHoldDelayMs ?? 1000,
      configAllowLegacyEvents: this.d.configAllowLegacyEvents ?? true,
      configHealthWarnPendingBatches: this.d.configHealthWarnPendingBatches ?? HEALTH_WARN_PENDING_BATCHES,
      configHealthCriticalPendingBatches: this.d.configHealthCriticalPendingBatches ?? HEALTH_CRIT_PENDING_BATCHES,
      configHealthWarnFailures: this.d.configHealthWarnFailures ?? HEALTH_WARN_FAILURES,
      configHealthCriticalFailures: this.d.configHealthCriticalFailures ?? HEALTH_CRIT_FAILURES,
      configHealthWarnStaleMs: this.d.configHealthWarnStaleMs ?? HEALTH_WARN_STALE_MS,
      configHealthCriticalStaleMs: this.d.configHealthCriticalStaleMs ?? HEALTH_CRIT_STALE_MS,
      configHealthWarnBufferUtil: this.d.configHealthWarnBufferUtil ?? HEALTH_WARN_BUFFER_UTIL,
      configHealthCriticalBufferUtil: this.d.configHealthCriticalBufferUtil ?? HEALTH_CRIT_BUFFER_UTIL,
      configHealthNotifyWarnIntervalMs: this.d.configHealthNotifyWarnIntervalMs ?? HEALTH_NOTIFY_WARN_INTERVAL_MS,
      configHealthNotifyCritIntervalMs: this.d.configHealthNotifyCritIntervalMs ?? HEALTH_NOTIFY_CRIT_INTERVAL_MS,
      
      // Preserve Changelog
      changelog: this.d.changelog ?? [],
      changelogConfig: this.d.changelogConfig ?? {
        customPill: false,
        showNotification: false,
        lastUpdated: Date.now(),
      },
      publicSiteMetricsSnapshot: this.d.publicSiteMetricsSnapshot ?? null,
      websitePublicSyncEnabled:
        typeof this.d.websitePublicSyncEnabled === "boolean" ? this.d.websitePublicSyncEnabled : true,
      websiteManualFlushAt: this.d.websiteManualFlushAt ?? null,
      websiteOverrideEnabled:
        typeof this.d.websiteOverrideEnabled === "boolean" ? this.d.websiteOverrideEnabled : false,
      websiteOverrideDownloads: clampInt(this.d.websiteOverrideDownloads, 0, Number.MAX_SAFE_INTEGER, 0),
      websiteOverrideCountries: normalizePublicSiteCountryList(this.d.websiteOverrideCountries),
    };
    
    this.data = {
      totalEvents: 0,
      totalDownloads: 0,
      totalSuccess: 0,
      totalFail: 0,
      totalCancelled: 0,
      pendingEvents: 0,
      lastEventAt: null,
      lastFlushAt: null,
      counters: createEmptyCounters(),
      retryState: { ...DEFAULT_RETRY_STATE },
      reqCountToday: 0,
      reqCountDate: today,
      reqDailyCounts: { [today]: 0 },
      hardRemoteOff: false,
      buffer: [],
      batchSeq: 0,
      eventSeq: 0,
      committedSeq: 0,
      pendingBatches: [],
      deliveryMetrics: createEmptyDeliveryMetrics(),
      failureRollups: [],
      ipCounts: {},
      ipCountsSize: 0,
      uniqueRequestsToday: 0,
      processedIds: [],
      burstCounts: {},
      loginAttempts: {},
      ipAllowlistEnabled: false,
      ipAllowlist: [],
      trackRates: {},
      ...preservedConfig,
    };
    await this.state.storage.delete(STORAGE_KEY);
    await this.state.storage.deleteAlarm();
    await this.persist();
    return json({ ok: true, message: "state reset" });
  }

  private async handleAdminForceFlush(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const result = await this.flushToOracle(true);
    if (!result.ok) {
      return json(
        {
          ok: false,
          error: result.error || "flush_failed",
          remaining: this.d.buffer.length,
        },
        { status: 500 },
      );
    }

    return json({
      ok: true,
      sent: result.sent,
      remaining: this.d.buffer.length,
    });
  }

  /**
   * Admin endpoint to update remote config values.
   * All extensions will pick up these changes on their next config fetch.
   * 
   * POST /admin/update-config
   * Body: { batchSize?: number, maxDailyRequests?: number, maxRetry?: number, 
   *         maxEventsPerRequest?: number, maxBufferSize?: number,
   *         flushMode?: 'next_day' | 'time_based',
   *         timeFlushMinutes?: { low: number, mid: number, high: number },
   *         dailyFlushWindowStartUtc?: number, dailyFlushWindowMinutes?: number,
   *         cancelHoldDelayMs?: number, allowLegacyEvents?: boolean }
   */
  private async handleAdminUpdateConfig(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    if (!isPlainObject(body)) {
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const errors: string[] = [];
    const applyNumber = (
      key: string,
      min: number,
      max: number,
      setter: (value: number) => void,
    ) => {
      if (!(key in body)) return;
      const value = body[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        setter(Math.min(max, Math.max(min, Math.floor(value))));
        return;
      }
      errors.push(key);
    };
    const applyBool = (key: string, setter: (value: boolean) => void) => {
      if (!(key in body)) return;
      const value = body[key];
      if (typeof value === "boolean") {
        setter(value);
        return;
      }
      errors.push(key);
    };

    applyNumber("batchSize", 1, 1000, (value) => {
      this.d.configBatchSize = value;
    });
    applyNumber("maxDailyRequests", 1, 1000, (value) => {
      this.d.configMaxDailyRequests = value;
    });
    applyNumber("maxRetry", 0, 20, (value) => {
      this.d.configMaxRetry = value;
    });
    applyNumber("maxEventsPerRequest", 1, 50000, (value) => {
      this.d.configMaxEventsPerRequest = value;
    });
    applyNumber("maxBufferSize", 1, 500000, (value) => {
      this.d.configMaxBufferSize = value;
    });
    applyNumber("dailyFlushWindowStartUtc", 0, 23, (value) => {
      this.d.configDailyFlushWindowStartUtc = value;
    });
    applyNumber("dailyFlushWindowMinutes", 1, 24 * 60, (value) => {
      this.d.configDailyFlushWindowMinutes = value;
    });
    applyBool("allowLegacyEvents", (value) => {
      this.d.configAllowLegacyEvents = value;
    });

    if ("flushMode" in body) {
      if (body.flushMode === "next_day" || body.flushMode === "time_based") {
        this.d.configFlushMode = body.flushMode;
      } else {
        errors.push("flushMode");
      }
    }

    if ("timeFlushMinutes" in body) {
      if (isPlainObject(body.timeFlushMinutes)) {
        const tfm = body.timeFlushMinutes as Record<string, unknown>;
        if (
          typeof tfm.low === "number" &&
          typeof tfm.mid === "number" &&
          typeof tfm.high === "number" &&
          Number.isFinite(tfm.low) &&
          Number.isFinite(tfm.mid) &&
          Number.isFinite(tfm.high)
        ) {
          this.d.configTimeFlushMinutes = {
            low: Math.max(1, Math.min(10080, Math.floor(tfm.low))),   // 1 min to 7 days
            mid: Math.max(1, Math.min(10080, Math.floor(tfm.mid))),
            high: Math.max(1, Math.min(10080, Math.floor(tfm.high))),
          };
        } else {
          errors.push("timeFlushMinutes");
        }
      } else {
        errors.push("timeFlushMinutes");
      }
    }

    if ("cancelHoldDelayMs" in body) {
      applyNumber("cancelHoldDelayMs", 0, 10000, (value) => {
        this.d.configCancelHoldDelayMs = value;
      });
    }

    if ("healthThresholds" in body) {
      if (!isPlainObject(body.healthThresholds)) {
        errors.push("healthThresholds");
      } else {
        const ht = body.healthThresholds as Record<string, unknown>;
        const thresholdErrors: string[] = [];
        const readIntField = (
          key: string,
          min: number,
          max: number,
          fallback: number,
        ) => {
          if (!(key in ht)) return fallback;
          const value = ht[key];
          if (typeof value === "number" && Number.isFinite(value)) {
            return Math.min(max, Math.max(min, Math.floor(value)));
          }
          thresholdErrors.push(`healthThresholds.${key}`);
          return fallback;
        };
        const readFloatField = (
          key: string,
          min: number,
          max: number,
          fallback: number,
        ) => {
          if (!(key in ht)) return fallback;
          const value = ht[key];
          if (typeof value === "number" && Number.isFinite(value)) {
            return Math.min(max, Math.max(min, value));
          }
          thresholdErrors.push(`healthThresholds.${key}`);
          return fallback;
        };

        const nextWarnPending = readIntField(
          "warnPendingBatches",
          0,
          1000,
          this.d.configHealthWarnPendingBatches,
        );
        const nextCritPending = readIntField(
          "criticalPendingBatches",
          0,
          2000,
          this.d.configHealthCriticalPendingBatches,
        );
        const nextWarnFailures = readIntField(
          "warnFailures",
          0,
          100,
          this.d.configHealthWarnFailures,
        );
        const nextCritFailures = readIntField(
          "criticalFailures",
          0,
          100,
          this.d.configHealthCriticalFailures,
        );
        const nextWarnStale = readIntField(
          "warnStaleMs",
          0,
          30 * 24 * 60 * 60 * 1000,
          this.d.configHealthWarnStaleMs,
        );
        const nextCritStale = readIntField(
          "criticalStaleMs",
          0,
          30 * 24 * 60 * 60 * 1000,
          this.d.configHealthCriticalStaleMs,
        );
        const nextWarnBuffer = readFloatField(
          "warnBufferUtil",
          0,
          1,
          this.d.configHealthWarnBufferUtil,
        );
        const nextCritBuffer = readFloatField(
          "criticalBufferUtil",
          0,
          1,
          this.d.configHealthCriticalBufferUtil,
        );

        if (nextWarnPending > nextCritPending) {
          thresholdErrors.push("healthThresholds.pendingBatches");
        }
        if (nextWarnFailures > nextCritFailures) {
          thresholdErrors.push("healthThresholds.failures");
        }
        if (nextWarnStale > nextCritStale) {
          thresholdErrors.push("healthThresholds.staleMs");
        }
        if (nextWarnBuffer > nextCritBuffer) {
          thresholdErrors.push("healthThresholds.bufferUtil");
        }

        if (thresholdErrors.length > 0) {
          errors.push(...thresholdErrors);
        } else {
          this.d.configHealthWarnPendingBatches = nextWarnPending;
          this.d.configHealthCriticalPendingBatches = nextCritPending;
          this.d.configHealthWarnFailures = nextWarnFailures;
          this.d.configHealthCriticalFailures = nextCritFailures;
          this.d.configHealthWarnStaleMs = nextWarnStale;
          this.d.configHealthCriticalStaleMs = nextCritStale;
          this.d.configHealthWarnBufferUtil = nextWarnBuffer;
          this.d.configHealthCriticalBufferUtil = nextCritBuffer;
        }
      }
    }

    if ("healthNotifyIntervalsMs" in body) {
      if (!isPlainObject(body.healthNotifyIntervalsMs)) {
        errors.push("healthNotifyIntervalsMs");
      } else {
        const hi = body.healthNotifyIntervalsMs as Record<string, unknown>;
        const intervalErrors: string[] = [];
        const readInterval = (
          key: string,
          fallback: number,
        ) => {
          if (!(key in hi)) return fallback;
          const value = hi[key];
          if (typeof value === "number" && Number.isFinite(value)) {
            return Math.min(24 * 60 * 60 * 1000, Math.max(60 * 1000, Math.floor(value)));
          }
          intervalErrors.push(`healthNotifyIntervalsMs.${key}`);
          return fallback;
        };
        const nextWarn = readInterval("warn", this.d.configHealthNotifyWarnIntervalMs);
        const nextCrit = readInterval("critical", this.d.configHealthNotifyCritIntervalMs);
        if (nextWarn < nextCrit) {
          intervalErrors.push("healthNotifyIntervalsMs.order");
        }
        if (intervalErrors.length > 0) {
          errors.push(...intervalErrors);
        } else {
          this.d.configHealthNotifyWarnIntervalMs = nextWarn;
          this.d.configHealthNotifyCritIntervalMs = nextCrit;
        }
      }
    }

    if (errors.length > 0) {
      return json({ ok: false, error: "invalid_config", fields: errors }, { status: 400 });
    }

    await this.persist();

    // Return current config state
    return json({
      ok: true,
      message: "Config updated. Extensions will pick up changes on next config fetch.",
      config: {
        configVersion: this.d.configVersion ?? CONFIG_VERSION,
        batchSize: this.d.configBatchSize,
        maxDailyRequests: this.d.configMaxDailyRequests,
        maxRetry: this.d.configMaxRetry,
        maxEventsPerRequest: this.d.configMaxEventsPerRequest,
        maxBufferSize: this.d.configMaxBufferSize,
        flushMode: this.d.configFlushMode,
        dailyFlushWindowStartUtc: this.d.configDailyFlushWindowStartUtc,
        dailyFlushWindowMinutes: this.d.configDailyFlushWindowMinutes,
        timeFlushMinutes: this.d.configTimeFlushMinutes,
        cancelHoldDelayMs: this.d.configCancelHoldDelayMs,
        allowLegacyEvents: this.d.configAllowLegacyEvents,
        healthThresholds: {
          warnPendingBatches: this.d.configHealthWarnPendingBatches,
          criticalPendingBatches: this.d.configHealthCriticalPendingBatches,
          warnFailures: this.d.configHealthWarnFailures,
          criticalFailures: this.d.configHealthCriticalFailures,
          warnStaleMs: this.d.configHealthWarnStaleMs,
          criticalStaleMs: this.d.configHealthCriticalStaleMs,
          warnBufferUtil: this.d.configHealthWarnBufferUtil,
          criticalBufferUtil: this.d.configHealthCriticalBufferUtil,
        },
        healthNotifyIntervalsMs: {
          warn: this.d.configHealthNotifyWarnIntervalMs,
          critical: this.d.configHealthNotifyCritIntervalMs,
        },
      },
    });
  }

  private async handleAdminCutPower(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    this.d.hardRemoteOff = true;
    await this.persist();

    const quota = computeQuotaDescriptor(
      this.d.reqCountToday,
      this.d.hardRemoteOff,
    );

    return json({
      ok: true,
      remoteEnabled: quota.remoteEnabled,
      quotaLevel: quota.quotaLevel,
      modeLabel: quota.modeLabel,
    });
  }

  private async handleAdminRestorePower(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    this.d.hardRemoteOff = false;
    await this.persist();

    const quota = computeQuotaDescriptor(
      this.d.reqCountToday,
      this.d.hardRemoteOff,
    );

    return json({
      ok: true,
      remoteEnabled: quota.remoteEnabled,
      quotaLevel: quota.quotaLevel,
      modeLabel: quota.modeLabel,
    });
  }

  private async handleAdminFullSync(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let iterations = 0;
    let lastError: string | undefined;

    while ((this.d.buffer.length > 0 || this.d.pendingBatches.length > 0) && iterations < 20) {
      const result = await this.flushToOracle(true);
      if (!result.ok) {
        lastError = result.error;
        break;
      }
      iterations++;
    }

    const ok = this.d.buffer.length === 0 && this.d.pendingBatches.length === 0 && !lastError;

    return json({
      ok,
      remaining: this.d.buffer.length,
      pendingBatches: this.d.pendingBatches.length,
      iterations,
      error: lastError,
    });
  }

  // ---------------------------------------------------------------------------
  // Oracle flush + retry/backoff
  // ---------------------------------------------------------------------------

  private async scheduleRetry(): Promise<void> {
    if (!this.d.retryState) {
      this.d.retryState = { ...DEFAULT_RETRY_STATE };
    }

    const rs = this.d.retryState;
    const backoffStepsSeconds = [
      60, // 1 min
      300, // 5 min
      900, // 15 min
      1800, // 30 min
      3600, // 1 hour
      21_600, // 6 hours
      43_200, // 12 hours
      86_400, // 1 day
    ];
    // FIX: first failure (1) should map to index 0 (60s)
    const idx = Math.min(
      Math.max((rs.consecutiveFailures || 0) - 1, 0),
      backoffStepsSeconds.length - 1,
    );
    const backoffSec = backoffStepsSeconds[idx];
    const nextMs = Date.now() + backoffSec * 1000;

    rs.nextRetryAt = nextMs;
    await this.state.storage.setAlarm(nextMs);
  }

  /**
   * Helper to find the key with the highest count in a record
   */
  private getTopKey(record: Record<string, number>): string {
    let topKey = "unknown";
    let max = -1;
    for (const [key, val] of Object.entries(record)) {
      if (val > max) {
        max = val;
        topKey = key;
      }
    }
    return topKey;
  }

  private mergeCounts(target: Record<string, number>, source: Record<string, number>): Record<string, number> {
    for (const [key, val] of Object.entries(source)) {
      target[key] = (target[key] || 0) + (val || 0);
    }
    return target;
  }

  private mergeFailureLogs(
    a: Array<{ key: string; source: "cloudflare-do"; stage: string; errorCode: string; errorDetail: string; sampleCount: number; tsUtc: number }> = [],
    b: Array<{ key: string; source: "cloudflare-do"; stage: string; errorCode: string; errorDetail: string; sampleCount: number; tsUtc: number }> = [],
  ): Array<{ key: string; source: "cloudflare-do"; stage: string; errorCode: string; errorDetail: string; sampleCount: number; tsUtc: number }> {
    const map = new Map<string, { key: string; source: "cloudflare-do"; stage: string; errorCode: string; errorDetail: string; sampleCount: number; tsUtc: number }>();
    for (const row of [...a, ...b]) {
      if (!row?.key) continue;
      const existing = map.get(row.key);
      if (!existing) {
        map.set(row.key, {
          key: row.key,
          source: "cloudflare-do",
          stage: row.stage,
          errorCode: row.errorCode,
          errorDetail: row.errorDetail,
          sampleCount: Math.max(0, Math.floor(row.sampleCount || 0)),
          tsUtc: row.tsUtc || Date.now(),
        });
      } else {
        existing.sampleCount += Math.max(0, Math.floor(row.sampleCount || 0));
        if ((row.tsUtc || 0) >= existing.tsUtc) {
          existing.tsUtc = row.tsUtc || existing.tsUtc;
          existing.errorDetail = row.errorDetail || existing.errorDetail;
        }
      }
    }
    return Array.from(map.values())
      .sort((x, y) => y.tsUtc - x.tsUtc)
      .slice(0, MAX_FAILURE_EXPORT_PER_BATCH);
  }

  private normalizeEventCount(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 1;
    const int = Math.floor(value);
    if (int <= 0) return 1;
    return Math.min(int, MAX_ROLLUP_COUNT);
  }

  private sumWeightedEventCount(events: StoredEvent[]): number {
    if (!Array.isArray(events) || events.length === 0) return 0;
    let total = 0;
    for (const ev of events) {
      total += this.normalizeEventCount(ev?.count);
    }
    return total;
  }

  private recordDeliveryStage(
    deliveryId: string,
    batchId: string,
    stage: DeliveryStage,
    count: number,
    now: number = Date.now(),
  ): void {
    if (!deliveryId || !batchId) return;
    const safeCount = Math.max(0, Math.floor(count || 0));
    if (safeCount <= 0) return;

    const totals = this.d.deliveryMetrics.totals;
    totals[stage] += safeCount;

    let rec = this.d.deliveryMetrics.recent.find((item) => item.deliveryId === deliveryId);
    if (!rec) {
      rec = {
        deliveryId,
        batchId,
        accepted: 0,
        stored: 0,
        forwarded: 0,
        committed: 0,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      this.d.deliveryMetrics.recent.push(rec);
    }
    rec.batchId = batchId;
    rec[stage] += safeCount;
    if (stage === "forwarded") rec.status = "forwarded";
    if (stage === "committed") rec.status = "committed";
    rec.updatedAt = now;

    if (this.d.deliveryMetrics.recent.length > MAX_RECENT_DELIVERIES) {
      this.d.deliveryMetrics.recent = this.d.deliveryMetrics.recent
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_RECENT_DELIVERIES);
    }
  }

  private pruneFailureRollups(now: number = Date.now()): void {
    const floor = now - FAILURE_ROLLUP_RETENTION_MS;
    this.d.failureRollups = this.d.failureRollups
      .filter((item) => item && item.lastTs >= floor)
      .sort((a, b) => b.lastTs - a.lastTs);
    if (this.d.failureRollups.length > MAX_FAILURE_ROLLUPS) {
      this.d.failureRollups = this.d.failureRollups.slice(0, MAX_FAILURE_ROLLUPS);
    }
  }

  private recordFailure(
    stage: string,
    errorCode: string,
    errorDetail: unknown,
    sampleCount: number = 1,
    now: number = Date.now(),
  ): void {
    const normalizedStage = sanitizeString(stage, 64, FIELD_PATTERNS.generic, "unknown_stage");
    const normalizedCode = sanitizeString(errorCode, 64, FIELD_PATTERNS.generic, "unknown_error");
    const detail = normalizeFailureDetail(errorDetail);
    const day = new Date(now).toISOString().slice(0, 10);
    const key = `${day}|${normalizedStage}|${normalizedCode}`;
    const count = Math.max(1, Math.floor(sampleCount || 1));
    const existing = this.d.failureRollups.find((item) => item.key === key);
    if (existing) {
      existing.sampleCount += count;
      existing.unsentCount += count;
      existing.lastTs = now;
      existing.errorDetail = detail;
    } else {
      this.d.failureRollups.push({
        key,
        source: "cloudflare-do",
        stage: normalizedStage,
        errorCode: normalizedCode,
        errorDetail: detail,
        sampleCount: count,
        unsentCount: count,
        firstTs: now,
        lastTs: now,
      });
    }
    this.pruneFailureRollups(now);
  }

  private consumeFailureRollupsForBatch(now: number = Date.now()): Array<{
    key: string;
    source: "cloudflare-do";
    stage: string;
    errorCode: string;
    errorDetail: string;
    sampleCount: number;
    tsUtc: number;
  }> {
    this.pruneFailureRollups(now);
    const unsent = this.d.failureRollups
      .filter((item) => item.unsentCount > 0)
      .sort((a, b) => b.lastTs - a.lastTs)
      .slice(0, MAX_FAILURE_EXPORT_PER_BATCH);
    return unsent.map((item) => ({
      key: item.key,
      source: item.source,
      stage: item.stage,
      errorCode: item.errorCode,
      errorDetail: item.errorDetail,
      sampleCount: item.unsentCount,
      tsUtc: item.lastTs,
    }));
  }

  private markFailureRollupsExported(exported: Array<{ key: string; sampleCount: number }>): void {
    if (!Array.isArray(exported) || exported.length === 0) return;
    const byKey = new Map<string, number>();
    for (const row of exported) {
      if (!row?.key) continue;
      const prev = byKey.get(row.key) || 0;
      byKey.set(row.key, prev + Math.max(0, Math.floor(row.sampleCount || 0)));
    }
    for (const item of this.d.failureRollups) {
      const used = byKey.get(item.key) || 0;
      if (used <= 0) continue;
      item.unsentCount = Math.max(0, item.unsentCount - used);
    }
    this.pruneFailureRollups();
  }

  private mergeTimeBuckets(a: TimeBucket[], b: TimeBucket[]): TimeBucket[] {
    const map = new Map<string, TimeBucket>();
    const addBucket = (bucket: TimeBucket) => {
      const existing = map.get(bucket.bucketStart);
      if (!existing) {
        map.set(bucket.bucketStart, {
          bucketStart: bucket.bucketStart,
          bucketEnd: bucket.bucketEnd,
          totals: { ...bucket.totals },
          counters: { ...bucket.counters },
        });
        return;
      }
      existing.totals.totalEvents += bucket.totals.totalEvents;
      existing.totals.totalDownloads += bucket.totals.totalDownloads;
      existing.totals.totalSuccess += bucket.totals.totalSuccess;
      existing.totals.totalFail += bucket.totals.totalFail;
      this.mergeCounts(existing.counters.byStatus, bucket.counters.byStatus);
      this.mergeCounts(existing.counters.byType, bucket.counters.byType);
      this.mergeCounts(existing.counters.byBrowser, bucket.counters.byBrowser);
      this.mergeCounts(existing.counters.byOs, bucket.counters.byOs);
      this.mergeCounts(existing.counters.byExtVersion, bucket.counters.byExtVersion);
      this.mergeCounts(existing.counters.byLanguage, bucket.counters.byLanguage);
      this.mergeCounts(existing.counters.byCountry, bucket.counters.byCountry);
      this.mergeCounts(existing.counters.byErrorType, bucket.counters.byErrorType);
    };
    a.forEach(addBucket);
    b.forEach(addBucket);
    return Array.from(map.values()).sort((x, y) => x.bucketStart.localeCompare(y.bucketStart));
  }

  private mergePendingBatchesIfNeeded(): void {
    while (this.d.pendingBatches.length > MAX_PENDING_BATCHES) {
      let firstIdx = this.d.pendingBatches.findIndex((b) => (b.attempts ?? 0) === 0);
      let secondIdx = this.d.pendingBatches.findIndex(
        (b, idx) => idx > firstIdx && (b.attempts ?? 0) === 0,
      );
      if (firstIdx === -1 || secondIdx === -1) {
        // Fallback: merge the two oldest batches to enforce a hard cap during outages.
        const sorted = this.d.pendingBatches
          .map((b, idx) => ({ idx, createdAt: b.createdAt || 0 }))
          .sort((a, b) => a.createdAt - b.createdAt);
        if (sorted.length < 2) break;
        firstIdx = sorted[0].idx;
        secondIdx = sorted[1].idx;
      }
      const [second] = this.d.pendingBatches.splice(secondIdx, 1);
      const [first] = this.d.pendingBatches.splice(firstIdx > secondIdx ? firstIdx - 1 : firstIdx, 1);
      if (!first || !second) break;
      const mergedSummary = {
        totals: {
          totalEvents: first.batch.summary.totals.totalEvents + second.batch.summary.totals.totalEvents,
          totalDownloads: first.batch.summary.totals.totalDownloads + second.batch.summary.totals.totalDownloads,
          totalSuccess: first.batch.summary.totals.totalSuccess + second.batch.summary.totals.totalSuccess,
          totalFail: first.batch.summary.totals.totalFail + second.batch.summary.totals.totalFail,
        },
        browsers: this.mergeCounts({ ...first.batch.summary.browsers }, second.batch.summary.browsers),
        os: this.mergeCounts({ ...first.batch.summary.os }, second.batch.summary.os),
        countries: this.mergeCounts({ ...first.batch.summary.countries }, second.batch.summary.countries),
        languages: this.mergeCounts({ ...first.batch.summary.languages }, second.batch.summary.languages),
        versions: this.mergeCounts({ ...first.batch.summary.versions }, second.batch.summary.versions),
        types: this.mergeCounts({ ...first.batch.summary.types }, second.batch.summary.types),
        errorReasons: this.mergeCounts({ ...first.batch.summary.errorReasons }, second.batch.summary.errorReasons),
        topBrowser: "unknown",
        topOs: "unknown",
        topCountry: "unknown",
        topType: "unknown",
      };
      mergedSummary.topBrowser = this.getTopKey(mergedSummary.browsers);
      mergedSummary.topOs = this.getTopKey(mergedSummary.os);
      mergedSummary.topCountry = this.getTopKey(mergedSummary.countries);
      mergedSummary.topType = this.getTopKey(mergedSummary.types);

      const mergedWeightedCount = first.weightedCount + second.weightedCount;
      const now = Date.now();
      const mergedFailureLogs = this.mergeFailureLogs(
        first.batch.failureLogs as Array<{
          key: string;
          source: "cloudflare-do";
          stage: string;
          errorCode: string;
          errorDetail: string;
          sampleCount: number;
          tsUtc: number;
        }> | undefined,
        second.batch.failureLogs as Array<{
          key: string;
          source: "cloudflare-do";
          stage: string;
          errorCode: string;
          errorDetail: string;
          sampleCount: number;
          tsUtc: number;
        }> | undefined,
      );

      const mergedBatch: OracleBatch = {
        batchId: `do-merge-${now}`,
        generatedAt: now,
        timeZone: "UTC",
        summary: mergedSummary,
        timeBuckets: this.mergeTimeBuckets(first.batch.timeBuckets, second.batch.timeBuckets),
        doState: first.batch.doState,
        uniqueIps: [],
        delivery: {
          deliveryId: `dlv-do-merge-${now}`,
          acceptedCount:
            (first.batch.delivery?.acceptedCount || first.weightedCount) +
            (second.batch.delivery?.acceptedCount || second.weightedCount),
          storedCount:
            (first.batch.delivery?.storedCount || first.weightedCount) +
            (second.batch.delivery?.storedCount || second.weightedCount),
          forwardedCount:
            (first.batch.delivery?.forwardedCount || 0) +
            (second.batch.delivery?.forwardedCount || 0),
          committedCount:
            (first.batch.delivery?.committedCount || 0) +
            (second.batch.delivery?.committedCount || 0),
          createdAt: Math.min(first.createdAt || now, second.createdAt || now),
          minSeq:
            typeof first.batch.delivery?.minSeq === "number" || typeof second.batch.delivery?.minSeq === "number"
              ? Math.min(
                  typeof first.batch.delivery?.minSeq === "number" ? first.batch.delivery.minSeq : Number.MAX_SAFE_INTEGER,
                  typeof second.batch.delivery?.minSeq === "number" ? second.batch.delivery.minSeq : Number.MAX_SAFE_INTEGER,
                )
              : null,
          maxSeq:
            typeof first.batch.delivery?.maxSeq === "number" || typeof second.batch.delivery?.maxSeq === "number"
              ? Math.max(
                  typeof first.batch.delivery?.maxSeq === "number" ? first.batch.delivery.maxSeq : 0,
                  typeof second.batch.delivery?.maxSeq === "number" ? second.batch.delivery.maxSeq : 0,
                )
              : null,
        },
        failureLogs: mergedFailureLogs,
      };
      const merged: PendingOracleBatch = {
        batch: mergedBatch,
        weightedCount: mergedWeightedCount,
        maxSeq: Math.max(first.maxSeq, second.maxSeq),
        attempts: Math.max(first.attempts ?? 0, second.attempts ?? 0),
        createdAt: Math.min(first.createdAt || Date.now(), second.createdAt || Date.now()),
      };
      this.d.pendingBatches.unshift(merged);
    }
  }

  private maybeCompactBuffer(): void {
    const maxBuffer = this.d.configMaxBufferSize || 50_000;
    if (this.d.buffer.length < Math.floor(maxBuffer * COMPACT_TRIGGER_UTIL)) {
      return;
    }

    const target = Math.floor(maxBuffer * COMPACT_TARGET_UTIL);
    const toCompact = this.d.buffer.length - target;
    if (toCompact <= 0) return;

    const sliceCount = Math.min(toCompact, COMPACT_MAX_BATCH);
    const events = this.d.buffer.slice(0, sliceCount);
    if (events.length === 0) return;

    const batchId = `do-compact-${Date.now()}-${events.length}ev`;
    const batch = this.buildOracleBatch(events, batchId);
    const maxSeq = events.reduce((m, ev) => Math.max(m, ev.seq || 0), this.d.committedSeq || 0);
    const weightedCount = this.sumWeightedEventCount(events);
    if (batch.delivery) {
      this.recordDeliveryStage(batch.delivery.deliveryId, batch.batchId, "accepted", batch.delivery.acceptedCount);
      this.recordDeliveryStage(batch.delivery.deliveryId, batch.batchId, "stored", batch.delivery.storedCount);
    }
    this.d.pendingBatches.push({
      batch,
      weightedCount,
      maxSeq,
      attempts: 0,
      createdAt: Date.now(),
    });
    this.d.buffer = this.d.buffer.slice(sliceCount);

    this.mergePendingBatchesIfNeeded();
  }

  /**
   * Build an aggregated OracleBatch from raw events in buffer.
   * Groups events by hour and aggregates counters.
   */
  private buildOracleBatch(events: StoredEvent[], batchIdOverride?: string): OracleBatch {
    const now = Date.now();
    
    // 1. Group events by hour bucket (Keep logic for historical data)
    const hourBuckets = new Map<string, StoredEvent[]>();
    for (const ev of events) {
      const ts = ev.timestamp || now;
      const d = new Date(ts);
      // Truncate to hour: "2025-12-11T03:00:00Z"
      const hourKey = d.toISOString().slice(0, 13) + ":00:00Z";
      if (!hourBuckets.has(hourKey)) {
        hourBuckets.set(hourKey, []);
      }
      hourBuckets.get(hourKey)!.push(ev);
    }

    // Aggregate each hour bucket
    const timeBuckets: TimeBucket[] = [];
    for (const [hourStart, evs] of hourBuckets) {
      const bucket = this.aggregateBucket(hourStart, evs);
      timeBuckets.push(bucket);
    }
    timeBuckets.sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));

    // 2. Build Full Batch Summary (Aggregates EVERYTHING)
    const summary: BatchSummary = {
      totals: { totalEvents: 0, totalDownloads: 0, totalSuccess: 0, totalFail: 0 },
      browsers: {},
      os: {},
      countries: {},
      languages: {},
      versions: {},
      types: {},
      errorReasons: {},
      topBrowser: "unknown",
      topOs: "unknown",
      topCountry: "unknown",
      topType: "unknown"
    };
    let minSeq: number | null = null;
    let maxSeq: number | null = null;

    for (const ev of events) {
      const weight = this.normalizeEventCount(ev.count);
      summary.totals.totalEvents += weight;
      summary.totals.totalDownloads += weight; // All events are download attempts
      
      if (ev.status === "success") summary.totals.totalSuccess += weight;
      else if (ev.status === "cancelled") summary.totals.totalFail += weight;
      else summary.totals.totalFail += weight;

      // Aggregations
      const browser = (ev.browser || "unknown").toLowerCase();
      summary.browsers[browser] = (summary.browsers[browser] || 0) + weight;

      const os = (ev.os || "unknown").toLowerCase();
      summary.os[os] = (summary.os[os] || 0) + weight;

      const country = (ev.country || "unknown").toLowerCase();
      summary.countries[country] = (summary.countries[country] || 0) + weight;

      const lang = (ev.language || "unknown").toLowerCase();
      summary.languages[lang] = (summary.languages[lang] || 0) + weight;

      const ver = sanitizeString(ev.ext_version, 32, FIELD_PATTERNS.generic, "0.0.0");
      summary.versions[ver] = (summary.versions[ver] || 0) + weight;

      const type = (ev.file_type || "unknown").toLowerCase();
      summary.types[type] = (summary.types[type] || 0) + weight;

      if (ev.status === "fail") {
        const err = (ev.error_type || "unknown").toLowerCase();
        summary.errorReasons[err] = (summary.errorReasons[err] || 0) + weight;
      }
      if (typeof ev.seq === "number" && Number.isFinite(ev.seq)) {
        minSeq = minSeq == null ? ev.seq : Math.min(minSeq, ev.seq);
        maxSeq = maxSeq == null ? ev.seq : Math.max(maxSeq, ev.seq);
      }
    }

    // Calculate "Top" stats
    summary.topBrowser = this.getTopKey(summary.browsers);
    summary.topOs = this.getTopKey(summary.os);
    summary.topCountry = this.getTopKey(summary.countries);
    summary.topType = this.getTopKey(summary.types);

    // 3. Build DO state snapshot
    const quota = computeQuotaDescriptor(this.d.reqCountToday, this.d.hardRemoteOff);
    const doState: DOStateBatch = {
      ok: true,
      totalEvents: this.d.totalEvents,
      totalDownloads: this.d.totalDownloads,
      totalSuccess: this.d.totalSuccess,
      totalFail: this.d.totalFail,
      pendingEvents: this.d.pendingEvents,
      lastEventAt: this.d.lastEventAt,
      lastFlushAt: this.d.lastFlushAt,
      quota,
      envSnapshot: {
        maxBatchEvents: this.env.MAX_BATCH_EVENTS || "n/a",
        oracleEndpoint: this.env.ORACLE_ENDPOINT || "unknown",
      },
    };

    // Generate stable batch ID using sequence number (doesn't change on retry)
    const batchId = batchIdOverride || `do-seq${this.d.batchSeq}-${events.length}ev`;
    const weightedCount = this.sumWeightedEventCount(events);
    const failureLogs = this.consumeFailureRollupsForBatch(now);

    // PRIVACY FIX: IP collection disabled per PRIVACY.md policy
    // The privacy policy states IPs are never stored, so we don't send them to Oracle
    // This disables the Geo Map feature but aligns code with documented privacy claims
    // To re-enable, update PRIVACY.md to disclose IP storage and uncomment the code below
    const uniqueIps: string[] = [];  // Disabled for privacy compliance

    // LEAN INGESTION: Only send summaries, NOT raw events or IPs
    // This reduces payload size and maintains privacy compliance
    return {
      batchId,
      generatedAt: now,
      timeZone: "UTC",
      summary,      // Aggregated counters
      timeBuckets,  // Hourly aggregates
      doState,      // DO health snapshot
      delivery: {
        deliveryId: `dlv-${batchId}`,
        acceptedCount: weightedCount,
        storedCount: weightedCount,
        forwardedCount: 0,
        committedCount: 0,
        createdAt: now,
        minSeq,
        maxSeq,
      },
      failureLogs,
      uniqueIps,    // Empty - IPs not collected per privacy policy
      // NOTE: Raw events intentionally excluded to reduce payload size
    };

  }

  private aggregateBucket(hourStart: string, events: StoredEvent[]): TimeBucket {
    const totals: BucketTotals = {
      totalEvents: 0,
      totalDownloads: 0,
      totalSuccess: 0,
      totalFail: 0,
    };

    const counters: BucketCounters = {
      byStatus: {},
      byType: {},
      byBrowser: {},
      byOs: {},
      byExtVersion: {},
      byLanguage: {},
      byCountry: {},
      byErrorType: {},
    };

    for (const ev of events) {
      const weight = this.normalizeEventCount(ev.count);
      totals.totalEvents += weight;
      // totalDownloads = all download attempts (success + fail)
      totals.totalDownloads += weight;
      
      if (ev.status === "success") {
        totals.totalSuccess += weight;
      } else {
        totals.totalFail += weight;
      }

      // Aggregate counters
      const status = ev.status || "unknown";
      counters.byStatus[status] = (counters.byStatus[status] || 0) + weight;

      const type = (ev.file_type || "unknown").toLowerCase();
      counters.byType[type] = (counters.byType[type] || 0) + weight;

      const browser = (ev.browser || "unknown").toLowerCase();
      counters.byBrowser[browser] = (counters.byBrowser[browser] || 0) + weight;

      const os = (ev.os || "unknown").toLowerCase();
      counters.byOs[os] = (counters.byOs[os] || 0) + weight;

      const extVer = sanitizeString(ev.ext_version, 32, FIELD_PATTERNS.generic, "0.0.0");
      counters.byExtVersion[extVer] = (counters.byExtVersion[extVer] || 0) + weight;

      const lang = (ev.language || "unknown").toLowerCase();
      counters.byLanguage[lang] = (counters.byLanguage[lang] || 0) + weight;

      const country = (ev.country || "unknown").toLowerCase();
      counters.byCountry[country] = (counters.byCountry[country] || 0) + weight;

      if (ev.status === "fail") {
        const errType = (ev.error_type || "unknown").toLowerCase();
        counters.byErrorType[errType] = (counters.byErrorType[errType] || 0) + weight;
      }
    }

    // Calculate bucket end (1 hour later)
    const startDate = new Date(hourStart);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const bucketEnd = endDate.toISOString().slice(0, 19) + "Z";

    return {
      bucketStart: hourStart,
      bucketEnd,
      totals,
      counters,
    };
  }

  private async flushToOracle(
    _force: boolean,
  ): Promise<{ ok: boolean; sent: number; error?: string }> {
    const now = Date.now();

    if (!this.d.buffer.length && this.d.pendingBatches.length === 0) {
      // Nothing to flush; clear retry state + alarm.
      this.d.lastFlushAt = now;
      this.d.retryState = { ...DEFAULT_RETRY_STATE };
      await this.scheduleNextMidnightAlarm();
      await this.persist();
      return { ok: true, sent: 0 };
    }

    const resolvedOracleEndpoint = resolveOracleEndpoint(this.env.ORACLE_ENDPOINT, {
      allowInsecureHttp: this.env.ALLOW_INSECURE_ORACLE_ENDPOINT === "true",
    });
    if (!resolvedOracleEndpoint.ok || !this.env.DO_SHARED_SECRET) {
      const msg = !resolvedOracleEndpoint.ok
        ? resolvedOracleEndpoint.message
        : "DO_SHARED_SECRET is not configured";
      if (!this.d.retryState) this.d.retryState = { ...DEFAULT_RETRY_STATE };
      this.d.retryState.lastError = msg;
      this.d.retryState.lastFlushAttemptAt = now;
      logEvent("error", "oracle_flush_misconfigured", {
        error: msg,
        reason: !resolvedOracleEndpoint.ok ? resolvedOracleEndpoint.error : "do_shared_secret_missing",
      });
      this.recordFailure("oracle_forward", "misconfigured", msg, 1, now);
      // Don't schedule retries if endpoint is missing - just report error
      await this.state.storage.deleteAlarm();
      await this.persist();
      return { ok: false, sent: 0, error: msg };
    }

    const maxBatchEnv =
      parseInt(this.env.MAX_BATCH_EVENTS || "10000", 10) || 10000;
    // FIX: even "force" should chunk; force just means "try now / bypass gating"
    let eventsToFlush: StoredEvent[] = [];
    let oracleBatch: OracleBatch | null = null;
    let pendingMeta: PendingOracleBatch | null = null;

    if (this.d.pendingBatches.length > 0) {
      pendingMeta = this.d.pendingBatches[0];
      oracleBatch = pendingMeta.batch;
      pendingMeta.attempts = (pendingMeta.attempts ?? 0) + 1;
    } else {
      eventsToFlush = this.d.buffer.slice(0, maxBatchEnv);
      oracleBatch = this.buildOracleBatch(eventsToFlush);
    }
    if (!oracleBatch) {
      return { ok: false, sent: 0, error: "no_oracle_batch" };
    }
    const flushWeightedCount = pendingMeta
      ? Math.max(
          pendingMeta.weightedCount || 0,
          oracleBatch.delivery?.acceptedCount || 0,
        )
      : this.sumWeightedEventCount(eventsToFlush);

    if (!oracleBatch.delivery) {
      oracleBatch.delivery = {
        deliveryId: `dlv-${oracleBatch.batchId}`,
        acceptedCount: flushWeightedCount,
        storedCount: flushWeightedCount,
        forwardedCount: 0,
        committedCount: 0,
        createdAt: now,
      };
    }
    if (!pendingMeta) {
      this.recordDeliveryStage(
        oracleBatch.delivery.deliveryId,
        oracleBatch.batchId,
        "accepted",
        oracleBatch.delivery.acceptedCount,
        now,
      );
      this.recordDeliveryStage(
        oracleBatch.delivery.deliveryId,
        oracleBatch.batchId,
        "stored",
        oracleBatch.delivery.storedCount,
        now,
      );
    }

    const stashFailedBatch = () => {
      if (pendingMeta || !oracleBatch || eventsToFlush.length === 0) return;
      const maxSeq = eventsToFlush.reduce(
        (m, ev) => Math.max(m, ev.seq || 0),
        this.d.committedSeq || 0,
      );
      this.d.pendingBatches.push({
        batch: oracleBatch,
        weightedCount: this.sumWeightedEventCount(eventsToFlush),
        maxSeq,
        attempts: 1,
        createdAt: now,
      });
      this.d.buffer = this.d.buffer.slice(eventsToFlush.length);
      this.mergePendingBatchesIfNeeded();
    };

    const targetUrl = resolvedOracleEndpoint.ingestUrl;
    logEvent("info", "oracle_flush_attempt", {
      target: "/ingest-batch",
      fromPendingBatch: !!pendingMeta,
      eventCount: eventsToFlush.length,
    });

    if (!this.d.retryState) this.d.retryState = { ...DEFAULT_RETRY_STATE };
    this.d.retryState.lastFlushAttemptAt = now;
    if (pendingMeta) {
      oracleBatch.failureLogs = this.consumeFailureRollupsForBatch(now);
    }
    if (oracleBatch.delivery.forwardedCount < flushWeightedCount) {
      const forwardedDelta = flushWeightedCount - oracleBatch.delivery.forwardedCount;
      oracleBatch.delivery.forwardedCount += forwardedDelta;
      this.recordDeliveryStage(
        oracleBatch.delivery.deliveryId,
        oracleBatch.batchId,
        "forwarded",
        forwardedDelta,
        now,
      );
    }

    try {
      // Send to /ingest-batch endpoint (aggregated format)
      // We append "/ingest-batch" here to correct the base URL if needed
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DO-SECRET": this.env.DO_SHARED_SECRET,
        },
        body: JSON.stringify(oracleBatch),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const msg = `Oracle responded ${res.status} ${res.statusText} ${text}`;
        this.d.retryState.lastError = msg;
        this.d.retryState.consecutiveFailures += 1;
        logEvent("warn", "oracle_flush_failed", { status: res.status, statusText: res.statusText });
        this.recordFailure("oracle_forward", "http_error", msg, 1, now);
        stashFailedBatch();
        await this.scheduleRetry();
        await this.persist();
        return { ok: false, sent: 0, error: msg };
      }

      const ack = await res
        .json()
        .catch(() => null) as { ok?: boolean; batchId?: string; ingestedAt?: number } | null;
      if (!ack || ack.ok !== true) {
        const msg = "Oracle ACK invalid or missing ok=true";
        this.d.retryState.lastError = msg;
        this.d.retryState.consecutiveFailures += 1;
        logEvent("warn", "oracle_flush_ack_invalid", { error: msg });
        this.recordFailure("oracle_ack", "invalid_ack", msg, 1, now);
        stashFailedBatch();
        await this.scheduleRetry();
        await this.persist();
        return { ok: false, sent: 0, error: msg };
      }
      if (!ack.batchId || ack.batchId !== oracleBatch.batchId) {
        const msg = `Oracle ACK batchId mismatch (expected ${oracleBatch.batchId}, got ${ack.batchId || "missing"})`;
        this.d.retryState.lastError = msg;
        this.d.retryState.consecutiveFailures += 1;
        logEvent("warn", "oracle_flush_ack_mismatch", { error: msg });
        this.recordFailure("oracle_ack", "batch_mismatch", msg, 1, now);
        stashFailedBatch();
        await this.scheduleRetry();
        await this.persist();
        return { ok: false, sent: 0, error: msg };
      }

      // Success: drop the sent events or pending batch and increment batch sequence
      if (pendingMeta) {
        this.d.pendingBatches.shift();
        this.d.pendingEvents = Math.max(0, this.d.pendingEvents - pendingMeta.weightedCount);
        this.d.committedSeq = Math.max(this.d.committedSeq, pendingMeta.maxSeq);
      } else {
        const maxSeq = eventsToFlush.reduce((m, ev) => Math.max(m, ev.seq || 0), this.d.committedSeq || 0);
        const weightedCount = this.sumWeightedEventCount(eventsToFlush);
        this.d.buffer = this.d.buffer.slice(eventsToFlush.length);
        this.d.pendingEvents = Math.max(
          0,
          this.d.pendingEvents - weightedCount,
        );
        this.d.committedSeq = Math.max(this.d.committedSeq, maxSeq);
      }
      this.d.lastFlushAt = now;
      this.d.batchSeq += 1; // Increment so next batch gets new ID
      if (oracleBatch.delivery.committedCount < flushWeightedCount) {
        const committedDelta = flushWeightedCount - oracleBatch.delivery.committedCount;
        oracleBatch.delivery.committedCount += committedDelta;
        this.recordDeliveryStage(
          oracleBatch.delivery.deliveryId,
          oracleBatch.batchId,
          "committed",
          committedDelta,
          now,
        );
      }
      this.markFailureRollupsExported(
        (oracleBatch.failureLogs || []).map((row) => ({
          key: row.key,
          sampleCount: row.sampleCount,
        })),
      );
      this.d.retryState = { ...DEFAULT_RETRY_STATE };
      await this.scheduleNextMidnightAlarm();
      await this.persist();

      return {
        ok: true,
        sent: flushWeightedCount,
      };
    } catch (err: unknown) {
      const msg = `Oracle flush error: ${String(err)}`;
      if (!this.d.retryState) this.d.retryState = { ...DEFAULT_RETRY_STATE };
      this.d.retryState.lastError = msg;
      this.d.retryState.consecutiveFailures += 1;
      logEvent("error", "oracle_flush_exception", { error: String(err) });
      this.recordFailure("oracle_forward", "exception", msg, 1, now);
      stashFailedBatch();
      await this.scheduleRetry();
      await this.persist();
      return { ok: false, sent: 0, error: msg };
    }
  }
  /**
   * Public endpoint for the extension to fetch the changelog.
   * Returns sorted entries and current config.
   */
  private async handleGetChangelog(): Promise<Response> {
    const sorted = [...this.d.changelog].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return json({
      ok: true,
      entries: sorted,
      config: this.d.changelogConfig,
    });
  }

  /**
   * Admin endpoint to update changelog or config.
   * Expects JSON body with `changelog` (array) or `config` (object) or both.
   */
  private async handleAdminUpdateChangelog(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    try {
      const body = await request.json() as { 
        changelog?: ChangelogEntry[]; 
        config?: ChangelogConfig;
      };

      let updated = false;

      if (Array.isArray(body.changelog)) {
        this.d.changelog = body.changelog;
        updated = true;
      }

      if (body.config) {
        this.d.changelogConfig = {
          ...this.d.changelogConfig,
          ...body.config,
          lastUpdated: Date.now(),
        };
        updated = true;
      }

      if (updated) {
        await this.persist();
      }

      return json({ ok: true, updated });
    } catch {
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
  }

  // ---------------------------------------------------------------------------
  // Login Rate Limiting
  // ---------------------------------------------------------------------------

  /**
   * Handles login attempt tracking for rate limiting.
   * POST /auth/login-attempt
   * Body: { ip: string, success: boolean }
   * 
   * On failed attempt: increment counter, check if blocked
   * On success: clear attempts for that IP
   * 
   * Returns: { allowed: boolean, attemptsRemaining?: number, blockedUntil?: number }
   */
  private async handleLoginAttempt(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    let body: { ip?: string; success?: boolean; checkOnly?: boolean };
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const ip = body.ip || request.headers.get("CF-Connecting-IP") || "unknown";
    const isSuccess = body.success === true;
    const checkOnly = body.checkOnly === true;

    // Initialize if not present
    if (!this.d.loginAttempts) {
      this.d.loginAttempts = {};
    }

    const now = Date.now();
    const record = this.d.loginAttempts[ip];

    // Check-only mode: return current lockout state without mutating
    if (checkOnly) {
      if (record) {
        const elapsed = now - record.firstAttemptAt;
        if (elapsed >= LOCKOUT_DURATION_MS) {
          return json({
            ok: true,
            allowed: true,
            attemptsRemaining: MAX_ATTEMPTS,
          });
        }
        if (record.attempts >= MAX_ATTEMPTS) {
          const blockedUntil = record.firstAttemptAt + LOCKOUT_DURATION_MS;
          return json({
            ok: true,
            allowed: false,
            blockedUntil,
            blockedForSeconds: Math.ceil((blockedUntil - now) / 1000),
            message: "Too many failed login attempts. Try again later.",
          });
        }
        return json({
          ok: true,
          allowed: true,
          attemptsRemaining: MAX_ATTEMPTS - record.attempts,
        });
      }
      return json({
        ok: true,
        allowed: true,
        attemptsRemaining: MAX_ATTEMPTS,
      });
    }

    // On successful login, clear attempts
    if (isSuccess) {
      delete this.d.loginAttempts[ip];
      await this.persist();
      return json({ ok: true, allowed: true, attemptsRemaining: MAX_ATTEMPTS });
    }

    // Check if currently locked out
    if (record) {
      const elapsed = now - record.firstAttemptAt;
      
      // If lockout period expired, reset
      if (elapsed >= LOCKOUT_DURATION_MS) {
        this.d.loginAttempts[ip] = { attempts: 1, firstAttemptAt: now };
        await this.persist();
        return json({ 
          ok: true, 
          allowed: true, 
          attemptsRemaining: MAX_ATTEMPTS - 1 
        });
      }

      // Already at max attempts, deny
      if (record.attempts >= MAX_ATTEMPTS) {
        const blockedUntil = record.firstAttemptAt + LOCKOUT_DURATION_MS;
        return json({ 
          ok: true, 
          allowed: false, 
          blockedUntil,
          blockedForSeconds: Math.ceil((blockedUntil - now) / 1000),
          message: "Too many failed login attempts. Try again later."
        });
      }

      // Increment and check
      record.attempts += 1;
      await this.persist();

      if (record.attempts >= MAX_ATTEMPTS) {
        const blockedUntil = record.firstAttemptAt + LOCKOUT_DURATION_MS;
        return json({ 
          ok: true, 
          allowed: false, 
          blockedUntil,
          blockedForSeconds: Math.ceil((blockedUntil - now) / 1000),
          message: "Too many failed login attempts. Try again later."
        });
      }

      return json({ 
        ok: true, 
        allowed: true, 
        attemptsRemaining: MAX_ATTEMPTS - record.attempts 
      });
    }

    // First failed attempt for this IP
    this.d.loginAttempts[ip] = { attempts: 1, firstAttemptAt: now };
    await this.persist();
    
    return json({ 
      ok: true, 
      allowed: true, 
      attemptsRemaining: MAX_ATTEMPTS - 1 
    });
  }

  // ---------------------------------------------------------------------------
  // IP Allowlist Handlers
  // ---------------------------------------------------------------------------

  /**
   * Check if an IP is allowed to access the dashboard.
   * POST /auth/check-ip-allowlist
   * Body: { ip: string }
   * 
   * Returns: { allowed: boolean }
   */
  private async handleCheckIpAllowlist(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ allowed: false, error: "unauthorized" }, { status: 401 });
    }
    let body: { ip?: string };
    try {
      body = await request.json();
    } catch {
      return json({ allowed: true }); // Allow on parse error to prevent lockout
    }

    const ip = normalizeIp(body.ip || "");

    // If allowlist is disabled, allow all
    if (!this.d.ipAllowlistEnabled || this.d.ipAllowlist.length === 0) {
      return json({ allowed: true });
    }

    // Check CIDR/IP match
    const isAllowed = ip ? isIpAllowed(ip, this.d.ipAllowlist) : false;
    
    return json({ allowed: isAllowed });
  }

  /**
   * Get current IP allowlist configuration.
   * GET /admin/ip-allowlist
   * Requires X-Admin-Secret
   */
  private async handleGetIpAllowlist(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // Get the client IP from request headers (Cloudflare-provided)
    const clientIp = this.getClientIp(request);

    return json({
      ok: true,
      enabled: this.d.ipAllowlistEnabled,
      allowlist: this.d.ipAllowlist,
      yourIp: clientIp,
    });
  }

  /**
   * Update IP allowlist configuration.
   * POST /admin/ip-allowlist
   * Body: { enabled?: boolean, allowlist?: string[], add?: string, remove?: string }
   * Requires X-Admin-Secret
   */
  private async handleAdminIpAllowlist(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let body: { 
      enabled?: boolean; 
      allowlist?: string[]; 
      add?: string; 
      remove?: string 
    };
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    let updated = false;

    // Set enabled state
    if (typeof body.enabled === "boolean") {
      this.d.ipAllowlistEnabled = body.enabled;
      updated = true;
    }

    // Replace entire allowlist
    if (Array.isArray(body.allowlist)) {
      const normalized = body.allowlist
        .map((entry) => normalizeAllowlistEntry(entry))
        .filter((entry): entry is string => !!entry)
        .filter((entry) => parseCidr(entry) !== null);
      this.d.ipAllowlist = normalized;
      updated = true;
    }

    // Add single IP
    if (body.add && typeof body.add === "string") {
      const entry = normalizeAllowlistEntry(body.add);
      if (entry && parseCidr(entry) && !this.d.ipAllowlist.includes(entry)) {
        this.d.ipAllowlist.push(entry);
        updated = true;
      }
    }

    // Remove single IP
    if (body.remove && typeof body.remove === "string") {
      const entry = normalizeAllowlistEntry(body.remove);
      const idx = entry ? this.d.ipAllowlist.indexOf(entry) : -1;
      if (idx !== -1) {
        this.d.ipAllowlist.splice(idx, 1);
        updated = true;
      }
    }

    if (updated) {
      await this.persist();
    }

    return json({
      ok: true,
      updated,
      enabled: this.d.ipAllowlistEnabled,
      allowlist: this.d.ipAllowlist,
    });
  }
}
