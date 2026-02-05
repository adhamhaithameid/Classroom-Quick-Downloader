// filepath: cloudflare-worker/src/dashboard/main.ts
import type { StatsResponse, QuotaDescriptor, ChangelogEntry, ChangelogConfig } from "../types";
import { FAVICON_PNG_DATA_URI } from "../assets";

function formatTs(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAge(ts: number | null): string {
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

function quotaToStateTag(quota?: QuotaDescriptor) {
  if (!quota) {
    return {
      label: "unknown",
      className: "state-unknown",
      description: "No quota information available.",
    };
  }

  const n = quota.requestsToday;

  if (n <= 1_000)
    return {
      label: "sleeping",
      className: "state-sleeping",
      description: "Very low traffic today.",
    };
  if (n <= 5_000)
    return {
      label: "super chill",
      className: "state-super-chill",
      description: "Extension is barely touching the Worker.",
    };
  if (n <= 10_000)
    return {
      label: "chill",
      className: "state-chill",
      description: "Plenty of headroom.",
    };
  if (n <= 20_000)
    return {
      label: "easy",
      className: "state-easy",
      description: "Still well below limits.",
    };
  if (n <= 30_000)
    return {
      label: "kinda easy",
      className: "state-kinda-easy",
      description: "Load is fine. Batch size may start increasing soon.",
    };
  if (n <= 40_000)
    return {
      label: "normal",
      className: "state-normal",
      description: "Normal daily traffic.",
    };
  if (n <= 50_000)
    return {
      label: "slightly busy",
      className: "state-slightly-busy",
      description: "Worker is warming up.",
    };
  if (n <= 60_000)
    return {
      label: "kinda busy",
      className: "state-kinda-busy",
      description: "Closer to quota, batching should be stronger.",
    };
  if (n <= 70_000)
    return {
      label: "busy",
      className: "state-busy",
      description: "We are in the hard-normal zone.",
    };
  if (n <= 80_000)
    return {
      label: "very busy",
      className: "state-very-busy",
      description: "High traffic. Worker is protecting quota.",
    };
  if (n <= 90_000)
    return {
      label: "super busy",
      className: "state-super-busy",
      description: "Approaching Cloudflare free tier limits.",
    };
  if (n <= 95_000)
    return {
      label: "emergency",
      className: "state-emergency",
      description: "Emergency mode. Batch sizes should be huge.",
    };
  if (n <= 99_000)
    return {
      label: "critical",
      className: "state-critical",
      description: "We are basically at the limit. Prepare cut power.",
    };
  return {
    label: "cut the power rn",
    className: "state-cut-power",
    description: "Remote analytics should be OFF; everything local.",
  };
}

function quotaToFlag(quota?: QuotaDescriptor) {
  if (!quota) {
    return {
      label: "unknown",
      className: "flag-unknown",
      description: "No info.",
    };
  }
  const n = quota.requestsToday;
  if (n <= 20_000)
    return {
      label: "easy",
      className: "flag-easy",
      description: "Way below limits (<20k).",
    };
  if (n <= 50_000)
    return {
      label: "normal",
      className: "flag-normal",
      description: "Comfortable usage (<50k).",
    };
  if (n <= 80_000)
    return {
      label: "hard",
      className: "flag-hard",
      description: "High traffic (<80k).",
    };
  return {
    label: "fuck",
    className: "flag-fuck",
    description: "Basically at limits (>80k).",
  };
}

function classifySuccessRate(success: number, fail: number) {
  const total = success + fail;
  if (!total) {
    return {
      text: "—",
      badge: "No data",
      className: "",
    };
  }
  const rate = (success / total) * 100;
  if (rate >= 98) {
    return {
      text: `${rate.toFixed(1)}%`,
      badge: "Excellent",
      className: "metric-good",
    };
  }
  if (rate >= 95) {
    return {
      text: `${rate.toFixed(1)}%`,
      badge: "Healthy",
      className: "metric-warn",
    };
  }
  return {
    text: `${rate.toFixed(1)}%`,
    badge: "Unstable",
    className: "metric-bad",
    };
}

function topKey(data?: Record<string, number>): string {
  if (!data) return "—";
  const entries = Object.entries(data);
  if (!entries.length) return "—";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function renderLoginPage(errorMessage?: string): string {
  return "";
}

export function renderDashboard(stats: StatsResponse): string {
  return "";
}