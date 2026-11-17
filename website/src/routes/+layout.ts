/**
 * kit 3: `$app/stores` is gone, and +layout.svelte stays in legacy mode on
 * purpose (a full runes conversion of 1300 lines was judged too risky for a
 * migration PR). A universal load reruns on every navigation, so exporting
 * the pathname and the "no route matched" flag here gives the layout reactive
 * data props it can track with legacy `$:` statements.
 *
 * - `pathname`: the live URL path for analytics payloads, menu highlighting,
 *   and the per-route chrome effects.
 * - `isErrorRoute`: `route.id === null` means kit could not match a route —
 *   that is exactly the dynamic-404 case the old `$page.status === 404` check
 *   covered. Matched-route errors (403/500) keep their previous behavior.
 */
export const load = ({ url, route }: import('./$types').LayoutLoadEvent) => {
  return {
    pathname: url.pathname,
    isErrorRoute: route.id === null
  };
};

export const prerender = true;
