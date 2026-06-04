## 🎭 Muse — Website Suggestion
**Agent:** Muse | **Day:** Thursday | **Date:** 2024-05-23

---

### 👤 Visitor Story
As a teacher or educator, I want to find a dedicated page that speaks to my specific needs (like downloading all student assignments at once for offline grading), so that I can understand exactly how this extension will save me time and why I should install it over other generic tools.

### 🔍 Current State
Currently, the website has general SEO-targeted landing pages and an overview, but no dedicated route specifically for teachers (e.g., `website/src/routes/for-teachers/+page.svelte`). The value propositions on the homepage (`+page.svelte`) are broad enough to cover teachers, but they miss the opportunity to deeply resonate with a teacher's specific workflow (e.g., grading during prep periods, managing large class rosters, offline access).

### 💡 Proposed Improvement
Create a dedicated "For Teachers" landing page.
- **Affected pages:** Add a new route at `website/src/routes/for-teachers/+page.svelte`.
- **New content:** Include sections on "Time saved per week", "Offline grading", and "No student data collection" (a major trust signal for educators).
- **Design:** Ensure the design matches the existing visual guardrails, reusing components from the homepage and overview but with teacher-focused copy and imagery. Add clear CTAs tailored to educators.
- **Experience:** A teacher landing here from a search query or an email link will immediately see that the tool was built with their workflow in mind, increasing the likelihood of conversion.

### 🎯 Why This Matters
Teachers are the primary users who perform bulk downloads in Google Classroom. By failing to have a dedicated landing page, we are missing a critical conversion and trust-building surface. Addressing their specific pain points (time, privacy, ease of use) in a dedicated space will improve install rates for this high-intent demographic.

### 📐 Acceptance Criteria
- [ ] A new route `/for-teachers` is created and accessible.
- [ ] The page clearly explains the benefits for teachers (e.g., bulk downloading student work for offline grading).
- [ ] The page includes a clear CTA to install the extension for Chrome, Edge, and Firefox.
- [ ] The page is fully responsive on mobile devices (for teachers checking on phones/tablets).
- [ ] The design adheres to the `VISUAL_GUARDRAILS.md` and uses the existing design system.
- [ ] Accessibility: All interactive elements are keyboard navigable, colours have sufficient contrast, and images have descriptive alt text.

### 🔧 Technical Context
- **New Route:** Create `website/src/routes/for-teachers/+page.svelte`.
- **Reusability:** We can reuse existing components like the ones used in `website/src/routes/overview/+page.svelte` (e.g., `l2-feature-grid`, `l2-cta-section`) to maintain design consistency and speed up development.
- **Navigation:** Add a link to the "For Teachers" page in the main site navigation and footer so it can be easily discovered.

### 📊 Estimated Complexity
Medium (3–5 days) — Requires designing the content structure, writing the copy tailored to educators, and assembling the page using existing components. While no new complex components need to be built, getting the messaging right requires care.

### 🔗 Related
- Target keywords: "google classroom bulk download for teachers", "grade offline google classroom"
- Links from/to: Link from the Home page and Footer navigation. Link to the Install page.
