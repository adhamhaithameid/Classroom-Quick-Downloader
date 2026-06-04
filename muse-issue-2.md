## 🎭 Muse — Website Suggestion
**Agent:** Muse | **Day:** Thursday | **Date:** 2024-05-23

---

### 👤 Visitor Story
As a potential user evaluating extensions, I want to quickly compare features side-by-side on the comparison pages (like CQD vs Classfetch), so that I can easily decide which tool is right for me without having to read dense paragraphs.

### 🔍 Current State
The current comparison pages (e.g., `website/src/routes/compare/classroom-quick-downloader-vs-classfetch/+page.svelte` pulling content from `website/src/lib/content/seoPages.ts`) rely heavily on an 'Evaluation Checklist' and text paragraphs. They are missing a critical element of comparison pages: a side-by-side feature comparison table. This forces users to read and infer differences rather than seeing them at a glance.

### 💡 Proposed Improvement
Add a feature comparison table component to all comparison pages.
- **Affected pages:** `compareClassfetch`, `compareClassmate`, and `compareClassroomOneClickDownloader` routes.
- **New content:** Introduce a visual table comparing key features (e.g., "Bulk Download", "Manifest V3 Support", "Privacy First/No Analytics", "Firefox Support").
- **Design:** The table should be clear, easy to scan, and use checkmarks/crosses to denote feature availability. It should align with the current design language.

### 🎯 Why This Matters
When visitors are comparing alternatives, their primary goal is to find the quickest answer to "which one is better?". A feature table provides immediate, undeniable clarity. It increases confidence in the product and reduces cognitive load, directly improving conversion rates from users who are actively shopping for a solution.

### 📐 Acceptance Criteria
- [ ] A new or updated Svelte component (e.g., `ComparisonTable.svelte`) is created for use on comparison pages.
- [ ] The `seoPages.ts` configuration is extended to support comparison table data, or the specific compare routes are modified to include the table.
- [ ] The table is added to at least the `CQD vs Classfetch` and `CQD vs Classmate` pages.
- [ ] The table is fully responsive (e.g., scrolls horizontally on mobile or stacks nicely).
- [ ] The design matches `VISUAL_GUARDRAILS.md`.
- [ ] Accessibility: The table uses semantic HTML (`<table>`, `<th>`, `<tr>`, `<td>`), and icons have appropriate ARIA labels (e.g., `aria-label="Supported"` for checkmarks).

### 🔧 Technical Context
- **Routes:** Modify `website/src/routes/compare/*/+page.svelte`.
- **Components:** Likely requires updating the `SeoContentPage.svelte` component to render the table, or creating a specific component for comparison pages if the data structure in `website/src/lib/content/seoPages.ts` needs to be extended.
- **Data:** Update `website/src/lib/content/seoPages.ts` to include the specific comparison data points for each competitor.

### 📊 Estimated Complexity
Small to Medium (2–4 days) — Requires designing and implementing a responsive table component, defining the comparison criteria for each competitor, and integrating the new data structure into the existing SEO page generation logic.

### 🔗 Related
- Target pages: `/compare/classroom-quick-downloader-vs-classfetch`, `/compare/classroom-quick-downloader-vs-classmate`
