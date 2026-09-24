# CQD Roadmap — Free → Pro, Current State to Paid Launch

**Date:** 2026-09-22 · **Owner:** Adham Haitham · **Tracker:** bd (wayfinder map `Classroom-Quick-Downloader-0h4d`, all work filed as beads)
**Companion docs:** [PRODUCT_FREE_PRO_PLANS.md](./PRODUCT_FREE_PRO_PLANS.md) (feature audit with code evidence) · per-feature implementation plans will live in `docs/superpowers/plans/` (writing-plans format) as each feature starts · research findings in `docs/research/`.

**The commitment this roadmap encodes:** finish every Free-plan feature and drive reliability to a measured ~100% bar first. Only after that gate closes: add Pro positioning to site + marketing, build monetization, then build Pro features. Nothing about Pro ships while free reliability work remains.

---

## Phase 0 — Current state (baseline, pre-plan)

Everything below is shipped and code-verified (evidence paths in PRODUCT_FREE_PRO_PLANS.md):

- **Downloading:** one-click per-file buttons (all Drive types + Docs/Sheets/Slides remapping), per-post Download All with group progress + cancel, whole-classroom download, teacher-side Student Work downloads with opaque-link resolver, zero-tab Drive endpoint, HTML-interstitial refusal.
- **Reliability:** failure taxonomy (transient/permanent/auth/cancel), single auto-retry on transient failures, formal download state machine (`src/core/acquire/state-machine.ts`), 150s stall deadline, multi-account `authuser=0..9` recovery, MIME completion verification, URL allowlist validation.
- **Detection & UX:** comment/edited/both flags in 147 locales, 3 live-switchable engine modes (Legacy/New/API-beta), dark-mode matching, popup with stats donut + What's New overlay.
- **Backend:** Cloudflare Worker (DO + D1 + KV) — analytics ingest, site metrics, store scraping, changelog, admin dashboard, CSV + Google Sheets backups. Oracle severed from live path 2026-09-20.
- **Quality:** ~3,200 tests, E2E browser matrix, contract simulator, real-Classroom live harness, accuracy corpora.
- **Monetization:** none exists (no payment, license, or entitlement code anywhere). Site copy promises "completely free… no premium tier" (FAQ + 5 SEO pages).

**Not built:** queue panel, backoff retries, size verification, download history, diagnostics, options page, folders/naming, duplicates, ZIP archive, Course Sync, multi-select, keyboard shortcut, licensing, pricing page.

---

## Phase 1 — Free plan completion (v1.9, epic `0h4d.1`)

| # | Bead | Feature | Depends on |
|---|------|---------|-----------|
| 1 | `0h4d.1.1` | Persist download job records to chrome.storage (fix MV3 orphaning) | — |
| 2 | `0h4d.1.2` | Download queue panel: per-file states, concurrency, pause | #1 |
| 3 | `0h4d.1.3` | Exponential backoff retry engine (bounded, jittered) | — |
| 4 | `0h4d.1.4` | Surface failure reasons in download UI | — |
| 5 | `0h4d.1.5` | Expected-size download verification | — |
| 6 | `0h4d.1.6` | Local download history (per-file, persisted) | #1 |
| 7 | `0h4d.1.7` | Diagnostics page + copyable PII-free report | #4 |
| 8 | `0h4d.1.8` | Options page (settings out of popup) | — |
| 9 | `0h4d.1.9` | Keyboard shortcut for download-all | — |
| 10 | `0h4d.1.10` | Site reliability metric (first-attempt success rate) | — |
| 11 | `0h4d.1.11` | **Reliability gate: define + measure the free-plan exit criteria** | #2, #3, #5 |

**Exit gate (bead `0h4d.1.11`):** "~100% working" is defined honestly and measurably: ≥99.5% first-attempt success, ≥99.9% eventual success (retry-recovered) on canary + telemetry, across Chromium + Firefox, zero P0/P1 bugs, live-Classroom suite green N consecutive runs. The gate closes Phase 1; only then does Phase 2 begin. This protects the promise the site already makes.

**Working agreement per feature:** each gets its own writing-plans implementation doc (`docs/superpowers/plans/YYYY-MM-DD-<feature>.md`) with TDD tasks; UI features follow the established prototype → notes → sign-off → integrate workflow before Svelte/content-UI implementation.

---

## Phase 2 — Pre-Pro infrastructure (v1.9.5, epic `0h4d.2`)

Monetization + security readiness. Everything here is greenfield (zero monetization code exists today).

| # | Bead | Work item | Depends on |
|---|------|-----------|-----------|
| 1 | `0h4d.2.1` | Security hardening: extension + worker + dashboards, pre-licensing threat model | — |
| 2 | `0h4d.2.2` | Worker license/entitlement endpoints (signed, rate-limited, D1 tables) | provider + identity decisions |
| 3 | `0h4d.2.3` | Extension entitlement module (offline-tolerant, cached, `isPro()`) | endpoints |
| 4 | `0h4d.2.4` | Pricing page + Free/Pro comparison on website | pricing + positioning decisions |
| 5 | `0h4d.2.5` | Copy rewrite: FAQ/SEO "no premium tier" promises | positioning decision |
| 6 | `0h4d.2.6` | Store listings update (CWS/AMO/Edge) | one-vs-two-extension decision |
| 7 | `0h4d.2.7` | Backend consolidation execution | Cloudflare-vs-Oracle decision |
| 8 | `0h4d.2.8` | Admin dashboard licensing ops (issue/revoke/refund, fraud signals) | endpoints |
| 9 | `0h4d.2.9` | Payments/tax/merchant-of-record setup | provider decision |

**Open decisions gating this phase** (wayfinder tickets on map `0h4d`, resolved via live discussion + research):

- `0h4d.4` ✅ **Research: monetization provider** — [Lemon Squeezy](./research/monetization-provider.md): true merchant of record (files global VAT — decisive for a solo dev selling to international students), native license-key API with per-key device instances, 5% + 50¢/sale. Validate through CQD's own Worker proxy with 30-day cached grace so the provider stays swappable. Runner-up: Paddle. Rejected: Gumroad (10%), raw Stripe (tax liability on you).
- `0h4d.5` ✅ **Research: pricing students actually pay** — [one-time license, no subscriptions](./research/pricing-students.md): ~$9.99 standard / $7.99 launch; plan 0.5–2.5% conversion of *active* installs; net formula ≈ active × conv% × price × (1 − 6% refunds − 8% fees) → worked table per 10k actives. The low price *is* the student discount; use PPP regional pricing rather than verification coupons.
- `0h4d.6` ✅ **Research: store policies for paid extensions** — [single listing is effectively mandatory](./research/store-policies-paid.md): AMO forbids paid listings outright; CWS repetitive-content and Edge bulk-submission rules read against twin free/paid listings. External checkout + entitlement gating is allowed on all three stores with disclosure; CWS Limited Use (tightened July 2026) requires the license flow be disclosed; Firefox `data_collection: none` must be updated or the license check must send only an opaque install ID.
- `0h4d.7` **Decision: one extension with license gate vs separate Pro extension** — research strongly favors **one listing, entitlement-gated** (user's own instinct: same extension, managed by ID). Confirm in a 10-minute grilling session and close.
- `0h4d.8` **Decision: license identity binding** — Google account ID vs install ID vs purchase email vs license key. Must survive reinstall/multi-machine and respect the no-accounts privacy posture.
- `0h4d.9` **Decision: backend consolidation — Cloudflare-only vs Oracle revival.** Current reality: Cloudflare already carries 100% of the live path and is free-tier sustainable; Oracle is severed. Recommendation: consolidate on Cloudflare, keep Oracle as optional cold archive. The owner's "make Cloudflare AND Oracle all work" intent is honored by making one path fully reliable rather than reviving a dead one.
- `0h4d.10` **Decision: Pro positioning + copy rewrite strategy** — "free stays free; Pro adds organization/archive/sync."
- `0h4d.11` **Decision: profitability go/no-go** — real dashboard numbers × pricing scenarios → go/no-go + minimum revenue target.

---

## Phase 3 — Pro features build (v2.0/2.1, epic `0h4d.3`)

All gated behind the entitlement module from Phase 2. No artificial limits on free core ever.

| # | Bead | Feature | Depends on |
|---|------|---------|-----------|
| 1 | `0h4d.3.1` | Course folders + naming templates (flagship, cheapest win) | entitlement, history |
| 2 | `0h4d.3.2` | Download selected (multi-select) | queue, entitlement |
| 3 | `0h4d.3.3` | Duplicate detection ("already downloaded" prompts) | history, entitlement |
| 4 | `0h4d.3.4` | ZIP course archive + manifest | queue, entitlement |
| 5 | `0h4d.3.5` | Priority queue + concurrency control | queue, entitlement |
| 6 | `0h4d.3.6` | Course Sync consent flow + API tier enablement | entitlement |
| 7 | `0h4d.3.7` | Course Sync MVP (on-open new-file detection + prompt) | consent flow, history |
| 8 | `0h4d.3.8` | Scheduled sync | Sync MVP |

---

## Phase 4 — Launch & operations

- Pricing live on site + store listings; conversion telemetry (fog-of-war ticket on the map: define the funnel events needed to measure uptake).
- Support workflow: diagnostics reports (Phase 1) + licensing ops dashboard (Phase 2) are the support toolkit.
- Monitor: first-attempt success rate stays above gate after Pro features land; license-abuse signals watched.
- Revisit fog items when reached: refunds/disputes flow, school/bulk licensing, trial mechanics.

---

## Readiness assessment — can the current state carry this?

**Yes, with named gaps.** Evidence:

- **Engineering capacity is proven:** 3,200+ tests, property/fuzz/stress suites, E2E matrix across 4 browser channels, a real-Classroom live harness, and an engine architecture (state machine, strategy chain, event bus) already shaped for exactly the queue/retry/verification work in Phase 1. Phase 1 is an extension of patterns that exist, not a rewrite.
- **Backend capacity is proven:** the Cloudflare Worker already buffers/aggregates analytics at thousands-of-users scale on free-tier design, with backups and an admin console. License validation adds small, cacheable read traffic — well within it.
- **Product surface is proven:** live on three stores since Nov 2025, 147 locales, real review corpus (4.7★/31) — real users exist today.

Named gaps (all filed as beads, none blocking Phase 1):

1. **Monetization is greenfield** — Phase 2 entirely; de-risked by the three research tickets before any code.
2. **Solo-dev support load** — diagnostics + licensing ops dashboards are the mitigation; budget time for them (they are Phase 1/2 beads, not afterthoughts).
3. **Store policy exposure** — license validation touches the privacy posture; resolved by decision `0h4d.8` (prefer install-ID/license-key binding over account identifiers to keep `data_collection: none` honest).
4. **Profitability is unknown until measured** — decision `0h4d.11` is the honest gate: pull real installs/actives from the dashboard, apply the pricing formula from `0h4d.5`, decide with numbers. A student-affordable price is a design constraint of that research, not an afterthought.

**Honest framing on "100%":** no software hits a literal 100% across every network/browser/Google change. The gate in `0h4d.1.11` converts the intent into measured thresholds (≥99.5% first-attempt, ≥99.9% eventual) with a public metric — stronger than a promise, because failures are detected, retried, explained, and recoverable by construction.
