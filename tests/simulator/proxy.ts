// filepath: tests/simulator/proxy.ts
/**
 * ============================================================================
 * PROXY — the simulator's real network surface (Manual-QA Replay)
 * ============================================================================
 *
 * Playwright route interception cannot feed Chromium's download manager, so
 * `chrome.downloads` requests never reach route.fulfill handlers. The fix is
 * a real local HTTPS MITM proxy: the browser is launched with
 * `proxy: { server: <this proxy> }` + `ignoreHTTPSErrors`, and every request
 * — including the download manager's — flows through here.
 *
 * TLS: a committed test-only CA/server cert (tests/simulator/certs) with SANs
 * for the simulated origins. The private key protects nothing — it exists so
 * the QA run is deterministic and offline. Connections to any other host die
 * immediately: the browser can never reach the real internet through this
 * proxy.
 */

import http from "node:http";
import tls from "node:tls";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import type { Scenario } from "./scenario";
import { collectDriveFiles, resolveSimulatedResponse, type SimulatedResponse } from "./origins";
import { buildAppDocument } from "./app";

const CERTS_DIR = path.resolve(__dirname, "certs");
const SIMULATED_HOSTS = new Set([
  "classroom.google.com",
  "drive.google.com",
  "drive.usercontent.google.com",
  "docs.google.com",
]);

export interface ServedDownload {
  url: string;
  filename: string;
}

export interface SimulatorProxy {
  url: string;
  close: () => Promise<void>;
}

function writeResponse(socket: net.Socket, response: SimulatedResponse): void {
  if (response.resetSocket) {
    socket.destroy();
    return;
  }
  const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body, "utf8");
  const statusText =
    response.status === 200
      ? "OK"
      : response.status === 204
        ? "No Content"
        : response.status === 302
          ? "Found"
          : response.status === 404
            ? "Not Found"
            : response.status === 503
              ? "Service Unavailable"
              : "OK";
  const headers = [
    `HTTP/1.1 ${response.status} ${statusText}`,
    `content-type: ${response.contentType}`,
    ...(response.headers ? Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`) : []),
    "content-length: " + body.length,
    "connection: close",
  ];
  socket.write(headers.join("\r\n") + "\r\n\r\n");
  if (response.destroyAfterSend) {
    // Real-world shape: response headers arrive, the body starts, and the
    // connection dies mid-stream — the download manager reports an interrupt
    // for an already-started download.
    socket.write(body);
    socket.destroy();
    return;
  }
  if (response.slowChunks && response.slowChunks.parts > 1) {
    // Real-world shape: a slow trickle — body arrives in chunks with delays,
    // exercising stall handling and progress patience.
    const parts = response.slowChunks.parts;
    const delayMs = response.slowChunks.delayMs;
    const size = Math.ceil(body.length / parts);
    let sent = 0;
    const sendNext = () => {
      if (socket.destroyed) return;
      const slice = body.subarray(sent * size, Math.min((sent + 1) * size, body.length));
      socket.write(slice);
      sent += 1;
      if (sent < parts) setTimeout(sendNext, delayMs);
      else socket.end();
    };
    sendNext();
    return;
  }
  socket.end(body);
}

/**
 * Serve one TLS side of a CONNECT tunnel. Requests arrive over the decrypted
 * socket; each connection is closed after its first response (connection:
 * close) — deterministic and plenty fast for a local proxy.
 */
function serveMitmSocket(clientSocket: net.Socket, firstChunk: Buffer, resolve: (url: string) => SimulatedResponse): void {
  const tlsSocket = new tls.TLSSocket(clientSocket, {
    isServer: true,
    key: fs.readFileSync(path.join(CERTS_DIR, "server.key")),
    cert: fs.readFileSync(path.join(CERTS_DIR, "server.crt")),
  });

  let buffer = Buffer.alloc(0);
  let answered = false;

  const onData = (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (answered) return;
    const end = buffer.indexOf("\r\n\r\n");
    if (end === -1) return;
    const head = buffer.subarray(0, end).toString("utf8");
    const requestLine = head.split("\r\n")[0];
    const hostLine = head.split("\r\n").find((l) => l.toLowerCase().startsWith("host:"));
    const host = hostLine?.slice(5).trim() ?? "";
    const target = requestLine.split(" ")[1] ?? "/";
    const url = target.startsWith("http") ? target : `https://${host}${target}`;
    answered = true;
    writeResponse(tlsSocket, resolve(url));
  };

  tlsSocket.on("data", onData);
  tlsSocket.on("error", () => clientSocket.destroy());
  if (firstChunk && firstChunk.length > 0) onData(firstChunk);
}

/**
 * Start the MITM proxy for a scenario. Pass the returned URL to Playwright's
 * `proxy: { server }` launch option together with `ignoreHTTPSErrors: true`.
 */
export async function startSimulatorProxy(scenario: Scenario): Promise<SimulatorProxy> {
  const appDocument = buildAppDocument(scenario);
  const files = collectDriveFiles(scenario);
  const servedDownloads: ServedDownload[] = [];
  const resolve = (url: string) => {
    const response = resolveSimulatedResponse(url, { appDocument, files });
    if (url.includes("export=download")) {
      const disposition = response.headers?.["content-disposition"] ?? "";
      servedDownloads.push({
        url,
        filename: disposition.match(/filename="([^"]+)"/)?.[1] ?? "",
      });
    }
    return response;
  };

  const server = http.createServer((req, res) => {
    // Plain HTTP: nothing simulated lives here — die politely.
    res.writeHead(204);
    res.end();
  });

  server.on("connect", (req, clientSocket, head) => {
    const host = (req.url ?? "").split(":")[0];
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");

    if (!SIMULATED_HOSTS.has(host)) {
      // Drain and die: the browser must not reach the real internet.
      clientSocket.destroy();
      return;
    }

    serveMitmSocket(clientSocket, Buffer.from(head), resolve);
  });

  server.on("clientError", (_err, socket) => {
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
  });

  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address() as net.AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    servedDownloads,
    close: async () => {
      // Chromium holds proxy sockets in its pool; force-close them, then stop
      // listening. Bounded so a wedged socket cannot hang the test run.
      server.closeAllConnections?.();
      server.close();
      await new Promise<void>((resolveClose) => {
        const t = setTimeout(() => resolveClose(), 2000);
        server.close(() => {
          clearTimeout(t);
          resolveClose();
        });
      });
    },
  };
}
