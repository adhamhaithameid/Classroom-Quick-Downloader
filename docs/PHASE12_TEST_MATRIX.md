# Phase 12 Test Matrix (Strict + Comprehensive)

This document maps each `plan.md` phase-12 requirement to concrete tests and commands in this repository.

Primary runner:

```bash
bash tools/phase12_verify.sh
```

---

## 12.1 Unit

1. Schema validators reject unknown fields and invalid enums.
   - `cloudflare-worker/tests/index-auth-config.test.ts`
   - `cloudflare-worker/tests/security.test.ts`
   - `oracle-backend/internal/handlers/public_website_test.go`
   - `website/src/lib/api/publicSite.security.test.ts`
2. Idempotency behavior for duplicate event IDs.
   - `oracle-backend/internal/handlers/public_website_test.go`
   - `oracle-backend/internal/handlers/public_website_internal_test.go`
3. Aggregation determinism by UTC day.
   - `oracle-backend/internal/handlers/public_website_internal_test.go`
   - `website/src/lib/api/publicSite.coercion.test.ts`

Command gates:

```bash
pnpm -C website run test:unit
pnpm -C cloudflare-worker run test:regression
pnpm -C oracle-backend run test:regression
```

## 12.2 Functional

1. Website click events accepted by Worker.
   - `cloudflare-worker/tests/functional.test.ts`
   - `cloudflare-worker/tests/security.test.ts` (`/api/public/website/events`)
2. Daily 23:00 flush emits correct batch.
   - `cloudflare-worker/tests/security.test.ts`
3. Oracle persists raw + aggregate in one transaction.
   - `oracle-backend/internal/handlers/public_website_internal_test.go`
   - `oracle-backend/internal/handlers/public_website_test.go`

Command gate:

```bash
pnpm run test:functional
```

## 12.3 Integration

1. Website -> Worker -> Oracle batch flow with correlation ID continuity.
   - `cloudflare-worker/tests/security.test.ts`
   - `oracle-backend/internal/handlers/ingest_e2e_test.go`
2. Oracle snapshot generation reflects new aggregate rows.
   - `oracle-backend/internal/handlers/public_website_test.go`
   - `website/src/lib/api/publicSite.integration.test.ts`
3. Dashboard replay of DLQ batch succeeds.
   - `cloudflare-worker/tests/security.test.ts`
   - `cloudflare-worker/tests/index-auth-config.test.ts` (route/auth path)

Command gate:

```bash
pnpm run test:integration:all
```

## 12.4 Regression

1. Existing extension ingest and dashboard behavior unchanged.
   - `cloudflare-worker/tests/regression.test.ts`
   - `cloudflare-worker/tests/dashboard.test.ts`
2. Existing public website endpoints still respond (compat wrappers).
   - `oracle-backend/internal/handlers/public_website_test.go`
   - `website/src/lib/api/publicSite.snapshot.test.ts`

Command gate:

```bash
pnpm run test:regression
```

## 12.5 Load

1. Worker ingest sustained throughput under expected peak.
   - `cloudflare-worker/tests/load-stress.test.ts`
2. Oracle batch ingest throughput for daily flush size.
   - `oracle-backend/tests/performance` benchmarks via `test:load`

Command gate:

```bash
pnpm run test:load
```

## 12.6 Stress

1. Burst ingest to queue limits.
   - `cloudflare-worker/tests/load-stress.test.ts`
2. Oracle temporary downtime + large replay on recovery.
   - `oracle-backend/internal/handlers/public_website_reliability_test.go`
   - `oracle-backend/internal/handlers/public_website_load_stress_test.go`

Command gate:

```bash
pnpm run test:stress
```

## 12.7 Security

1. Auth required on admin routes.
   - `cloudflare-worker/tests/index-auth-config.test.ts`
   - `oracle-backend/cmd/app/main_test.go`
2. Step-up required on danger routes.
   - `cloudflare-worker/tests/index-auth-config.test.ts`
   - `oracle-backend/cmd/app/main_test.go`
3. CSRF/origin checks enforced.
   - `cloudflare-worker/tests/index-auth-config.test.ts`
   - `oracle-backend/cmd/app/middleware.go` + test coverage in `cmd/app`
4. Rate-limit and lockout behavior validated.
   - `cloudflare-worker/tests/index-auth-config.test.ts`
   - `cloudflare-worker/tests/auth_timing.test.ts`
5. No raw IP leakage in public outputs.
   - `cloudflare-worker/tests/security.test.ts`
   - `oracle-backend/internal/handlers/public_website_test.go`

Command gate:

```bash
pnpm run test:security:all
```

## 12.8 UI

1. Worker dashboard replay/flush controls usable.
   - `cloudflare-worker/tests/dashboard.test.ts`
2. Oracle health chain panels show accurate state.
   - `oracle-backend/internal/handlers/ha_storage_test.go`
3. Website degraded states and refresh behavior correct.
   - `website/src/lib/stores/websiteSnapshot.test.ts`
   - `website/src/routes/layout.shell.test.ts`

Command gate:

```bash
pnpm run test:ui
```

## 12.9 Fuzz

1. Fuzz ingest payload parser for Worker and Oracle.
   - `cloudflare-worker/tests/fuzz.test.ts`
   - `oracle-backend/internal/handlers/public_website_fuzz_test.go`
2. Fuzz malformed JSON and boundary-size payloads.
   - `cloudflare-worker/tests/fuzz.test.ts`
   - `oracle-backend/internal/handlers/public_website_fuzz_test.go`

Command gate:

```bash
pnpm run test:fuzz:all
```

## 12.10 Reliability

1. Retry with jitter/backoff functions correctly.
   - `cloudflare-worker/tests/reliability.test.ts`
2. DLQ creation and replay path verified.
   - `cloudflare-worker/tests/security.test.ts`
3. No event loss across Worker restarts (within DO persistence guarantees).
   - `cloudflare-worker/tests/reliability.test.ts`
   - `oracle-backend/internal/handlers/public_website_reliability_test.go`

Command gate:

```bash
pnpm run test:reliability
```

## 12.11 Smoke

1. `health` endpoints.
2. one ingest call.
3. one snapshot call.
4. one authenticated dashboard call.

Command gates:

```bash
pnpm run test:smoke
bash tools/phase13_smoke.sh
```

---

## Single-command closure

For full strict closure:

```bash
bash tools/phase12_verify.sh
```
