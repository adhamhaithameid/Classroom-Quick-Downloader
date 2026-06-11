## ✨ Refine — Tech Debt
**Agent:** Refine | **Day:** Thursday | **Date:** 2026-06-11

---

### 📦 Debt Category
Skipped Tests

### 🔍 Current State
There are 12 skipped tests across the workspaces:
- 10 skipped tests in `extension/tests/analytics-flush-runtime.test.ts`
- 2 skipped tests in `extension/tests/student-work-flag-disable-entrypoints.test.ts`
- 0 skipped tests in `cloudflare-worker/tests/`

### 💡 Proposed Paydown Strategy
Audit the 12 skipped tests to determine if they can be re-enabled or if they should be deleted.
- First step: Review the 2 skipped tests in `extension/tests/student-work-flag-disable-entrypoints.test.ts` since it's a smaller set. Determine why they are skipped and either fix the underlying issue to re-enable them or delete them if the behavior is no longer supported.
- Full paydown: Review all 10 skipped tests in `extension/tests/analytics-flush-runtime.test.ts`. Fix the mock configurations, async timing issues, or obsolete assertions that led to them being skipped, and re-enable them. If any are truly irrelevant, delete them with an explanatory comment or commit message.
- Done looks like: 0 `.skip` annotations in the test suites.

### 🎯 Why This Matters Now
Skipped tests are broken promises; they indicate that a behavior is intended to be covered by tests but currently is not. Over time, these behaviors can silently regress. Resolving these tests guarantees the system behaves as expected, reducing the likelihood of regressions in critical areas like analytics flushing and entrypoint disablement.

### 📐 Acceptance Criteria
- [ ] 0 skipped tests remaining in `extension/tests/student-work-flag-disable-entrypoints.test.ts`.
- [ ] 0 skipped tests remaining in `extension/tests/analytics-flush-runtime.test.ts`.
- [ ] CI criterion — all tests pass after skipped tests are re-enabled or deleted.

### 🔧 Technical Context
Run `grep -rn "\.skip\|\.only\|xtest\|xit\|xdescribe\|skip(" extension/tests/ cloudflare-worker/tests/ --include="*.test.ts"` to find skipped tests.
Review `extension/tests/student-work-flag-disable-entrypoints.test.ts` and `extension/tests/analytics-flush-runtime.test.ts`.
To test: `cd extension && pnpm run test`

### 📊 Estimated Complexity
Medium (3-5 days) - Requires understanding the original intent of the tests, investigating why they were skipped, and potentially fixing actual bugs to make them pass.

### ⚠️ Risks
If the skipped tests are re-enabled without properly fixing the underlying issue, they may become flaky and break the CI pipeline.

### 🔗 Related
None.
