---
title: "Reach: website missing a \"For Teachers\" landing page — high-intent audience with no dedicated page"
---

## 🚀 Reach — Growth & Distribution
**Agent:** Reach | **Day:** Thursday | **Date:** 2026-07-02
**Channel:** Website
**Cost:** Free

---

### 🎯 Growth Opportunity
The website lacks a dedicated landing page for educators. Teachers represent a high-intent audience who frequently search for "bulk download classroom files," but our current SEO pages (e.g., `/bulk-download-google-classroom-assignments`) are entirely student-focused in their copy. We should add a new `forTeachers` configuration in `seoPages.ts` and map it to a `/for-teachers` route.

### 📊 Why This Matters
Teachers have a different pain point than students: they need to download entire assignment submissions for grading or archiving across multiple classes. When a teacher searches for a solution and lands on a page talking about "offline study or exam review," the messaging feels misaligned, increasing bounce rates. A dedicated `/for-teachers` page will capture this specific, high-intent SEO traffic and improve conversion by speaking directly to their use case (grading, archiving, batching work). Furthermore, a satisfied teacher is highly likely to recommend the tool to their entire department, creating a strong word-of-mouth growth loop.

### 💡 Specific Recommendation
Add a new page configuration to `website/src/lib/content/seoPages.ts`:

```typescript
  forTeachers: withDefaults({
    path: '/for-teachers',
    title: 'Google Classroom Bulk Downloader For Teachers',
    description:
      'Download all student submissions and Google Classroom assignment files at once. Built to save teachers time during grading and archiving.',
    eyebrow: 'For Educators',
    h1: 'Faster Downloads For Teachers',
    intro:
      'Grading and archiving shouldn\\'t require hundreds of manual clicks. Classroom Quick Downloader lets teachers bulk download all student work from any assignment with a single click.',
    keywords: 'google classroom bulk download for teachers, download all student submissions, teacher grading tool, google classroom archiver',
    sections: [
      {
        heading: 'Stop Clicking One-By-One',
        paragraphs: [
          'Teachers often spend hours manually opening and downloading individual student submissions or course materials.',
          'CQD adds a "Download All" button directly to your Google Classroom interface, allowing you to batch download entire assignments instantly.'
        ]
      },
      {
        heading: 'Built For Grading & Archiving',
        bullets: [
          'Download all attachments from a single assignment stream in one click.',
          'Save time at the end of the term when archiving class materials.',
          'Secure by design: CQD does not collect or upload student files or grades.'
        ],
        paragraphs: ['Whether you are collecting essays for offline grading or saving term projects, CQD streamlines the process.']
      }
    ]
  }),
```

### 📐 Acceptance Criteria
- [ ] `seoPages.ts` is updated with the `forTeachers` configuration.
- [ ] A new route `website/src/routes/for-teachers/+page.svelte` is created that uses `<SeoContentPage config={seoPages.forTeachers} />`.
- [ ] Verification — the `/for-teachers` page renders correctly with the teacher-specific copy.
- [ ] Live check — the page is indexable and properly added to the sitemap via `INDEXABLE_SITE_PATHS`.

### 🔧 How to Implement
1. Open `website/src/lib/content/seoPages.ts`.
2. Copy and paste the `forTeachers` object (from the Specific Recommendation section) into the `seoPages` export.
3. Create a new directory and file at `website/src/routes/for-teachers/+page.svelte`.
4. In that file, import `SeoContentPage` and `seoPages`, and render the page:
   ```svelte
   <script lang="ts">
     import SeoContentPage from '$lib/components/SeoContentPage.svelte';
     import { seoPages } from '$lib/content/seoPages';
   </script>

   <SeoContentPage config={seoPages.forTeachers} />
   ```
5. Run `pnpm -C website check`, `test`, and `build` to verify.

### 📊 Estimated Impact
Creating a dedicated page targeting teacher-specific keywords (e.g., "download all student submissions") will significantly improve search visibility and conversion rates for educators, our highest-leverage user base for word-of-mouth distribution.

### 🔗 Related
None.
