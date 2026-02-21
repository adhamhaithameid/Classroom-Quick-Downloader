import type { ChangelogEntry } from "./types";

type SafeReleaseEntry = {
  id: string;
  version: string;
  date: string;
  changes: string[];
};

const FALLBACK_VERSION = "Unknown";
const EMPTY_STATE_MESSAGE = "No release notes published yet. Check back soon.";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function coerceDate(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    return new Date(0).toISOString();
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }
  return parsed.toISOString();
}

function coerceChanges(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 32);
}

export function sanitizeReleaseEntries(entries: unknown[]): SafeReleaseEntry[] {
  const normalized = entries
    .map((entry, index): SafeReleaseEntry | null => {
      if (!entry || typeof entry !== "object") return null;
      const src = entry as Partial<ChangelogEntry>;
      const version = typeof src.version === "string" && src.version.trim() ? src.version.trim() : FALLBACK_VERSION;
      const date = coerceDate(src.date);
      const changes = coerceChanges(src.changes);
      const id = typeof src.id === "string" && src.id.trim() ? src.id.trim() : `${version}-${index}`;
      return { id, version, date, changes };
    })
    .filter((entry): entry is SafeReleaseEntry => entry !== null);

  normalized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return normalized;
}

function formatDisplayDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function renderEntries(entries: SafeReleaseEntry[]): string {
  if (!entries.length) {
    return `<section class="cqd-release-empty">${escapeHtml(EMPTY_STATE_MESSAGE)}</section>`;
  }

  const byYear = new Map<string, SafeReleaseEntry[]>();
  for (const entry of entries) {
    const year = new Date(entry.date).getUTCFullYear().toString();
    const existing = byYear.get(year) ?? [];
    existing.push(entry);
    byYear.set(year, existing);
  }

  const sortedYears = [...byYear.keys()].sort((a, b) => Number(b) - Number(a));
  return sortedYears
    .map((year) => {
      const rows = byYear.get(year) ?? [];
      const renderedRows = rows
        .map((entry) => {
          const renderedChanges = entry.changes.length
            ? `<ul class="cqd-release-list">${entry.changes.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
            : '<p class="cqd-release-empty-changes">No details were provided for this release.</p>';

          return `
            <article class="cqd-release-card">
              <header class="cqd-release-card-header">
                <span class="cqd-version-pill">v${escapeHtml(entry.version)}</span>
                <time class="cqd-release-date" datetime="${escapeHtml(entry.date)}">${escapeHtml(formatDisplayDate(entry.date))}</time>
              </header>
              ${renderedChanges}
            </article>
          `;
        })
        .join("");

      return `
        <section class="cqd-release-year">
          <h2>${escapeHtml(year)}</h2>
          <div class="cqd-release-timeline">${renderedRows}</div>
        </section>
      `;
    })
    .join("");
}

export function renderReleaseNotesPage(entries: SafeReleaseEntry[], origin: string): string {
  const latest = entries.length ? formatDisplayDate(entries[0].date) : "No releases yet";
  const total = entries.length;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Classroom Quick Downloader Release Notes</title>
    <style>
      :root {
        --bg: #f5f7fb;
        --surface: #ffffff;
        --line: #d5deeb;
        --text: #10223a;
        --muted: #5e7088;
        --accent: #2257ff;
        --accent-soft: #ebf1ff;
        --ring: rgba(34, 87, 255, 0.18);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: radial-gradient(1200px 600px at 80% -10%, #dfe9ff 0%, transparent 55%), var(--bg);
        color: var(--text);
      }

      .cqd-page {
        width: min(980px, calc(100% - 32px));
        margin: 32px auto 64px;
      }

      .cqd-hero {
        background: linear-gradient(138deg, #0e1a2b 0%, #1f2f49 45%, #284f9a 100%);
        color: #f8fbff;
        border-radius: 24px;
        padding: 28px 28px 24px;
        box-shadow: 0 18px 40px rgba(10, 26, 52, 0.25);
      }

      .cqd-eyebrow {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.82;
      }

      .cqd-title {
        margin: 0;
        font-size: clamp(30px, 5vw, 42px);
        letter-spacing: -0.02em;
        line-height: 1.06;
      }

      .cqd-subtitle {
        margin: 12px 0 0;
        font-size: 16px;
        color: rgba(240, 245, 255, 0.92);
        max-width: 680px;
      }

      .cqd-meta-row {
        margin-top: 20px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .cqd-meta-chip {
        display: inline-flex;
        align-items: center;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 12px;
        font-weight: 600;
        color: #e7efff;
        text-decoration: none;
      }

      .cqd-meta-chip:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .cqd-releases {
        margin-top: 26px;
        display: grid;
        gap: 20px;
      }

      .cqd-release-year {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 20px 20px 18px;
        box-shadow: 0 8px 22px rgba(14, 26, 43, 0.06);
      }

      .cqd-release-year h2 {
        margin: 0 0 16px;
        font-size: 26px;
        letter-spacing: -0.02em;
      }

      .cqd-release-timeline {
        position: relative;
        display: grid;
        gap: 12px;
        padding-left: 18px;
      }

      .cqd-release-timeline::before {
        content: "";
        position: absolute;
        left: 0;
        top: 3px;
        bottom: 3px;
        width: 2px;
        background: linear-gradient(var(--accent), rgba(34, 87, 255, 0.15));
      }

      .cqd-release-card {
        position: relative;
        background: #fbfdff;
        border: 1px solid #dfe6f4;
        border-radius: 14px;
        padding: 14px 14px 12px;
      }

      .cqd-release-card::before {
        content: "";
        position: absolute;
        left: -22px;
        top: 17px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid var(--accent);
        background: #fff;
        box-shadow: 0 0 0 4px var(--ring);
      }

      .cqd-release-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }

      .cqd-version-pill {
        background: var(--accent-soft);
        border: 1px solid #cad8ff;
        color: #2349b7;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
      }

      .cqd-release-date {
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .cqd-release-list {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 6px;
        color: #1e2f47;
        font-size: 14px;
        line-height: 1.45;
      }

      .cqd-release-empty,
      .cqd-release-empty-changes {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .cqd-release-empty {
        background: var(--surface);
        border: 1px dashed var(--line);
        border-radius: 16px;
        padding: 24px;
        text-align: center;
      }

      .cqd-footer {
        margin-top: 20px;
        color: var(--muted);
        font-size: 13px;
      }

      .cqd-footer a {
        color: #1f50cd;
        text-decoration: none;
      }

      .cqd-footer a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <main class="cqd-page">
      <header class="cqd-hero">
        <p class="cqd-eyebrow">Classroom Quick Downloader</p>
        <h1 class="cqd-title">Release Notes</h1>
        <p class="cqd-subtitle">
          Product updates and fixes in a clean timeline inspired by Arc's release notes style.
        </p>
        <div class="cqd-meta-row">
          <span class="cqd-meta-chip">Last updated: ${escapeHtml(latest)} (UTC)</span>
          <span class="cqd-meta-chip">Total releases: ${total}</span>
          <a class="cqd-meta-chip" href="/changelog">Raw changelog API</a>
        </div>
      </header>

      <section class="cqd-releases">
        ${renderEntries(entries)}
      </section>

      <footer class="cqd-footer">
        Found an issue? <a href="${escapeHtml(origin)}/">Open dashboard login</a> or share feedback from the extension popup.
      </footer>
    </main>
  </body>
</html>`;
}
