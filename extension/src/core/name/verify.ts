// filepath: extension/src/core/name/verify.ts
/**
 * ============================================================================
 * VERIFY — filename extension checks shared by every naming call site (S7)
 * ============================================================================
 */

/**
 * The file extension of a name, lowercase — or null when the name does not
 * end in a plausible extension (dot + 1-10 alphanumerics at end of string).
 */
export function fileNameExtension(name: string): string | null {
  const m = name.match(/\.([a-zA-Z0-9]{1,10})$/);
  return m ? m[1].toLowerCase() : null;
}

/** True when the name ends in a plausible file extension. */
export function hasFileExtension(name: string): boolean {
  return fileNameExtension(name) !== null;
}
