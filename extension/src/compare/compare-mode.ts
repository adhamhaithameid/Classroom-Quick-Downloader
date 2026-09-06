// filepath: extension/src/compare/compare-mode.ts
/**
 * ============================================================================
 * COMPARE MODE — build-time gate
 * ============================================================================
 *
 * Compare mode is a BUILD flag, not a runtime setting. `pnpm build:compare`
 * runs `wxt build --mode compare`, which sets `import.meta.env.MODE`. Vite
 * inlines that constant, so every `if (IS_COMPARE_BUILD)` block is statically
 * false in a normal build and gets dead-code-eliminated.
 *
 * WHY NOT AN EngineMode VALUE
 * The seam design sketched `EngineMode = 'v1' | 'v2' | 'compare'`, but
 * `src/engines/types.ts` already defines
 * `EngineMode = 'legacy' | 'shadow' | 'v2' | 'v3'`, and that type is wired
 * through engine-registry, mode-controller, the popup toggle and
 * `chrome.storage.local.cqdV2Mode`. Adding a member would have meant touching
 * all of them, and — worse — would have created a runtime path into compare
 * mode from the popup.
 *
 * As a build flag there is no such path. A store build cannot reach compare
 * mode even with storage tampering, because the code is not in the bundle.
 */

/** True only in builds produced by `wxt build --mode compare`. */
export const IS_COMPARE_BUILD = import.meta.env.MODE === 'compare';
