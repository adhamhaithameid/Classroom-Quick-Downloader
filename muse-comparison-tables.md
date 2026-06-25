---
title: "Muse: comparison pages missing feature table — visitors cannot compare at a glance"
---

## 🎭 Muse — Website Suggestion
**Agent:** Muse | **Day:** Thursday | **Date:** 2024-05-23

---

### 👤 Visitor Story
As a potential user evaluating alternatives, I want to see a side-by-side feature comparison table, so that I can quickly understand why Classroom Quick Downloader is better than competitors like Classfetch without having to read long paragraphs of text.

### 🔍 Current State
The existing comparison pages (e.g., `website/src/routes/compare/classroom-quick-downloader-vs-classfetch/+page.svelte`) currently rely on the `SeoContentPage` component and `seoPages.ts` configuration, which primarily outputs sections of text (headings, paragraphs, bullets). While good for SEO, large blocks of text are difficult for users to scan when they want to make a quick decision about which tool to install. There is no visual feature comparison table.

### 💡 Proposed Improvement
Add support for a feature comparison table to the `SeoContentPage` component and its underlying configuration in `website/src/lib/content/seoPages.ts`.
- Update the `SeoSection` type to optionally support a `table` or `comparison` property.
- Update `website/src/lib/components/SeoContentPage.svelte` to render this table, matching the visual style of the site (e.g., using `--border-subtle`, `--surface`, and the checkmark/cross icons or styling seen in the FAQ/Overview).
- Update the content in `seoPages.compareClassfetch` (and other comparison pages) to utilize this new table feature, highlighting CQD's advantages (speed, reliability, privacy, price).

### 🎯 Why This Matters
Comparison pages are high-intent landing pages. Users arriving here are actively looking to install a tool but are weighing their options. A clear, honest, and scannable feature table is a standard SaaS best practice that significantly improves conversion rates on comparison pages by reducing cognitive load.

### 📐 Acceptance Criteria
- [ ] The `SeoContentPage` component can render a comparison table.
- [ ] At least one comparison page (e.g., vs Classfetch) includes a populated feature table.
- [ ] The table is responsive, functioning correctly on mobile devices (e.g., horizontal scrolling or stacked view).
- [ ] The table matches the site's design system (colors, fonts, borders).
- [ ] Accessibility: The table uses semantic HTML (`<table>`, `<th>`, `<tr>`, `<td>`, `scope` attributes) and provides clear context for screen readers.

### 🔧 Technical Context
- Modify `website/src/lib/content/seoPages.ts` to extend the `SeoSection` type.
- Modify `website/src/lib/components/SeoContentPage.svelte` to implement the table rendering logic.
- Update the specific comparison configurations (e.g., `compareClassfetch`) in `seoPages.ts` to include the table data.

### 📊 Estimated Complexity
Small to Medium (1–3 days) — Requires extending an existing type, adding HTML/CSS for a responsive table in an existing component, and writing the specific comparison content for the table.

### 🔗 Related
- Affects routes: `/compare/classroom-quick-downloader-vs-classfetch`, `/compare/classroom-quick-downloader-vs-classmate`, `/compare/classroom-quick-downloader-vs-classroom-one-click-downloader`
