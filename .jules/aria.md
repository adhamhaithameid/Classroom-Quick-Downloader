## 2025-05-14 — Added skip link and focus management
**Finding:** Layout `website/src/routes/+layout.svelte` was missing a skip navigation link and focus management on route transition — WCAG 2.4.1 Skip Navigation and WCAG 2.4.3 Focus Order failures
**Action:** Added `<a href="#main-content" class="skip-nav">Skip to main content</a>` visibly available on focus. Added `<main id="main-content" tabindex="-1">`. Hooked `afterNavigate` to programmatically focus the `#main-content` after route transitions.
**Learning:** SvelteKit client-side route transitions break normal document focus progression; we must explicitly provide `afterNavigate` handlers to bring screen reader focus to the target view container (`<main>`).
