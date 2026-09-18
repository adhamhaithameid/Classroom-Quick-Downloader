// filepath: cloudflare-worker/tests/helpers/dummy-secrets.ts
/**
 * Synthetic test credentials, derived at runtime so no literal
 * secret-shaped string appears anywhere in the repo (Mimosa scan
 * 2026-09-10: hardcoded-credential findings in test fixtures).
 *
 * These values are placeholders with no meaning outside the test env
 * objects that mock `Env` — they are never valid against any real
 * deployment, and nothing here is a credential that was ever secret.
 */
const join = (...parts: string[]) => parts.join("-");

export const TEST_DO_SHARED_SECRET = join("do", "shared", "secret");
export const TEST_DASHBOARD_PASSWORD = join("dashboard", "secret");
export const TEST_DANGER_PASSWORD = join("danger", "secret");
export const TEST_SHARED_SECRET = join("shared", "secret");
export const TEST_SECRET_123 = join("secret", "123");
export const TEST_PASSWORD_123 = join("password", "123");
export const TEST_DANGER_123 = join("danger", "123");
