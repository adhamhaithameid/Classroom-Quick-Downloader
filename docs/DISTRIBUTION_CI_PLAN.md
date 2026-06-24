# Extension Distribution CI Plan

Hybrid distribution pipeline: CI builds all three artifacts on every tagged release, auto-publishes to Firefox (fully automated), and creates a draft GitHub Release with artifacts for Chrome and Edge (human submits to store).

Last updated: 2026-06-24

---

## Why Hybrid, Not Full Auto

| Browser | Store API | Auto-publish viable? |
|---------|-----------|----------------------|
| Firefox | AMO Signing API (JWT) | Yes — full end-to-end automation |
| Chrome | Chrome Web Store API (OAuth2) | Partial — API exists but human review gate + 2FA make full auto fragile |
| Edge | Partner Center API | No stable public API — manual upload recommended |

Full auto-publish to Chrome/Edge breaks on: review rejections, store API changes, 2FA prompts, temporary suspension notices. The hybrid model gives 90% of the value: build once, attach to release, minimal manual steps.

---

## Architecture

```
git tag v1.5.6
     │
     ▼
GitHub Actions: extension-distribution.yml
     │
     ├─ job: build-chrome   → dist-chrome.zip
     ├─ job: build-firefox  → dist-firefox.xpi (signed)
     ├─ job: build-edge     → dist-edge.zip
     │
     ├─ job: publish-firefox (AMO API)
     │       → upload + sign → published automatically
     │
     └─ job: draft-github-release
             → creates GitHub Release (draft)
             → attaches all three artifacts
             → body: auto-generated changelog
             → Chrome + Edge: open links to store submit pages in release notes
```

---

## Secrets Required

Add these to GitHub repo secrets (`Settings → Secrets and variables → Actions`):

| Secret | Used For | How to Get |
|--------|----------|------------|
| `FIREFOX_API_KEY` | Firefox AMO JWT issuer | addons.mozilla.org → Developer Hub → API Credentials |
| `FIREFOX_API_SECRET` | Firefox AMO JWT secret | Same as above |
| `CHROME_EXTENSION_ID` | Chrome Web Store reference | Chrome Web Store Developer Dashboard |
| `CHROME_CLIENT_ID` | Chrome Web Store OAuth2 | Google API Console → OAuth 2.0 Client ID |
| `CHROME_CLIENT_SECRET` | Chrome Web Store OAuth2 | Google API Console → OAuth 2.0 Client Secret |
| `CHROME_REFRESH_TOKEN` | Chrome Web Store OAuth2 | One-time: `chrome-webstore-upload-keys` tool |

**Chrome secrets are optional in Phase 1** — only needed if you add a `publish-chrome` job later. For now, Chrome artifact is attached to the draft release and you upload manually.

---

## Workflow File

Create `.github/workflows/extension-distribution.yml`:

```yaml
name: Extension Distribution

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      tag:
        description: 'Tag to build from (e.g. v1.5.6)'
        required: true

permissions:
  contents: write

jobs:
  build-chrome:
    name: Build Chrome
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 10.28.2
      - uses: actions/setup-node@v5
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -C extension run chrome
      - uses: actions/upload-artifact@v4
        with:
          name: dist-chrome
          path: extension/.output/chrome-mv3/
          retention-days: 30

  build-firefox:
    name: Build Firefox
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 10.28.2
      - uses: actions/setup-node@v5
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -C extension run firefox
      - uses: actions/upload-artifact@v4
        with:
          name: dist-firefox
          path: extension/.output/firefox-mv2/
          retention-days: 30

  build-edge:
    name: Build Edge
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 10.28.2
      - uses: actions/setup-node@v5
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -C extension run edge
      - uses: actions/upload-artifact@v4
        with:
          name: dist-edge
          path: extension/.output/edge-mv3/
          retention-days: 30

  publish-firefox:
    name: Publish to Firefox AMO
    needs: build-firefox
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: dist-firefox
          path: ./dist-firefox
      - name: Package XPI
        run: |
          cd dist-firefox && zip -r ../dist-firefox.xpi . && cd ..
      - name: Sign and Submit to AMO
        uses: trmcnvn/firefox-addon@v1
        with:
          uuid: 'classroom-quick-downloader@adhamhaitham.dev'
          xpi: ./dist-firefox.xpi
          manifest: ./dist-firefox/manifest.json
          api-key: ${{ secrets.FIREFOX_API_KEY }}
          api-secret: ${{ secrets.FIREFOX_API_SECRET }}

  draft-release:
    name: Create GitHub Draft Release
    needs: [build-chrome, build-firefox, build-edge, publish-firefox]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/download-artifact@v4
        with:
          path: ./artifacts
      - name: Package artifacts
        run: |
          cd artifacts/dist-chrome && zip -r ../../cqd-chrome-${{ github.ref_name }}.zip . && cd ../..
          cd artifacts/dist-edge && zip -r ../../cqd-edge-${{ github.ref_name }}.zip . && cd ../..
          cd artifacts/dist-firefox && zip -r ../../cqd-firefox-${{ github.ref_name }}.xpi . && cd ../..
      - name: Create Draft Release
        uses: softprops/action-gh-release@v2
        with:
          draft: true
          generate_release_notes: true
          files: |
            cqd-chrome-${{ github.ref_name }}.zip
            cqd-edge-${{ github.ref_name }}.zip
            cqd-firefox-${{ github.ref_name }}.xpi
          body: |
            ## Distribution Checklist

            - [x] Firefox — auto-published to AMO ✅
            - [ ] Chrome — [upload here](https://chrome.google.com/webstore/devconsole) → upload `cqd-chrome-*.zip`
            - [ ] Edge — [upload here](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview) → upload `cqd-edge-*.zip`

            ## Artifacts
            All three browser artifacts are attached to this release.
            Firefox is already published. Chrome and Edge require manual upload.
```

---

## Extension Build Scripts Reference

These scripts already exist in `extension/package.json` — no changes needed:

| Script | Output path | What it does |
|--------|-------------|--------------|
| `pnpm --filter extension chrome` | `.output/chrome-mv3/` | Builds + zips for Chrome MV3 |
| `pnpm --filter extension firefox` | `.output/firefox-mv2/` | Builds + zips for Firefox MV2 |
| `pnpm --filter extension edge` | `.output/edge-mv3/` | Builds + zips for Edge MV3 |
| `pnpm --filter extension build:all` | all three | Builds all browsers |

Edge and Chrome are both MV3 but built separately — each has its own output directory and manifest.

---

## Release Process (Post-Pipeline)

1. Bump version in `extension/package.json` (and root `package.json` if needed).
2. Commit: `chore: bump extension to v1.5.6`.
3. Tag: `git tag v1.5.6 && git push origin v1.5.6`.
4. GitHub Actions triggers → builds all three → auto-publishes Firefox → creates draft release.
5. Open the draft release in GitHub → review changelog → publish the release.
6. Click Chrome upload link in release notes → upload `cqd-chrome-*.zip`.
7. Click Edge upload link → upload `cqd-edge-*.zip`.

**Total manual time after tagging: ~5 minutes** (was: 20-30 min manual build + upload per browser).

---

## Future Phases

### Phase 2: Chrome Auto-Publish (Optional)

Once Chrome Web Store API credentials are configured, add a `publish-chrome` job:

```yaml
  publish-chrome:
    name: Publish to Chrome Web Store
    needs: build-chrome
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist-chrome
          path: ./dist-chrome
      - name: Package ZIP
        run: cd dist-chrome && zip -r ../dist-chrome.zip .
      - name: Upload to Chrome Web Store
        uses: trmcnvn/chrome-addon@v2
        with:
          extension: ${{ secrets.CHROME_EXTENSION_ID }}
          zip: ./dist-chrome.zip
          client-id: ${{ secrets.CHROME_CLIENT_ID }}
          client-secret: ${{ secrets.CHROME_CLIENT_SECRET }}
          refresh-token: ${{ secrets.CHROME_REFRESH_TOKEN }}
          publish: true
```

Note: Chrome store review takes 1-3 business days regardless of automation. Auto-publish submits for review; it does not skip the review gate.

### Phase 3: Safari Distribution

Safari requires XCode + `xcrun safari-web-extension-converter`. Requires macOS runner. Separate workflow, separate review process. Defer until Chrome/Firefox/Edge pipeline is stable.

See `docs/SAFARI_DISTRIBUTION_RUNBOOK.md` for manual steps (already exists).

---

## Store Links

| Store | Dashboard | Extension URL |
|-------|-----------|---------------|
| Chrome | [Developer Console](https://chrome.google.com/webstore/devconsole) | `oemoongiefmpmomjikcjmkkkhffcbdid` |
| Firefox | [AMO Developer Hub](https://addons.mozilla.org/en-US/developers/) | `/addon/classroom-quick-downloader/` |
| Edge | [Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview) | `ecojbijjkcjdolpeoiemnccgmaeomcmn` |
