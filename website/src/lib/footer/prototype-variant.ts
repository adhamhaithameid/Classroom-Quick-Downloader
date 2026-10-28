/**
 * Footer prototype variants (bead w403). The layout renders the real
 * SiteFooter for every variant; the variant only decides the reveal
 * machinery around it. Pure so the guard test can pin the route mapping.
 */
export type FooterVariant = 'reveal' | 'static' | 'curtain';

export const PROTOTYPE_STATIC_PATH = '/prototype-footer-a';
export const PROTOTYPE_CURTAIN_PATH = '/prototype-footer-b';

export function resolveFooterVariant(pathname: string): FooterVariant {
  if (pathname === PROTOTYPE_STATIC_PATH || pathname.startsWith(`${PROTOTYPE_STATIC_PATH}/`)) {
    return 'static';
  }
  if (pathname === PROTOTYPE_CURTAIN_PATH || pathname.startsWith(`${PROTOTYPE_CURTAIN_PATH}/`)) {
    return 'curtain';
  }
  return 'reveal';
}
