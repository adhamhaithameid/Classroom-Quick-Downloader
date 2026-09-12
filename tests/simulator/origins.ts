// filepath: tests/simulator/origins.ts
/**
 * ============================================================================
 * ORIGINS — pure response resolvers for the simulated Google origins
 * ============================================================================
 *
 * Shared by the local MITM proxy (the only network surface in a QA run).
 * Deterministic: same request + scenario → same bytes, every time.
 */

import type { Scenario, ByteKind, LinkSpec } from "./scenario";
import { linkHref } from "./scenario";

export interface DriveFile {
  id: string;
  filename: string;
  bytesKind: ByteKind;
}

export interface SimulatedResponse {
  status: number;
  contentType: string;
  headers?: Record<string, string>;
  body: string | Buffer;
  /**
   * Destroy the connection instead of answering. An HTTP error status would
   * still be downloaded by Chrome as a body; only a dead socket produces a
   * real NETWORK_FAILED interruption for the download manager.
   */
  resetSocket?: boolean;
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
    head: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("CQD deterministic simulator workbook\n", "utf8")]),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

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
  return Buffer.concat([head, Buffer.alloc(512, 0x41)]);
}

function virusScanInterstitial(file: DriveFile): SimulatedResponse {
  const next = `/uc?export=download&confirm=t&id=${encodeURIComponent(file.id)}`;
  return {
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: `<!doctype html>
<html><head><meta charset="utf-8"><title>Google Drive - Virus scan warning</title></head>
<body>
  <div>Google Drive can't scan this file for viruses.</div>
  <div class="uc-name-size"><a id="uc-download-link" href="${next}">${file.filename}</a> (1K)</div>
  <form action="${next}" method="get">
    <button id="uc-download-confirm" type="submit">Download anyway</button>
  </form>
  <a href="${next}">تنزيل على أي حال</a>
</body></html>`,
  };
}

function viewerPage(file: DriveFile, product: string): SimulatedResponse {
  return {
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: `<!doctype html>
<html><head><meta charset="utf-8"><title>${file.filename} - ${product}</title></head>
<body><div class="sim-viewer">Simulated ${product} viewer for ${file.filename}</div></body></html>`,
  };
}

function fileDownloadResponse(file: DriveFile): SimulatedResponse {
  const bytes = fileBytes(file);
  return {
    status: 200,
    contentType: MAGIC[file.bytesKind].contentType,
    headers: { "content-disposition": `attachment; filename="${file.filename}"` },
    body: bytes,
  };
}

const NOT_FOUND: SimulatedResponse = { status: 404, contentType: "text/plain", body: "simulator: unknown resource" };
const NO_CONTENT: SimulatedResponse = { status: 204, contentType: "text/plain", body: "" };
const INERT_PAGE: SimulatedResponse = {
  status: 200,
  contentType: "text/html; charset=utf-8",
  body: "<!doctype html><html><body>simulator: docs surface</body></html>",
};

/**
 * Resolve ANY request the browser makes during a QA run. Everything that is
 * not a simulated origin dies as 204 — the browser can never reach the real
 * internet through the proxy.
 */
export function resolveSimulatedResponse(
  rawUrl: string,
  context: { appDocument: string; files: Map<string, DriveFile> },
): SimulatedResponse {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return NO_CONTENT;
  }

  if (url.hostname === "classroom.google.com") {
    // Only documents matter to CQD; the simulator serves the SPA shell for
    // every Classroom path.
    return { status: 200, contentType: "text/html; charset=utf-8", body: context.appDocument };
  }

  if (url.hostname === "drive.google.com") {
    if (url.pathname === "/uc" && url.searchParams.get("export") === "download") {
      const id = url.searchParams.get("id") ?? "";
      // QA journeys prefix missing file ids with "missing" to exercise the
      // download-failure path (NETWORK_FAILED, not an HTTP error body).
      if (id.startsWith("missing")) return { ...NOT_FOUND, resetSocket: true };
      const file = context.files.get(id);
      return file ? fileDownloadResponse(file) : NOT_FOUND;
    }
    if (url.pathname === "/open") {
      const file = context.files.get(url.searchParams.get("id") ?? "");
      return file ? virusScanInterstitial(file) : NOT_FOUND;
    }
    return viewerPage({ id: "", filename: "unknown", bytesKind: "pdf" }, "Drive");
  }

  if (url.hostname === "docs.google.com") {
    const match = url.pathname.match(/^\/(?:document|presentation|drawings|spreadsheets)\/d\/([^/]+)/);
    if (!match) return INERT_PAGE;
    const file = context.files.get(match[1]);
    if (!file) return NOT_FOUND;
    if (url.pathname.endsWith("/export")) return fileDownloadResponse(file);
    return viewerPage(file, url.pathname.startsWith("/spreadsheets/") ? "Google Sheets" : "Google Docs");
  }

  return NO_CONTENT;
}

/** Re-exported for callers that need anchor URLs (kept for parity with old API). */
export { linkHref };
