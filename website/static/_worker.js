const LEGACY_HOST = 'classroom-quick-downloader-website.pages.dev';
const CANONICAL_HOST = 'classroom-quick-downloader.adhamhaithameid.is-a.dev';
const EMAILS_PATH = '/emails';
const EMAILS2_PATH = '/emails2';

// Inline scripts in app.html and SvelteKit's per-page __sveltekit_* bootstrap
// blocks are build-specific, so a committed static CSP would break on every
// deploy. Instead the worker hashes the inline scripts of each HTML response
// at the edge and emits a strict script-src for exactly those blocks.
const CSP_BASE_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https://lh3.googleusercontent.com",
  "connect-src 'self' https://cqd-analytics.adhamhaithameid.workers.dev https://api.github.com",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  'upgrade-insecure-requests'
];

const INLINE_SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const EXECUTABLE_TYPE_RE = /type\s*=\s*("module"|'module')/i;
const ANY_TYPE_RE = /type\s*=\s*("[^"]*"|'[^']*')/i;

// Per-isolate cache: pathname -> CSP header value. Bounded so a pathological
// path flood cannot grow memory without limit.
const CSP_CACHE_MAX = 512;
const cspCache = new Map();

function isExecutableInlineScript(attrs) {
  if (/\bsrc\s*=/i.test(attrs)) return false;
  if (!ANY_TYPE_RE.test(attrs)) return true; // classic script
  return EXECUTABLE_TYPE_RE.test(attrs); // only type="module" executes
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function sha256Source(body) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return toBase64(new Uint8Array(digest));
}

export async function buildContentSecurityPolicy(html) {
  const sources = new Set();
  for (const match of html.matchAll(INLINE_SCRIPT_RE)) {
    if (!isExecutableInlineScript(match[1])) continue;
    // Hash sources are single-quoted per the CSP grammar — unquoted
    // sha256-… tokens parse as (invalid) host expressions.
    sources.add(`'sha256-${await sha256Source(match[2])}'`);
  }
  return [...CSP_BASE_DIRECTIVES, `script-src 'self' ${[...sources].sort().join(' ')}`].join('; ');
}

const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'x-frame-options': 'DENY'
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

async function withContentSecurityPolicy(request, assetResponse) {
  const contentType = assetResponse.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return withSecurityHeaders(assetResponse);

  const pathname = new URL(request.url).pathname;
  let cspPromise = cspCache.get(pathname);
  if (!cspPromise) {
    cspPromise = buildContentSecurityPolicy(await assetResponse.clone().text());
    cspCache.set(pathname, cspPromise);
    if (cspCache.size > CSP_CACHE_MAX) {
      cspCache.delete(cspCache.keys().next().value);
    }
  }
  let csp;
  try {
    csp = await cspPromise;
  } catch {
    // Hashing failed: serve with base headers rather than breaking the page.
    cspCache.delete(pathname);
    return withSecurityHeaders(assetResponse);
  }

  const headers = new Headers(assetResponse.headers);
  headers.set('content-security-policy', csp);
  const withCsp = new Response(assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers
  });
  return withSecurityHeaders(withCsp);
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

    return withContentSecurityPolicy(request, await env.ASSETS.fetch(request));
  }
};
