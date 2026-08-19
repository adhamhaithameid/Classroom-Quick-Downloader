# Corpus tooling

| Tool | Runs where | Purpose |
|---|---|---|
| `capture-bookmarklet.js` | Browser console on live Classroom | Dumps sanitized-safe raw card HTML to a JSON file. No network. |
| `sanitize-capture.mjs` | Node | Raw capture → `tests/accuracy/corpus/<caseId>/` with **placeholder labels** |
| `generate-synthetic.mjs` | Node | Regenerates all `syn-*` cases; labels are true by construction |

## Live-capture procedure (the part that needs a human)

1. Open Classroom (any view) in Chrome, signed in, with test content visible.
2. Paste the contents of `capture-bookmarklet.js` into DevTools → Enter.
3. A JSON file downloads. Move it somewhere private (it may contain user text).
4. `node tools/corpus/sanitize-capture.mjs ~/Downloads/cqd-capture-*.json <caseId> <viewKind> <lang>`
5. **Label `expected.json` by hand** — reading the page as a human. The loader
   refuses cases with an empty note, so an unlabelled capture cannot sneak in.
6. Set `"origin": "capture"` (the sanitizer already did), run
   `pnpm test:accuracy`, re-label or fix until C1 passes, then update floors.

## Provenance

Every case carries `origin`: `fixture` (copied from trusted regression
fixtures), `synthetic` (generated here, realistic shells), or `capture`
(live Classroom). G0 was reached with fixture + synthetic cases; captures
replace synthetics progressively in S2+ follow-ups.
