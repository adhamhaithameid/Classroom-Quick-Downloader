# Extension Security Audit — Classroom Quick Downloader

**Audit date:** 2026-09-24
**Scope:** Browser extension only (`extension/` — manifest, background service worker, content scripts, popup/UI, bundled libs, dependencies). Extension↔backend network boundary flagged; `cloudflare-worker/` and `oracle-backend/` NOT audited this pass.
**Commit under test:** `56bd96f0` (main), fresh `wxt build` → `extension/.output/chrome-mv3` v1.8.0 (Chrome MV3; Firefox MV2/Edge MV3 same source, static review only).
**Method:** Phase 0 recon → Phase 1 static (file-by-file + pattern sweep + Mimosa deep scan + pnpm audit + repo's own security suites) → Phase 2 functional runtime (unpacked load in Chromium-for-Testing 153, mock Classroom/Drive/worker hosts) → Phase 3 adversarial (hostile filenames, URL-validator bypass attempts, cross-extension barrage, storage tampering, compromised-worker payloads, races, SW wake, isolation).
**Companion Mimosa scan:** scanId `scan-2026-09-24T07-18-31.820Z-f59649d5852f`, seal `sha256:2874893db3d60d66ded614a16e419ad423bcfcc3818d88be03d3e3b0766bdaf5`, artifacts `~/.mimosa/security-scans/project-89e2c8caf3abddfdd3d84918/scan-2026-09-24T07-18-31.820Z-f59649d5852f`.

---

## 1. Executive summary

**Overall risk: LOW. No Critical or High findings. The extension is safe to keep serving its live user base, with two small hardening items worth landing before the next release.**

This extension has an unusually strong security posture for its category. Every message listener verifies `sender.id === chrome.runtime.id`; every download URL passes an HTTPS-only, Google-host-allowlist validator with URL-shape checks before `chrome.downloads.download`; there is no `externally_connectable`, no `web_accessible_resources`, no `eval`/`new Function`, no remote code, no secrets in storage, and no OAuth token persistence. The analytics pipeline sanitizes every field with regex allowlists, clamps every remote-config value into fixed ranges, and pins the worker URL at build time. The old Oracle backend is confirmed severed **empirically** (zero requests across the entire test matrix). `pnpm audit` (prod + dev): **0 vulnerabilities**; the repo's own security suites (xss-prevention, download-validator, link-fuzz, content-url-utils) pass **71/71**.

Adversarial testing could not produce a single exploitable path: a hostile Classroom DOM cannot XSS the extension, cannot trigger a download from the page's main world (no `chrome.runtime`), cannot forge bridge messages, and cannot name a download that escapes `~/Downloads`. A second extension is refused at the browser level ("Receiving end does not exist"). A fully compromised analytics worker cannot do anything beyond suggesting out-of-range numbers, which are clamped on both ingest and load. The filename attack matrix — the one plausible pre-attack hypothesis from static review — was **empirically refuted** in a real (headed) Chrome: every traversal/absolute/reserved/control-character name was rejected by Chrome's download pipeline and fell back to the server-supplied name.

Two Low findings remain (filename defense-in-depth, hung-server start callback) plus least-privilege cleanups. None are exploitable today.

---

## 2. Security findings

| # | Severity | Location | Description | Exploit scenario | Fix |
|---|----------|----------|-------------|------------------|-----|
| S1 | **Low** (defense-in-depth) | `src/core/name/sanitize.ts:23`; `entrypoints/background/index.ts:327-331` (`suggest({filename})`); `entrypoints/background/bridge-download-service.ts:115`; `src/v2/render/button-renderer.ts:248` | `fileMeta.name` originates from page DOM (attachment titles, Drive file names, bridge payload `file.name`) and reaches `onDeterminingFilename.suggest()` **without any path-character filtering** — `sanitizeFileName` only strips trailing type labels and dedups text. Verified in Chrome 153: the *browser* rejects every hostile form (`../../x`, `..\..\x`, `/etc/passwd`, `C:\...`, `~/x`, control chars, `CON`, trailing dots → all fell back to the server name). The only surviving power is subdirectory creation. | A Classroom attachment (or Drive file) named `My Folder/notes.pdf` creates `~/Downloads/My Folder/` on download. Attackers control these names. No escape from Downloads, no overwrite, no traversal — verified empirically (headed run, `headed2/headed3` logs). | Belt-and-braces: strip `/`, `\`, control chars, leading `.`, and collapse `..` in `sanitizeFileName` before the name is sent in `CQD_DOWNLOAD`/bridge payloads. Removes reliance on sink behavior across all current and future browsers. |
| S2 | **Low** (robustness, overlaps S1) | `entrypoints/background/download-handler.ts:193-234` | The `chrome.downloads.download` start-callback can **never fire** if the target host accepts the connection but stalls (verified: mock server that never responds → no callback → no `sendResponse` → the initiating message's promise dangles). Content-script buttons recover via the 150 s `PENDING_DEADLINE_MS` stall hook, so users are not dead-ended; the popup-originated response path just resolves late. | Slow-loris-style host (or a hung corporate proxy) leaves a button in "Retrying…" for up to ~150 s instead of failing fast. | Race the start callback with a ~15 s timeout; on timeout, cancel the download id and settle with the honest error path. |
| S3 | **Low** (least privilege) | `wxt.config.ts:53-62` | Unused attack surface in the manifest: `host_permissions` includes `https://oracle.classroom-quick-downloader.com/*` although the Oracle path is severed (zero calls verified across all runtime tests); `https://accounts.google.com/*` host permission is not required for `chrome.identity` token flows; CSP `connect-src` still names the Oracle host. | None directly. Every host permission is review friction at store review time and potential future-abuse surface if the bundle is ever compromised. | Drop the Oracle host permission + CSP entry; drop `accounts.google.com` unless a specific flow needs it. Fold into the next manifest-affecting release. |
| S4 | **Info** (dead-code risk) | `src/student_work/channel.ts:73-79, 161-174` | The `BroadcastChannel(STUDENT_WORK_CHANNEL_NAME)` fallback in the resolver has **no sender authentication** — any same-origin page JS could inject a resolve result through it. It is unreachable in production (all supported browsers expose `chrome.runtime` in content scripts; the runtime path checks `sender.id`). | Requires a browser where content scripts lack `chrome.runtime` — none exists in the support matrix. | Delete the BroadcastChannel fallback, or add a comment pinning its test-only status. |
| S5 | **Info** (cosmetic) | content scripts / popup `sendMessage` call sites | "Unchecked runtime.lastError: The message port closed…" console noise from fire-and-forget `sendMessage` patterns (observed in the popup during the matrix; some were harness-originated). | None. Cosmetic console noise visible to developers only. | Wrap fire-and-forget sends with a callback that swallows `lastError`, or route through a helper. |
| S6 | **Info** (false positive) | Mimosa `finding:358331b79759535dc571ea24` — `src/engines/v3/engine-v3.ts:232` | Mimosa deep-scan flags "cross-file taint" from URL input to an `innerHTML` assignment. The taint path terminates in `tests/v2-docs-anchor-discovery.test.ts:20` — **test scaffolding**, not shipped code. Mimosa itself marks it advisory requiring human confirmation. | None (test-only). | None. Noted for scan-triage completeness. |

**Out-of-scope boundary note (flagged, not audited):** Mimosa returned 42 further findings, all in `oracle-backend/` (8), `cloudflare-worker/` (31), and `tools/` (3) — e.g. SSRF-shaped `forwardArchivedBatchToOracle`, `proxyToDO`, `runArchiver`, path-traversal-shaped `captureSnapshot`. These are server-side and belong to a separate pass. From the extension's side of the boundary, the only backend hosts the extension can reach are the two pinned, HTTPS worker hosts; the extension's outbound payloads are regex-allowlisted download counters, and its inbound handling of both `/config` and `/track` responses survived malformed, type-confused, and 5 MB oversized payloads in testing.

---

## 3. Functional bugs

| # | Severity | Repro | Expected | Actual |
|---|----------|-------|----------|--------|
| F1 | Low | Point `chrome.downloads.download` at a host that accepts TCP but never responds (e.g. `nc -l` that sends nothing). Trigger a download; observe the initiating `CQD_DOWNLOAD` `sendMessage` response. | Callback settles within seconds with an error. | No callback until the 150 s stall deadline reaps the pending; the original message response never resolves (same root cause as S2). |
| F2 | Info | Open the popup, trigger several fire-and-forget messages (e.g. toggle flags with no Classroom tab open). | Clean console. | "Unchecked runtime.lastError: The message port closed before a response was received." (same root cause as S5.) |
| F3 | Info (QA gap, not a user bug) | Run any filename-dependent behavior under the repo's own `qa-chromium` (headless) project. | Suggestions/hHTML-guard behave as in production. | Headless Chromium never fires `onDeterminingFilename`, so the entire filename-suggestion and HTML-guard paths are invisible to the headless E2E suite. Users are unaffected (real browsers are headed); the suite just can't see this layer. One headed ("new headless"-adjacent) journey would close the gap. |
| F4 | Unconfirmed observation | Tamper `cqdV2Mode`/`extensionEnabled` while a legacy-mode Classroom page is open, then re-count injected elements ~1 s later. | Elements persist. | One run observed 0 cqd elements briefly after tamper; not reproducible as a defect (likely the stop/start re-scan cycle mid-flight). Needs a deliberate repro before treating as a bug. |

Everything else exercised worked as intended: first-run defaults, popup UI (v1.8.0, toggles, engine-mode control, changelog section, stats donut), settings persistence across full browser restart, engine-mode live switching path, content-script injection on legacy mode against a captured-Classroom fixture, 30-way parallel downloads + cancel storm, SW cold-wake on message, graceful failures for 404/HTML/forbidden responses.

---

## 4. Adversarial test log

| Attempt | Vector | Result | What it proves |
|---|---|---|---|
| A1 | Malicious mock Classroom page (real captured fixture + hostile payloads): `javascript:` href, `evil.example` link, Drive URL with `../../` id, page-level `postMessage({type:'CQD_BRIDGE_REQUEST', …})` | **Failed (defended).** No download triggered; buttons only appeared on legitimate Drive attachments. | Content scripts don't trust page globals; the bridge has no `window` surface. |
| A2 | Main-world isolation probe (`window.chrome.runtime`, `__cqdPerfSnapshot`) | **Failed (defended).** All `undefined` in the page's main world. | Isolated world properly contains extension internals (per the shared-globals leakage check). |
| A3 | URL validator bypass matrix (popup as trusted sender): `javascript:`, `http:`, non-Google host, `drive.google.com.evil.example` host-suffix spoof, `drive.google.com/../../x` | **Failed (defended).** 5/5 blocked with `INVALID_URL`/shape reasons. The one URL that started was a legitimately-shaped `drive.google.com/file/d/` link (by design). | `validateDownloadUrl` (HTTPS-only + host allowlist + shape patterns + `..`/`%25` rejection) holds at the chokepoint every URL must cross. |
| A4 | Filename attack matrix — 14 hostile names through the real (headed) Chrome pipeline: `../../evil.js`, `..\..\evil.js`, `/etc/passwd`, `C:\Users\v\evil.exe`, `foo/../../bar.pdf`, `~/evil.sh`, 900-char name, `"b|c<d>e?.pdf`, RTL-override, control chars, `CON`, `file.pdf...`, `Subfolder/ok.pdf`, `Homework.pdf` | **Failed (defended), with one nuance.** Every hostile form: suggestion rejected by Chrome, file saved under the server's name (`server-file (N).pdf`) — no traversal, no escape, no reserved-name handling issues. Legit name applied; subdirectory suggestion **was honored** (`~/Downloads/Subfolder/ok.pdf`) — clutter-only, contained to Downloads (→ finding S1). | The only sink extension-controlled names reach is Chrome's download namer, which sanitizes correctly in Chrome 153. The extension's own lack of filtering (S1) is currently latent, not exploitable. |
| A5 | HTML/interstitial guard: mock Drive returning `text/html` for a PDF request | **Failed (defended).** Download started, was cancelled **and erased** by the `looksLikeHtml` guard; nothing landed (item removed from `downloads.search`). | Users can't be silently fed an attacker-relevant HTML page where a PDF was expected. |
| A6 | Cross-extension attack: purpose-built second extension sent 8 forged messages (`CQD_DOWNLOAD` with traversal name, evil URL, cancel, `cqd-set-mode: v3`, flag toggle, `CQD_BRIDGE_REQUEST`, forged resolver publish, icon update) from a real extension-page context | **Failed (defended), 8/8.** All rejected: "Could not establish connection. Receiving end does not exist." Zero downloads, zero settings changes, CQD SW healthy afterwards. | No `onMessageExternal`/`externally_connectable` surface exists; `sender.id` checks in every listener are the second layer. Sender validation claimed in Phase 1 is **actually enforced**. |
| A7 | Storage tampering via extension context: `cqdV2Mode = "<img src=x onerror=…>"`, `extensionEnabled = {evil:true}`, garbage `local_stats`, negative `cqd_analytics_config_v1` | **Failed (defended).** Popup re-opened cleanly; invalid mode ignored by `isValidMode`; analytics config is clamped at every load via `migrateConfig` (raw garbage stays in storage but is never consumed raw). | Storage-derived values are validated before use. (Local malware that can write chrome.storage is already game-over by definition.) |
| A8 | Compromised worker `/config`: `batchSize: 999999`, `maxDailyRequests: -5`, `flushMode: "nonsense"`, `remoteEnabled: "yes"`, `cancelHoldDelayMs: -12345`, `maxEventsPerRequest: 9e9`, `timeFlushMinutes.low: 9999999` — delivered on a genuine SW cold start | **Failed (defended).** Stored config after refresh: `batchSize 1000, maxDailyRequests 1, maxRetry 20, flushMode "next_day", remoteEnabled true, cancelHoldDelayMs 0, maxEventsPerRequest 50000, lowUsageFlushMinutes 10080` — every clamp fired exactly as coded. | A malicious/compromised worker cannot reconfigure the extension into abuse (e.g. can't crank event volume or unpin flush windows). |
| A9 | Malformed `/track` response (`acceptedIds:"not-an-array"`, `committedSeq:{…}`, `ackId:123`) and HTTP 500; also a 5 MB `/config` body | **Failed (defended).** Type-checked field-by-field; SW alive after all three. | The flush/ack path trusts nothing structural from the worker. |
| A10 | Race: 30 concurrent `CQD_DOWNLOAD`s + 30 cancels from the popup; concurrent tabs in earlier legs | **Failed (defended).** 30/30 started with distinct requestIds, cancels accepted, no crash, SW alive; authoritative-registry design (`state.ts` D11) prevents cross-correlation. | No exploit via concurrency; exactly-once correlation holds. |
| A11 | MV3 SW suspension: `ServiceWorker.stopAllWorkers`, then message | **Failed (defended).** Message woke the SW and completed (`downloadId` returned). | No suspension-window dead ends for the message path. |
| A12 | Oracle callback probe: `oracle.classroom-quick-downloader.com` mapped to a local listener for the entire matrix | **Failed (defended) — zero hits.** | The Oracle severance is real; no hidden extension→Oracle path exists. |
| A13 | Dependency/supply-chain: `pnpm audit` prod and dev; Mimosa dependency scan (46 packages) | **Clean.** 0 vulnerabilities; 0 matched advisories. | No known-vulnerable bundled dependencies. |

---

## 5. Prioritized remediation

| Priority | Item | Why now | Effort |
|---|---|---|---|
| 1 — before next release | **S1**: path-filter `sanitizeFileName` (strip `/ \ ..` control chars, leading dots) so page-derived names are clean before `CQD_DOWNLOAD`/bridge payloads | Converts a latent sink-trust into defense-in-depth; kills the only attacker-controlled side effect observed (subfolder creation); small pure-function diff with existing test suites (`tests/xss-prevention`, `download-validator`) to extend | ~30 min + tests |
| 2 — before next release | **S2/F1**: timeout race around the `downloads.download` start callback | Removes the last "button hangs ~150 s" dead-end on hostile/hung networks | ~1 h |
| 3 — next manifest churn | **S3**: drop Oracle host permission + CSP entry; re-evaluate `accounts.google.com` host permission | Least privilege; smoother store review; zero behavior change (Oracle confirmed severed) | Trivial, but any host-permission removal can re-prompt users — schedule deliberately |
| 4 — backlog | **S4** delete BroadcastChannel fallback; **S5** lastError hygiene; **F3** one headed E2E journey covering filename suggestion + HTML guard | Hygiene and coverage gaps only | Small |

Explicitly **not** findings: public `oauth2.client_id` (correct for installed extensions — secrets are not used in this flow), `chrome.storage.local` holding no tokens/PII (verified), MV2/Firefox build (same code path; `onDeterminingFilename` is Chromium-only by API design and Firefox never receives extension filename suggestions).

---

## 6. Verification artifacts

- Harness + logs: `/tmp/cqd-audit/` (`harness.mjs`, `headed2.mjs`, `headed3.mjs`, `attack2.mjs`, `*.log`, `*-result.json`)
- Mimosa sealed scan: `scan-2026-09-24T07-18-31.820Z-f59649d5852f` (seal `sha256:2874893d…`, 43 findings: 1 extension-scope, dispositioned S6 above)
- Repo security suites: `xss-prevention` 19, `download-validator` 25, `classroom-link-fuzz` 19, `content-url-utils` 8 — all green on `56bd96f0`
- Test downloads and any files landing in `~/Downloads` during the headed runs were removed afterwards.

*Static claims were verified against the built MV3 bundle's manifest and source at `56bd96f0`; runtime claims were executed, not theorized. Firefox MV2 coverage is static-only this pass (repo's signed-Firefox E2E leg covers its journeys separately).*

---

## 7. Remediation record (2026-09-25, branch `fix/security-audit-2026-09-24`)

Every finding from section 2 is fixed and pinned by red/green/black tests. "RED" = the test was run against the pre-fix build (`56bd96f0`) and failed for the contract's own assertion; "GREEN" = passes post-fix; "BLACK" = black-box E2E against the built extension through public surfaces only.

| Finding | Fix commit | RED (pre-fix evidence) | GREEN (enforcement) | BLACK (E2E) |
|---|---|---|---|---|
| S1 filename hardening | `01786be6` (+ `:` strip added in `b5715f23` after the E2E matrix showed the sink rejecting `C:Usersvevil.exe`; trim-order fix in the review commit) | Unit: 7 failures in `sanitize.test.ts` + `download-name-boundary.guard.test.ts`; E2E: hostile names landed as `server-file.pdf` fallback (no sanitized suggestion) | `sanitize.test.ts` S1 suite + adversarial property; `download-name-boundary.guard.test.ts` pins the `sanitizeDownloadName` chokepoint (single `message.fileMeta` use) | `tests/e2e/headed/filename-security.spec.ts`: 11-name matrix through the real (headed) pipeline — sanitized stems land (`evil.js`→`evil (N).pdf` per Chrome's MIME normalization), no subdirectories, nothing escapes, legit `Homework.pdf` byte-identical, duplicates uniquify |
| S2 start-callback timeout | `9702c468` (+ `handleStartTimeout` consolidation in review commit — code review caught the retry path missing the analytics event) | Unit: 4 failures (fake `chrome.downloads.download` that never calls back + fake timers); E2E: response never settles (2.0m timeout) | `background-download-handler.test.ts` S2 suite (export const, single settle, drive settle, stray-cancel); `handleStartTimeout` shared by all four call sites | `tests/e2e/download-start-timeout.spec.ts`: hanging HTTPS host → `CQD_DOWNLOAD` settles ≤25s with `started:false` + honest message; SW alive |
| S3 manifest least privilege | `662bf21e` | Guard: 2 failures (oracle + accounts entries present) | `manifest-least-privilege.guard.test.ts`: no oracle host anywhere, no accounts host, no `<all_urls>` ever, required perms/oauth2/4 real hosts pinned | Covered by the full E2E legs (44/44 on `extension-chromium` + `extension-edge`) — SW boots, popup works, worker config fetch flows |
| S4 BroadcastChannel removal | `3606f131` | Guard: 2 failures (channel construct + missing relay assertions) | `student-work-channel.guard.test.ts` (no `new BroadcastChannel`, no `onmessage`, no channel name; relay + sender.id pinned); channel tests assert no-runtime resolves empty | Resolver journeys green in full E2E (`student-work*.spec.ts`) |
| S5 lastError hygiene | `c868cd25` | Guard: 13 offenders listed | `sendmessage-hygiene.guard.test.ts` — the enforcement mechanism: scans `entrypoints/` + `src/`, fails on any `sendMessage`/`connect` whose args never consume `lastError` | `tests/e2e/console-hygiene.spec.ts`: closed-tab-mid-download journey, SW console clean. Note: the E2E noise repro proved non-deterministic pre-fix (Chrome throws synchronously on dead-tab sends in this path), so the journey is a black-box regression net; the guard is the "never again" teeth |
| S6 Mimosa false positive | none required | — | — | — (taint path terminates in `tests/v2-docs-anchor-discovery.test.ts`, test scaffolding) |
| F1/S2 hang | same as S2 | audit L1 | same as S2 | same as S2 |
| F3 headless QA gap | `b5715f23` | n/a (gap) | `extension-headed` project (E2E_HEADED=1 gate, mirrors `QA_SIGNED_XPI`); CI xvfb step in the `extension-e2e` job | the filename spec itself |
| F4 storage-tamper anomaly | investigated, **not reproducible** — documented as non-finding (audit section 3 F4 already marked unconfirmed; the tamper journey passes in E2E) | — | — | covered by H1/H2 probes in the audit harness |

**In-scope discovery fixed en route:** `tests/e2e/global-setup.ts` carried merge-conflict markers committed on main (`eb5191dc`) — every Playwright run on main was broken at global-setup. Resolved in `b5715f23` (`execSync` unused; `execFileSync` is the real import).

**Code review (two-axis) outcome:** Standards — 9 judgement calls, 3 applied (timeout-body consolidation, lastError idiom, trim order), remainder nits/noted; Spec — requirements complete, no scope creep, no wrong implementations. Post-review: vitest 176 files / 4,148 tests green; Playwright `extension-chromium` + `extension-edge` 44/44 green; headed filename spec green.
