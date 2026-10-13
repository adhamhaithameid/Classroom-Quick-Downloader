// Inspect the engine-mode selector in the REAL popup's Classroom view.
// Recipe: classroom fixture tab active -> SW opens popup as a BACKGROUND tab
// -> popup mounts and sees the Classroom tab -> full view renders.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EXT = path.join(ROOT, "extension/.output/chrome-mv3");
const FIXTURE = fs.readFileSync(
  path.join(ROOT, "extension/tests/fixtures/classroom/classwork-material-post-en.html"),
  "utf8",
);
const wrapped = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Classroom</title></head>
<body style="margin:0;padding:24px;font-family:Roboto,Arial,sans-serif">${FIXTURE}</body></html>`;

const ctx = await chromium.launchPersistentContext("/tmp/cqd-spike-engine", {
  channel: "chromium",
  headless: true,
  viewport: { width: 360, height: 640 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--no-first-run",
    "--disable-default-apps",
    "--disable-blink-features=AutomationControlled",
  ],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
const id = new URL(sw.url()).host;

// 1. Classroom fixture tab (fulfilled, active).
await ctx.route("https://classroom.google.com/**", (route) => {
  if (route.request().resourceType() === "document") {
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: wrapped });
  }
  return route.fulfill({ status: 204, body: "" });
});
const classroom = await ctx.newPage();
await classroom.goto("https://classroom.google.com/c/course-1", { waitUntil: "domcontentloaded" });

// 2. Popup as a background tab: the classroom tab stays active.
await sw.evaluate(() => chrome.tabs.create({ url: chrome.runtime.getURL("popup.html"), active: false }));
await ctx.waitForEvent("page", { timeout: 10000 }).catch(() => {});
const popup = ctx.pages().find((p) => p.url().includes("popup.html"));
if (!popup) {
  console.log("POPUP TAB NOT FOUND; pages:", ctx.pages().map((p) => p.url()));
  await ctx.close();
  process.exit(1);
}
await popup.waitForTimeout(1200);

const view = await popup.evaluate(() => document.body.innerText.slice(0, 120));
console.log("popup view:", JSON.stringify(view));

// 3. Dismiss What's New if open, expand settings, dump engine selector facts.
if (await popup.locator(".cqd-changelog-overlay.open").count()) {
  await popup.locator(".cqd-cl-back").first().click().catch(() => {});
  await popup.waitForTimeout(400);
}
const head = popup.locator('[aria-controls="cqd-settings-body"]').first();
if (await head.count()) {
  if ((await head.getAttribute("aria-expanded")) === "false") await head.click();
  await popup.waitForTimeout(500);
}
const group = popup.locator(".cqd-engine-mode").first();
console.log("engine group present:", await group.count());
if (await group.count()) {
  await group.scrollIntoViewIfNeeded().catch(() => {});
  await popup.waitForTimeout(200);
  const facts = await popup.evaluate(() => {
    const g = document.querySelector(".cqd-engine-mode");
    const gs = getComputedStyle(g);
    const grp = g.getBoundingClientRect();
    const segs = [...g.querySelectorAll(".cqd-engine-mode-option")].map((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent.trim(),
        checked: el.getAttribute("aria-checked"),
        disabled: el.disabled,
        w: Math.round(r.width),
        h: Math.round(r.height),
        font: s.fontFamily.split(",")[0],
        size: s.fontSize,
        weight: s.fontWeight,
        color: s.color,
        bg: s.backgroundColor,
        radius: s.borderRadius,
        clipped: el.scrollWidth > el.clientWidth,
      };
    });
    return {
      group: {
        w: Math.round(grp.width),
        h: Math.round(grp.height),
        cols: gs.gridTemplateColumns,
        gap: gs.gap,
        pad: gs.padding,
        bg: gs.backgroundColor,
        radius: gs.borderRadius,
      },
      segs,
      viewport: document.documentElement.clientWidth,
    };
  });
  console.log(JSON.stringify(facts, null, 2));
  await popup.screenshot({ path: path.join(ROOT, "spike/spike-shots/engine-selector.png") });
  console.log("screenshot: spike/spike-shots/engine-selector.png");
}
await ctx.close();
