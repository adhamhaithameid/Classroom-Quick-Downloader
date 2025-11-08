// Classroom Quick Downloader — dynamic blue pill with inline SVG icons (CSP-proof),
// smart de-duplication, and auto-repositioning so it's always visible.

/* ===================== CONFIG ===================== */
const BTN = "cqd-btn";          // pill button
const BTN_WRAP = "cqd-wrap";    // inline wrapper next to filename
const ROW = "cqd-row";          // fallback row below tight containers
const SIZE_DEFAULT = "md";      // "sm" | "md" | "lg"
const ICON_PX_BY_SIZE = { sm: 16, md: 20, lg: 28 }; // CSS pixels for SVG

/* ===================== BOOT ===================== */
const injectedByRoot = new WeakMap(); // de-dupe: Set<fileId> per “post/card” root

init();

function init() {
  injectStyles();

  // Multiple passes to beat SPA races
  runAll(document);
  requestIdleCallback(() => runAll(document), { timeout: 1500 });
  setTimeout(() => runAll(document), 800);

  // Observe DOM updates
  const mo = new MutationObserver(() => runAll(document));
  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });

  // React to navigation changes
  hookLocationChanges(() => runAll(document));
  window.addEventListener("popstate", () => runAll(document));
  window.addEventListener("hashchange", () => runAll(document));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) runAll(document); });

  // Keep-alive (cheap)
  setInterval(() => {
    if (!document.getElementById("cqd-style")) injectStyles();
    runAll(document);
  }, 2000);
}

/* ===================== MAIN PASS ===================== */
function runAll(root) {
  try { processListContext(root); } catch {}
}

/* =============== LIST VIEW (outside the file) =============== */
/** Attach one pill per Drive file per post/card root.
 *  Prefer the filename link (skip thumbnail-only links). */
function processListContext(root) {
  const candidates = root.querySelectorAll(
    'a:not([data-cqd-scanned="1"]), [role="link"]:not([data-cqd-scanned="1"])'
  );

  for (const el of candidates) {
    if (!el.isConnected) continue;

    if (isImageOnlyLink(el)) continue; // we prefer the text filename link

    const fileId =
      getFileIdFromElement(el) ||
      extractDriveFileId(el.getAttribute && el.getAttribute("href"));

    if (!fileId) continue;

    const card = findPostRoot(el);
    if (!card) continue;

    // Per-card de-dupe for this fileId
    if (card.querySelector(`.${BTN_WRAP}[data-cqd-file-id="${fileId}"]`) ||
        card.querySelector(`.${ROW}[data-cqd-file-id="${fileId}"]`)) {
      el.setAttribute("data-cqd-scanned", "1");
      continue;
    }
    let set = injectedByRoot.get(card);
    if (!set) { set = new Set(); injectedByRoot.set(card, set); }
    if (set.has(fileId)) { el.setAttribute("data-cqd-scanned", "1"); continue; }

    // Build pill + inline insertion
    const wrap = document.createElement("span");
    wrap.className = BTN_WRAP;
    wrap.dataset.cqdFileId = fileId;
    wrap.style.display = "inline-flex";
    wrap.style.verticalAlign = "middle";
    wrap.style.marginLeft = "8px";
    wrap.style.flexShrink = "0";

    const btn = createDownloadButton(buildDownloadUrl(fileId), SIZE_DEFAULT);
    wrap.appendChild(btn);

    el.insertAdjacentElement("afterend", wrap);

    // Ensure the pill stays visible in tight rows (“Your work”)
    ensureVisiblePlacement({ linkEl: el, wrap, card, fileId });

    set.add(fileId);
    el.setAttribute("data-cqd-scanned", "1");
  }
}

/* =============== BUTTON FACTORY (inline SVG) =============== */
function createDownloadButton(downloadUrl, size = "md") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `${BTN} ${BTN}--${size}`;

  // Inline SVG icon (CSP-proof). Size chosen by pill size.
  const px = ICON_PX_BY_SIZE[size] || ICON_PX_BY_SIZE.md;
  const svg = (window.CQD_ICONS && window.CQD_ICONS.createDownloadIcon)
    ? window.CQD_ICONS.createDownloadIcon(px)
    : fallbackSvg(px);
  btn.appendChild(svg);

  const label = document.createElement("span");
  label.className = "cqd-label";
  label.textContent = "Download";

  btn.appendChild(label);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerDownload(downloadUrl);
  });

  return btn;
}

// If for some reason icons.js didn’t load, we still draw a simple fallback icon.
function fallbackSvg(size) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.style.fill = "currentColor";
  svg.style.display = "inline-block";
  svg.style.verticalAlign = "middle";
  const p1 = document.createElementNS(ns, "path");
  p1.setAttribute("d", "M5 20h14v-2H5v2z");
  const p2 = document.createElementNS(ns, "path");
  p2.setAttribute("d", "M12 4a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42l2.3 2.3V5a1 1 0 0 1 1-1z");
  svg.append(p1, p2);
  return svg;
}

/* =============== DYNAMIC VISIBILITY / REPOSITIONING =============== */
function ensureVisiblePlacement({ linkEl, wrap, card, fileId }) {
  const container = linkEl.parentElement || linkEl;
  const blockBelow = findBlockRow(linkEl);

  const ro = new ResizeObserver(check);
  ro.observe(container);
  window.addEventListener("resize", check);
  setTimeout(check, 0);
  setTimeout(check, 250);

  function isClipped() {
    const btnRect = wrap.getBoundingClientRect();
    const parRect = container.getBoundingClientRect?.() || { left: 0, right: 1e9, width: 1e9 };
    if (btnRect.width < 8 || btnRect.height < 8) return true;

    const cs = getComputedStyle(container);
    const noWrap = cs.whiteSpace === "nowrap" || (cs.display.includes("flex") && cs.flexWrap === "nowrap");
    const hidesOverflow = cs.overflowX === "hidden" || cs.overflow === "hidden";

    if ((noWrap || hidesOverflow) && btnRect.right > parRect.right - 2) return true;
    return false;
  }

  function moveToRow() {
    if (wrap.closest(`.${ROW}`)) return;
    const row = document.createElement("div");
    row.className = ROW;
    row.dataset.cqdFileId = fileId;
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.style.margin = "6px 0 0 0";
    row.appendChild(wrap);
    (blockBelow || container).insertAdjacentElement("afterend", row);
  }

  function moveInline() {
    if (!wrap.closest(`.${ROW}`)) return;
    linkEl.insertAdjacentElement("afterend", wrap);
    const orphanRow = linkEl.nextElementSibling?.nextElementSibling;
    if (orphanRow && orphanRow.classList?.contains(ROW) && orphanRow.children.length === 0) {
      orphanRow.remove();
    }
  }

  function check() {
    try { isClipped() ? moveToRow() : moveInline(); } catch {}
  }
}

/* =============== DOWNLOAD + ID HELPERS =============== */
function triggerDownload(downloadUrl) {
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function buildDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function extractDriveFileId(url) {
  if (!url) return null;
  try {
    const m1 = url.match(/\/d\/([A-Za-z0-9_-]{20,})/);
    if (m1 && m1[1]) return m1[1];
    const u = new URL(url, location.href);
    const idParam = u.searchParams.get("id");
    if (idParam && /[A-Za-z0-9_-]{20,}/.test(idParam)) return idParam;
    const idLike = (url.match(/[?&]id=([A-Za-z0-9_-]{20,})/) || [])[1];
    if (idLike) return idLike;
  } catch {}
  return null;
}

function getFileIdFromElement(el) {
  if (!el) return null;

  const href = el.getAttribute?.("href");
  const fromHref = extractDriveFileId(href || "");
  if (fromHref) return fromHref;

  if (el.attributes) {
    for (const attr of el.attributes) {
      const val = attr.value || "";
      if (!val) continue;

      const embedD = val.match(/\/d\/([A-Za-z0-9_-]{20,})/);
      if (embedD && embedD[1]) return embedD[1];

      const embedQ = (val.match(/[?&]id=([A-Za-z0-9_-]{20,})/) || [])[1];
      if (embedQ) return embedQ;

      const jsonId = (val.match(/"id"\s*:\s*"([A-Za-z0-9_-]{20,})"/) || [])[1];
      if (jsonId) return jsonId;

      if (attr.name.toLowerCase().includes("id")) {
        const direct = (val.match(/[A-Za-z0-9_-]{20,}/) || [])[0];
        if (direct) return direct;
      }
    }
  }

  const a = el.querySelector?.("a[href]");
  if (a) return extractDriveFileId(a.getAttribute("href") || "");

  return null;
}

/* =============== HEURISTICS & HELPERS =============== */
function isImageOnlyLink(el) {
  const hasImg = !!el.querySelector?.("img, svg");
  const txt = (el.textContent || "").trim();
  return hasImg && txt.length < 3;
}

function findPostRoot(el) {
  return (
    el.closest('article') ||
    el.closest('c-wiz') ||
    el.closest('[role="listitem"]') ||
    el.closest('[data-stream-item], [jscontroller], [data-item-id]') ||
    el.closest('section') ||
    document.body
  );
}

function findBlockRow(el) {
  return (
    el.closest('[role="listitem"]') ||
    el.closest('[class*="row"], [class*="Row"]') ||
    el.closest('div')
  );
}

/* =============== STYLES =============== */
function injectStyles() {
  if (document.getElementById("cqd-style")) return;
  const style = document.createElement("style");
  style.id = "cqd-style";
  style.textContent = `
    .${BTN} {
      --cqd-bg: #1a73e8;          /* Google Blue 600 */
      --cqd-bg-hover: #1765cc;
      --cqd-text: #ffffff;
      --cqd-shadow: 0 1px 2px rgba(0,0,0,0.20);
      --cqd-shadow-hover: 0 3px 6px rgba(0,0,0,0.22);

      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--cqd-bg);
      color: var(--cqd-text);
      border: none;
      border-radius: 9999px; /* pill */
      padding: 6px 12px;
      font-size: 13px;
      line-height: 1.4;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: var(--cqd-shadow);
      transition: box-shadow 140ms ease, background 140ms ease, transform 40ms ease;
      flex: 0 0 auto;
    }
    .${BTN}:hover { background: var(--cqd-bg-hover); box-shadow: var(--cqd-shadow-hover); }
    .${BTN}:active { transform: translateY(0.5px); }
    .${BTN}:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(26,115,232,0.35); }

    .${BTN} .cqd-label { letter-spacing: .2px; }

    /* Fallback row (below tight containers) */
    .${ROW} { width: 100%; }
  `;
  document.head.appendChild(style);
}

/* =============== SPA ROUTE HOOK =============== */
function hookLocationChanges(onChange) {
  const fire = () => { try { onChange(); } catch {} };
  const push = history.pushState;
  const replace = history.replaceState;

  history.pushState = function() {
    const ret = push.apply(this, arguments);
    fire();
    return ret;
  };
  history.replaceState = function() {
    const ret = replace.apply(this, arguments);
    fire();
    return ret;
  };
}
