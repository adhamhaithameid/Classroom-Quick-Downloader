// filepath: cloudflare-worker/src/dashboard/utils.ts
/**
 * Dashboard utility functions.
 */

import type { QuotaDescriptor } from "../types";

export function formatTs(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatAge(ts: number | null): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff <= 0) return "just now";

  const sec = Math.floor(diff / 1_000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day > 0) return `${day}d`;
  if (hr > 0) return `${hr}h`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

export function topKey(data?: Record<string, number>): string {
  if (!data) return "—";
  const entries = Object.entries(data);
  if (!entries.length) return "—";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function renderTableRows(data: Record<string, number>): string {
  const keys = Object.keys(data).sort((a, b) => data[b] - data[a]);
  if (keys.length === 0) return "<tr><td colspan='2'>—</td></tr>";
  return keys
    .map((k) => `<tr><td>${k}</td><td>${data[k]}</td></tr>`)
    .join("");
}

interface StateTag {
  label: string;
  className: string;
  description: string;
}

export function quotaToStateTag(quota?: QuotaDescriptor): StateTag {
  if (!quota) {
    return { label: "unknown", className: "state-unknown", description: "No quota info." };
  }

  const n = quota.requestsToday;

  if (n <= 1_000) return { label: "sleeping", className: "state-sleeping", description: "Very low traffic." };
  if (n <= 5_000) return { label: "super chill", className: "state-super-chill", description: "Barely touching Worker." };
  if (n <= 10_000) return { label: "chill", className: "state-chill", description: "Plenty of headroom." };
  if (n <= 20_000) return { label: "easy", className: "state-easy", description: "Well below limits." };
  if (n <= 30_000) return { label: "kinda easy", className: "state-kinda-easy", description: "Load is fine." };
  if (n <= 40_000) return { label: "normal", className: "state-normal", description: "Normal traffic." };
  if (n <= 50_000) return { label: "slightly busy", className: "state-slightly-busy", description: "Warming up." };
  if (n <= 60_000) return { label: "kinda busy", className: "state-kinda-busy", description: "Closer to quota." };
  if (n <= 70_000) return { label: "busy", className: "state-busy", description: "Hard-normal zone." };
  if (n <= 80_000) return { label: "very busy", className: "state-very-busy", description: "Protecting quota." };
  if (n <= 90_000) return { label: "super busy", className: "state-super-busy", description: "Approaching limits." };
  if (n <= 95_000) return { label: "emergency", className: "state-emergency", description: "Emergency mode." };
  if (n <= 99_000) return { label: "critical", className: "state-critical", description: "At the limit." };
  return { label: "cut power", className: "state-cut-power", description: "Remote analytics OFF." };
}

export function quotaToFlag(quota?: QuotaDescriptor): StateTag {
  if (!quota) {
    return { label: "unknown", className: "flag-unknown", description: "No info." };
  }
  const n = quota.requestsToday;
  if (n <= 20_000) return { label: "easy", className: "flag-easy", description: "Way below limits." };
  if (n <= 50_000) return { label: "normal", className: "flag-normal", description: "Comfortable usage." };
  if (n <= 80_000) return { label: "hard", className: "flag-hard", description: "High traffic." };
  return { label: "critical", className: "flag-fuck", description: "At limits." };
}

interface SuccessRateMeta {
  text: string;
  badge: string;
  className: string;
}

export function classifySuccessRate(success: number, fail: number): SuccessRateMeta {
  const total = success + fail;
  if (!total) return { text: "—", badge: "No data", className: "" };
  
  const rate = (success / total) * 100;
  if (rate >= 98) return { text: `${rate.toFixed(1)}%`, badge: "Excellent", className: "metric-good" };
  if (rate >= 95) return { text: `${rate.toFixed(1)}%`, badge: "Healthy", className: "metric-warn" };
  return { text: `${rate.toFixed(1)}%`, badge: "Unstable", className: "metric-bad" };
}
