// filepath: extension/src/v2/decision/download-validator.ts
/**
 * ============================================================================
 * DOWNLOAD VALIDATOR — Security Gate for Download URLs
 * ============================================================================
 *
 * Every URL derived from DOM elements passes through this validator
 * before being sent to chrome.downloads.download(). This prevents:
 *
 * 1. Open redirect attacks (malicious URLs disguised as Drive links)
 * 2. Non-HTTPS downloads (data integrity, MITM prevention)
 * 3. Unexpected hosts (only Google domains allowed)
 * 4. Malformed URLs (invalid schemes, encoded bypasses)
 *
 * Why is this needed?
 * The DOM is fundamentally untrusted. Students can submit assignments
 * with arbitrary links. A malicious link could end up in an anchor tag
 * that CQD would happily put a download button on without validation.
 *
 * Every download URL must pass validateDownloadUrl() before download.
 *
 * @author Adham — better safe than breached
 * @since v4.0.0
 */

// ============================================================================
// ALLOWED HOSTS
// ============================================================================

/**
 * Hosts that are allowed as download targets.
 * Only Google-owned domains that legitimately serve files.
 */
const ALLOWED_HOSTS = new Set([
  'drive.google.com',
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
  'forms.google.com',
  'classroom.google.com',
  'drive.usercontent.google.com',
  'doc-00-00-docs.googleusercontent.com',
  'doc-0s-00-docs.googleusercontent.com',
  'lh3.googleusercontent.com',
]);

/**
 * Host suffix patterns — catch subdomains of Google services.
 * Example: doc-XX-XX-docs.googleusercontent.com
 */
const ALLOWED_HOST_SUFFIXES = [
  '.google.com',
  '.googleusercontent.com',
  '.googleapis.com',
];

// ============================================================================
// URL SHAPE PATTERNS
// ============================================================================

/**
 * Expected URL patterns for downloadable files.
 * At least one must match for a URL to be considered valid.
 */
const ALLOWED_URL_PATTERNS: RegExp[] = [
  // Drive file download
  /^https:\/\/drive\.google\.com\/(?:u\/\d+\/)?(?:file\/d\/|open\?|uc\?)/,
  // Drive usercontent (export endpoint)
  /^https:\/\/drive\.usercontent\.google\.com\//,
  // Docs/Slides/Drawings export
  /^https:\/\/docs\.google\.com\/(?:u\/\d+\/)?(?:document|presentation|drawings)\/d\//,
  // Classroom drive proxy
  /^https:\/\/classroom\.google\.com\/(?:u\/\d+\/)?drive\//,
  // Docs googleusercontent (direct download)
  /^https:\/\/doc-[0-9a-z]+-[0-9a-z]+-docs\.googleusercontent\.com\//,
  // Generic /file/d/ pattern
  /^https:\/\/[a-z0-9.-]+\.google(?:usercontent)?\.com\/.*\/file\/d\//,
];

// ============================================================================
// VALIDATION RESULT
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  url: string;
  reason: string;
  host: string | null;
}

// ============================================================================
// VALIDATOR
// ============================================================================

/**
 * Validate a URL before allowing it as a download target.
 *
 * @param rawUrl - The URL string to validate
 * @returns ValidationResult with valid=true if the URL is safe to download
 */
export function validateDownloadUrl(rawUrl: string): ValidationResult {
  // 1. Basic string checks
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, url: rawUrl, reason: 'EMPTY_URL', host: null };
  }

  const trimmed = rawUrl.trim();

  // 2. Parse as URL
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, url: trimmed, reason: 'MALFORMED_URL', host: null };
  }

  // 3. Scheme must be HTTPS
  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      url: trimmed,
      reason: `INVALID_SCHEME: ${parsed.protocol}`,
      host: parsed.hostname,
    };
  }

  // 4. Host must be in allowlist or match suffix
  const host = parsed.hostname.toLowerCase();
  const hostAllowed =
    ALLOWED_HOSTS.has(host) ||
    ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));

  if (!hostAllowed) {
    return {
      valid: false,
      url: trimmed,
      reason: `DISALLOWED_HOST: ${host}`,
      host,
    };
  }

  // 5. URL shape must match at least one expected pattern
  // This is intentionally opinionated. A false negative here is annoying, but a
  // false positive here means the extension tries to download the wrong thing.
  const shapeMatch = ALLOWED_URL_PATTERNS.some((pattern) => pattern.test(trimmed));
  if (!shapeMatch) {
    return {
      valid: false,
      url: trimmed,
      reason: `UNEXPECTED_URL_SHAPE`,
      host,
    };
  }

  // 6. Check for suspicious encoding (double-encoded characters, path traversal)
  if (trimmed.includes('%25') || trimmed.includes('..') || trimmed.includes('\x00')) {
    return {
      valid: false,
      url: trimmed,
      reason: 'SUSPICIOUS_ENCODING',
      host,
    };
  }

  return { valid: true, url: trimmed, reason: 'OK', host };
}

/**
 * Batch-validate multiple URLs.
 * Returns only the valid ones (with original index for mapping).
 */
export function filterValidDownloadUrls(
  urls: string[],
): { index: number; url: string; result: ValidationResult }[] {
  return urls.map((url, index) => ({
    index,
    url,
    result: validateDownloadUrl(url),
  })).filter((entry) => entry.result.valid);
}
