# Safari Distribution Runbook (Temporarily Disabled)

Safari support is currently disabled by project decision.

Do not use:

- `pnpm -C extension run safari`
- `pnpm -C extension run safari:xcode`
- `pnpm -C extension run safari:local`

Those commands intentionally fail with a disabled message so Safari cannot be shipped by accident.

<!--
Archived note:
- Prior Safari conversion/build scripts are intentionally kept in `tools/safari/`
  for potential future re-enable, but they are not part of active build/release flow.
-->
