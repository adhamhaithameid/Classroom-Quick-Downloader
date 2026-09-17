# Plan: Grid cursor bend (website ambient background)

## Destination

On every page of the website, the 60px engineering grid in `AmbientBackground.svelte`
bends gently around the cursor — lines bow as if wrapped around a circle centered on
the pointer, then return to pixel-identical straightness. Touch devices, reduced-motion
users, and no-JS visits keep today's static CSS grid.

## Context

- Prototype validated: `website/prototype-grid-bend.html` (throwaway, untracked).
  Judge passed all 5 screenshots (off/whisper/circle/magnetic + scrolled).
  Winner: **Circle** — radius 190px, strength 10px, swirl 0.35, follow 0.16.
- The lines: `.l2-page-grid` in `website/src/lib/components/AmbientBackground.svelte` —
  1px `linear-gradient` lines, `background-size: 60px 60px`, layer `opacity: 0.05`,
  color `var(--text)`; mounted once in `+layout.svelte`; absolute, scroll-locked,
  `pointer-events: none`, `aria-hidden`.
- Website tests run in vitest `environment: 'node'` (no DOM). Pure math gets unit
  tests; DOM/canvas code stays thin and is pinned by the existing string-assertion
  guard tests plus visual verification.
- House pointer-effect conventions (navbar sheen, footer canvas): passive listeners,
  cached rects, JS writes CSS/DOM only when needed, `prefers-reduced-motion` honored.

## Global Constraints

1. **Baseline fidelity**: with the cursor far away (or before any pointer event), the
   canvas-rendered grid must be indistinguishable from the CSS grid: 60px pitch, 1px
   lines at `var(--text)`, 0.05 effective opacity, lines locked to document coordinates
   (scroll-compensated), lines land on the same subpixels (`+0.5` stroke offset).
2. **Gates**: the effect activates only when `matchMedia('(pointer: fine)').matches`
   AND `!matchMedia('(prefers-reduced-motion: reduce)').matches`. Otherwise the CSS
   grid stays and the canvas never renders. Re-check on media change.
3. **Stacking/a11y**: canvas is `aria-hidden`, `pointer-events: none`, sits where the
   grid sat (z-index 0, content above). The `.l2-page-grid` wrapper keeps its class,
   opacity, and CSS background (used as fallback; hidden via a `bend-live` class only
   while the canvas paints).
4. **Performance**: passive listeners; no per-event layout reads; devicePixelRatio
   capped at 2; rAF loop draws only while unsettled and stops when settled;
   `visibilitychange` pauses the loop.
5. **Effect character (locked from prototype)**: Gaussian falloff
   `exp(-(d²/R²))`, R = 190; radial push away from cursor + tangential swirl 0.35;
   max displacement 10px; exponential cursor smoothing factor 0.16/frame@60fps;
   influence eases in on pointer activity and out on document mouseleave.
6. **Tests**: TDD at the pure-math seam (vitest, node env). Guard tests
   (`style-consistency.guard.test.ts`) extended to pin: canvas aria-hidden, `bend-live`
   fallback swap, reduced-motion gate, pointer-events none. All existing guard
   assertions stay green.
7. Vanilla CSS + scoped Svelte styles (no Tailwind). TypeScript strict per tsconfig.

## Task 1 — `bendField` pure module + tests (TDD)

New `website/src/lib/grid/bendField.ts`:

- `export interface BendParams { radius: number; strength: number; swirl: number }`
- `export const GRID_PITCH = 60`, `export const FADE_EPS = 0.004`
- `export function bendOffset(x, y, cx, cy, p: BendParams): { dx: number; dy: number } | null`
  — Gaussian falloff; null when falloff ≤ FADE_EPS (draw straight). Radial push away
  from cursor plus tangential swirl (rotate offset by adding `(-uy, ux) * swirl`).
- `export const BEND_DEFAULTS: BendParams` = `{ radius: 190, strength: 10, swirl: 0.35 }`
  plus `FOLLOW = 0.16`, `DPR_CAP = 2`, `SAMPLE_PX = 16`.

TDD (vitest, node env — write failing tests first, watch fail, implement, watch pass)
in `website/src/lib/grid/bendField.test.ts`:

- offset is `null` well beyond the radius (no displacement in far field)
- offset at the cursor itself is zero (r → 0 guard, no NaN)
- a point directly above the cursor is pushed further up (radial, away) with swirl 0
- swirl 0.35 rotates the offset counter-clockwise relative to the radial direction
- displacement magnitude grows monotonically with `strength`
- falloff decays: |offset| at distance 2R is far smaller than at R
- `GRID_PITCH`/`BEND_DEFAULTS`/`FOLLOW`/`DPR_CAP`/`SAMPLE_PX` carry the locked values

Run: `cd website && npx vitest run src/lib/grid/bendField.test.ts`

## Task 2 — Svelte action + AmbientBackground integration + guards + changelog

1. New `website/src/lib/actions/gridBend.ts` — Svelte action `gridBend(canvas: HTMLCanvasElement)`.
   Behavior (using Task 1's module): viewport-fixed canvas painting the 60px grid
   (1px strokes, color from computed `--text`, canvas element at `opacity: 0.05`),
   scroll-compensated via `window.scrollX/scrollY` per draw; passive `pointermove` on
   window, `mouseleave` on documentElement, passive `scroll`, `resize`, and
   `visibilitychange`; gates checked on init and on media `change` (never activates
   when gates fail); toggles `bend-live` on `canvas.parentElement` only while active;
   rAF loop stops when settled; `destroy()` removes listeners, loop, class, and
   resets canvas display.
2. `website/src/lib/components/AmbientBackground.svelte`: add
   `<canvas class="l2-grid-canvas" aria-hidden="true" use:gridBend></canvas>` inside
   the `.l2-page-grid` div (after it, as sibling child of the component root — canvas
   paints where the grid paints). Scoped CSS: `.l2-grid-canvas { position: fixed;
   top: 0; left: 0; width: 100%; height: 100%; opacity: 0.05; pointer-events: none;
   z-index: 0; display: none; }` and `.l2-page-grid :global(...)` not needed — add
   `bend-live` handling on the canvas's parent via the action's class toggle:
   `.l2-page-grid.bend-live { background-image: none; }` (note: `bend-live` toggled on
   the grid div = canvas's parent). Update the component's header comment (one line)
   to mention the cursor bend.
   Ruling (review, 2026-09-17): `.l2-grid-canvas` must NOT carry its own opacity —
   the wrapper's `opacity: 0.05` already composites the whole subtree, so an own
   0.05 would double-apply to an effective 0.0025.
3. `website/src/routes/style-consistency.guard.test.ts`: extend the ambient test
   (keep every existing assertion green) to also pin: canvas markup with
   `aria-hidden="true"` + `use:gridBend`, `.bend-live` fallback rule, and that
   `gridBend.ts` references `prefers-reduced-motion` and `pointer: fine`.
4. Run `website/src/routes/layout.shell.test.ts`, `overview.visual-guard.test.ts`,
   `routes.render.test.ts`; update only if the new canvas breaks an assertion.
5. `data/changelog/website-changelog.manual.md`: one entry at the top following the
   file's existing entry format ("Background grid lines now bend gently around your
   cursor; static for reduced-motion / touch — falls back automatically").

Validation: `cd website && npx vitest run src/lib/grid/bendField.test.ts
src/routes/style-consistency.guard.test.ts src/routes/layout.shell.test.ts
src/routes/overview.visual-guard.test.ts src/routes/routes.render.test.ts &&
pnpm check`. Then visual gate (controller-run): build/preview screenshots idle +
cursor-hover on desktop and mobile widths, judged; idle shot compared for seamlessness.

## Execution notes

- Branch: current branch (`main`) per approved plan — repo convention is direct work
  on main; user approved committing there.
- Prototype file `website/prototype-grid-bend.html` stays untracked (throwaway);
  not committed with this work.
- Production rewrite, not prototype promotion: no preset/slider chrome, constants
  locked, action returns `destroy` cleanup.
- Note (2026-09-17): the shipped displacement model is the **Lens** variant (user
  choice after evaluating five variants in the prototype); `bendOffset` is a fisheye
  lens, not radial+swirl; peak offset ≈ 10px at radius 190 / strength 10.
