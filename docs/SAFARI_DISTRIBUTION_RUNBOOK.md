# Safari Distribution Runbook

This runbook defines how to ship Classroom Quick Downloader to Safari users.

Important: Safari users cannot install the raw extension zip directly like Chrome/Firefox. Safari requires an app container built in Xcode.

## 1. Prerequisites

- macOS with Xcode installed
- Xcode Command Line Tools (`xcrun` available)
- Apple Developer account (required for TestFlight/App Store distribution)
- Repo dependencies installed:

```bash
pnpm install
```

## 2. Build Safari Web Extension Artifact

```bash
pnpm -C extension run safari
```

Expected outputs:

- `extension/.output/safari-mv2/` (unpacked Safari extension build)
- `extension/.output/classroom-quick-downloader-<version>-safari.zip`

## 3. Convert to Xcode Project

Use the helper:

```bash
pnpm -C extension run safari:xcode
```

Optional environment overrides:

```bash
SAFARI_APP_NAME="Classroom Quick Downloader Safari" \
SAFARI_BUNDLE_ID="dev.adhamhaitham.cqd.safari" \
OPEN_XCODE=1 \
pnpm -C extension run safari:xcode
```

This generates a project under:

- `extension/.output/safari-xcode/`

## 3.5 One-command local flow (build + convert + compile + launch)

```bash
pnpm -C extension run safari:local
```

This command:

1. builds the Safari extension artifact,
2. converts it to an Xcode project,
3. compiles the macOS container app,
4. launches the app, and
5. opens Safari extensions settings.

## 4. Local Manual Testing on Safari

1. Open generated `.xcodeproj`.
2. Set Signing Team for all targets (app + extension).
3. Run the container app from Xcode once.
4. Open Safari -> Settings -> Extensions.
5. Enable `Classroom Quick Downloader`.
6. Verify on `https://classroom.google.com`.

Recommended smoke checks:

- Single file download
- Download all
- Cancel flow
- Changelog button opens expected page
- Analytics endpoint reachable (non-blocking behavior if unreachable)

## 5. TestFlight / App Store Distribution

1. In Xcode, set:
   - Marketing version = extension release version (for example `1.3.9`)
   - Build number incremented
2. `Product -> Archive`
3. In Organizer: `Distribute App -> App Store Connect -> Upload`
4. In App Store Connect:
   - Create/attach TestFlight build
   - Add internal/external testers
5. After approval/review, publish to App Store.

## 6. Release Checklist (Safari)

- [ ] `pnpm -C extension run safari` passes
- [ ] Xcode conversion succeeds
- [ ] Local Safari QA completed
- [ ] TestFlight upload completed
- [ ] Version parity checked against extension release notes
- [ ] Post-release smoke on macOS Safari completed

## 7. Troubleshooting

### `xcrun: command not found`

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

### Converter fails with signing or bundle conflicts

- Use a unique bundle identifier
- Remove stale generated project folder and rerun converter

### Extension not visible in Safari settings

- Ensure container app was run at least once from Xcode
- Ensure extension target signing is valid

## 8. Ownership

- Build/release owner: repository maintainers
- CI validation owner: extension pipeline maintainers
- Production distribution owner: Apple Developer account admins
