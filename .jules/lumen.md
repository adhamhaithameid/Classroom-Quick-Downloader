## 2026-07-01 — Fixed CLS from missing image dimensions on icon images
**Finding:** Multiple `<img class="l2-cta-icon">` and `<img class="un-browser-icon">` elements lacked explicit `width` and `height` attributes, causing Cumulative Layout Shift (CLS) during page load. Estimated impact: slight CLS improvement.
**Action:** Added explicit `width="22" height="22"` (or `width="20" height="20"`) to the affected icons in `+page.svelte` across the `overview`, `overview-editor`, and `uninstall` routes.
**Learning:** Svelte component rendering respects CSS dimensions, but providing explicit HTML width/height attributes for browser icons prevents initial layout recalculation and shifts before CSS fully loads.
