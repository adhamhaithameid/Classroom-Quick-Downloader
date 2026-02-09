
/**
 * Utility functions for the Cloudflare Worker.
 */

/**
 * Compares two strings using a constant-time algorithm to prevent timing attacks.
 * It hashes both strings using SHA-256 and then compares the hashes.
 *
 * @param a - The first string to compare (e.g., user input).
 * @param b - The second string to compare (e.g., the secret).
 * @returns A promise that resolves to true if the strings are equal, false otherwise.
 */
export async function safeCompare(a: string | null | undefined, b: string | null | undefined): Promise<boolean> {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return a === b;
  }

  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);

  const aHash = await crypto.subtle.digest("SHA-256", aBuf);
  const bHash = await crypto.subtle.digest("SHA-256", bBuf);

  return timingSafeEqual(aHash, bHash);
}

function timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;

  const viewA = new DataView(a);
  const viewB = new DataView(b);
  let diff = 0;

  for (let i = 0; i < viewA.byteLength; i++) {
    diff |= viewA.getUint8(i) ^ viewB.getUint8(i);
  }

  return diff === 0;
}
