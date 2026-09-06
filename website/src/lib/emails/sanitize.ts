/**
 * Sanitization for the email preview page (/emails).
 *
 * The page renders third-party-shaped email HTML (styles + body) via {@html}.
 * That is an XSS sink by construction, so everything passes through here
 * first. Kept separate from the route so it is unit-testable.
 */
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize raw CSS intended for a <style> element.
 * CSS never legitimately contains "<", so removing it kills every known
 * breakout vector ("</style><script>...") without a parser dependency.
 */
export function sanitizeEmailCss(css: string): string {
  return typeof css === 'string' ? css.replace(/</g, '') : '';
}

/**
 * Sanitize email body HTML with an allowlist-oriented profile: standard HTML
 * (tables, images, links, inline styling) survives; script/style-injection,
 * event handlers, and javascript: URLs do not.
 */
export function sanitizeEmailBodyHtml(html: string): string {
  if (typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
}
