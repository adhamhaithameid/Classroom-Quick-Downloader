# AnimatedNumber viewport-threshold fix plan

Bead: Classroom-Quick-Downloader-11z (P3, claimed). During visual QA the "100+
Languages" AnimatedNumber showed `0+` until its host was scrolled to viewport
center. Root cause is two-part in `website/src/lib/components/AnimatedNumber.svelte`:

1. After hydration with `animated` + `animateOnView`, the component resets
   `displayValue` to the start value and waits for an IntersectionObserver
   configured with `rootMargin: '0px 0px -8% 0px'` (default). That negative
   bottom margin SHRINKS the observation root, so a host sitting in the bottom
   ~8% of the viewport — i.e. visible to the user — never reports
   `isIntersecting`, and the counter stays at `0` indefinitely.
2. There is no fallback: if the observer never fires (band edge, exotic
   layouts, host partially clipped), the final value is never reached.

## Spec

The counter must ALWAYS reach its final value, and must reach it promptly
whenever any part of the host is inside the real viewport — even while the
shrunken observer band would not yet report intersection. The prerendered SSR
HTML must keep rendering the final value (no flash of `0` in no-JS contexts).
The component's public props API must not change.

## Approach (agreed)

Extract the first-in-view orchestration out of the component into a pure,
dependency-injected TypeScript module so it is testable in the repo's
node-only vitest environment (no DOM-environment dependency may be added).
The module combines:

- a real-viewport fast path: at observe time, if the host's bounding rect
  intersects the real viewport (any partial visibility, non-zero size), fire
  immediately without waiting for the observer;
- the IntersectionObserver path for hosts fully outside the viewport;
- a fallback timer so a never-firing observer still ends at the final value;
- exactly-once semantics and a disconnect handle.

The component keeps its props, its reactive re-animation on value change, and
its SSR contract; only the onMount trigger wiring changes.

## Global Constraints

1. **No new dependencies.** `vitest` environment stays `node` (see
   `website/vitest.config.ts`). Tests stub `IntersectionObserver`, timers
   (`vi.useFakeTimers`), and viewport geometry — no jsdom/happy-dom.
2. **Allowed files ONLY:**
   - `website/src/lib/components/AnimatedNumber.svelte` (modify)
   - `website/src/lib/components/AnimatedNumber.ui.test.ts` (extend)
   - `website/src/lib/components/animated-number/in-view.ts` (new module)
   - `website/src/lib/components/animated-number/in-view.test.ts` (new tests)

   Touching anything else is a spec violation. A parallel session is actively
   editing `overview/+page.svelte`, `app.css`, `SeoContentPage.svelte`,
   `_worker.js` and extension sources on this same branch — never stage,
   edit, or revert those. Stage only the four files above by explicit path
   (never `git add -A` / `git add .`).
3. **SSR contract:** existing SSR assertions in
   `AnimatedNumber.ui.test.ts` must keep passing unmodified (prerendered HTML
   shows the final value, or the `initialValue` when provided).
4. **Props API unchanged:** `value`, `initialValue`, `suffix`, `prefix`,
   `format`, `animated`, `animateOnView`, `threshold`, `rootMargin` keep their
   names, types, and defaults.
5. **TDD mandatory:** every new behavior is written as a failing test first
   (RED observed, then minimal GREEN). A stub module is acceptable scaffolding
   to turn import errors into assertion failures.
6. **Behavior contract** for the module (see Task 1).

## Task 1: Extract testable in-view orchestration and fix the viewport band bug

Create `website/src/lib/components/animated-number/in-view.ts` exporting an
orchestration function (suggested name `observeFirstInView`) with this
contract:

- Inputs: a host `Element`; observer options `threshold` (number) and
  `rootMargin` (string) passed through to IntersectionObserver; an
  `onEnter` callback; an optional fallback delay (default 4000 ms); viewport
  geometry and the IntersectionObserver constructor must be resolvable in a
  node test (via injectable fields or `vi.stubGlobal` — implementer's choice,
  documented in the module).
- Behavior:
  1. If no `IntersectionObserver` constructor exists, call `onEnter()`
     immediately (preserves today's no-IO path).
  2. Else, before/while observing, take a real-viewport fast path: read the
     host rect; if it is non-zero-size and any part of it lies inside the
     real viewport (`rect.bottom > 0 && rect.top < viewportHeight`), call
     `onEnter()` immediately without waiting for the observer. This is THE
     fix: the default `rootMargin: '0px 0px -8% 0px'` band must not be able
     to hold a partially-visible counter at `0`.
  3. Otherwise observe the host; when the observer reports `isIntersecting`
     for the host, call `onEnter()`.
  4. If nothing has fired `onEnter` after the fallback delay, fire it then.
  5. `onEnter` executes exactly once, no matter how many of the above paths
     fire (duplicate IO entries, fast path + observer + fallback racing).
  6. The returned handle's `disconnect()` cancels the observer and the
     fallback timer so `onEnter` can no longer fire afterwards.

Required node-env test cases (`in-view.test.ts`) — each watched failing
before implementation:

  a. fires `onEnter` immediately when the host rect is partially inside the
     real viewport even though the observer never reports intersecting
     (rect `{ top: 850, bottom: 880, width: 100, height: 30 }`, viewport
     height 900, observer constructed but never fires) — the reported bug;
  b. waits for the observer when the rect is entirely below the viewport,
     and fires when the captured observer callback reports
     `{ isIntersecting: true }`;
  c. does not take the fast path for a zero-size rect (`{0,0,0,0}`,
     display:none host) — waits for observer/fallback instead;
  d. falls back to `onEnter` after the delay when the host stays outside the
     viewport and the observer never fires;
  e. fires exactly once when the observer fires twice and the fallback also
     elapses;
  f. `disconnect()` prevents any later `onEnter` from observer or fallback;
  g. fires immediately when `IntersectionObserver` is undefined.

Then rewire `AnimatedNumber.svelte` onMount to use the module: the existing
`!animated` and `!animateOnView` branches and the reactive `$:` re-animation
stay as they are; the IntersectionObserver block is replaced by the module
call (`onEnter` sets `hasAnimatedInView = true` and calls
`animateTo(value)` once), and the cleanup returns the module handle's
`disconnect()` plus `stopAnimation()`.

Extend `AnimatedNumber.ui.test.ts` only if an SSR-level assertion is needed
for unchanged behavior (existing three tests must pass unmodified).

Tests to run (from `website/`): `pnpm vitest run
src/lib/components/animated-number/in-view.test.ts
src/lib/components/AnimatedNumber.ui.test.ts
src/lib/components/AnimatedNumericText.ui.test.ts` and `pnpm test:ui`.
Full-suite runs are polluted by a parallel session's in-flight work on this
branch — do not run or fix those; report only the suites above.

Commit message: `fix(website): AnimatedNumber counters always reach their final value — real-viewport fast path + in-view fallback (#11z)` — stage the four files by explicit path only.
