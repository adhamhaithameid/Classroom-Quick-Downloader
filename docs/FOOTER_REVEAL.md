# Footer Reveal — file map & contracts

Current as of 2026-10-03 (verified against `website/src`; anchors are
`file:line`). This system was rebuilt through 12 tuning rounds (2026-09);
the contracts below are the shipped ones. Guard tests pin most of them —
when you change a number here, change its guard or the suite will (correctly)
fail.

## Terminology: two different "magnetic" systems

- **Scroll detent** — `src/lib/scroll/magneticPin.ts` (+ its test). The
  footer-reveal magnet: capture band, hold, settle, release.
- **Cursor-pull CTA** — `src/lib/actions/magnetic.ts` +
  `src/lib/motion/magneticField.ts`; the `.ft-magnet` buttons in the footer
  (`SiteFooter.svelte:185-228`, pull clamp ±5px ×0.16). Guard:
  `src/lib/motion/magnetic.guard.test.ts` whitelists files per effect and
  **forbids** `+layout.svelte` and `SiteFooter.svelte` from `use:magnetic`.

## File map

| File | Role |
|---|---|
| `src/lib/scroll/magneticPin.ts` (303 ln) | detent math + runtime (`initMagneticPin`) |
| `src/routes/+layout.svelte` (3007 ln) | reveal wiring: geometry, scroll vars, arming, CSS (`initSheetReveal` :534-670, reveal CSS :1405-1530) |
| `src/lib/components/SiteFooter.svelte` (1264 ln) | cascade choreography + stagger CSS (:49-88 JS, :1140-1185 CSS) |
| `src/lib/components/AmbientBackground.svelte` | orbs + lens grid; `paused` prop freezes when invisible (instances: `+layout.svelte:1297,1316`) |
| `src/lib/actions/gridBend.ts` + `src/lib/grid/bendField.ts` | 60px cursor-bent canvas grid (action; math module) |
| `src/lib/styles/glass.css` | shared glass language; `.glass-stagger` is card-level, not the footer cascade |
| `src/lib/celebration/balloons/` | in-house balloon engine (`engine.ts`, `controller.ts` gating, `config.ts`) |
| `src/lib/components/BalloonsOverlay.svelte` | fixed overlay, `use:portalToBody` (:20) — see trap below |
| `src/lib/actions/portalToBody.ts` | portal action; header comment names the containing-block cause (:1-4) |
| `docs/research/footer-reveal-round7-research.md` | design research for the detent |

## Pin/hold contracts (`magneticPin.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `HOLD_OFFSET_PX` (:35) | **0** | footer fully hidden at rest — the user-approved contract; the old 56px peek is retired (:31-34). Pinned by `magneticPin.test.ts:108`. |
| `PULL_BAND_PX` (:37) | 150 | capture band above the pin (`lo = pinY − 150`) |
| `ESCAPE_PX` (:39) | 160 | past hold +160 = free scroll |
| `INTENT_PX` (:43) | 260 | sustained push (≥ one wheel tick ~105px) that breaks the magnet; pinned `INTENT_PX >= 260` |
| `INTENT_DECAY_MS` (:46) / `QUIET_MS` (:48) | 250 / 150 | intent gap / rest-arrival quiet time |
| `SETTLE_RATE` (:50) | 0.2 | exponential settle per frame |

Runtime semantics: cancelable wheel interception (:210-232), rest arrivals via
quiet timer (:131-142), settle writes `scrollTo({behavior:'instant'})` (:181),
release hands back to native scroll with **no scrollTo** (pinned), re-arm only
when the zone is left (:255-262, pinned).

## Reveal wiring (`+layout.svelte`)

- Geometry: pin = `mainH − viewport`, budget = `footerH − viewport`, written
  to `--sheet-pin` / `--reveal-pad` / `--reveal-budget` (:562-577); progress
  `e` recomputed every frame from untainted quantities — `getBoundingClientRect`
  freezes at the stick and `offsetTop` grows by stick displacement (:595-608).
- **Arming hysteresis**: arm at `e >= -150`, disarm at `e < -200`
  (:643-645); `sheetGone` at `e >= innerHeight − 2` (:649).
- **The containing-block trap**: `.reveal-live.is-revealing main` gets
  `translate: 0 calc(-1 * var(--lift))` (:1437) and `will-change: translate`
  (:1441) → `<main>` becomes the containing block for every `position:fixed`
  descendant, which renders them document-anchored. **Any fixed overlay must
  `use:portalToBody`** (BalloonsOverlay does, :20; media modal and edit
  toolbars were the historical casualties). Runway spacer `.reveal-runway`
  must stay a sibling of `<main>`, not its margin (rationale :1405-1413 —
  margin caused a measured double-speed lift bug).
- Reduced-motion overrides: :1503-1530. First-paint guard: `html.js` +
  `.reveal-off` (:1494-1501); SSR must never ship hidden cascade state
  (`layout.shell.test.ts:190`).

## Cascade (`SiteFooter.svelte`)

Tokens: `--ft-rise: 16px`, `--ft-click-ease: cubic-bezier(0.32,1.35,0.42,1)`
(:759-760). Choreography (:49-88): `STEP_MS = 55`, `CHAIN_GAP = 120`,
`CHAIN_CAP = 440`, `ARM_LINE = 0.92` (arm only below 92% viewport);
IntersectionObserver `rootMargin: '0px 0px -8% 0px'` (:145) + rAF scroll
backstop. CSS (:1140-1165): `ft-armed` hides (opacity + translateY + scale),
`ft-go` runs `ft-click-in 0.55s` — **opacity + transform only, no
visibility**; classes stripped on animationend (:169-176). Reduced-motion
kill switch :1169-1185.

## Drift traps (numbers that changed repeatedly — update guards with them)

The tuning rounds moved these numbers more than once; nothing in `qa-artifacts/`
is committed (that directory is runtime-generated, `tests/e2e/qa/report-generator.mjs:15`),
so these code constants are the only source of truth:

- `±150/−200` arming hysteresis — `+layout.svelte:643-644`
- `innerHeight − 2` sheetGone — `+layout.svelte:649`
- `0.92` ARM_LINE and `−8%` rootMargin — `SiteFooter.svelte:78,145`
- `HOLD_OFFSET_PX = 0` — pinned by `magneticPin.test.ts:108`

## Guard tests

- `src/lib/scroll/magneticPin.test.ts` — zone math + source-contract suite
  reading `magneticPin.ts` as text (cancelable-only, INTENT ≥ 260, no
  scrollTo on release, re-arm-on-exit, HOLD = 0)
- `src/lib/motion/magnetic.guard.test.ts` — `use:magnetic` whitelist
- `src/routes/layout.shell.test.ts` — no SSR-hidden cascade state; footer render layers
- `src/lib/components/BalloonsOverlay.component.test.ts` — overlay behavior
- `src/lib/grid/bendField.test.ts` — bend math
