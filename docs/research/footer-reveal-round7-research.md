# Sticky footer reveal: scroll detents, rendering perf, flash prevention — Research Notes

*Research date: 2026-09-19. Round 7 research for the website sticky-sheet footer reveal
(`<main>` sticky at `top: -(mainH - 100vh)`, fixed 100vh footer window beneath it at z-index 0,
scroll-linked `--lift`/`--ft-travel` CSS vars via rAF-throttled passive scroll listener, two
full-viewport 2D canvases painting a cursor-bent grid, 2×12 `blur(120px)` orbs, glass surfaces
with `backdrop-filter: blur(20-28px)` over the animating canvas). Primary sources only:
MDN, CSSWG drafts, web.dev / Chrome developer docs, W3C WCAG understanding docs, library docs
and source.*

---

## TL;DR

1. **Do not put CSS scroll-snap on the root scroller for the detent.** In `proximity` mode snapping
   happens only "at the termination of a scroll, at the discretion of the UA" (CSSWG
   [css-scroll-snap](https://drafts.csswg.org/css-scroll-snap/)), programmatic `scrollTo()` is
   *also* subject to snapping (spec, Issue 2593), re-snap after any layout/content change is
   mandatory, and the snap area is the **transformed border box** of the sentinel — which is
   exactly the thing our live-geometry reveal keeps moving. The
   [Interop 2024 scroll-snap issue](https://github.com/web-platform-tests/interop/issues/492)
   explicitly notes "many unresolved scroll-snap bugs remain, particularly when used on
   `:root`/viewport".
2. **Known root-scroller snap bugs are real and unfixed in places**: sticky-positioned elements
   produce inaccurate snap positions (Chromium
   [835301](https://issues.chromium.org/issues/835301)); scripted scrolling on snap containers
   fails in Safari 18 ("the scroll position does not move, or the content fails to render",
   WebKit [283707](https://bugs.webkit.org/show_bug.cgi?id=283707), still NEW/P2); bugs cluster
   around `scrollIntoView()`, scroll-to-top gestures, find-in-page and VoiceOver (interop #492).
3. **The JS detent pattern is the right family — copy GSAP's contract, not fullPage.js's.**
   ScrollTrigger snap works by "merely animat[ing] the native scroll position and … automatically
   relinquish[ing] control the moment the user attempts to scroll", factors scroll velocity into
   the snap destination, and cancels the snap on any user scroll interaction
   ([GSAP ScrollTrigger docs](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)). Never trap:
   WCAG 2.3.3 requires interaction-triggered motion be disableable, and the spec's own snapping
   section demands "a user can 'escape' a snap position, regardless of the scroll method".
4. **On iOS you cannot win a fight against native momentum**: programmatic scroll updates issued
   during an active flick "try to be at different positions at the same time"
   ([react-window #122](https://github.com/bvaughn/react-window/issues/122)). Design the detent
   for wheel/trackpad only; on touch, settle *after* the gesture (via `scrollend`) instead of
   mid-momentum.
5. **`scrollend` (Baseline, newly available since Dec 2025) is the correct settle primitive** —
   it fires when "the scroll position has no more pending updates and the user has completed
   their gesture", including after programmatic smooth scrolls
   ([MDN scrollend](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event)).
   Use it instead of scroll-debounce timers; keep a timeout fallback.
6. **Two always-on full-viewport canvases + 24 `blur(120px)` layers is the single biggest perf
   risk in the stack.** Layer creation is not free — "every layer you create requires memory and
   management" and "Every layer's textures needs to be uploaded to the GPU"
   ([web.dev, stick to compositor-only properties](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)).
   Canvas guidance: "Render screen differences only, not the whole new state", pre-render
   repeated drawing to an offscreen canvas, and layer static vs dynamic content
   ([MDN Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)).
7. **Pause the footer canvas while it is concealed** via IntersectionObserver (built for
   "Deciding whether or not to perform tasks or animation processes based on whether or not the
   user will see the result" — [MDN IO](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API))
   plus `document.visibilityState` for tab-hide. `visibility: hidden` does **not** stop animation
   work the way rendering-skipping properties do — `content-visibility: hidden` "skips its
   contents … similar to giving the contents display: none" while visibility only stops painting
   ([MDN content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)).
8. **`backdrop-filter` over an animating canvas forces the blur to be recomputed every frame.**
   MDN confirms it "applies filter effects to the pixels painted behind the element" and scopes
   them to the nearest *backdrop root*; web.dev's own article carries the warning "backdrop-filter
   can hurt performance. Test before deploying"
   ([web.dev backdrop-filter](https://web.dev/articles/backdrop-filter)). Watch out for accidental
   backdrop roots (any ancestor with `opacity` < 1, `filter`, `mask`, `will-change` on those
   properties) — a common cause of the effect "not working" or of extra work
   ([MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)).
9. **`will-change` is a last-resort, per-element hint**: "Use the will-change property as a last
   resort to try to deal with existing performance problems", overuse "will result in excessive
   memory use", and it should be added/removed around the animation via script
   ([MDN will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)).
   `contain: layout paint` on the two 100vh windows is safe and useful — paint containment means
   "if the containing box is offscreen, the browser does not need to paint its contained elements"
   — but it creates a containing block for `absolute/fixed` descendants and a new stacking
   context ([MDN contain](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)).
10. **Read-then-write inside one rAF frame is the sanctioned shape**: "batch your style reads and
    do them first … and then do any writes", and reads are cheap while layout is clean — "all the
    old layout values from the previous frame are known and available for you to query"
    ([web.dev, avoid layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)).
    Our one `getBoundingClientRect()` per frame for live geometry is the *cheap* case; the sin is
    interleaving reads and writes.
11. **`@starting-style` + `transition-behavior: allow-discrete` (both Baseline 2024) replace the
    "add the class a frame after first paint" hack**: "CSS transitions are by default not
    triggered on an element's initial style update … To enable first-style transitions,
    @starting-style rules are needed"
    ([MDN @starting-style](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style)), and
    `allow-discrete` animates `display`/`visibility` with value flips timed so content is visible
    for the whole duration ([MDN transition-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior)).
12. **bfcache restore is a real flash source**: the page is restored from "a snapshot of the
    entire page in memory, including the JavaScript heap"; re-sync reveal geometry on
    `pageshow` with `event.persisted === true`
    ([web.dev bfcache](https://web.dev/articles/bfcache)). View Transitions is the wrong tool for
    a scroll-linked reveal — it is for discrete DOM state changes and works by suppressing
    rendering while "the browser takes snapshots of the old and new states"
    ([Chrome view-transitions docs](https://developer.chrome.com/docs/web-platform/view-transitions)).

---

## 1. Magnetic scroll stop / detent at the pre-footer pin point

### 1.1 Native CSS scroll-snap: exact proximity semantics

- `proximity` strictness (MDN, [scroll-snap-type](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type)):
  "The visual viewport of this scroll container **may** snap to a snap position if it isn't
  currently scrolled. The user agent decides if it snaps or not based on scroll parameters."
  The spec words it the same way: snapping in proximity mode happens "at the termination of a
  scroll, at the discretion of the UA given the parameters of the scroll", while `mandatory`
  requires the container "to be snapped to a snap position when there are no active scrolling
  operations" ([CSSWG css-scroll-snap](https://drafts.csswg.org/css-scroll-snap/)). There is no
  specified distance threshold; the selection algorithm is "intentionally left mostly undefined,
  so that user agents can take into account sophisticated models of user intention". In practice
  proximity may never snap a small fling to our pre-footer stop — it is UA-discretionary and
  cannot be tuned.
- Snap areas and sticky: the snap area "is determined by taking the transformed border box … then
  adding the specified outsets" (spec §5.1). The spec text never addresses `position: sticky`
  descendants, and Chromium bug [835301](https://issues.chromium.org/issues/835301)
  ("[css-scroll-snap][position-sticky] scroll-snapping 'stickily' positioned elements") reports
  that "after scrolling around, snap positions often become incorrect" when sticky boxes are
  involved — i.e. snapping against a sticky-resolved box is a known-buggy area, and our sheet's
  pin geometry is precisely a sticky-resolved box that also depends on live content height.
- Re-snap is mandatory on any layout change: "If the content in the scroll port changes — for
  example, if content is added, moved, deleted, or resized — the scroll container will re-snap to
  the previously snapped content if that content is still present"
  ([MDN scroll-snap-type](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type));
  spec: "the UA must re-evaluate the resulting scroll position, and re-snap if required". A
  re-snap to a *different* box "must behave and animate the same way as any other
  scroll-into-view operation". Our footer grows asynchronously (testimonials, FAQ accordions,
  font load), so a snap system would be re-evaluating and potentially yanking the page while the
  user reads.
- Programmatic scrolls are snapped too: the author can request "a bias for the scrollport to land
  on a snap position after scrolling operations (including programmatic scrolls such as the
  scrollTo() method)" (spec; clarified in the changelog via CSSWG Issue 2593). So
  `window.scrollTo({behavior:'smooth'})` used for other UI (hash links, "back to top") would
  fight the snap.
- Escape requirement (the spec's anti-scrolljacking clause): UAs "must ensure that a user can
  'escape' a snap position, regardless of the scroll method", and "a [relative scroll] without an
  intended end position must always ignore the starting snap positions". Any JS detent we build
  should honor the same contract.

### 1.2 Known problems of root-scroller scroll-snap

- [Interop #492 (CSS Scroll Snap)](https://github.com/web-platform-tests/interop/issues/492):
  "many unresolved scroll-snap bugs remain, particularly when used on `:root`/viewport"; bugs
  "frequently appear in combination with other APIs", specifically `scrollIntoView()` and
  scroll-to-top gestures, plus search (find-in-page) and VoiceOver. Linked: 5 WebKit, 5 Chromium,
  1 Mozilla bugs; the issue was the Interop 2024 focus area.
- Chromium [835301](https://issues.chromium.org/issues/835301): sticky + scroll-snap =
  inaccurate snap positions (noted above).
- WebKit [283707](https://bugs.webkit.org/show_bug.cgi?id=283707) (Safari 18.1.1, macOS 15,
  NEW/P2, InRadar): with `scroll-snap-type: x mandatory`, scripted scrolling misbehaves —
  "the scroll speed is too fast, the scroll position does not move, or the content fails to
  render". Related: WebKit 245722, 160622. Safari's snap + scripted-scroll interactions are the
  least stable of the three engines.
- Mandatory-on-root trap: web.dev's scroll-snap guide warns "Avoid using mandatory when the
  target elements are far apart. This can make content between snap positions unavailable"
  ([web.dev/css-scroll-snap](https://web.dev/articles/css-scroll-snap)). `proximity` on the root
  scroller is the "safer" config, but that safety means it cannot *hold* a position — it only
  nudges at gesture end, which is not a magnetic stop.

### 1.3 JS detent pattern: what mature libraries actually do

- **GSAP ScrollTrigger `snap`** ([docs](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)):
  - Snap values are 0–1 *progress* values of a trigger; `snapTo` can be a number, array
    ("snaps to the closest progress value in the Array **in the direction of the last scroll**"),
    function — the function "feeds the natural destination value (based on velocity)" — or
    `"labels"`/`"labelsDirectional"`.
  - `delay` ("the delay (in seconds) between the last scroll event and the start of the snapping
    animation. Default is half the scrub amount (or 0.1)"), `duration` optionally a clamped
    range `{min, max}` — clamped "based on the velocity. That way, if the user stops scrolling
    close to a snapping point, it'd take less time to snap" — `ease` (default `"power3"`), and
    `inertia` (on by default; the *projected* velocity destination is factored in unless
    `inertia: false`).
  - Directional by default since 3.8.0; `onInterrupt` fires when the user scrolls mid-snap; the
    snap "will be cancelled if/when the user (or anything else) interacts in any way with
    scrolling".
  - Design stance: snapping "merely animates the native scroll position and it automatically
    relinquishes control the moment the user attempts to scroll", so it "isn't scroll-jacking and
    is compatible with native technologies like CSS scroll snapping". This is the contract to
    copy: settle-then-ease, velocity-aware duration, cancel-on-intent.
- **Lenis** ([README](https://github.com/darkroomengineering/lenis)): "Runs on native scroll —
  wraps the browser's own scroll, so position: sticky, anchor links, and accessibility keep
  working." It drives smoothing from a rAF loop (`autoRaf: true` default off in recent versions —
  call `lenis.raf(time)` per frame), with `lerp` (default `0.1`), `duration` (default `1.2`s,
  "Useless if lerp defined"), `wheelMultiplier` / `touchMultiplier` (default `1`), and
  `syncTouch` (default `false`: "Mimic touch device scroll while allowing scroll sync (can be
  unstable on iOS<16)"). Accessibility is on by default: `respectReducedMotion: true` means
  "smoothing is disabled (`lerp` is forced to `1` …) and programmatic scrolls (`scrollTo`, anchor
  links) jump instantly"; the opt-out is marked "(not recommended)". Anchors are blocked during
  programmatic scrolling unless `anchors: true` — "By default, Lenis will prevent anchor links
  from working while scrolling." Notably Lenis does *not* implement CSS scroll-snap without an
  extra plugin — smoothing libraries and snap are separate concerns.
- **fullPage.js-style scrolljacking** is the anti-pattern the above two avoid: hijacking all
  scroll input breaks the spec's escape rule, keyboard/AT scrolling, find-in-page and deep links.
  Neither GSAP nor Lenis prevents native scrolling at rest; they only animate the native position
  and yield on user input.
- **OS-level wheel physics.** MDN is explicit that wheel deltas are not pixels by default:
  "You must check the deltaMode property to determine the unit of the deltaX, deltaY, and deltaZ
  values. Do not assume that those values are specified in pixels"
  ([MDN deltaMode](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode);
  `DOM_DELTA_PIXEL`=0, `DOM_DELTA_LINE`=1, `DOM_DELTA_PAGE`=2). Also: "A wheel event doesn't
  necessarily dispatch a scroll event", and "do not rely on the wheel event's delta* properties
  to get the scrolling direction. Instead, detect value changes of scrollLeft and scrollTop of
  the target in the scroll event"
  ([MDN WheelEvent](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent)). Cancelability
  is latched: "In some browsers, only the first wheel event in a sequence is cancelable, and
  later events are non-cancelable", and a non-passive wheel listener "may cause performance
  issues as the browser has to wait for every wheel event to be processed before actually
  scrolling the content" ([MDN wheel event](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event)).
  On macOS the OS itself decouples gesture from scroll: AppKit models the post-gesture decay as
  scroll *momentum phases* (`NSEvent.momentumPhase`: none/began/changed/ended —
  [Apple docs](https://developer.apple.com/documentation/appkit/nsevent/momentumphase)), i.e. the
  browser receives decaying synthesized wheel deltas during momentum. An intent accumulator must
  therefore distinguish fresh gesture deltas from decaying momentum deltas (momentum deltas
  shrink monotonically; resetting the accumulator on every wheel event *under*-triggers during
  momentum and over-triggers with fast mice — a per-window sum with decay, or a velocity estimate,
  is the robust shape, and is exactly why GSAP clamps snap `duration` by velocity).
- **iOS Safari + programmatic scroll during momentum.** Long-standing, reproducible behavior:
  while a touch fling is still decelerating, assignments to `scrollTop` / `scrollTo()` fight the
  momentum — "the list tries to be at different positions at the same time"
  ([react-window #122](https://github.com/bvaughn/react-window/issues/122); same behavior
  documented in the Safari `window.scrollTo(0,0)` folklore). Conclusion for us: never attempt a
  mid-momentum `scrollTo` on touch; either let touch pass through un-detented, or apply the
  settle after `scrollend`/`touchend` + settle.
- **`scrollend` is the settle primitive** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event)):
  "The scrollend event fires when element scrolling has completed … when the scroll position has
  no more pending updates and the user has completed their gesture." It also covers programmatic
  scrolls: "Scroll position updates include smooth or mouse wheel scrolling, keyboard scrolling,
  scroll-snap events, or other APIs". Baseline 2025 "newly available" (all engines since Dec
  2025) — feature-detect (`'onscrollend' in window`) and fall back to a scroll-debounce timeout.
  If we ever move the detent to CSS snap, `scrollsnapchange` fires "at the end of a scrolling
  operation when a new scroll snap target has been selected, just before the corresponding
  scrollend event" — but it is still marked "Experimental … not Baseline"
  ([MDN scrollsnapchange](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollsnapchange_event)).

### 1.4 Accessibility

- WCAG 2.3.3 *Animation from Interactions* (AAA) is the criterion that governs a detent's
  animation: "Motion animation triggered by interaction can be disabled, unless the animation is
  essential to the functionality or the information being conveyed." It explicitly blesses
  scrolling itself — "Moving new content into the viewport is essential for scrolling. The user
  controls the essential scrolling movement so it is allowed" — and explicitly names our hazard:
  "Another animation that is often non-essential is parallax scrolling." Sufficient techniques are
  the `prefers-reduced-motion` media query (C39) or its JS equivalent (SCR40)
  ([W3C understanding doc](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)).
- WCAG 2.5.4 *Motion Actuation* does **not** apply to scroll hijacking — it covers "functionality
  that can be operated by device motion or user motion" via sensors (tilt/shake), and
  "incidental motion" like normal touchscreen operation is excluded under *Supported Interface*
  ([W3C understanding doc](https://www.w3.org/WAI/WCAG21/Understanding/motion-actuation.html)).
  The governing constraints for a detent are instead 2.1.1 *Keyboard* (space/End/PageDown/arrows
  must scroll normally — so gate all detent logic to wheel/touch gestures, never key events) and
  2.3.3 (honor `reduce`).
- `prefers-reduced-motion: reduce` means "a user has enabled a setting on their device to
  minimize the amount of non-essential motion"; vestibular triggers include "scaling or panning
  large objects" ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).
  Lenis's default (`respectReducedMotion: true` → smoothing off, programmatic scrolls jump
  instantly) is the model to copy for a detent: under `reduce`, either disable the magnetic stop
  entirely or settle without easing.

### Implications for this codebase

1. **Skip CSS scroll-snap on `:root` entirely.** Proximity can't hold; mandatory traps; re-snap on
   async footer growth + programmatic-scroll snapping + sticky-box snap bugs (Chromium 835301,
   WebKit 283707, interop #492) make it the wrong tool for a one-stop detent on a
   live-geometry reveal.
2. **Implement the detent in JS on top of native scroll**, GSAP-contract style: (a) never
   `preventDefault` continuously — read wheel in a `passive: true` listener and settle by easing
   `window.scrollTo` to the pre-footer pin point *after* the gesture ends; (b) accumulate
   |deltaY| over a short window (normalize by `deltaMode`: ×line-height for lines, ×viewport for
   pages) as release intent; (c) cancel/return the ease the instant any wheel/keydown/touch
   arrives (GSAP's `onInterrupt` behavior); (d) duration/ease scaled to the scroll velocity at
   settle time.
3. **Gate the detent**: only wheel (`pointerType`/wheel presence), never keydown — space/End/
   PageDown keep native behavior (WCAG 2.1.1); skip entirely under
   `matchMedia('(prefers-reduced-motion: reduce)')` (or settle instantly, Lenis-style).
4. **On touch/iOS: no mid-momentum intervention.** Apply holds only after `scrollend`; accept that
   touch users get the plain reveal without the magnetic stop.
5. **Use `scrollend` (with timeout fallback) to detect settle**, both for arming the detent and
   for deciding when the sheet has pinned — replaces any scroll-debounce heuristic.
6. **Anchor/hash links**: the detent must never veto programmatic scrolls it didn't cause; tag
   our own ease scrolls and ignore scroll events from them.

---

## 2. Rendering performance for this exact stack

### 2.1 Pipeline facts that frame everything

- The pixel pipeline is JavaScript → style → layout → paint → composite; "If you change a
  property that requires neither layout or paint, the browser can jump straight to the
  compositing step. This is the cheapest and most desirable pathway." Chromium "optimizes
  scrolling of the page so that it occurs solely on the compositor thread where possible"
  ([web.dev rendering-performance](https://web.dev/articles/rendering-performance)). Everything
  we do on scroll (CSS var writes consumed by transform/opacity, canvas repaints) is either
  compositor-only or a per-frame main-thread paint — the goal is to keep it out of layout and to
  minimize paint area.
- Only two properties are composite-only: "Today there are only two properties for which that is
  true — transforms and opacity", and the animated element "should be on its own compositor
  layer" ([web.dev stick-to-compositor](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)).
  Our `--lift`/`--ft-travel` consumers should therefore drive `transform`/`opacity` only.

### 2.2 Full-viewport canvas repaint cost & pausing offscreen canvases

- MDN's optimization list maps 1:1 onto our grid painter
  ([MDN Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)):
  - "If you find yourself repeating some of the same drawing operations on each animation frame,
    consider offloading them to an offscreen canvas" — the static 60px grid, once rendered,
    should be blitted, not re-laid-out per frame.
  - "Render screen differences only, not the whole new state" / "In your application, you may
    find that some objects need to move or change frequently, while others remain relatively
    static. A possible optimization … is to layer your items using multiple `<canvas>` elements."
    Our canvases repaint everything every frame when only the cursor warp region changes.
  - `alpha: false` on the context if the canvas is opaque ("This information can be used
    internally by the browser to optimize rendering"); avoid `shadowBlur` ("Avoid the
    shadowBlur property whenever possible"); round drawImage coordinates to avoid forced
    anti-aliasing; "CSS transforms are faster since they use the GPU".
- Pausing work when nothing can be seen:
  - IntersectionObserver is explicitly "for … Deciding whether or not to perform tasks or
    animation processes based on whether or not the user will see the result", replacing scroll
    handlers that poll `getBoundingClientRect()` — "As the user scrolls the page, these
    intersection detection routines are firing constantly during the scroll handling code,
    resulting in an experience that leaves the user frustrated"
    ([MDN IO](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)). The
    footer-window canvas is a textbook case: hidden at 0% intersection while the sheet covers it.
  - Tab-level: `document.visibilityState` is `visible`/`hidden`, changing on tab switch,
    minimize, and OS screen lock, with the `visibilitychange` event
    ([MDN visibilityState](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState)).
    Suspend both rAF loops when `hidden`.
  - Note the modern event for this exact purpose: `contentvisibilityautostatechange` fires when
    `content-visibility: auto` skipping starts/stops "letting apps pause work like canvas
    drawing" ([MDN content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)).
- `visibility: hidden` is *not* a work stop: it stays in the render/a11y tree and only skips
  paint, unlike skipping primitives — `content-visibility: hidden` "skips its contents … similar
  to giving the contents display: none" (while preserving rendering state: "Using
  content-visibility: hidden; instead of display: none; preserves the rendering state of content
  when hidden and rendering is faster")
  ([MDN content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)).
  So our `visibility: hidden` + delayed-transition footer window still lays out its internals
  (including the second canvas) — only its paint is elided, and CSS animations inside it keep
  advancing their clocks.

### 2.3 backdrop-filter and blur-layer costs

- What it does: "The backdrop-filter property applies filter effects to the pixels painted behind
  an element, up to the nearest ancestor that is a backdrop root" — i.e. the blur input is the
  live composited backdrop; when that backdrop animates (our canvas), the filter must be
  recomputed. Scope surprises: ancestors with `filter` ≠ none, `opacity` < 1, `mask`/`clip-path`,
  `backdrop-filter`, `mix-blend-mode` ≠ normal, **or `will-change` naming any of those** become
  backdrop roots, silently changing (or clipping) what gets blurred
  ([MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)).
  Because "it applies to everything behind the element, to see the effect the element or its
  background needs to be transparent or partially transparent."
- Performance: web.dev's backdrop-filter article carries the only official short warning —
  "backdrop-filter can hurt performance. Test before deploying"
  ([web.dev backdrop-filter](https://web.dev/articles/backdrop-filter)). There is no
  browser-optimized "cheap blur": each glass surface is an extra readback+filter over the region
  beneath it, per frame, for the whole animating area.
- Many blurred elements: the layer-economics rule applies — "every layer you create requires
  memory and management, and that's not free … Every layer's textures needs to be uploaded to the
  GPU, so there are further constraints" ([web.dev stick-to-compositor](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)).
  12 `blur(120px)` orbs × 2 instances = 24 filter surfaces; blur radius scales filter cost with
  the blur footprint, and each orb also promotes its own layer.

### 2.4 will-change / contain / content-visibility

- `will-change`: "Use the will-change property as a last resort to try to deal with existing
  performance problems. Don't use it to anticipate performance problems"; "Overusing the property
  can cause the page to slow down"; "Excessive use of will-change will result in excessive memory
  use and will cause more complex rendering to occur"; "Applying a non-auto value on a large
  section, such as the `<body>`, can actually be bad"; and the add/remove-around-animation
  pattern via script ("it is a good practice to switch will-change on and off using script code
  before and after the change occurs"). It also has visual side effects: with stacking-context
  properties "the stacking context is created up front"
  ([MDN will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)).
- `contain: layout paint` on the two fixed-size 100vh windows: layout containment "isolates the
  internal layout … nothing outside the element affects its internal layout, and vice versa";
  paint containment means "Descendants of the element don't display outside its bounds" and — the
  one we want — "If the containing box is offscreen, the browser does not need to paint its
  contained elements". Side effects to verify: `layout`/`paint`/`strict`/`content` each create
  "a new containing block (for the descendants whose position property is absolute or fixed), a
  new stacking context, [and] a new block formatting context"
  ([MDN contain](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)).
- `content-visibility: auto` "skips its contents" (layout+style+paint containment, and when not
  relevant "also size containment … stops painting and hit-testing") until the element approaches
  the viewport; measured effect: "the rendering time … went from 232ms to 30ms" (~7×) on the
  article's demo, with `contain-intrinsic-size: auto <length>` preventing scrollbar jumps. Two
  caveats that matter to us: "DOM APIs … that force rendering on a skipped subtree" erase the
  benefit (we measure the footer live every frame — do *not* put `auto` on it), and skipped
  content stays in the a11y tree/find-in-page, so intentionally-hidden things may need
  `aria-hidden` ([web.dev content-visibility](https://web.dev/articles/content-visibility);
  [MDN content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)).

### 2.5 Scroll-handler and rAF rules

- Batch reads and writes: "you should always batch your style reads and do them first (where the
  browser can use the previous frame's layout values) and then do any writes"; interleaving them
  in a loop is "forced synchronous layout (or sometimes forced reflow)" and repeated
  read-write-read-write cycles are "layout thrashing". Crucially, a read with clean layout is
  cheap: "as the JavaScript runs all the old layout values from the previous frame are known and
  available for you to query" — one `getBoundingClientRect()` per frame *before* any style write
  is the acceptable case; the cost only appears when a read follows a write in the same frame
  ([web.dev avoid-large-complex-layouts-and-layout-thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)).
- Wheel listeners: prefer `passive: true` so the browser doesn't wait for the handler before
  scrolling ("This may cause performance issues as the browser has to wait for every wheel event
  to be processed before actually scrolling the content"
  — [MDN wheel event](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event)).

### Implications for this codebase

1. **Drive everything from `--lift`/`--ft-travel` with transform/opacity only** — never let the
   vars feed layout properties; the footer window content should translate, not re-layout.
2. **Differential-render the grid canvases**: cache the static 60px grid on an offscreen canvas,
   repaint only the cursor-warp region (dirty-rect `clearRect`/`drawImage`), round coordinates,
   and consider `alpha: false` where the canvas is opaque.
3. **Pause both canvases on `document.hidden`**; pause the footer canvas via an
   IntersectionObserver at ~0.01 threshold while the sheet conceals it, resume on intersect; the
   sticky-main canvas likewise when the footer fully covers it.
4. **Do not `content-visibility: auto` the footer window or sticky main** (we measure them each
   frame; forced rendering of a skipped subtree erases the benefit). `auto` + `contain-intrinsic-
   size: auto` is a good fit for below-the-fold marketing sections instead.
5. **Add `contain: layout paint` to the fixed footer window and sticky main** (verify nothing
   inside is `position: fixed` against the viewport — containment would re-root it).
6. **Audit glass surfaces against the backdrop-root list** (any ancestor `opacity` < 1, `filter`,
   `mask`, or `will-change` on those) — both a correctness and a cost issue; and treat each
   additional `backdrop-filter` surface as per-frame cost over the animating canvas: measure
   before adding more.
7. **Reduce orb count / blur cost**: 24 independent `blur(120px)` layers is the worst shape;
   pre-render one blurred orb sprite (canvas or single blurred element) and reuse it, or share a
   single oversized blurred gradient per instance. Remove any blanket `will-change` hints; if
   needed, set `will-change: transform` only on the translating footer content and only while the
   reveal is active.

---

## 3. Flash prevention for layered reveal UI

### 3.1 What the platform now gives us (Baseline 2024)

- `@starting-style`: "The @starting-style CSS at-rule is used to define starting values for
  properties set on an element that you want to transition from when the element receives its
  first style update." The problem it solves is exactly our first-paint guard's job: "CSS
  transitions are by default not triggered on an element's initial style update, or when its
  display type changes from none to another value. To enable first-style transitions,
  @starting-style rules are needed." It is one-way ("When it transitions back from its initial
  visible state, it will no longer use the @starting-style styles"), and for top-layer/`display`
  exits you must also transition `display` and `overlay` with `transition-behavior:
  allow-discrete`, "otherwise the exit animation would not be visible"
  ([MDN @starting-style](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style)).
- `transition-behavior: allow-discrete`: "specifies whether transitions will be started for
  properties whose animation behavior is discrete." Discrete properties "generally flip between
  two values 50% through animating", except when animating to/from `display: none` (or
  `content-visibility: hidden`), where the flip is timed so content shows the whole duration
  (to-visible flips at 0%, to-hidden flips at 100%). Our hand-written "delayed `visibility`
  transition" is exactly this pattern done manually — `visibility` discretely flips and the
  transition machinery holds the old value until the end
  ([MDN transition-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior)).
  Both are Baseline 2024 (newly available Aug 2024), so the SvelteKit site still needs the
  current `html.js`-class + delayed-visibility approach as fallback — they compose: the JS guard
  can remain as the no-`@starting-style` fallback path.
- View Transitions API: for discrete state changes, not scroll-linked effects. Same-document
  transitions run by `document.startViewTransition(() => updateTheDOMSomehow())`; mechanics:
  "The browser takes snapshots of the old and new states", "The DOM gets updated while rendering
  is suppressed", "The transitions are powered by CSS Animations". Chrome 111+ for same-document;
  Chrome 126+ / Safari 18.2 for cross-document via `@view-transition { navigation: auto; }`
  ([Chrome view-transitions docs](https://developer.chrome.com/docs/web-platform/view-transitions)).
  A scroll-driven reveal is continuous and tied to native scroll position — snapshot/animation
  machinery is the wrong model, and its rendering suppression would visibly freeze the canvas
  during the swap.

### 3.2 bfcache-related flash restoration

- bfcache is "a snapshot of the entire page in memory, including the JavaScript heap"; on
  restore, "browsers … pause any pending timers or unresolved promises" and resume them. The
  detection pattern: `window.addEventListener('pageshow', (event) => { if (event.persisted) { … }
  })` — "true if the page was restored from bfcache". Rules that keep pages eligible: "never use
  the unload event. Ever!" (use `pagehide`), and avoid `Cache-Control: no-store` on the document
  ([web.dev bfcache](https://web.dev/articles/bfcache)). For a reveal UI: a bfcache restore
  replays the *restored* DOM/CSSOM state — the `html.js` class, the footer window's
  visibility/opacity, and the last scroll position all come back as-is, but any transient JS
  state (in-progress ease, rAF loop, IO callbacks) resumes from where it paused. Restores are the
  classic source of "footer window invisible/visible at the wrong scroll offset" flashes.

### 3.3 FOUC / first-paint guards for JS-enhanced layers

- The repo's existing pattern (inline `document.documentElement.classList.add('js')` in
  `app.html`, then gate enhanced-layer styles on `.js`) remains the standard progressive-
  enhancement guard for "layer must not exist until JS has mounted". The platform-native
  alternative/complement is `@starting-style` for *entry* transitions without any class timing,
  plus `transition-behavior: allow-discrete` so `visibility`/`display` can participate in the
  transition (both Baseline 2024). MDN's `content-visibility` page adds a flash-adjacent a11y
  caveat worth keeping: elements hidden with `display: none` or `visibility: hidden` "will still
  appear in the accessibility tree … If you don't want an element to appear in the accessibility
  tree, use aria-hidden=\"true\""
  ([MDN content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)).
- Live geometry (deriving reveal state from `getBoundingClientRect()` each frame) is itself the
  correct anti-flash measure for async content growth — the flash risk it removes is a *stale
  cached height*, which no CSS feature replaces. Keep reads-before-writes in the frame
  (§2.5) so the live measurement stays free.

### Implications for this codebase

1. **Keep the `html.js` guard**, but add `@starting-style` blocks for the footer window's entry
   state (opacity/transform from hidden → shown) behind `@supports` so modern browsers get a
   no-JS-timing first paint; the existing delayed-`visibility` transition stays as fallback.
2. **Replace the hand-rolled delayed `visibility` transition with (or mirror it via)
   `transition-behavior: allow-discrete` on `visibility`** — same flip-at-end semantics,
   spec-defined, and it composes with `@starting-style` entry.
3. **Add a `pageshow` handler**: if `event.persisted`, force one synchronous reveal-geometry
   recomputation and re-apply the correct footer-window visibility state before the next paint;
   restart the rAF loops (they were paused while frozen). Also assert no `unload` handlers exist
   on the site (bfcache eligibility).
4. **Do not adopt View Transitions for the reveal** — it is for discrete DOM swaps and suppresses
   rendering mid-change; wrong for a continuous scroll-linked effect (and would freeze the canvas
   during snapshots).
5. **Keep live per-frame geometry**, but structure each frame as: all `getBoundingClientRect()`
   reads first → then CSS var writes (§2.5) so the live measurement never triggers forced
   reflow.
6. **A11y flash check**: the concealed footer window is `visibility: hidden` (still in a11y tree)
   — add `aria-hidden`/`inert` toggling in sync with the visual state so hidden footer content
   (links, form) is neither announced nor tabbable while concealed.

---

## Sources

- CSSWG: https://drafts.csswg.org/css-scroll-snap/
- MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type ·
  https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll_snap ·
  https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event ·
  https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollsnapchange_event ·
  https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent ·
  https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode ·
  https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event ·
  https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- web.dev: https://web.dev/articles/css-scroll-snap · https://web.dev/articles/rendering-performance ·
  https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count ·
  https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing ·
  https://web.dev/articles/content-visibility · https://web.dev/articles/backdrop-filter ·
  https://web.dev/articles/bfcache
- Chrome developer docs: https://developer.chrome.com/docs/web-platform/view-transitions
- MDN perf/layout: https://developer.mozilla.org/en-US/docs/Web/CSS/contain ·
  https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility ·
  https://developer.mozilla.org/en-US/docs/Web/CSS/will-change ·
  https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter ·
  https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API ·
  https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState ·
  https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- MDN flash/transition: https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style ·
  https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior
- WCAG: https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html ·
  https://www.w3.org/WAI/WCAG21/Understanding/motion-actuation.html
- Bugs/interop: https://github.com/web-platform-tests/interop/issues/492 ·
  https://issues.chromium.org/issues/835301 · https://bugs.webkit.org/show_bug.cgi?id=283707 ·
  https://github.com/bvaughn/react-window/issues/122
- Libraries: https://gsap.com/docs/v3/Plugins/ScrollTrigger/ ·
  https://github.com/darkroomengineering/lenis (README)
- OS physics: https://developer.apple.com/documentation/appkit/nsevent/momentumphase
