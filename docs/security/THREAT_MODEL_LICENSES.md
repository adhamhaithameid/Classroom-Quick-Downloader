# Threat Model — Licensing & Entitlement (pre-build)

**Date:** 2026-09-30 · **Owner:** Adham Haitham · **Tracker:** bead `0h4d.2.1` (Phase 2 first bead)
**Scope:** the licensing surface BEFORE any license code exists — worker endpoints (2.2),
extension entitlement module (2.3), admin ops (2.8), payments (2.9). No code ships in
Phase 2 before the mitigation named here for it exists.
**Companion research:** [monetization-provider.md](../research/monetization-provider.md)
(Lemon Squeezy: license keys with activate/validate/deactivate + per-key instance
limits, signed responses, webhooks), [store-policies-paid.md](../research/store-policies-paid.md)
(disclosure obligations; Firefox `data_collection` constraint).

## Assets & trust boundaries

| Asset | Where | Sensitivity |
|---|---|---|
| License keys (hashed) | Worker D1 `licenses` | secret-equivalent; never stored raw, never returned whole |
| Activations (install ID + key) | Worker D1 `activations` | links purchases to machines; PII-minimal (opaque ID only) |
| License event audit trail | Worker D1 `license_events` | integrity-critical (disputes, fraud) |
| Signed entitlement payload | Worker → extension | grant of Pro features; tamper = theft |
| LS webhook secret | Worker secret store | forgery = free licenses |
| Admin credentials | existing dashboard auth + step-up | full licensing control |
| Checkout flow | Lemon Squeezy (MoR) | payment data never touches CQD systems |

Trust boundaries: (extension SW ↔ worker API), (Lemon Squeezy ↔ worker webhook),
(admin browser ↔ worker dashboard), (worker ↔ D1). The extension is UNTRUSTED at the
API boundary — every endpoint assumes a hostile client.

## Attack tree → mitigations

Each leaf names the owning bead; a threat is closed only when its mitigation's test
exists. (Worker auth patterns reused: admin secret + step-up, DO rate limiting,
login-attempt lockout.)

### A. Free-Pro theft
- **A1 Forge an entitlement payload** (craft `isPro()` locally). → *2.3*: payload is
  HMAC-signed (worker secret, WebCrypto verify in extension); a modified payload fails
  verification. Tamper tests are a 2.3 gate. Residual: user patches the extension
  binary — accepted (any client-side gate is patchable; the goal is raising cost, not
  DRM perfection).
- **A2 Replay a captured valid payload.** → *2.3*: payload carries `expiresAt` +
  install ID; verification binds payload→install and revalidates against 2.2 within
  the grace window (30d max). Replayed onto another install fails the binding.
- **A3 Share one key across many machines** (the classic). → *2.2*: per-key instance
  limits (LS native) enforced at `activate`: N activations max, LRU eviction beyond,
  activation velocity logged. *2.8*: install-ID-count-per-key fraud flag.
- **A4 Enumerate valid keys** (guess/probe `validate`). → *2.2*: keys are high-entropy
  (LS-generated), stored hashed, validated via constant-time compare; validate +
  activate sit behind the existing DO rate limiter with per-IP + per-key budgets;
  probe storms trip the fraud signal (2.8).
- **A5 Use a refunded/charged-back key forever.** → *2.2*: webhook `refund/chargeback`
  transitions the license to `revoked`; validate honors revocation immediately;
  extension grace window lets it run out naturally (no bricking mid-term, no free ride
  past grace).

### B. Server-side attacks
- **B1 Forged or replayed webhooks** (attacker POSTs "purchase" to the worker). →
  *2.2*: LS webhook signature verify (HMAC, raw-body), timestamp tolerance window,
  event-id dedupe (idempotent replay rejection); unverified webhooks are dropped and
  logged. Test: valid / tampered / replayed / wrong-secret in 2.2's suite.
- **B2 Endpoint DoS** (hammer validate/activate, burn D1 quota). → *2.2*: existing DO
  rate-limiter pattern with per-IP budgets; validate responses are cacheable
  (30-day grace design means honest clients check rarely); abuse trips the 2.8 signal.
- **B3 SSRF / injection via new endpoints.** → *2.2*: parameterized D1 queries only
  (D1 blocked-keyword guard already exists); no outbound fetch driven by request
  input; Mimosa deep scan on the licensing surface once 2.2 exists (scan + triage per
  the sealed-scan precedent).
- **B4 Secret leakage** (webhook secret, admin secret). → existing secret-store
  patterns; secrets never in logs/responses (asserted in 2.2's tests); GitGuardian +
  audit gates stay on.

### C. Privacy & policy (the no-accounts posture)
- **C1 License check leaks identity** (breaks Firefox `data_collection: none`). →
  *0h4d.8 decision (CLOSED)*: identity = license key + **opaque install ID** — no
  Google account IDs, no emails to the worker. *2.3*: the `entitlement_check` event
  is opaque; *2.6*: AMO `data_collection` declares exactly this.
- **C2 D1 data exposure** (dump of licenses/activations). → *2.2*: keys hashed,
  install IDs opaque, no emails stored; D1 access only via the worker service layer
  (no public SQL surface); admin D1 console keeps its step-up gate.
- **C3 Diagnostics/history interplay** — a user's support report must not carry
  entitlement state. → *1.7 (shipped)*: diagnostics schema has no license fields;
  keep it that way when 2.3 lands (add a test asserting absence).

### D. Admin & ops
- **D1 Rogue admin action** (revoke/refund without trace). → *2.8*: every mutation
  writes a `license_events` row (who/when/what); dashboard actions require the
  existing admin auth; the audit trail is append-only.
- **D2 Fraud blind spots.** → *2.8*: signals = activation velocity, install-ID count
  per key, refund-after-activation churn, validate-rate spikes; flags render for a
  human decision — no auto-bans (solo-dev support reality, false positives lock out
  paying students).

## What this model deliberately does NOT cover

- Patched-extension piracy beyond A1's residual note (accepted risk).
- Lemon Squeezy's own compromise (their SOC/MoR responsibility; the provider-swap
  design — worker-side `LicenseProvider` interface — is the mitigation).
- School/bulk licensing and trial mechanics (fog-of-war; revisit post-launch).

## Execution checklist (wired into the owning beads)

- [ ] 2.2: webhook signature + replay tests; rate-limit trips; key-hash/constant-time
      tests; secrets-not-in-responses assertions; D1 migrations reviewed against C2.
- [ ] 2.3: signature tamper tests; install-binding test; grace/lock path tests;
      free-path regression guard; `entitlement_check` opacity test (C1); diagnostics-
      absence test (C3).
- [ ] 2.8: audit-trail completeness test; fraud-signal math tests (D2).
- [ ] 2.9: sandbox purchase→activate→refund→revoke E2E (HITL, owner's LS account).
- [ ] Mimosa deep scan on the licensing surface after 2.2 lands; zero untriaged
      findings closes this bead alongside the checklist.
