#!/usr/bin/env node
// One-time CWS refresh-token minter (local only — never commit).
// Loopback OAuth flow: opens Google consent in the user's Chrome, catches
// the redirect on 127.0.0.1, exchanges the code (PKCE), prints the token.
import http from "node:http";
import crypto from "node:crypto";
import { exec } from "node:child_process";

// Desktop-type OAuth client (loopback redirect allowed). The extension's
// manifest client is a web client and rejects loopback with 400 invalid_request.
const CLIENT_ID = process.env.CWS_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.CWS_CLIENT_SECRET ?? "";
if (!CLIENT_ID) {
  console.error("Usage: CWS_CLIENT_ID=<desktop-client-id> [CWS_CLIENT_SECRET=<secret>] node mint-refresh-token.mjs");
  process.exit(1);
}
console.log(`using client: ${CLIENT_ID}`);
const PORT = 46371;
const REDIRECT = `http://127.0.0.1:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";

const verifier = crypto.randomBytes(48).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

const authUrl =
  "https://accounts.google.com/o/oauth2/auth" +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  "&response_type=code" +
  `&scope=${encodeURIComponent(SCOPE)}` +
  "&access_type=offline" +
  "&prompt=consent" +
  `&code_challenge=${challenge}` +
  "&code_challenge_method=S256";

const server = http.createServer((req, res) => {
  const url = new URL(req.url, REDIRECT);
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("no code");
    return;
  }
  res.writeHead(200, { "content-type": "text/html" });
  res.end("<h1>Consent received — you can close this tab.</h1>");

  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
    code_verifier: verifier,
    ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
  });
  fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
    .then((r) => r.json())
    .then((tok) => {
      console.log("TOKEN_RESPONSE:" + JSON.stringify(tok));
      server.close();
      process.exit(0);
    })
    .catch((e) => {
      console.error("exchange failed", e);
      process.exit(1);
    });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`listening on ${REDIRECT}`);
  exec(`open -a "Google Chrome" "${authUrl}"`);
});
