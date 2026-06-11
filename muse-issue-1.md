## 🎭 Muse — Website Suggestion
**Agent:** Muse | **Day:** Thursday | **Date:** 2024-05-23

---

### 👤 Visitor Story
As a teacher, I want to see a dedicated page explaining how Classroom Quick Downloader solves my specific grading workflow problems (downloading all student assignments at once), so that I can quickly decide if this extension is right for my classroom.

### 🔍 Current State
The website currently has a generic home page and several comparison/SEO pages (`website/src/routes/bulk-download-google-classroom-assignments/+page.svelte`, etc.), but lacks a dedicated destination page clearly tailored to teachers, who are the primary users of the extension. The generic messaging focuses on features ("bulk download") rather than teacher outcomes ("save 20 minutes of clicking when grading").

### 💡 Proposed Improvement
Create a dedicated "For Teachers" landing page.
- **Route:** `website/src/routes/for-teachers/+page.svelte`
- **Content:** Reframe the value proposition around teacher time-savings, reliable grading workflows, and Google Workspace compatibility.
- **Design:** Follow the existing visual language in `docs/VISUAL_GUARDRAILS.md` using components like `SeoContentPage.svelte` as a starting point, perhaps including testimonials from educators or a short video showing a teacher grading workflow.
- **Experience:** A teacher landing on this page should feel the product was built specifically for their daily pain points.

### 🎯 Why This Matters
Teachers are the highest-value users and primary decision-makers for this extension. A generic home page might lose them if they don't immediately connect the features to their grading workflow. A dedicated page improves conversion rates for this specific audience and acts as a strong landing page for teacher-focused marketing or community shares.

### 📐 Acceptance Criteria
- [ ] A new route `website/src/routes/for-teachers/+page.svelte` is created.
- [ ] Content specifically addresses teacher pain points (grading, saving time, organizing student files).
- [ ] Responsive design works smoothly on mobile and desktop.
- [ ] Matches existing design system (Plus Jakarta Sans typography, proper visual guardrail compliance).
- [ ] Accessibility: keyboard navigable, sufficient color contrast, alt text on images.

### 🔧 Technical Context
- **New Route:** `website/src/routes/for-teachers/+page.svelte`
- **Dependencies:** Can reuse existing components like `$lib/components/SeoContentPage.svelte` or custom components matching the homepage style.
- **SEO config:** Add a new entry to `website/src/lib/content/seoPages.ts` for the "For Teachers" page.

### 📊 Estimated Complexity
Medium (3-5 days). Requires copywriting, potentially new assets/screenshots showing teacher use cases, and assembling the Svelte components.

### 🔗 Related
- Existing SEO pages: `website/src/routes/bulk-download-google-classroom-assignments/+page.svelte`