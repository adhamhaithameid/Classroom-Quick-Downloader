/**
 * Shared student-work hint helpers. These were verbatim duplicates in
 * resolver.ts and extractor.ts (census finding); one home, both import.
 */

/** Pull the raw student-work user hint from ?u / ?userId or the hash
 * fragment of a Classroom URL. Null when absent or malformed. */
export function resolveStudentWorkUserHint(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    const fromQuery = parsed.searchParams.get('u') || parsed.searchParams.get('userId');
    if (fromQuery && fromQuery.trim().length > 0) return fromQuery.trim();

    const rawHash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    if (rawHash) {
      const hashParams = new URLSearchParams(rawHash);
      const fromHash = hashParams.get('u') || hashParams.get('userId');
      if (fromHash && fromHash.trim().length > 0) return fromHash.trim();
    }
  } catch {
    // Ignore malformed hint inputs.
  }
  return null;
}

// base64 decoding?? is this hacking??
// No: Classroom encodes the student id, and the numeric form decodes to the
// same digits. The manual alphabet path covers contexts without atob.
export function decodeHintToken(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{6,}$/.test(trimmed)) return trimmed;

  const normalizedBase64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = normalizedBase64 + '='.repeat((4 - (normalizedBase64.length % 4)) % 4);
  const manualDecode = (): string | null => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;

    for (const char of paddedBase64) {
      if (char === '=') break;
      const idx = alphabet.indexOf(char);
      if (idx < 0) return null;
      buffer = (buffer << 6) | idx;
      bits += 6;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 0xff);
      }
    }
    try {
      return new TextDecoder().decode(new Uint8Array(bytes));
    } catch {
      return null;
    }
  };

  try {
    const decoded = (typeof atob === 'function' ? atob(paddedBase64) : manualDecode())?.trim() || '';
    if (/^\d{6,}$/.test(decoded)) return decoded;
  } catch {
    const decoded = manualDecode()?.trim() || '';
    if (/^\d{6,}$/.test(decoded)) return decoded;
  }
  return null;
}
