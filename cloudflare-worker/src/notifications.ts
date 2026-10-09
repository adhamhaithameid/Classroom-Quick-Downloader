/**
 * In-dashboard notifications center.
 *
 * Aggregates EXISTING health signals into one dismissible list. No email,
 * no external pushes: the list renders server-side from data the worker
 * already has (DO stats, DO pipeline health, scrape-health KV, uptime KV).
 * Dismissals live in a bounded KV ring keyed by stable notification id.
 */

import type { StatsResponse } from "./types";
import type { UptimeSummary } from "./uptime";
import type { ScrapeAlert } from "./store-stats";

export const NOTIFICATION_DISMISSALS_KV_KEY = "site:v1:notif-dismissals";
export const MAX_NOTIFICATION_DISMISSALS = 200;
const MAX_ID_LENGTH = 200;
const MAX_DETAIL_LENGTH = 300;

export type NotificationSeverity = "info" | "warn" | "critical";

export interface AdminNotification {
  /** Stable id used for dismissal; derived from the condition, not the time. */
  id: string;
  severity: NotificationSeverity;
  title: string;
  detail: string;
}

export interface NotificationInputs {
  stats: StatsResponse;
  pipelineHealth?: { status?: unknown; reasons?: unknown } | null;
  scrapeAlerts?: ScrapeAlert[];
  uptime?: UptimeSummary | null;
}

function clampText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function sanitizeNotificationId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const id = raw.trim();
  if (!id || id.length > MAX_ID_LENGTH) return "";
  // Ids are internal strings; keep them to a safe charset.
  return /^[A-Za-z0-9:_.-]+$/.test(id) ? id : "";
}

type DismissalRecord = { id: string; ts: number };

export function parseDismissals(raw: string | null): DismissalRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: DismissalRecord[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Partial<DismissalRecord>;
      const id = sanitizeNotificationId(record.id);
      if (!id || typeof record.ts !== "number" || !Number.isFinite(record.ts)) continue;
      out.push({ id, ts: Math.floor(record.ts) });
    }
    return out.slice(-MAX_NOTIFICATION_DISMISSALS);
  } catch {
    return [];
  }
}

export function boundDismissals(records: DismissalRecord[]): DismissalRecord[] {
  return records.slice(-MAX_NOTIFICATION_DISMISSALS);
}

/** Build the aggregated list. Order: critical first, then warn, then info. */
export function buildNotifications(inputs: NotificationInputs): AdminNotification[] {
  const { stats } = inputs;
  const notifications: AdminNotification[] = [];

  // 1. Pipeline health (DO self-assessment fetched once per dashboard load).
  const status = typeof inputs.pipelineHealth?.status === "string" ? inputs.pipelineHealth.status : "";
  if (status === "warn" || status === "critical") {
    const reasonsRaw = inputs.pipelineHealth?.reasons;
    const reasons = Array.isArray(reasonsRaw)
      ? reasonsRaw.filter((reason): reason is string => typeof reason === "string" && reason.length > 0)
      : [];
    notifications.push({
      id: `pipeline:${status}`,
      severity: status,
      title: `Pipeline health: ${status}`,
      detail: clampText(reasons.length > 0 ? reasons.join("; ") : "Check the Pipeline Health tab for details.", MAX_DETAIL_LENGTH),
    });
  }

  // 2. Scrape health (store-side watchdog from the snapshot cron).
  for (const alert of inputs.scrapeAlerts ?? []) {
    if (!alert || typeof alert.store !== "string") continue;
    notifications.push({
      id: sanitizeNotificationId(`scrape:${alert.store}`) || "scrape:unknown",
      severity: "warn",
      title: `Store scrape failing: ${alert.store}`,
      detail: clampText(String(alert.reason || "consecutive failures"), MAX_DETAIL_LENGTH),
    });
  }

  // 3. Quota proximity (existing stats).
  const quotaLevel = stats.quota?.quotaLevel ?? "UNKNOWN";
  if (quotaLevel !== "BELOW_LIMITS") {
    notifications.push({
      id: `quota:${quotaLevel}`,
      severity: quotaLevel.toUpperCase().includes("CRIT") ? "critical" : "warn",
      title: `Quota level: ${quotaLevel}`,
      detail: "The worker changed its backpressure mode based on request volume.",
    });
  }
  const maxDaily = stats.remoteConfig?.maxDailyRequests ?? 0;
  const today = stats.quota?.requestsToday ?? 0;
  if (maxDaily > 0) {
    const ratio = today / maxDaily;
    if (ratio >= 0.95) {
      notifications.push({
        id: "quota:requests-95",
        severity: "critical",
        title: "Request quota nearly exhausted",
        detail: `${today.toLocaleString()} of ${maxDaily.toLocaleString()} daily requests used (>= 95%).`,
      });
    } else if (ratio >= 0.8) {
      notifications.push({
        id: "quota:requests-80",
        severity: "warn",
        title: "Request quota approaching limit",
        detail: `${today.toLocaleString()} of ${maxDaily.toLocaleString()} daily requests used (>= 80%).`,
      });
    }
  }

  // 4. Uptime (commit-2 self-check ring).
  const uptime = inputs.uptime ?? null;
  if (uptime) {
    if (uptime.lastCheck && !uptime.lastCheck.ok) {
      notifications.push({
        id: "uptime:last-check",
        severity: "warn",
        title: "Last uptime check failed",
        detail: `Self-check at ${new Date(uptime.lastCheck.timestamp).toISOString()} did not answer OK.`,
      });
    }
    if (uptime.consecutiveFailures >= 12) {
      notifications.push({
        id: "uptime:consecutive-failures",
        severity: "critical",
        title: "Uptime checks failing for an hour or more",
        detail: `${uptime.consecutiveFailures} consecutive failed self-checks (5-minute cadence).`,
      });
    } else if (uptime.consecutiveFailures >= 3) {
      notifications.push({
        id: "uptime:consecutive-failures",
        severity: "warn",
        title: "Uptime checks failing",
        detail: `${uptime.consecutiveFailures} consecutive failed self-checks (5-minute cadence).`,
      });
    }
    if (typeof uptime.uptime24h === "number" && uptime.uptime24h < 99) {
      notifications.push({
        id: "uptime:24h-below-99",
        severity: "warn",
        title: "24h uptime below 99%",
        detail: `${uptime.uptime24h.toFixed(1)}% of self-checks succeeded in the last 24 hours.`,
      });
    }
  }

  const rank: Record<NotificationSeverity, number> = { critical: 0, warn: 1, info: 2 };
  return notifications.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Filter out dismissed ids (bounded dismissal list from KV). */
export function applyDismissals(
  notifications: AdminNotification[],
  dismissals: DismissalRecord[],
): { visible: AdminNotification[]; dismissedIds: string[] } {
  const dismissed = new Set(dismissals.map((record) => record.id));
  return {
    visible: notifications.filter((notification) => !dismissed.has(notification.id)),
    dismissedIds: notifications
      .filter((notification) => dismissed.has(notification.id))
      .map((notification) => notification.id),
  };
}
