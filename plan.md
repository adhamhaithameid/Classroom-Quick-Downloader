1. **Fix package.json overrides to resolve audit issues.**
   - The CI failed because `pnpm audit` found vulnerabilities in `esbuild` and `shell-quote` inside `cloudflare-worker`.
   - The memory states: `To resolve pnpm audit vulnerabilities across the monorepo workspaces, configure dependency version overrides within the pnpm.overrides object in the root package.json.`
   - I will use `replace_with_git_merge_diff` to add `"esbuild": ">=0.28.1"` and `"shell-quote": ">=1.8.4"` to the `pnpm.overrides` block in the root `package.json`.
2. **Verify changes.**
   - Run `pnpm install` in the root.
   - Run `cd cloudflare-worker && pnpm run audit` to ensure vulnerabilities are resolved.
3. **Complete pre commit steps.**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
4. **Submit the PR.**
   - Commit message: `Vault: add try/catch around storage operations in changelog utils and fix audit issues`
