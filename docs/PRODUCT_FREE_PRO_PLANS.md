# CQD Product Plans — Feature Audit & Free/Pro Split

**Date:** 2026-09-22 · **Basis:** code audit of extension v1.8.0 (repo 3.2.7), website, cloudflare-worker. Every claim below is grounded in code, with pointers. Planning doc — not committed lore; update as decisions land.

---

## 1. Features already built (shipped, code-verified)

### Core downloading
- **One-click per-file download buttons** injected next to every Classroom attachment (Stream, Classwork, materials). Drive files of any type; Google Docs/Sheets/Slides/Drawings viewer URLs remapped to real downloads. `entrypoints/content/button-factory.ts`, `entrypoints/content/url-utils.ts`, `src/shared/drive-endpoint.ts`.
- **Download All per post** (≥2 files): one button downloads every attachment in the post, with group progress ("Downloading… 2 → 5"), Cancel All (hold-to-cancel). `src/download-all/`, `entrypoints/download_all.content.ts`.
- **Whole-classroom download** (API engine mode): enumerates the course and downloads everything, staggered. `src/v2/render/classroom-download-controller.ts`.
- **Student Work downloads (teacher side)**: per-submission download buttons, board-wide Download All on the by-status page, and a resolver that turns Classroom's opaque `g/tg` links into real Drive URLs via a hidden-iframe bridge (multi-layer: query IDs → strict Classroom-API matching → iframe). `src/student_work/`, `entrypoints/student_work_*.content.ts`.
- **Zero-tab, zero-interstitial Drive path**: all downloads target `drive.usercontent.google.com/download?...&confirm=t`; HTML error/interstitial responses are detected and erased, never saved as fake files.

### Reliability engine (much of the "v1.6 Reliability" wishlist is ALREADY DONE)
- **Failure taxonomy + classification**: transient (network/server/timeout) vs permanent (disk-full, virus, blocked, crash — each with specific user guidance) vs auth vs user-cancel. `entrypoints/background/index.ts` onChanged handler.
- **Auto-retry**: transient failures retry once in place; browser-start failures retry once. Formal **download state machine** exists as a pure reducer: `src/core/acquire/state-machine.ts` (+ strategy chain `src/strategies/acquire/strategy-chain.ts` with a reserved, flag-off `api` tier).
- **Multi-account recovery**: on 403/HTML auth failures, invisibly sweeps `authuser=0..9` across signed-in Google accounts before honest `AUTH_ALL_FAILED`. This fixed the most-reported "files start then fail" bug (1.6.x).
- **Stall deadline**: 150 s pending deadline → honest TIMEOUT; orphan sweep cleanup. `entrypoints/background/state.ts`, `entrypoints/background/cleanup.ts`.
- **Completion verification (partial)**: on `complete`, the item is re-inspected; HTML-MIME "successes" are cancelled and re-routed. Extension captured from the real filename. No size/hash checks yet.
- **Security gating**: every URL passes an HTTPS + Google-host allowlist + shape validation before download; runtime messages verified against our own extension ID.

### Smart detection & UX
- **Comment flags / Edited flags / combined "Both" pills** on post cards, with hover detail, pulse effect, red frame overlay. Multilingual keyword detection (incl. Eastern Arabic numerals, BiDi normalization), 4-layer fallback detection. `entrypoints/content/smart-detector*.ts`, `flags.ts`, `both-badge.ts`.
- **Three engine modes, user-switchable live**: Legacy / New (v2) / API-beta (v3) in the popup. `src/engines/engine-registry.ts`, popup segmented control.
- **In-page dark-mode matching** (Dark Reader aware), ARIA-labelled buttons, keyboard operable popup controls.
- **Filename hygiene**: strips localized type labels, collapses doubled names/extensions (`src/core/name/`), browser-side uniquify on collision.

### Popup & settings
- Master enable toggle, engine mode, flag toggles (all persisted, live-applied).
- **Download stats donut** (lifetime count + file-type mix, persisted colors).
- **What's New overlay** with version pill glow/pulse driven by served changelog.
- Share panel (per-store links, copy), report-a-bug link, Buy-Me-a-Coffee link, GitHub link.
- No options page — everything is popup-only today.

### Internationalization
- **147 locales**, generated catalog + completeness patching; Classroom page language → browser → English fallback. `entrypoints/content/i18n.ts`, `extension/_locales/`.

### Telemetry & backend (privacy-safe)
- Anonymous events only (status, ext-only file type, browser/OS, bucketed duration, error class, source) — strict field allowlists, no filenames/URLs/accounts; Firefox `data_collection: none`. Batched flush with ACK protocol, exponential backoff, remote config.
- **Cloudflare Worker backend**: DO-buffered ingest → D1 archive; serves live site metrics, store-stat scraping (CWS/AMO/Edge/GitHub), changelog, remote config; `/admin` dashboard (stats, force-flush, changelog admin, D1 console); daily CSV + Google Sheets backups; post-deploy verification. Oracle severed.

### Testing & CI
- ~100 test files / 3,200+ tests (unit, property, fuzz, stress, i18n contract), E2E browser matrix (Chromium/Edge/Firefox-signed/Zen), contract simulator, real-Classroom live harness (student+teacher suites), accuracy corpora.

### Gaps vs the "ideal downloader" wishlist (NOT built)
| Capability | Status |
|---|---|
| Visible download queue panel w/ per-file states | No (per-file pills + group counters only, stagger starts) |
| Pause / byte-level progress | No |
| Resume interrupted downloads | No (and low feasibility — see §6) |
| Exponential backoff retries | No (single fixed retry) |
| Size/hash verification | No (MIME-only) |
| Download history (per-file, persisted) | No (aggregate stats only) |
| Disk-level duplicate detection | No (DOM-level dedup only) |
| Course/assignment folder organization | No (flat into Downloads) |
| Naming templates | No |
| ZIP export / manifests | No |
| Course Sync / auto new-file detection | No (API engine v3 scaffolded but discovery-merge is a documented Phase 8–9 stub; API acquire tier flag-off) |
| Multi-select "download selected" | No |
| Options page | No (popup-only) |
| Diagnostics mode | No (error codes exist internally) |
| Keyboard shortcut | No (`source: 'keyboard'` typed, unused) |
| **Any licensing/Pro/paywall code** | **None anywhere** (verified across extension, website, worker) |

---

## 2. The plan: what stays free, what becomes Pro

Principle (keep): **the downloader's foundation stays free; Pro sells organization, automation, and archive** — never "the same downloader with artificial limits." Local-first stays the positioning; no cloud storage of user files.

### FREE plan — everything a student needs to download

**Shipped today:** everything in §1 (one-click downloads, Download All, student work, flags, 147 languages, reliability engine, stats, privacy-safe analytics).

**To build (free):**
1. **Download queue panel** — visible per-file states (queued/downloading/done/failed) in a popup or in-page tray; replaces stagger-and-pray with a real queue built on the existing state machine. Cancel already exists; add pause-queue.
2. **Retry engine upgrade** — exponential backoff + jitter, bounded (3 attempts), on the existing taxonomy. Surface "Reason: network" style messages (codes already exist internally).
3. **Verification upgrade** — expected-size comparison where Drive metadata provides it (API tier already fetches metadata); flag zero-byte/anomalous completions.
4. **Download history (local)** — per-file record (name, course, size, status, timestamp) in `chrome.storage`/IndexedDB. *This is the free foundation Pro features build on* (duplicates, sync deltas, re-download).
5. **Diagnostics mode** — Settings → Diagnostics: checks (extension, browser, Classroom session, download API, last-failure with class + attempts) and a copyable, PII-free report. Slashes support load.
6. **Options page** — move growing settings out of the popup (queue prefs, history controls, diagnostics, language picker).
7. **Reliability metrics on the website** — "99.x% first-attempt success" from the telemetry already flowing (needs a small worker aggregation + site strip).
8. **Keyboard shortcut** — download-all on current page (`commands` permission).

### PRO plan — organization, automation, archive

**To build (Pro), in dependency order:**
1. **Course folders + naming templates** ⭐ flagship, lowest effort/highest perceived value — `Course/Assignment/file.pdf` via `onDeterminingFilename` (already intercepted today, just flat). Presets + custom `{course}/{topic}/{filename}` templates. Needs only course context (already classified per-route) + history plumbing.
2. **Download selected** — checkbox multi-select on classwork boards → queue. Builds on free queue.
3. **Duplicate detection** — "already downloaded → Open / Download anyway" using free-plan history (compare name+size+course; no hashing needed v1).
4. **Course archive export** — one-click ZIP of a course (or semester) + manifest file. Needs in-memory zip (fflate-class lib) fed by the queue.
5. **Priority queue & concurrency control** — parallelism slider, priority for pinned courses.
6. **Course Sync ("Keep this course offline")** ⭐ killer feature — pick courses; on Classroom open (or schedule), diff against history + API inventory, prompt "3 new files found → Download". Builds directly on the **already-scaffolded v3 API engine** (OAuth scopes configured, rate limiter at 30/60s, inventory cache) — the remaining work is the Phase 8–9 discovery→decision merge that is stubbed in `src/engines/v3/engine-v3.ts`.
7. **Scheduled sync** — alarms-based periodic check (extension-side; no server needed).

**Not planned:** cloud backup/storage (contradicts the privacy positioning and creates liability), and no arbitrary-limit paywall on core downloading.

---

## 3. Sequencing to "real users"

| Phase | Theme | Contents |
|---|---|---|
| **v1.9 (free)** | Trust & foundation | Queue panel, backoff retries, size verification, download history, diagnostics, options page, keyboard shortcut, site reliability metric |
| **v1.9.5 (infra)** | Monetization plumbing | License/entitlement decision + provider, worker `/license` endpoint, pricing page, **revise "no premium tier" copy (FAQ line 40, seoPages.ts 491/566)**, store listing updates |
| **v2.0 (Pro)** | Organization | Course folders + naming templates, download selected, duplicate detection |
| **v2.1 (Pro)** | Archive & automation | ZIP export + manifest, priority queue, Course Sync MVP (on-open diff), scheduled sync |

---

## 4. Prerequisites, risks & honest notes

- **Zero monetization infrastructure exists** — no payment SDK, license validation, or entitlement code anywhere. Everything in the "infra" phase is greenfield. Candidate providers: ExtensionPay (fastest, extension-native), Gumroad/Stripe license keys + worker validation (worker already exists to host the endpoint).
- **Positioning conflict:** FAQ and 5 SEO pages currently say "completely free… no premium tier, no trial limits." Shipping Pro means rewriting trust copy carefully — frame as "free stays free; Pro adds organization," never quietly.
- **License:** proprietary source-available, personal non-commercial — compatible with a Pro tier; no OSS obligation conflict.
- **Resume (Range/partial) is near-infeasible** on the current path: `chrome.downloads` gives no resumable handle for our redirect-served Drive endpoint, and we don't own the byte stream. The honest substitute is fast auto-retry from scratch + size verification. Say "auto-recovery," not "resume," in marketing.
- **MV3 worker restarts** orphan the in-memory download registry (mitigated by 150 s deadline + sweep). The queue/history work should persist job records to storage — this also fixes that fragility.
- **Course Sync consent:** the API tier is deliberately consent-gated; Sync must ride the same explicit opt-in (one clear consent screen, readonly scopes only). Store-review risk is manageable since scopes are already declared.
- **Don't rush cloud anything** — local-first is the differentiator the reviews praise.
