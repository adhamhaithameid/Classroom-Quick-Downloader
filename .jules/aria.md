## 2026-07-01 — Added skip navigation link
**Finding:** No skip navigation link — keyboard users tab through entire nav on every page (WCAG 2.4.1 Bypass Blocks)
**Action:** Added a visually hidden skip-to-main-content link at the top of +layout.svelte that becomes visible on focus. Updated main element with id='main-content' and tabindex='-1'.
**Learning:** SvelteKit global layouts need a skip link to bypass navigation headers, improving keyboard accessibility.
