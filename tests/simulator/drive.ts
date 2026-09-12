// filepath: tests/simulator/drive.ts
/**
 * ============================================================================
 * DRIVE SIMULATOR — deterministic Google Drive/Docs endpoints (Manual-QA Replay)
 * ============================================================================
 *
 * Serves real bytes with real headers so chrome.downloads genuinely runs and
 * Playwright surfaces real download events. No request ever leaves the
 * browser — everything is fulfilled by Playwright routing.
 */

import type { Route } from "@playwright/test";
import type { Scenario, ByteKind, LinkSpec } from "./scenario";

export interface DriveFile {
  id: string;
  filename: string;
  bytesKind: ByteKind;
}

const MAGIC: Record<ByteKind, { head: Buffer; contentType: string }> = {
  pdf: {
    head: Buffer.from("%PDF-1.4\n%CQD deterministic simulator document\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF", "utf8"),
    contentType: "application/pdf",
  },
  zip: {
    head: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("CQD deterministic simulator archive\n", "utf8")]),
    contentType: "application/zip",
  },
  xlsx: {
    // XLSX is a ZIP container — same PK magic, Office content type.
    head: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("CQD deterministic simulator workbook\n", "utf8")]),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

/** Collect every downloadable file id declared by the scenario. */
export function collectDriveFiles(scenario: Scenario): Map<string, DriveFile> {
  const files = new Map<string, DriveFile>();

  const visit = (link: LinkSpec) => {
    if ((link.kind === "drive" || link.kind === "docs" || link.kind === "sheets") && link.id) {
      const ext = link.bytes === "zip" ? "zip" : link.bytes === "xlsx" ? "xlsx" : "pdf";
      const fallbackName = link.name || `file-${link.id}.${ext}`;
      files.set(link.id, {
        id: link.id,
        filename: /\.[a-z0-9]{1,10}$/i.test(fallbackName) ? fallbackName : `${fallbackName}.${ext}`,
        bytesKind: link.bytes ?? "pdf",
      });
    }
  };

  for (const route of scenario.routes) {
    if (route.kind === "stream" || route.kind === "classwork") {
      for (const post of [...route.posts, ...(route.loadMorePosts ?? [])]) {
        post.attachments?.forEach(visit);
        post.looseLinks?.forEach(visit);
      }
    } else if (route.kind === "details") {
      route.details.attachments.forEach(visit);
      route.details.looseLinks?.forEach(visit);
    } else if (route.kind === "submissions") {
      for (const row of route.submissions.rows) row.attachments.forEach(visit);
    }
  }
  return files;
}

function fileBytes(file: DriveFile): Buffer {
  const { head } = MAGIC[file.bytesKind];
  // Pad so the payload is a realistic small download (keeps sizes stable).
  return Buffer.concat([head, Buffer.alloc(512, 0x41)]);
}

/**
 * The fake virus-scan interstitial: the same contract the real Drive page
 * offers the CQD bypass script (#uc-download-link, a confirm= form, and the
 * "Download anyway" wording in English and Arabic).
 */
function virusScanInterstitial(file: DriveFile): string {
  const next = `/uc?export=download&confirm=t&id=${encodeURIComponent(file.id)}`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Google Drive - Virus scan warning</title></head>
<body>
  <div>Google Drive can't scan this file for viruses.</div>
  <div class="uc-name-size"><a id="uc-download-link" href="${next}">${file.filename}</a> (1K)</div>
  <form action="${next}" method="get">
    <button id="uc-download-confirm" type="submit">Download anyway</button>
  </form>
  <a href="${next}">تنزيل على أي حال</a>
</body></html>`;
}

function spreadsheetsViewer(file: DriveFile): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${file.filename} - Google Sheets</title></head>
<body><div class="sim-viewer">Simulated Sheets viewer for ${file.filename}</div></body></html>`;
}

function notFound(): string {
  return "<!doctype html><html><body>simulator: unknown drive resource</body></html>";
}

/** Handler for https://drive.google.com/** — downloads, open interstitials. */
export async function handleDriveRoute(route: Route, files: Map<string, DriveFile>): Promise<void> {
  const url = new URL(route.request().url());

  if (url.pathname === "/uc" && url.searchParams.get("export") === "download") {
    const file = files.get(url.searchParams.get("id") ?? "");
    if (!file) {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "simulator: unknown file id" });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": MAGIC[file.bytesKind].contentType,
        "content-disposition": `attachment; filename="${file.filename}"`,
        "content-length": String(fileBytes(file).length),
      },
      body: fileBytes(file).toString("binary"),
    });
    return;
  }

  if (url.pathname === "/open") {
    const file = files.get(url.searchParams.get("id") ?? "");
    if (!file) {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "simulator: unknown file id" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: virusScanInterstitial(file) });
    return;
  }

  await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: notFound() });
}

/** Handler for https://docs.google.com/** — editor viewers and /export bytes. */
export async function handleDocsRoute(route: Route, files: Map<string, DriveFile>): Promise<void> {
  const url = new URL(route.request().url());
  const match = url.pathname.match(/^\/(?:document|presentation|drawings|spreadsheets)\/d\/([^/]+)/);

  if (!match) {
    // Forms and anything else: serve an inert page.
    await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><html><body>simulator: docs surface</body></html>" });
    return;
  }

  const file = files.get(match[1]);
  if (!file) {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "simulator: unknown file id" });
    return;
  }

  if (url.pathname.endsWith("/export")) {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": MAGIC[file.bytesKind].contentType,
        "content-disposition": `attachment; filename="${file.filename}"`,
      },
      body: fileBytes(file).toString("binary"),
    });
    return;
  }

  // Editor links: spreadsheets get a viewer page; documents too.
  await route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: url.pathname.startsWith("/spreadsheets/") ? spreadsheetsViewer(file) : spreadsheetsViewer(file),
  });
}
