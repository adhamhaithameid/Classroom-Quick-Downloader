---
title: "Muse: create a dedicated 'For Teachers' landing page with teacher-specific use cases"
---

## 🎭 Muse — Website Suggestion
**Agent:** Muse | **Day:** Thursday | **Date:** 2024-05-23

---

### 👤 Visitor Story
As a teacher, I want to see how Classroom Quick Downloader specifically helps me grade assignments faster, so that I can decide if it's worth installing to save time during my weekend grading sessions.

### 🔍 Current State
Currently, the website has a general homepage (`website/src/routes/+page.svelte` loading `website/src/routes/overview/+page.svelte`) that appeals broadly to any user of Google Classroom. While effective, it lacks dedicated messaging for the most common power-user: teachers. Teachers have specific pain points (e.g., clicking into 30 individual student documents, dealing with Google Drive virus scanning delays) that a dedicated landing page could directly address.

### 💡 Proposed Improvement
Create a dedicated route `website/src/routes/for-teachers/+page.svelte` (and accompanying SEO configuration in `seoPages.ts`).
- This page should use terminology specific to educators (e.g., "grading," "roster," "rubrics").
- It should include a specific "How It Works for Teachers" section that shows the exact workflow of downloading an entire class's submissions at once.
- The design should match the existing `SeoContentPage.svelte` or `OverviewPage` visual guardrails, perhaps reusing the overview components but with customized text.

### 🎯 Why This Matters
Teachers are the primary driver of organic growth. If a teacher loves the tool, they are likely to recommend it to their entire department. A generic value proposition might fail to resonate as strongly as "Save 2 hours on Sunday night grading." This creates a targeted conversion funnel that builds higher trust.

### 📐 Acceptance Criteria
- [ ] A new route `/for-teachers` exists and is accessible.
- [ ] The page clearly articulates the time-saving benefits for grading workflows.
- [ ] The page includes an explicit call-to-action to install the extension.
- [ ] The page is responsive on mobile devices.
- [ ] The page matches the existing visual design system and visual guardrails.
- [ ] Accessibility: The page is keyboard navigable, has sufficient color contrast, and uses proper semantic HTML.

### 🔧 Technical Context
- Add a new route: `website/src/routes/for-teachers/+page.svelte`
- Add new SEO content configuration in `website/src/lib/content/seoPages.ts`
- Likely reuse the `<SeoContentPage>` component or create a customized layout based on the `overview` components.

### 📊 Estimated Complexity
Medium (3-5 days) — Requires writing new targeted copy, potentially creating a new hero image/graphic specifically showing a teacher's view of Google Classroom, and wiring up the new route and SEO metadata.

### 🔗 Related
- Target SEO keywords: "download all assignments google classroom teacher", "google classroom grading tool"
- Link to this page from the main site footer and potentially the homepage hero section ("Are you a teacher?").
