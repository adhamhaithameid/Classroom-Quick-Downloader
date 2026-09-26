// Asserts the legacy Pages host 301-redirects to the canonical domain.
// Extracted from verify-production.mjs so it can be regression-tested against
// a local fixture server (tools/verify-production.test.mjs): this is the
// check that catches the "pages.dev stops redirecting" class of production
// regression (bead Classroom-Quick-Downloader-rhq) — a 200-with-HTML response
// masks the failure from users via the JS-redirect fallback while still
// splitting crawl budget.
export async function checkLegacyRedirect({ legacyBase, canonicalHost, fetchImpl = fetch } = {}) {
  const base = (
    legacyBase ??
    process.env.LEGACY_PAGES_BASE_URL ??
    'https://classroom-quick-downloader-website.pages.dev'
  ).replace(/\/+$/, '');
  const canonical = canonicalHost ?? 'classroom-quick-downloader.adhamhaithameid.is-a.dev';

  const response = await fetchImpl(`${base}/`, { redirect: 'manual' });
  if (response.status !== 301) throw new Error(`HTTP ${response.status}, expected 301`);
  const location = response.headers.get('location') ?? '';
  if (!location.includes(canonical)) throw new Error(`redirect target ${location}`);
  return location;
}
