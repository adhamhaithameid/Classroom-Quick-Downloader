# Free → Pro Security & Fintech Readiness Design

Date: 2026-09-30 · Status: DESIGN (no code) · Aligns with the closed plan decisions: Lemon Squeezy as Merchant of Record ($9.99 one-time), license key + opaque install ID, Cloudflare-only infrastructure.

This document is the security architecture for the paid tier of the website/Worker stack, to be implemented when the free-completion gate (0h4d) opens the Pro phase.

## 1. Payment boundary (PCI posture)

Lemon Squeezy is the Merchant of Record: checkout, card data, tax, and fraud live entirely on their PCI-DSS-scoped infrastructure. **No cardholder data ever touches this stack** — the card data scope (SA-A) is preserved by keeping it that way. The Worker never receives PANs; it receives signed webhook events and issues license keys.

## 2. New Worker endpoints (all under `/api/v1/license`, versioned from day one)

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/v1/license/activate` | POST | License key + opaque install ID | Validates key, binds install, returns signed entitlement token |
| `/api/v1/license/validate` | GET | Entitlement token | Re-check (cached in KV, short TTL) |
| `/api/v1/license/deactivate` | POST | License key + install ID | Frees a seat |

Design rules (from this audit's findings):
- **License keys stored hashed** (SHA-256 with a server pepper secret); the raw key exists only at issuance. Lookup by key hash; no sequential IDs — key format `CQD-XXXX-XXXX-XXXX-XXXX` (crockford base32, 80 bits entropy).
- **Opaque install ID**: client-generated UUIDv4, stored salted-hashed per activation row; never logged.
- **Signed entitlement token**: HMAC-SHA256 over `{licenseId, installId, tier, exp}` with a dedicated `LICENSE_TOKEN_SECRET` (rotatable; separate from `DO_SHARED_SECRET`). TTL 24h; renewal via `/validate`.
- **Rate limits**: reuse the shared per-IP minute limiter (`checkIpMinuteRateLimit`) — activate: 5/min/IP + 20/day/IP; validate: 60/min/IP. Per-key failure lockout mirrors the dashboard login limiter (5 fails → 15 min).
- **Activation seats**: cap per key (e.g. 3 installs); reactivate-with-same-ID is idempotent; seat release requires key knowledge.

## 3. Lemon Squeezy webhook receiver

- `POST /webhooks/lemon-squeezy` — **no session, no header secret; HMAC-SHA256 of the raw body** in the `X-Signature` header, constant-time compare, timestamp tolerance ±5 min, and a replay cache (event id, KV, 7-day TTL) for idempotency.
- Processed events: `order_created`, `subscription_created/updated/deleted`, `license_key_created`. Handler writes an entitlements record (KV + DO audit entry) and issues license keys. Failures go to a dead-letter queue mirroring `websiteTelemetry` semantics.
- Keep a **manual fulfillment fallback** (dashboard admin endpoint with danger step-up) in case the webhook pipeline is down — the Phase 0 incident shows why a webhook-only flow needs a human override.
- Endpoint sits OUTSIDE the CORS-allowlisted set (server-to-server only) and outside the public Origin-required group.

## 4. Secrets & governance

- New secrets: `LICENSE_TOKEN_SECRET`, `LS_WEBHOOK_SECRET` — injected via `wrangler secret`/CI only; added to `.dev.vars.example` with placeholders; documented in `docs/RUNBOOK_DEPLOYMENT.md`.
- **Rotation runbook** (docs to write when Pro launches): rotate `DO_SHARED_SECRET` (rolling: set → deploy → remove old), `DASHBOARD_PASSWORD`, payment secrets (Lemon Squeezy re-sign → swap), Google service account keys (annual).
- Cloudflare Access (`CLOUDFLARE_ACCESS_REQUIRED=1` + email allowlist) recommended before Pro launch — it fronts the whole dashboard with Google SSO on top of the existing password gate.

## 5. Entitlement data model (KV + DO)

- KV `entitlement:<installHash>` → `{tier, licenseId, exp, issuedAt}` TTL 48h (edge-fast validation).
- DO authoritative map `licenseKeys: { keyHash → { status, seats: [{installHash, activatedAt}], issuedAt, orderId } }` with audit entries for every mutation (reuse `dangerActionAuditLogs` pattern + actor IP trimming).
- Free tier stays keyless — entitlement checks short-circuit on missing token.

## 6. Monitoring & abuse response

- Reuse `ALERT_WEBHOOK_URL` plumbing: alert on webhook signature failures (>3/hour), activation lockouts, seat-exhaustion bursts, and the existing pipeline-health criticals (the current incident shows alerts must actually be configured — `lastHealthNotifyAt` has never fired because the URL is unset).
- Extend the danger audit trail to all license-admin mutations with export (admin endpoint, step-up gated).

## 7. Website/legal surface

- `/pricing` + checkout links carry `rel="nofollow sponsored"` (merchant policy), no `unsafe-inline` CSP regressions (checkout is hosted on Lemon Squeezy's domain).
- Privacy policy update: license keys, install IDs, and order emails retained X days; card data statement (never stored).
- `/.well-known/security.txt` page with the disclosure contact from `SECURITY.md`.

## 8. Non-goals

No self-hosted payment processing, no card data handling, no subscription state on the site, no license checks inside the marketing site itself (extension/Worker only).
