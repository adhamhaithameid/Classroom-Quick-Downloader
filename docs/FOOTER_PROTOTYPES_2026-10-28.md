# Footer rework prototypes (bead w403, 2026-10-28)

A friend reported the footer transition as laggy. Root cause: the shipped
sheet reveal writes `translate` + `will-change: translate` on `<main>` every
scroll frame, plus a magnetic detent engine (`magneticPin.ts`) and a footer
cascade. That transform also makes `<main>` a fixed-position containing
block — the known overlay portal trap.

Two Svelte prototypes live in the real site (real chrome, real footer, real
alignment), one route each:

| Route | Variant | Mechanism | JS on the scroll path |
| --- | --- | --- | --- |
| `/prototype-footer-a` | **A — static section** | The reveal is off; the footer is a plain in-flow section | None |
| `/prototype-footer-b` | **B — native sticky curtain** | `position: sticky; bottom: 0` footer behind an opaque, rounded sheet | None |
| every other route | shipped reveal | JS sheet lift (`initSheetReveal`) | per-frame style writes + magnetic detent |

Both routes render the identical `SiteFooter` component inside the real
`.site-shell`, so alignment is exact. The variant resolver is pure
(`website/src/lib/footer/prototype-variant.ts`) and unit-tested.

## What to evaluate

1. Scroll each route to the end. A reads as a normal page end; B uncovers
   the footer like the shipped reveal, with no JS.
2. Overlay check on B: the media modal and editor toolbars (currently
   trapped by the shipped reveal) would be free — main is no longer a
   containing block for `position: fixed` descendants while scrolling.
3. Reduced motion: A and B are motion-free by construction; the shipped
   reveal already falls back to plain flow.

## Trade-offs

- **A** is the simplest possible outcome and the fastest page end; it loses
  the reveal delight entirely.
- **B** keeps the sheet visual signature (rounded opaque sheet floating over
  the footer) at native compositor cost. It needs `main` to be opaque on
  prototype routes (done with `background: var(--bg)` + bottom radius).
- The shipped reveal stays untouched on every other route; integration
  after the decision means deleting ~300 lines (initSheetReveal,
  magneticPin, runway) and the portal-trap class with them.

## Decision requested

Pick A, B, or keep the shipped reveal. On a decision, a follow-up bead does
the integration and removes the dead machinery.
