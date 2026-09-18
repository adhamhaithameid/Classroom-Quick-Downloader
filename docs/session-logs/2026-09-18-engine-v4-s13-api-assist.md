# Session Log — Engine V4 S13: API Assist Engine (1yf.13)

Date: 2026-09-18 · Sprint: S13 (final sprint) of epic `1yf` (gh #685) · Subagent-driven development

## What shipped

| Commit | Content |
|---|---|
| `233e715b` | Identity token seam: optional `getIdentityToken?({scopes})` on BrowserPort (null-on-denial, never rejects) + chrome adapter + scriptable fake; 10 conformance tests |
| `934721ce` | `ApiDetector` (src/strategies/detect/api-detector.ts, name 'api'): decorator over a base DOM detector; `refresh()` pre-resolves token+snapshot (Detector.observe stays sync); fallback-to-base pinned by OBJECT IDENTITY across six triggers (denied token, no snapshot, pre-refresh, route mismatch, 120s expiry, post-reset); enrichment = strictly additive D12-style corroboration floor on an already-parsed DOM numeral, debug-traced (`api-corroboration` LayerTrace) |
| `70f40f42` | Consent + activation (#398): `isApiConfigured()` (identity permission + manifest oauth2.client_id); registry `'v3'` → `[EngineV3]` when configured else the unchanged fallback; popup Engine Mode 'API (beta)' disabled-with-tooltip → enabled = explicit consent; EngineV3 composes ApiDetector end-to-end (token → snapshot → refresh on student-work views → corroboration traces via `getApiCorroborationTrace(postId)`); privacy enforced at four test-pinned layers (popup gate → registry gate → orchestrator active-engines → student-work-view guard; non-interactive only; destroy clears everything) |
| `16e173ac` | Owner setup guide: docs/engine/api-assist-setup.md (exact wxt.config JSON, verification steps, privacy model) |

## G6 posture for V3

"V3 either shipped behind OAuth or explicitly deferred" — **shipped behind OAuth**: the full code path is live and testable; it is inert in shipped builds until the owner completes the setup doc (Google Cloud OAuth client id + identity/oauth2 manifest fields — the same wxt.config edit window as bead 770's default_locale).

## Honest deferrals (owner-credential follow-ups, on the epic/beads)

- The rendered-flag corroboration floor: API corroboration currently surfaces as traces, not flag-score changes — deliberate (R7: assist, never replace; promotion stays manual).
- The identity port adapter is the test/probe seam; EngineV3 still wires its pre-existing `ChromeIdentityTokenProvider` (semantics identical). Unify when the OAuth step lands.
- DetectContext carries no course ids, so between-refresh staleness is bounded by viewKind + 120s TTL — refresh-on-view-change discipline documented as load-bearing.

## Verification

Unit 4,014 passed / 11 failed (the standing parallel-session acquire-corpus set) · tsc clean · accuracy 20/20 · qa 16/0/1 headless · fitness 54/54.
