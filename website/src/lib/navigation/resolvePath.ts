import { resolve } from '$app/paths';

/**
 * kit 3 typed `resolve` overloads only accept literal route ids and
 * prerendered pathname literals; content and menu hrefs are arbitrary site
 * paths known at runtime. The runtime `resolve` still resolves any pathname
 * (it prefixes the base), so this helper narrows the type at one place
 * instead of scattering casts.
 */
export function resolvePath(pathname: string): string {
  return (resolve as unknown as (p: string) => string)(pathname);
}
