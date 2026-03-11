/**
 * Best-effort timing-safe string comparison for JavaScript.
 *
 * IMPORTANT: JavaScript does not guarantee constant-time execution.
 * JIT compilers, garbage collection, and branch prediction can all
 * introduce timing variations. This implementation minimizes the
 * most obvious timing channels (early exit on length mismatch,
 * character-by-character short-circuit) but is NOT equivalent to
 * crypto.subtle.timingSafeEqual (unavailable in Workers runtime for
 * arbitrary strings).
 *
 * For password verification, prefer bcrypt/scrypt which have their
 * own timing-safe comparison built in.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  let mismatch = a.length ^ b.length;
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i += 1) {
    const aCode = i < a.length ? a.charCodeAt(i) : 0;
    const bCode = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= aCode ^ bCode;
  }
  return mismatch === 0;
}
