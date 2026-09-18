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
  /**
   * Send headers + body, then destroy the socket WITHOUT a clean close —
   * models a connection dying mid-stream on an already-started download.
   */
  destroyAfterSend?: boolean;
  /**
   * Trickle the body in `parts` chunks `delayMs` apart — models a slow
   * stream and exercises stall handling.
   */
  slowChunks?: { parts: number; delayMs: number };
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
/**
 * Forbidden modeling: ids prefixed "forbidden" 403 for EVERY signed-in
 * account — the extension's account-cycling sweep runs its full bound and
 * settles on the honest all-accounts-denied terminal (qa-02's all-failed
 * group). Plain HTTP error body, deliberately NO resetSocket: the browser
 * downloads the HTML, the filename interceptor cancels, and the failure
 * resolves in seconds instead of Chromium's long dead-socket retry window.
 * The body is padded to several MB so the download is still IN PROGRESS when
 * the filename interception fires — a tiny body could complete before the
 * cancel lands and flip the file to a false success.
 */
const FORBIDDEN_BODY =
  '<!doctype html><html><head><title>403 Access Forbidden</title></head><body>403. That\'s an error. You do not have access.' +
  'x'.repeat(5 * 1024 * 1024) +
  '</body></html>';
const FORBIDDEN: SimulatedResponse = {
  status: 403,
  contentType: "text/html; charset=utf-8",
  body: FORBIDDEN_BODY,
};
const INERT_PAGE: SimulatedResponse = {
  status: 200,
  contentType: "text/html; charset=utf-8",
  body: "<!doctype html><html><body>simulator: docs surface</body></html>",
};

/** Adversarial failure vocabulary (no-dead-ends program): every shape models a
 *  real-world Drive/download failure the engine must classify honestly. */
function failureResponse(id: string): SimulatedResponse | null {
  if (id.startsWith("srvfail")) {
    // Transient server error: 503 — the engine should retry, then settle.
    return { status: 503, contentType: "text/plain", body: "simulator: backend error" };
  }
  if (id.startsWith("signin")) {
    // Drive bounces unauthenticated downloads to the sign-in flow.
    return {
      status: 302,
      contentType: "text/html; charset=utf-8",
      headers: { location: "https://accounts.google.com/SignIn?continue=https://drive.usercontent.google.com/download" },
      body: "",
    };
  }
  if (id.startsWith("resetmid")) {
    // Headers arrive, bytes start, connection dies mid-stream.
    return {
      status: 200,
      contentType: "application/pdf",
      headers: { "content-disposition": `attachment; filename="${id}.pdf"` },
      body: Buffer.concat([MAGIC.pdf.head, Buffer.alloc(64 * 1024, 0x41)]),
      destroyAfterSend: true,
    };
  }
  if (id.startsWith("slow")) {
    // A slow trickle: 1 MB over 8 chunks, 400 ms apart (~2.8s total).
    return {
      status: 200,
      contentType: "application/pdf",
      headers: { "content-disposition": `attachment; filename="${id}.pdf"` },
      body: Buffer.concat([MAGIC.pdf.head, Buffer.alloc(1024 * 1024, 0x42)]),
      slowChunks: { parts: 8, delayMs: 400 },
    };
  }
  if (id.startsWith("zerobyte")) {
    // Completes successfully with an EMPTY file — a silent-corruption shape.
    return {
      status: 200,
      contentType: "application/pdf",
      headers: { "content-disposition": `attachment; filename="${id}.pdf"` },
      body: Buffer.alloc(0),
    };
  }
  if (id.startsWith("quota")) {
    // Drive's quota/usage-limit page arrives as HTML — must be intercepted,
    // never saved as a fake .html "download".
    return {
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: '<!doctype html><html><head><title>Quota exceeded</title></head><body>usageLimits — you have exceeded your download quota. Try again later.</body></html>',
    };
  }
  return null;
}

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
      if (id.startsWith("forbidden")) return FORBIDDEN;
      const ucFailure = failureResponse(id);
      if (ucFailure) return ucFailure;
      const file = context.files.get(id);
      return file ? fileDownloadResponse(file) : NOT_FOUND;
    }
    if (url.pathname === "/open") {
      const file = context.files.get(url.searchParams.get("id") ?? "");
      return file ? virusScanInterstitial(file) : NOT_FOUND;
    }
    return viewerPage({ id: "", filename: "unknown", bytesKind: "pdf" }, "Drive");
  }

  if (url.hostname === "drive.usercontent.google.com") {
    // The byte-serving endpoint the extension now targets directly — the
    // destination Drive's interstitial "Download anyway" link lands on.
    if (url.pathname === "/download" && url.searchParams.get("export") === "download") {
      const id = url.searchParams.get("id") ?? "";
      if (id.startsWith("missing")) return { ...NOT_FOUND, resetSocket: true };
      // Forbidden modeling: 403 for every account, so the sweep runs to its
      // AUTH_ALL_FAILED terminal (qa-02's all-failed group). No resetSocket.
      if (id.startsWith("forbidden")) return FORBIDDEN;
      // Auth-locked modeling: ids prefixed "authlocked" 403 unless the attempt
      // carries authuser=1 (the account that holds access). This exercises the
      // extension's account-cycling sweep end-to-end: forbidden interrupts on
      // the default-account attempts, bytes once the sweep reaches authuser=1.
      if (id.startsWith("authlocked") && url.searchParams.get("authuser") !== "1") {
        return {
          status: 403,
          contentType: "text/html; charset=utf-8",
          body: '<!doctype html><html><head><title>403 Access Forbidden</title></head><body>403. That\'s an error. You do not have access.</body></html>',
        };
      }
      const failure = failureResponse(id);
      if (failure) return failure;
      const file = context.files.get(id);
      return file ? fileDownloadResponse(file) : NOT_FOUND;
    }
    return NOT_FOUND;
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
