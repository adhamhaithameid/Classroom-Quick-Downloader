# Classroom Baseline Capture — 2026-03-10

This baseline was captured from a dedicated non-Arc Chrome profile that was
signed into Google Classroom specifically for extension verification work.

What was captured locally:

1. `home`
   - Classroom home with enrolled courses visible
2. `stream`
   - the first reachable course stream page
3. `classwork_list`
   - the corresponding classwork tab for that same course
4. `material_details`
   - direct material details route for the first material in classwork
5. `assignment_details`
   - direct assignment details route for the first assignment in classwork
6. `announcement_detail`
   - direct post details route for the first stream post
7. `student_work_teacher`
   - teacher submissions dashboard for the first assignment
8. `student_submissions`
   - "View your work" route reachable from classwork

Why the raw HTML is not committed:

1. the snapshots contain real Classroom data,
2. they may include names, course content, and private identifiers,
3. we only commit the safe structural regression fixtures derived from the
   behavior we want to lock down.

Committed protection added alongside this capture:

1. fixture-backed tests that keep real attachment cards downloadable,
2. regression coverage preventing loose Forms/Sheets links from getting
   download buttons,
3. post-card detection coverage preventing nested wrappers from becoming
   duplicate bordered cards,
4. safe detail-surface fixtures covering material details, assignment details,
   post details, teacher submissions, and student work rows,
5. golden visual, RTL, link-fuzz, and stress suites wired into the extension CI job.

Local raw capture location:

`verification/baseline/2026-03-10/snapshots/`

Those raw snapshots are intentionally left untracked.

See also:

1. `verification/baseline/2026-03-10/issues.json`
2. `docs/CLASSROOM_FIXTURE_CAPTURE_GUIDE.md`
3. `docs/EXTENSION_GOLDEN_BEHAVIOR_MATRIX.md`
