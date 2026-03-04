# Manual Changelog Operations

## 1. Goal
Operate extension and website changelog content through source-controlled manual files.

## 2. Source Files
- `manual/changelog/website-changelog.manual.md`
- `manual/changelog/extension-changelog.manual.md`
- `manual/changelog/extension-pill-rules.manual.json`
- `manual/changelog/release-version.manual.json`

## 3. Required Format (Markdown)
Use one release block per version:

```md
## v1.3.9
### Summary
...
### Added
- ...
### Changed
- ...
### Fixed
- ...
```

## 4. Generate Runtime Artifacts
Run from repo root:

```bash
pnpm run sync:manual-changelog
```

Generator outputs:
- `website/src/lib/content/changelog.manual.generated.{json,ts}`
- `website/src/lib/content/release-version.manual.generated.{json,ts}`
- `extension/entrypoints/utils/manual-changelog.generated.{json,ts}`

## 5. Validation
Run:

```bash
pnpm -C website check
pnpm -C website test
pnpm -C extension compile
pnpm -C extension test -- --runInBand
```

## 6. Publish Checklist
1. Update manual source files.
2. Run `sync:manual-changelog`.
3. Run validation commands.
4. Verify website changelog page and extension popup locally.
5. Commit both source and generated files together.

## 7. Pill Rules (Extension)
- Managed by `extension-pill-rules.manual.json`.
- Current critical behavior requirement:
  - major red pulse for target versions `1.3.7` and `1.3.8`.

## 8. Legacy Runtime Customization
Cloudflare/Oracle legacy changelog runtime controls are retained for rollback but are not the active source in manual mode.
