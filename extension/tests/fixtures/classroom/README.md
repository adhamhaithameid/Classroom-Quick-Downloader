# Classroom HTML Fixtures

This directory stores sanitized Classroom HTML fixtures generated from live snapshots.

Fixtures currently committed:

1. `classwork-material-post-en.html`
   - one real attachment card
   - loose Forms/Sheets links in body copy
   - nested wrapper section that must not become a second post card
2. `stream-flagged-post-en.html`
   - single flagged post in the stream layout
   - edited metadata and class comments inside the same visual card
3. `mixed-links-post-en.html`
   - multiple real downloadable attachments
   - unsupported links (Forms, Sheets, YouTube, external) in the same post body
4. `rtl-flagged-post-ar.html`
   - RTL flag-placement regression fixture
   - Arabic edited/comment text inside one outer card
5. `material-details-en.html`
   - details-view attachment card with comment shell nearby
   - protects one real button and no comment-shell false positives
6. `assignment-details-en.html`
   - assignment details copy with unsupported Forms/Sheets links
   - protects against random buttons on instructions and CTA controls
7. `announcement-detail-en.html`
   - post details surface with nested comments shell
   - protects one-card ownership in the detail route
8. `student-work-teacher-en.html`
   - teacher submissions/admin controls surface
   - protects against stray buttons on admin actions
9. `student-submissions-en.html`
   - "View your work" rows with nested duplicate stream-item controllers
   - protects row dedupe and no random attachment buttons on count text

Generate a sanitized fixture with:

```bash
npx tsx tools/extract-fixture.ts verification/baseline/<baseline-date>/snapshots/<page-type>/snapshot.html --output extension/tests/fixtures/classroom --page-type <page-type> --lang <lang>
```

Refresh integrity manifest checksums after fixture changes:

```bash
pnpm -C extension run fixtures:manifest:update
```

The manifest (`manifest.json`) stores:

1. source metadata (GitHub PR/branch/commit reference),
2. per-file byte-size,
3. per-file SHA-256 checksum.

Important rules:

1. Never commit raw Classroom HTML that still contains names, emails, or private course data.
2. Keep raw captures in `verification/baseline/<date>/snapshots/` locally only.
3. Commit only sanitized fixtures that are safe for regression tests.
4. If a fixture represents current "golden" behavior, add or update a matching test in `extension/tests/`.
5. After adding/changing any fixture `.html`, regenerate `manifest.json` and keep checksum test passing.
