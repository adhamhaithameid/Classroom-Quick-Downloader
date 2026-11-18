# Phase 3 Design — Fintech Readiness for the Free→Pro Launch

**Date:** 2026-11-18 · **Tracker:** bead `Classroom-Quick-Downloader-9tx3`
**Scope:** the money-handling surface for the Pro launch — license API, webhook
receiver, secret governance, signature strength, trust pages, monitoring.
**Status key:** [SHIPPED] = merged to main and verified; [PLANNED] = designed
here, build tracked by its own bead.

## Sources in repo

Every claim below is checkable against these files:

- `cloudflare-worker/src/licensing/` — the shipped license service (PR #917, bead 0h4d.2.2)
- `extension/src/entitlement/` — the shipped entitlement module (PR #922, bead 0h4d.2.3)
- `docs/research/monetization-provider.md` — Lemon Squeezy decision (0h4d.4)
- `docs/research/pricing-students.md` — $9.99 / $7.99-launch pricing (0h4d.5)
- `docs/research/store-policies-paid.md` — single-listing + disclosure rules (0h4d.6)
- `docs/security/THREAT_MODEL_LICENSES.md` — attack tree A1–A5 (0h4d.2.1)
- `docs/ROADMAP_FREE_TO_PRO.md`, `docs/PRODUCT_FREE_PRO_PLANS.md` — phase plan and plan audit
- bead `wt5f` — deferred follow-ups from the 2.2 review loop

## 1. License API surface [SHIPPED]

Four operations on the Cloudflare Worker (decision 0h4d.9: Cloudflare-only;
Oracle is a cold archive guarded by `oracle-severance.guard.test.ts`):

| Operation | Route | Auth | Limit |
|---|---|---|---|
| Validate | `POST /license/validate` | license key in body | DO limiter, 10/min/IP |
| Activate | `POST /license/activate` | license key + opaque install ID | DO limiter, 5/min/IP; cap 5 activations per key |
| Provider events | `POST /license/webhook` | Lemon Squeezy HMAC (`X-Signature`) | signature fail-closed (401) |
| Admin ops | `POST /admin/licenses/issue`, `POST /admin/licenses/revoke`, `GET /admin/licenses/list` | dashboard session or `X-Admin-Secret` | existing admin auth envelope |

D1 tables (SITE_CACHE_DB): `licenses` (key_hash UNIQUE — raw keys are never
stored), `activations` (license_id + opaque install ID, UNIQUE pair,
atomic cap insert), `license_events` (payload-digest dedupe + audit).

Entitlement token contract (consumed by the extension module): `{"ok":true,
"status":"active"|"grace","entitlement":"<payloadB64>.<sigB64>"}`; payload is
`{license_ref, plan, expiresAt, graceUntil, issuedAt}`; `sigB64` is HMAC-SHA256
over the exact `payloadB64` string. 30-day grace. Endpoints fail closed (503)
without secrets.

Provider abstraction: `LicenseProvider` (issue/validate/revoke/webhook-verify)
with the Lemon Squeezy implementation default (decision 0h4d.4). A provider
swap is a config change (`LICENSE_PROVIDER`), not a client update — this is
the designed answer to the Stripe-acquisition migration risk recorded in the
research doc.

## 2. Lemon Squeezy webhook receiver [SHIPPED, guards deferred]

Signature verification runs over the raw body with
`LICENSE_WEBHOOK_SECRET`. Dedupe is content-addressed: the event digest is
`sha256(provider:rawBody)`, written AFTER successful processing, so a
mid-processing failure lets the provider's retry process the event (the
retry gets `webhook_handled`, not a false `webhook_duplicate`).

State transitions: `order_created` → issue/register;
`order_refunded` → refund + revoke (validate rejects immediately);
subscription events bind `provider_subscription_id` so renewals and key-less
refunds reach the right row across the two LS identifier namespaces (order id
vs license-key id).

The review-loop follow-ups (bead `wt5f`, PR #925) are merged: subscription
events can no longer resurrect refunded/revoked rows, webhook audit rows
bind the matched license id, the provider refresh is TTL-cached (5 minutes,
per-isolate, successful answers only, dropped on revoke/refund), and the
activate rate-limit trip plus the truly key-less subscription event are
route-tested.

## 3. Secret governance [SHIPPED surface; PLANNED operations]

Inventory — the licensing phase adds exactly two secrets:

| Secret | Where set | Used by | Rotation |
|---|---|---|---|
| `ENTITLEMENT_SIGNING_KEY` | `wrangler secret put` (Worker secret store; also needed in GH Actions deploy env if deploys re-set it) | validate/activate minting (Worker), verification (extension constant) | Rotation invalidates every cached token; schedule with a major (tokens re-mint on next online check); 12-month target |
| `LICENSE_WEBHOOK_SECRET` | `wrangler secret put` | webhook signature verification | Rotate in LS dashboard + Worker together; a mismatch is fail-closed (401), so rotation is safe-by-construction |

No LS admin API key exists in scope: the LS license endpoints authenticate
with the license key itself (deliberate, "no secret sprawl" —
`licensing/provider.ts`). Admin REST operations reuse the existing dashboard
session auth + step-up patterns; no new admin secret ships.

Rules (match the repo's existing posture):

- Secrets never enter the repo, logs, responses, or analytics. The raw
  license key never appears in any response, log, or event (guard-tested in
  the worker suite; the extension controller never logs at all).
- The extension's `ENTITLEMENT_VERIFY_KEY` constant is NOT a secret — see §4.

## 4. Signature strength limitation + upgrade path [SHIPPED limitation, PLANNED upgrade]

The extension verifies tokens with an HMAC key shipped in the bundle
(`extension/src/entitlement/config.ts` states this honestly). That key is an
INTEGRITY check: it detects tamper and corruption of cached tokens. It is
NOT authenticity against a determined attacker, who can read the key from
the bundle and mint tokens a patched client accepts. This matches the
threat model's A1 residual ("any client-side gate is patchable; the goal is
raising cost, not DRM perfection") — and the real enforcement points stay
server-side (activation caps, revoke propagation, refund webhooks).

Upgrade path (PLANNED, post-launch hardening bead): Ed25519 asymmetric
signatures. Private key lives in the Worker; only the PUBLIC key ships in
the extension; forged tokens become computationally infeasible. WebCrypto
supports Ed25519 in Chrome/Firefox/Edge current builds; the module's
`verify.ts` isolates the crypto seam, so the swap touches one file plus the
Worker mint path. Trigger: whenever client-side forgery shows up in the
wild, or at the first paid-launch security review, whichever comes first.

## 5. Trust pages [PLANNED beads 2.4/2.5/2.6]

Inventory and required content when Pro ships:

- **Privacy policy** — add the license flow: license key + opaque install ID
  transmitted to our Worker for validation; no accounts, no Google identity,
  no file content. Firefox `data_collection: none` must stay honest: the
  entitlement analytics event is gated OFF on Firefox in code (#922).
- **Security page** — the licensing threat model summary (A1–A5 mitigations).
- **FAQ** — the copy rewrite (bead 0h4d.2.5) is OWNER-HELD per decision
  0h4d.10 ("free stays free; Pro adds organization, archive, sync") and the
  wayfinder-map gate. The pricing page (2.4) must stay consistent with that
  framing; the rewrite lands as one session once the owner lifts the hold.
- **Pricing page** (2.4) — one-time $9.99 ($7.99 launch), Free/Pro table
  grounded in `PRODUCT_FREE_PRO_PLANS.md`; no checkout (arrives with 2.9);
  refund policy link (LS is merchant of record).
- **Store listings** (2.6) — per `store-policies-paid.md`: CWS requires
  terms-of-sale + refund policy + "you, not Google, are the seller" +
  paywall disclosure in the description; AMO requires "listings must
  disclose when payment is required"; single listing per store (duplicate
  listings violate CWS spam policy).

## 6. Monitoring [SHIPPED base, PLANNED licensing signals]

Existing production net: hourly production verification
(`tools/verify-production.mjs`), HTTPS endpoint monitor, scrape-health
webhook, daily backups with post-deploy verification.

Licensing adds (PLANNED with 2.8):

- Webhook health: count `webhook_signature_invalid` and
  `webhook_processing_failed` responses; alert on any sustained non-zero
  rate (a secret mismatch or a malformed provider payload is silent
  otherwise).
- Validate/activate outcomes: error-rate by code, rate-limit trip counts
  (the DO limiter already sees them).
- Activation anomalies (fraud flags from the 2.1 threat model): activation
  velocity per key, install-ID count per key, refund-after-activation
  churn, validate-probe storms. Signals render as flags in the admin
  dashboard; a human decides (solo-dev support reality — no auto-bans).
- Surface: the existing dashboard card pattern (2.8's touch-points).

## 7. Open decisions (carried — not invented here)

From the 0h4d map's "Not yet specified" list, unchanged:

- Refund/dispute UX copy (LS mechanics are MoR-handled; the words are ours).
- Family/school bulk licensing (teacher buys for a class).
- Trial mechanics (time-boxed Pro vs feature-limited free trial).
- Conversion-funnel telemetry events (needed to measure Pro uptake; design
  must respect the Firefox no-telemetry gate).
