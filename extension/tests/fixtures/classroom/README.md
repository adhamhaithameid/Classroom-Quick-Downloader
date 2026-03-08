# Classroom HTML Fixtures

This directory stores sanitized Classroom HTML fixtures generated from live snapshots.

Generate a sanitized fixture with:

```bash
npx tsx tools/extract-fixture.ts verification/baseline/2026-03-08/snapshots/<page-type>/snapshot.html --output extension/tests/fixtures/classroom --page-type <page-type> --lang <lang>
```
