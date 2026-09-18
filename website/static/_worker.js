const LEGACY_HOST = 'classroom-quick-downloader-website.pages.dev';
const CANONICAL_HOST = 'classroom-quick-downloader.adhamhaithameid.is-a.dev';
const EMAILS_PATH = '/emails';
const EMAILS2_PATH = '/emails2';

// No CSP here: the site ships inline scripts in app.html, so a policy would
// need unsafe-inline and add no real protection.
const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
};

// Redirects (301/308) are exempt: browsers do not honor response headers on
// the hop, the destination response carries them instead.
function withSecurityHeaders(response) {
  if (response.status >= 300 && response.status < 400) {
    return response;
  }
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === LEGACY_HOST) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === EMAILS_PATH || url.pathname === `${EMAILS_PATH}/`) {
      url.pathname = EMAILS2_PATH;
      return Response.redirect(url.toString(), 308);
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};
