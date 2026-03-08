# Live Snapshot Output

This directory is reserved for live Google Classroom captures produced by:

```bash
node tools/run-extension-phase0-baseline.mjs --with-live-capture --profile "<chrome-profile-dir>"
```

Expected structure:

1. `snapshots/<page-type>/snapshot.html`
2. `snapshots/<page-type>/screenshot.png`
3. `snapshots/<page-type>/metadata.json`

These captures require:

1. a Chrome profile already signed into Google Classroom,
2. manual navigation through each required page type,
3. a human review of resulting artifacts.
