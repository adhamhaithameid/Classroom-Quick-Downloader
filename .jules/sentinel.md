## 2026-02-15 - Embedded Dashboard Script Security
**Vulnerability:** Dynamic HTML generation using `innerHTML` within client-side scripts that are embedded as string literals in server-side TypeScript code (`cloudflare-worker/src/dashboard/main.ts`).
**Learning:** The architecture delivers the entire dashboard as a single HTML string from a Cloudflare Worker. This necessitates embedding client-side logic as strings, bypassing standard linter checks for XSS sinks like `innerHTML` in the client code because they are just TS string literals to the compiler.
**Prevention:** When delivering "single-file" apps via string interpolation, manually review embedded JavaScript for DOM sinks. Prefer `document.createElement` APIs which are verbose but structurally safe, especially since we lack a build step for this embedded client code that would strip/sanitize inputs automatically.

## 2026-02-14 - Timing Attack in Authentication
**Vulnerability:** The login handler and danger password verification used standard string comparison (`===`) for passwords. This exposes the application to timing attacks where an attacker can infer the password length or content by measuring the time it takes for the comparison to fail.
**Learning:** Even with a dedicated `timingSafeStringEqual` utility present in the codebase, it wasn't being used in all authentication paths. This highlights the importance of auditing all secret comparisons, not just those in "crypto" modules.
**Prevention:** Always use `timingSafeStringEqual` or `crypto.subtle` for comparing secrets, passwords, or hashes. Ensure strict code review or linting rules (if possible) for variable names containing "password" or "secret".

## 2026-02-11 - Stored XSS in Dashboard SSR
**Vulnerability:** The `cloudflare-worker` dashboard was vulnerable to Stored XSS. User-controlled inputs (changelog versions, changes, IDs) were interpolated directly into HTML strings without escaping. Additionally, configuration JSON was injected into `<script>` tags using standard `JSON.stringify`, which allows closing the script tag via `</script>`.
**Learning:** Server-side rendering (SSR) logic must explicitly escape all untrusted data. `JSON.stringify` is insufficient for embedding data in HTML `<script>` contexts because it does not escape HTML characters like `<` and `>`.
**Prevention:** Always use an HTML escaping utility (like `escapeHtml`) for string interpolation in HTML. For JSON in `<script>` tags, use a safe serializer that unicode-escapes `<` and `>` (e.g., `\u003c`, `\u003e`).
