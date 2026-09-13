// filepath: tests/simulator/certs/generate.mjs
/**
 * Regenerate the simulator's MITM server certificate (signed by the repo's
 * test-only CA) with the full origin SAN list. Run whenever a simulated host
 * is added, e.g.:
 *
 *   node tests/simulator/certs/generate.mjs
 *
 * The Chromium download manager verifies certificates OUTSIDE Playwright's
 * ignoreHTTPSErrors reach, so every simulated host must appear in these SANs.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const SAN_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "classroom.google.com",
  "drive.usercontent.google.com",
  "localhost",
];

const san = SAN_HOSTS.map((h) => `DNS:${h}`).join(",") + ",IP:127.0.0.1";
const key = path.join(dir, "server.key");
const csr = path.join(dir, "server.csr");
const ext = path.join(dir, "server.ext");
const crt = path.join(dir, "server.crt");
const caKey = path.join(dir, "ca.key");
const caCrt = path.join(dir, "ca.crt");

fs.writeFileSync(ext, `subjectAltName=${san}\n`);

execFileSync(
  "openssl",
  [
    "req", "-new", "-newkey", "rsa:2048", "-nodes",
    "-keyout", key, "-out", csr,
    "-subj", "/CN=drive.google.com",
  ],
  { stdio: "inherit" },
);
execFileSync(
  "openssl",
  [
    "x509", "-req", "-in", csr,
    "-CA", caCrt, "-CAkey", caKey, "-CAcreateserial",
    "-out", crt, "-days", "3650",
    "-extfile", ext,
  ],
  { stdio: "inherit" },
);
fs.rmSync(csr);
fs.rmSync(ext);
console.log(`server certificate regenerated with SANs: ${san}`);
