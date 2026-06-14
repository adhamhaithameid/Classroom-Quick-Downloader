1. **Fix missing try-catch around `chrome.storage.local.get/set` in `utils/changelog.ts`.**
   - The methods `persistManualCache`, `markAsSeen`, and `isVersionSeen` perform `chrome.storage.local` operations but don't wrap them in `try/catch`. This can cause uncaught exceptions if `chrome.storage` is not available or throws errors (like quota exceeded).
   - The fix is to add `try/catch` and safe default fallback behavior in case of errors.

2. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Call `pre_commit_instructions` tool to run the required tests and checks.

3. **Submit the PR.**
   - Commit message: `Vault: add try/catch around storage operations in changelog utils`
