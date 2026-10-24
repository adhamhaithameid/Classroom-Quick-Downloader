// Slice 0 spike — bead wupn. Proves or disproves the conductor architecture.
// Run: node spike/spike.mjs   (from repo root of the worktree)
// Evidence: spike/spike-shots/*.png + stdout table.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EXT = path.join(ROOT, "extension/.output/chrome-mv3");
const SHOTS = path.join(ROOT, "spike/spike-shots");
fs.mkdirSync(SHOTS, { recursive: true });
const FIXTURE = fs.readFileSync(
  path.join(ROOT, "extension/tests/fixtures/classroom/classwork-material-post-en.html"),
  "utf8",
);

const results = [];
function record(id, desc, ok, detail) {
  results.push({ id, desc, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${id}] ${desc} — ${detail}`);
}

// djb2-style checksum, mirrors extension/src/history/history-store.ts
function checksum(data) {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function launch(profileName, opts = {}) {
  const ctx = await chromium.launchPersistentContext(path.join("/tmp", profileName), {
    channel: "chromium",
    headless: opts.headed ? false : true,
    viewport: { width: 420, height: 700 },
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      "--no-first-run",
      "--disable-default-apps",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  const existing = ctx.serviceWorkers();
  const sw = existing.length
    ? existing[0]
    : await ctx.waitForEvent("serviceworker", { timeout: 15000 });
  const id = new URL(sw.url()).host;
  return { ctx, sw, id };
}

// Hard rule: nothing reaches Google except the fulfilled classroom fixture.
async function guardNetwork(ctx, fulfillBody) {
  await ctx.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("chrome-extension://")) return route.continue();
    if (url.startsWith("https://classroom.google.com/")) {
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: fulfillBody });
    }
    if (/(^|\.)google\.com$|googleapis\.com|gstatic\.com/.test(new URL(url).hostname)) {
      return route.abort();
    }
    return route.continue();
  });
}

async function seedStorage(sw, kv) {
  await sw.evaluate((data) => chrome.storage.local.set(data), kv);
}

// Compute integrity INSIDE the browser world, over the STORAGE READ-BACK.
// chrome.storage reorders object keys (base::Value dicts), so stringifying
// the pre-flight value never matches the extension's load-path verify.
async function seedWithIntegrity(sw, key, integrityKey, value) {
  await sw.evaluate(
    ([k, ik, v]) => {
      const djb2 = (data) => {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
          hash = ((hash << 5) - hash) + data.charCodeAt(i);
          hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
      };
      return chrome.storage.local.set({ [k]: v }).then(async () => {
        const res = await chrome.storage.local.get(k);
        await chrome.storage.local.set({ [ik]: djb2(JSON.stringify(res[k])) });
      });
    },
    [key, integrityKey, value],
  );
}

async function openPopup(ctx, id) {
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForTimeout(800);
  return page;
}

// The What's New overlay shows on every fresh profile; dismiss it once so
// later popup opens land on the main view deterministically.
async function dismissWhatsNew(page) {
  const back = page.getByRole("button", { name: /back/i }).first();
  if (await back.count()) await back.click().catch(() => {});
  await page.waitForTimeout(400);
}

const statsRecord = {
  schemaVersion: 1,
  installId: "spike-install",
  lifetimeCount: 50,
  lastMilestoneReached: null,
  milestonePending: 50,
  countedDownloadIds: [],
};
const historyEntries = [
  { id: "fx-1", ts: Date.now() - 86400000, filename: "syllabus.pdf", ext: "pdf", bytes: 123456, status: "success", host: "drive.usercontent.google.com", url: "https://drive.usercontent.google.com/spike-1" },
  { id: "fx-2", ts: Date.now() - 3600000, filename: "worksheet.pdf", ext: "pdf", bytes: 64000, status: "failed", errorCode: "SERVER_FORBIDDEN", host: "drive.usercontent.google.com", url: "https://drive.usercontent.google.com/spike-2" },
];

// ---------- CHECK 1: load built extension, read ID; stability across launches
try {
  const a = await launch("cqd-spike-r4-p1");
  const b = await launch("cqd-spike-r4-p2");
  record("1a", "extension loads, SW reachable, ID readable", true, `id=${a.id}`);
  const stable = a.id === b.id;
  record("1b", "ID stable across two profiles (path-derived, no manifest key)", stable, `${a.id} vs ${b.id}`);
  await seedStorage(a.sw, {
    cqd_download_stats_v1: statsRecord,
    cqd_download_stats_integrity_v1: checksum(JSON.stringify(statsRecord)),
    cqd_history_v1: historyEntries,
    cqd_history_integrity_v1: checksum(JSON.stringify(historyEntries)),
  });
  const round = await a.sw.evaluate(() => chrome.storage.local.get(["cqd_download_stats_v1"]));
  record("1c", "serviceWorker.evaluate writes+reads chrome.storage.local", round["cqd_download_stats_v1"]?.lifetimeCount === 50, `lifetimeCount=${round["cqd_download_stats_v1"]?.lifetimeCount}`);
  await a.ctx.close();
  await b.ctx.close();
} catch (e) {
  record("1", "load/ID/seed", false, String(e).slice(0, 300));
}

// ---------- CHECK 2: seeded storage drives popup through 3 real states
try {
  const { ctx, sw, id } = await launch("cqd-spike-r4-p3");
  const swErrors = [];
  sw.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) swErrors.push(m.text().slice(0, 200));
  });

  // state A: fresh install (no seed)
  let page = await openPopup(ctx, id);
  const textA = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(SHOTS, "state-a-fresh.png") });
  record("2a", "popup opens on chrome-extension:// and renders (fresh state)", textA.trim().length > 20, `chars=${textA.trim().length}`);
  await page.close();

  // state B: milestone celebration — read-back integrity, open, assert toast
  await seedWithIntegrity(sw, "cqd_download_stats_v1", "cqd_download_stats_integrity_v1", statsRecord);
  page = await openPopup(ctx, id);
  await dismissWhatsNew(page);
  const toast = page.locator(".cqd-milestone-toast");
  const toastVisible = await toast.count();
  const toastText = toastVisible ? await toast.first().innerText() : "";
  await page.screenshot({ path: path.join(SHOTS, "state-b-milestone.png") });
  await page.waitForTimeout(6000); // claim clears immediately; toast dismisses at 4s
  const stats = await sw.evaluate(() => chrome.storage.local.get(["cqd_download_stats_v1"]));
  const cleared = stats["cqd_download_stats_v1"]?.milestonePending === null;
  record("2b", "milestone state: seeded pending=50, popup claimed + cleared it", cleared, `cleared=${cleared}, toastVisible=${toastVisible}, toast=${JSON.stringify(toastText.slice(0, 80))}, swErrors=[${swErrors.slice(0, 3).join(" | ")}]`);
  await page.close();

  // state C: download history rows visible
  await seedWithIntegrity(sw, "cqd_history_v1", "cqd_history_integrity_v1", historyEntries);
  page = await openPopup(ctx, id);
  await dismissWhatsNew(page);
  await page.waitForTimeout(1000);
  let hit = await page.getByText("syllabus.pdf").count();
  if (!hit) {
    const section = page.locator('section[aria-label="Download history"]').first();
    if (await section.count()) await section.scrollIntoViewIfNeeded().catch(() => {});
    hit = await page.getByText("syllabus.pdf").count();
  }
  const textC = await page.evaluate(() => document.body.innerText);
  // Root-cause probe for bead cr9w: the SW acks CQD_HISTORY_GET async but
  // returns false — the channel closes and lastError should say so.
  const probe = await page.evaluate(
    () =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CQD_HISTORY_GET", query: "" }, (res) => {
          resolve({ lastError: chrome.runtime.lastError?.message ?? null, ok: res?.ok ?? null });
        });
      }),
  );
  await page.screenshot({ path: path.join(SHOTS, "state-c-history.png") });
  record("2c", "history state: seeded row 'syllabus.pdf' renders in popup", hit > 0, `matches=${hit}, probe=${JSON.stringify(probe)} (cr9w), snippet=${JSON.stringify(textC.slice(0, 120))}`);
  await ctx.close();
} catch (e) {
  record("2", "seeded popup states", false, String(e).slice(0, 300));
}

// ---------- CHECK 4: fulfilled classroom.google.com gets real content-script injection
const wrappedFixture = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Classroom</title></head>
<body style="margin:0;padding:24px;font-family:Roboto,Arial,sans-serif">
${FIXTURE}
</body>
</html>`;
try {
  const { ctx, id } = await launch("cqd-spike-p4b");
  await ctx.route("https://classroom.google.com/**", (route) => {
    if (route.request().resourceType() === "document") {
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: wrappedFixture });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await ctx.route(/^https:\/\/([a-z0-9-]+\.)?googleapis\.com|^https:\/\/([a-z0-9-]+\.)?gstatic\.com|^https:\/\/www\.google\.com/, (route) => route.abort());
  const page = await ctx.newPage();
  await page.goto("https://classroom.google.com/c/course-1", { waitUntil: "domcontentloaded" });
  await page.locator(".cqd-download-btn").first().waitFor({ timeout: 20000 });
  const n = await page.locator(".cqd-download-btn").count();
  await page.screenshot({ path: path.join(SHOTS, "state-d-classroom.png") });
  record("4", "real content script injected CQD download buttons into fulfilled fixture page", n > 0, `buttons=${n}, ext=${id}`);
  // hard rule proof: any other Google host is aborted
  let aborted = false;
  try {
    await page.goto("https://www.google.com/search?q=x", { timeout: 5000 });
  } catch {
    aborted = true;
  }
  record("4b", "non-fixture Google traffic aborted (zero live traffic rule)", aborted, "goto www.google.com failed as designed");
  await ctx.close();
} catch (e) {
  record("4", "classroom fixture + content script", false, String(e).slice(0, 300));
}

// ---------- CHECK 5 (headed): chrome.action.openPopup()
try {
  const { ctx, sw, id } = await launch("cqd-spike-r5-p5", { headed: true });
  const page = await ctx.newPage();
  await page.goto("about:blank");
  await page.bringToFront(); // openPopup needs an active browser window
  await page.waitForTimeout(500);
  const pagesBefore = ctx.pages().length;
  let popupAppeared = false;
  const popupPagePromise = ctx
    .waitForEvent("page", { timeout: 5000 })
    .then((p) => p)
    .catch(() => null);
  const evalResult = await sw
    .evaluate(() => chrome.action.openPopup().then(() => "called").catch((e) => `err:${e?.message ?? e}`))
    .catch((e) => `evalfail:${String(e).slice(0, 120)}`);
  const popupPage = await popupPagePromise;
  const allPages = ctx.pages();
  const popupUrl = allPages.map((p) => p.url()).find((u) => u.includes("/popup.html"));
  popupAppeared = Boolean(popupPage || popupUrl);
  if (popupPage || popupUrl) {
    const p = popupPage ?? allPages.find((x) => x.url().includes("/popup.html"));
    await p.waitForTimeout(1000);
    await p.screenshot({ path: path.join(SHOTS, "state-e-openpopup.png") }).catch(() => {});
  }
  record("5", "headed chrome.action.openPopup() shows the real bubble", popupAppeared, `eval=${evalResult}, pages ${pagesBefore}->${allPages.length}${popupUrl ? `, url=${popupUrl}` : ""}`);
  // The bubble is a native widget: if no page target appeared, capture the
  // desktop so a human can verify what the bubble showed.
  if (!popupAppeared && process.platform === "darwin") {
    const { execFileSync } = await import("node:child_process");
    execFileSync("screencapture", ["-x", path.join(SHOTS, "state-e-desktop.png")]);
    console.log("5: desktop screenshot saved (bubble is a native widget, not a page target)");
  }
  await ctx.close();
} catch (e) {
  record("5", "headed openPopup", false, String(e).slice(0, 300));
}

// ---------- CHECK 3 + 6: static findings (evidence from source, cited in report)
console.log("\nSTATIC FINDINGS");
console.log("3: changelog 'fetch failed'/'offline' states are UNREACHABLE in 1.9.1 —");
console.log("   fetchChangelogDetailed() never fetches; returns MANUAL_DATA (changelog.ts:171-179).");
console.log("   Network staging for changelog is moot; route/fulfill + setOffline still valid for other paths.");
console.log("6: popup Date usage is display-only (App.tsx:1112,2122; ErrorBoundary.tsx:60).");
console.log("   No popup state is wall-clock-dependent; page.clock available (playwright 1.63) but unneeded for state forcing.");
console.log("   MV3 alarms (analytics flush) live in the SW, not the popup — clock does not apply there.");

const pass = results.filter((r) => r.ok).length;
console.log(`\nRESULT: ${pass}/${results.length} checks passed`);
console.log(`Evidence: ${SHOTS}`);
