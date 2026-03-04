// filepath: cloudflare-worker/src/dashboard/login.ts
/**
 * Login page rendering.
 */

import { FAVICON_PNG_DATA_URI } from "../assets";
import { LOGIN_STYLES } from "./styles";

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderLoginPage(errorMessage?: string): string {
  const safeError = errorMessage ? escapeHtml(errorMessage) : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CQD Analytics – Admin Login</title>
  <link rel="icon" href="${FAVICON_PNG_DATA_URI}">
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>${LOGIN_STYLES}</style>
</head>
<body>
  <form class="login-card" method="POST" action="/">
    <div class="login-badge"><span class="login-badge-dot"></span><span>CQD Analytics Admin</span></div>
    <h1 class="login-title">Enter admin password</h1>
    <p class="login-subtitle">Allowlisted IPs use the normal password. If blocked-IP step-up is enabled, blocked IPs can use the admin danger password in the same field.</p>
    
    <div class="login-row">
      <div class="field">
        <input id="password-input" name="password" type="password" placeholder="Password..." autofocus required />
      </div>
      <button class="login-button" type="submit">Unlock →</button>
    </div>
    ${safeError ? `<div class="login-error">${safeError}</div>` : ""}
  </form>
  <script>document.getElementById("password-input")?.focus();</script>
</body>
</html>`;
}
