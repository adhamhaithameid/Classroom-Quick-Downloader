# Branded cursor

Site-wide custom cursor: the CQD logo's white ring and download arrow replace
the native cursor on every route. Approved in `website/prototype-cursor-v2.html`
(material A, glass) and refined in `website/prototype-cursor-v3.html`; the
locked decisions from that review are baked in as constants and guard tests.

## Behavior

- **Never native.** While the cursor is live, `html.cqd-cursor-live` stands
  every native cursor down site-wide (`cursor: none !important` in `app.css`).
  The branded layer always marks the true pointer position (52px center
  hotspot), so clicking stays exact. No-JS and touch visitors never get the
  class and keep full native behavior.
- **Two-tone ink (approved).** The ring, glass and every glyph stay white;
  the download arrow carries the logo's solid green fill (`#388E3C`),
  including the progress fill. Chosen from the green studio
  (`website/prototype-cursor-green.html`, variant D with a solid arrow).
- **Size 52px** (`CURSOR_SIZE_PX`), glass material, 37 states, no `none` state,
  no glow: hovering buttons, inputs and cards (`.glass-panel`,
  `[data-cursor-clear]`) clears the frosted glass so the page reads through
  the cursor.
- **Ring-only state over content.** Hovering anything meaningful — buttons,
  links, cards, text, titles, images, video, the globe/map, the navbar,
  the footer's mega CQD wordmark, the moving data bar (`RING_SELECTOR`, plus
  `[data-cursor-ring]` opt-in) — collapses the cursor to the bare ring:
  no arrow, no glass. The full glass + seeking arrow cursor is the
  empty-space cursor.
- **80ms follow lag** (`CURSOR_LAG_MS`): the whole cursor (ring and icon
  together — the trailing-layer experiment was cut on review) eases to the
  pointer with frame-rate-independent exponential easing, clamped at 250ms
  per frame so a tab-switch wake never teleports.
- **Buttery transitions.** The layer renders every state's glyphs statically;
  state changes flip `data-state` and CSS transitions morph between states
  (glass dissipates, the badge cuts into the ring via `stroke-dasharray`,
  the prohibition slash draws in). No re-rendering.
- **Text state on selection.** Text entry (`TEXT_ACTION_SELECTOR`) and active
  text selection (pressed mouse with a live selection) both show the compact
  I-beam state.
- **State precedence.** Explicit demo override, then branded CSS keywords
  (the UA's `cursor: pointer` on links is demoted so links get the ring
  state), then text selection, then text entry, then actions and ring
  triggers, then ambient.
- **Ambient seek tilt.** Over plain content the arrow leans toward the nearest
  seek target (`SEEK_SELECTOR`: `[data-cursor-seek]`, the overview hero's
  `.l2-cta-current`, and the footer's primary install CTA
  `.ft-cta-primary`). Targets are cached and re-indexed only on scroll/resize.
- **States from CSS keywords.** Any element setting `cursor: wait`, `grab`,
  `ew-resize`, etc. gets the matching branded state. An element may also set
  `data-cursor-state="copy"` for an explicit override (used by tests and
  demos). `progress` runs the rotating arc with a top-down arrow fill.

## Accessibility

| Condition | Behavior |
| --- | --- |
| Touch / coarse pointer | Layer never activates; native behavior untouched. |
| `prefers-reduced-motion` | Layer still marks the pointer (never native), but lag snaps to 0, transitions are disabled, the rotor stops, and the progress fill sits static. |
| No JavaScript | The `cqd-cursor-live` class is runtime-only, so nothing changes. |
| Keyboard use | The layer is `aria-hidden`, `pointer-events: none`, and ignores focus; the skip link and focus outlines are unaffected. |

## Files

| File | Role |
| --- | --- |
| `src/lib/cursor/cursorStates.ts` | Pure seam: state decision table, exponential easing, seek angle, selectors, approved constants. |
| `src/lib/cursor/CursorLayer.svelte` | The fixed visual layer: all 36 states as `data-state`-driven CSS (glass, ring, badge cut, slash, rotor, progress clip, glyphs). |
| `src/lib/actions/brandedCursor.ts` | Pointer engine (Svelte action): gates, sampling, state resolution, lag loop, seek indexing, progress fill, live-class lifecycle. |
| `src/routes/+layout.svelte` | Mounts `<CursorLayer />` once for every route. |
| `src/app.css` | The `html.cqd-cursor-live` native stand-down rule. |

## Tests

Run from `website/`:

```bash
npx vitest run src/lib/cursor/ src/routes/layout.shell.test.ts
```

- `src/lib/cursor/cursorStates.test.ts` — decision table (keyword precedence,
  text-entry and selection escalation, disabled actions, demo overrides),
  easing properties (per-tau fraction, frame-rate independence, clamps),
  seek angles, approved constants (52px / 80ms / 37 states).
- `src/lib/cursor/CursorLayer.guard.test.ts` — pins each reviewed requirement
  in source and rendered output: native stand-down rule, fine-pointer gate,
  52px, 80ms lag, **no trailing layer**, reduced-motion fallback, glass
  clearing, seek opt-in, progress fill, all glyph groups.
- `src/routes/layout.shell.test.ts` — the layout mounts the layer on every
  route.

## Prototypes

The throwaway prototypes remain for reference: `prototype-cursor.html` (v1
material exploration), `prototype-cursor-v2.html` (three materials + studio),
`prototype-cursor-v3.html` (approved glass refinement with the redesigns and
the two-layer follow experiment).
