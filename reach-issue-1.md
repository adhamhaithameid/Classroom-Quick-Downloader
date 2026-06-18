---
title: "Reach: website missing a \"For Teachers\" landing page — high-intent audience with no dedicated page"
---
## 🚀 Reach — Growth & Distribution
**Agent:** Reach | **Day:** Thursday | **Date:** 2026-06-18
**Channel:** Website
**Cost:** Free

---

### 🎯 Growth Opportunity
The website is missing a dedicated "For Teachers" landing page (`/for-teachers`). While the extension is built for students, teachers are the primary power users who need to bulk download assignments for grading and archiving. Currently, there is no page specifically targeting teacher-centric search queries or addressing their specific workflow needs.

### 📊 Why This Matters
Teachers searching Google for "how to download all student work in google classroom" or "bulk download classroom assignments for grading" represent a high-intent audience. A dedicated landing page that speaks directly to their use case (grading, archiving, offline access) will convert much higher than a generic home page. Furthermore, if a teacher finds the tool useful, they are likely to recommend it to their students and colleagues, creating a powerful word-of-mouth growth loop.

### 💡 Specific Recommendation
Create a new SEO-targeted page `website/src/routes/for-teachers/+page.svelte` using the `SeoContentPage` component.

1. Add a new configuration to `website/src/lib/content/seoPages.ts`:
```typescript
  forTeachers: withDefaults({
    path: '/for-teachers',
    title: 'For Teachers — Bulk Download Google Classroom Assignments',
    description: 'A tool for teachers to bulk download student assignments, grading materials, and class files from Google Classroom in one click.',
    eyebrow: 'Educators',
    h1: 'Save Hours on Grading: Bulk Download Classroom Files',
    intro: 'Stop clicking every single attachment to grade offline. Classroom Quick Downloader lets teachers download entire assignment sets in one click.',
    keywords: 'google classroom download for teachers, bulk download assignments for grading',
    sections: [
      {
        heading: 'Why Teachers Love It',
        bullets: [
          'Download all student submissions for an assignment at once.',
          'Grade assignments offline without waiting for Google Drive to load.',
          'Easily archive class materials at the end of the semester.'
        ],
        paragraphs: ['We know your time is valuable. This free tool removes the repetitive clicks so you can focus on teaching.']
      }
    ]
  }),
```

2. Create `website/src/routes/for-teachers/+page.svelte`:
```svelte
<script lang="ts">
  import SeoContentPage from '$lib/components/SeoContentPage.svelte';
  import { seoPages } from '$lib/content/seoPages';
</script>

<SeoContentPage config={seoPages.forTeachers} />
```

3. Add a link to this page in the website footer or navigation.

### 📐 Acceptance Criteria
- [ ] `seoPages.ts` updated with the `forTeachers` configuration.
- [ ] `website/src/routes/for-teachers/+page.svelte` created and rendering correctly.
- [ ] The new page is included in the sitemap automatically (via `SeoContentPage` integration).
- [ ] A visible link to the "For Teachers" page exists on the website.

### 🔧 How to Implement
1. Open `website/src/lib/content/seoPages.ts` and paste the `forTeachers` object into the `seoPages` export.
2. Create the folder `website/src/routes/for-teachers/`.
3. Create the file `+page.svelte` in that folder with the provided code.
4. Add a "For Teachers" link to the footer navigation if applicable.

### 📊 Estimated Impact
Captures a completely unaddressed, high-intent audience. Teachers have high retention and the highest potential to drive network effects (sharing with other teachers and students).

### 🔗 Related
None.
