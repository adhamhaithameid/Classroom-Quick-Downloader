# Website Visual Guardrails

This project intentionally protects two brand-critical areas from silent regressions:

1. Typography baseline (`Plus Jakarta Sans`)
2. Decorative identity layers (floating + 3D placement system)

## Why this exists

These visuals were accidentally changed in past refactors/deploys. The current guardrails force CI failures when those baseline elements drift.

## Enforced checks

- Route render checks assert:
  - Google Fonts preload includes `Plus Jakarta Sans`
  - Legacy `Inter` preload is not present
  - Overview structural layers exist: `l2-page-orbs`, `l2-page-grid`, `l2-page-floats`
- Visual guard tests assert:
  - Minimum decorative placement mix (float/doodle/3d)
  - Pinned supercharge star placement remains present
  - Global ambient animation/background rules still exist in `app.css`

## Test entrypoints

- `pnpm -C website test:visual-guards`
- Included in:
  - `pnpm -C website test:routes`
  - `pnpm -C website test:smoke`
  - `pnpm -C website test:strict`

## Updating visuals intentionally

If visual design intentionally changes:

1. Update implementation files first.
2. Update failing visual guard tests to match the new intentional baseline.
3. Keep this document and test names aligned with the new baseline.
