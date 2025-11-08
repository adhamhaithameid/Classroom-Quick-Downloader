// content.js

// ====== CONFIG ======
const BUTTON_CLASS = "classroom-quick-download-btn";
const BUTTON_LABEL = "Download";

// Run ASAP
init();

function init() {
  // Inject base styles once
  injectButtonStyles();

  // First pass on current DOM
  processDriveLinks(document);

  // Observe for future nodes (SPA changes)
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList" && (m.addedNodes?.length || m.removedNodes?.length)) {
        processDriveLinks(document);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Find all Drive links inside Classroom UI and attach buttons if not present.
 */
function processDriveLinks(root) {
  // Google Classroom uses different layouts for attachments; generally links are <a>
  // This finds: <a href="https://drive.google.com/...">
  const links = root.querySelectorAll('a[href*="drive.google.com"]:not(.' + BUTTON_CLASS + ')');

  links.forEach((link) => {
    // Some links are icons/thumbnails, some are text
    const driveUrl = link.getAttribute("href");
    if (!driveUrl) return;

    const fileId = extractDriveFileId(driveUrl);
    if (!fileId) return;

    // Make sure we haven't already placed a button near this link
    const alreadyHasBtn =
      link.parentElement &&
      link.parentElement.querySelector("." + BUTTON_CLASS);
    if (alreadyHasBtn) return;

    const downloadUrl = buildDownloadUrl(fileId);
    const btn = createDownloadButton(downloadUrl);

    // Try to put the button next to the link (Classroom usually uses flex rows)
    // Priority: parent → link after → fallback append
    if (link.parentElement) {
      // If the parent is inline-like, just append
      link.parentElement.style.display = link.parentElement.style.display || "flex";
      link.parentElement.style.alignItems = "center";
      link.parentElement.appendChild(btn);
    } else {
      // worst case: put after link
      link.insertAdjacentElement("afterend", btn);
    }
  });
}

/**
 * Extracts Drive file ID from several common URL patterns.
 * Supports:
 *  - https://drive.google.com/file/d/FILE_ID/view?...
 *  - https://drive.google.com/open?id=FILE_ID
 *  - https://drive.google.com/uc?id=FILE_ID&export=download
 *  - Anything containing `/d/FILE_ID/`
 */
function extractDriveFileId(url) {
  try {
    // 1) /file/d/FILE_ID/
    const fileDlRe = /\/d\/([a-zA-Z0-9_-]+)/;
    const m1 = url.match(fileDlRe);
    if (m1 && m1[1]) return m1[1];

    // 2) ?id=FILE_ID
    const u = new URL(url);
    const idParam = u.searchParams.get("id");
    if (idParam) return idParam;

    // 3) sometimes Classroom gives share URLs like .../uc?export=view&id=...
    const altId = u.searchParams.get("file_id");
    if (altId) return altId;

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Build direct download URL
 */
function buildDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Create the actual button element
 */
function createDownloadButton(downloadUrl) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BUTTON_CLASS;
  btn.innerHTML = `
    <span class="cqd-icon" aria-hidden="true">
      ${getDownloadSvg()}
    </span>
    <span class="cqd-label">${BUTTON_LABEL}</span>
  `;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerDownload(downloadUrl);
  });

  return btn;
}

/**
 * Try to trigger a download in the simplest way.
 * If this ever fails for some classroom-specific resource,
 * you can swap to fetchDownload(downloadUrl);
 */
function triggerDownload(downloadUrl) {
  // Technique 1: hidden <a download>
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.target = "_blank"; // sometimes needed for Drive
  a.rel = "noopener";
  // We *could* set a.download = '' but for Drive this is not always honored
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * If you encounter files that need authenticated fetch, use this instead.
 * Kept here for future expansion.
 */
/*
async function fetchDownload(downloadUrl) {
  try {
    const res = await fetch(downloadUrl, { credentials: "include" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "file"; // we don't know name, could be improved
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("[Classroom Quick Downloader] fetch download failed:", err);
    window.open(downloadUrl, "_blank");
  }
}
*/

/**
 * Inject styles for our button so it looks like a lightweight Material button.
 */
function injectButtonStyles() {
  if (document.getElementById("cqd-style")) return;
  const style = document.createElement("style");
  style.id = "cqd-style";
  style.textContent = `
    .${BUTTON_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #fff;
      color: #1967d2; /* Google Classroom-ish blue */
      border: 1px solid rgba(25, 103, 210, 0.2);
      border-radius: 6px;
      padding: 4px 10px 4px 8px;
      font-size: 0.78rem;
      line-height: 1.4;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,0.15);
      transition: background 0.15s ease, box-shadow 0.15s ease;
      white-space: nowrap;
    }
    .${BUTTON_CLASS}:hover {
      background: rgba(25, 103, 210, 0.06);
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }
    .${BUTTON_CLASS} .cqd-icon {
      display: flex;
      width: 16px;
      height: 16px;
    }
    .${BUTTON_CLASS} svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Simple inline SVG for "download"
 */
function getDownloadSvg() {
  // Material-like download icon
  return `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M5 20h14v-2H5v2zm7-18-5.5 5.5 1.42 1.42L11 7.83V16h2V7.83l3.08 3.09 1.42-1.42L12 2z"></path>
    </svg>
  `;
}
