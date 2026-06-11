## 🚀 Reach — Growth & Distribution
**Agent:** Reach | **Day:** Thursday | **Date:** 2026-06-11
**Channel:** Website
**Cost:** Free

---

### 🎯 Growth Opportunity
The website is currently missing a dedicated "For Teachers" landing page. Teachers are the primary power users of this extension and represent a high-intent audience who often search for phrases like "bulk download classroom files for grading" or "teacher tool for google classroom downloads".

### 📊 Why This Matters
When a teacher searches for bulk downloading tools, landing on a generic homepage is fine, but landing on a page specifically tailored to their grading workflow creates immediate trust. A "For Teachers" page directly addresses their specific pain points (managing multiple classes, archiving student work at the end of the term, grading offline) and significantly increases the likelihood of conversion and word-of-mouth sharing among faculty.

### 💡 Specific Recommendation
Add a new `forTeachers` configuration to `website/src/lib/content/seoPages.ts` with the following content:

```typescript
  forTeachers: withDefaults({
    path: '/for-teachers',
    title: 'For Teachers — Classroom Quick Downloader',
    description:
      'The fastest way for teachers to bulk download student assignments, materials, and Google Classroom files for offline grading and archiving.',
    eyebrow: 'Educators',
    h1: 'Classroom Quick Downloader For Teachers',
    intro:
      'Stop clicking through every student submission. Download entire assignments in one click for faster grading and easy archiving.',
    keywords: 'google classroom extension for teachers, bulk download student assignments, offline grading google classroom, teacher tools',
    sections: [
      {
        heading: 'Faster Grading Workflows',
        bullets: [
          'Download all student submissions for an assignment in one click.',
          'Review files offline or in your preferred desktop applications.',
          'Save hours of repetitive clicking during busy grading periods.'
        ],
        paragraphs: ['CQD is designed to eliminate the friction of managing dozens of student files.']
      },
      {
        heading: 'End-of-Term Archiving',
        bullets: [
          'Easily backup course materials before the classroom is archived.',
          'Keep local records of student work.'
        ],
        paragraphs: ['With one click, you can secure all the files you need before the term ends.']
      }
    ]
  }),
```

Then, ensure this path is accessible by updating the navigation or footer if necessary, and that it gets indexed via the sitemap since it uses `withDefaults` and the existing SEO framework.

### 📐 Acceptance Criteria
- [ ] `forTeachers` page configuration added to `website/src/lib/content/seoPages.ts`
- [ ] The page renders successfully at `/for-teachers`
- [ ] The page is automatically included in the sitemap and `robots.txt` indexable paths
- [ ] Verified the page correctly displays the teacher-specific messaging

### 🔧 How to Implement
1. Open `website/src/lib/content/seoPages.ts`.
2. Add the `forTeachers` object as shown in the recommendation above inside the exported `seoPages` object.
3. Save the file and run `pnpm -C website dev` to verify the page loads at `http://localhost:5173/for-teachers`.
4. Run `pnpm -C website build` to ensure the build succeeds and the new page is prerendered.

### 📊 Estimated Impact
This targets a high-intent audience segment. A dedicated SEO landing page can capture long-tail organic search traffic from teachers looking for grading efficiency tools, potentially driving a steady increase in teacher installs over time.

### 🔗 Related
None
