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
   duplicate bordered cards.

Local raw capture location:

`verification/baseline/2026-03-10/snapshots/`

Those raw snapshots are intentionally left untracked.
