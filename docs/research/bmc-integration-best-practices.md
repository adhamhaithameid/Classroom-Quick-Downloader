# Buy Me a Coffee on a Static SvelteKit Site (Cloudflare Pages): Best-Practice Research

Researched 2026-09-24 for the Classroom Quick Downloader (CQD) marketing site (`website/`), a SvelteKit app using `adapter-static` with `prerender = true`, deployed to Cloudflare Pages (`pages_build_output_dir = "build"`). The site is privacy-first and currently ships no third-party scripts; a plain BMC text link already exists in the footer (`website/src/lib/components/SiteFooter.svelte`), and a button prototype exists at `website/prototype-bmc-button.html`.

---

## 1. The three integration approaches

### Option 1: Official embed/widget `<script>` — not recommended for CQD

BMC's official generator (creator dashboard, Tools → Widget/button generator; also linked from the [official brand page](https://buymeacoffee.com/brand) as "Buttons & Widget for Your Website") emits a snippet of this shape:

```html
<script data-name="BMC-Widget" data-cfasync="false"
  src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js"
  data-id="yourusername"
  data-description="Support me on Buy me a coffee!"
  data-message=""
  data-color="#FFDD00"
  data-position="Right"
  data-x_margin="18" data-y_margin="18"></script>
```

This is the canonical floating-tab widget (multiple independent reproductions of the generator output agree on this snippet, e.g. the [Gatsby guide by eshlox](https://eshlox.net/2019/11/04/add-buy-me-a-coffee-widget-to-a-gatsbyjs-site.en/) and [eight-bites](https://eight-bites.blog/en/2021/07/add-buy-me-coffee-widget-gatsby/); the lowendspirit community also [confirmed](https://lowendspirit.com/discussion/7481/is-this-code-safe-to-run) that `widget.prod.min.js` / `button.prod.min.js` on `cdnjs.buymeacoffee.com` is the official origin). The `data-cfasync="false"` flag exists specifically so Cloudflare Rocket Loader won't defer it.

Why it conflicts with CQD's goals:

- **Third-party JavaScript on every page.** The script injects a floating iframe and pulls additional resources from BMC's CDN. On a site that prides itself on zero third-party scripts, this breaks the promise and adds consent-banner surface (GDPR/ePrivacy) for no functional gain.
- **Performance and CLS.** A script that renders fixed-position UI after load risks layout shift and main-thread work; a prerendered static `<a>` + image has none.
- **Not needed.** The widget exists so creators can drop support UI into sites they don't control the markup of (WordPress, etc.). CQD owns its markup and can use a plain link.

### Option 2: Official image + `<a href>` link — recommended

The official generator also emits a plain HTML button: an `<a>` pointing at `https://www.buymeacoffee.com/<username>` wrapping an `<img>` of the official button art, nominally sized around 217x60 px with `alt="Buy Me A Coffee"` (reproduced widely, e.g. the [ron.sh GitHub README guide](https://ron.sh/add-a-buy-me-a-coffee-button-to-your-readme/)). The art itself is served from BMC's CDN at:

- `https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png` — verified by direct HTTP fetch on 2026-09-24: `HTTP/2 200`, `content-type: image/png`, **4,431 bytes**, intrinsic size **545x153 px**, `cache-control: max-age=31536000`, `access-control-allow-origin: *`.
- BMC also runs a customizable official button endpoint used by its [official WordPress plugin](https://wordpress.org/plugins/buymeacoffee/): `https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&slug=<user>&button_colour=FFDD00&...` — verified to return `image/svg+xml` with `cache-control: max-age=31536000`.

For a privacy-first static site the best move is to **download the official art once and self-host it in `/static`**, then use a plain anchor. You get: zero third-party requests, no consent-banner implications, one small same-origin asset that Cloudflare Pages serves alongside everything else, and HTML present at build time (guaranteed to show in production — no JS required, nothing can be blocked by an extension or a BMC CDN hiccup). This is exactly the direction the existing prototype took (`prototype-assets/bmc-button.svg`, official art as vector).

One nuance: the prototype's SVG weighs **36.8 KB** — over 8x the 4.4 KB official PNG. For a button displayed at ~40 px tall, the **PNG is the lighter choice** unless the vector is optimized. Either works; PNG is verified small.

### Option 3: Inline SVG recreation — discouraged

Recreating the button as inline SVG (hand-rolled paths, CSS text instead of the Cookie-cursive wordmark) violates the spirit of BMC's brand program. BMC distributes official logo/button assets precisely so creators don't improvise the mark ([brand page](https://buymeacoffee.com/brand): "Download" under Logo and Graphics). Risks: brand drift (wrong yellow, wrong typeface, stretched pill), no single source of truth when BMC updates the art, and inline SVG bloats every prerendered HTML page (payload duplicated per page) instead of being one cacheable file. If you want vector, use BMC's official vector from the brand kit as a static file — as the prototype does — rather than a recreation.

**Verdict: Option 2, with self-hosted official art.**

---

## 2. Link attributes: `rel`, `target`, and SEO

- **`target="_blank"` is a UX choice, not a requirement.** Donation pages opening in a new tab keeps the visitor on your tool page; it's the convention BMC snippets use. The existing CQD footer link already does `target="_blank" rel="noopener noreferrer"`.
- **`rel="noopener noreferrer"`** (or at minimum `noopener`) is good practice with `target="_blank"`. Modern browsers imply `noopener` for `target="_blank"`, but keeping it is harmless and covers older engines; `noreferrer` additionally strips the `Referer` header — a small privacy bonus consistent with CQD's posture ([MDN: rel=noopener](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener)).
- **`nofollow` / `sponsored`:** [Google's outbound-link guidance](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links) says `rel="sponsored"` is for **ads and paid placements** (someone paid you or you paid someone), and `rel="nofollow"` is the fallback for links you don't want to endorse or have crawled. A link to *your own* BMC page is neither an ad nor a paid placement — you are not being paid by BMC to place it — so `sponsored` is not required and slightly mislabels the relationship. Adding `nofollow` is harmless and is the common convention for outbound monetization links; it only affects link-equity flow to buymeacoffee.com, which you don't need to influence. Practical recommendation: `rel="noopener noreferrer nofollow"`. Reserve `sponsored` for actual affiliate/sponsored placements elsewhere.
- **Reliability/SEO of the button itself:** because the site is fully prerendered, the anchor and image are in the served HTML — no hydration, no "why doesn't it show in production" class of bugs. Search engines see a normal outbound link; it neither helps nor hurts rankings. The only SEO-relevant mistake to avoid is making the support link client-JS-rendered (CQD isn't doing that).

---

## 3. Accessibility

- **The image is meaningful, not decorative:** it *is* the link text. Give it honest alt text. BMC's official snippet uses `alt="Buy Me A Coffee"`; for WCAG 2.4.4 (Link Purpose in Context) and 1.1.1 (Non-text Content), a more self-explanatory accessible name is better on a standalone marketing page: set `aria-label` on the anchor, e.g. `aria-label="Support Classroom Quick Downloader — buy the developer a coffee on Buy Me a Coffee"` (an `aria-label` on the `<a>` overrides the inner `alt` as the link's accessible name). Keep `alt="Buy me a coffee"` on the `img` as a fallback.
- **Don't duplicate:** if the anchor has an `aria-label`, decorative arrows/emoji inside it should be `aria-hidden="true"` (the footer already does this with `↗`).
- **Focus visibility:** the prototype already styles `:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }` — keep it. Do not remove outlines on the yellow button against light backgrounds (contrast of yellow-on-white is poor; the outline carries the focus indication).
- **Contrast caveat:** the yellow pill with dark text is BMC's official art, so it's exempt from the usual "style it darker" temptation — but any *text label* you add next to it (e.g. "Support the project") must meet 4.5:1 contrast; the prototype's small uppercase label at opacity 0.4 is borderline for small text and worth checking.
- **Hover-only reveal:** the navbar panels reveal on `:hover`/`:focus-within`-style CSS; ensure the BMC placement inside those panels is reachable by keyboard (focus within the tab wrapper triggers the panel), or also mirror the button in the always-visible footer.

---

## 4. Image format, size, loading, and CLS

- **Format:** PNG (4.4 KB) from BMC's CDN, or the official SVG from the brand kit (36.8 KB unoptimized). PNG wins on raw size for a button; SVG wins only if optimized. Either is fine; don't convert to WebP — keep the official asset bytes intact.
- **Intrinsic vs display size:** the art is 545x153 intrinsic (aspect ratio 3.563:1). The generator's nominal display size is ~217x60; the prototype displays it at 40 px tall (~142 px wide). Both are legitimate; **never stretch or crop** (see brand rules below).
- **CLS prevention — required:** always set explicit `width` and `height` attributes matching the display size (or intrinsic, and size via CSS), so the browser reserves space before the image loads. This is the single most common BMC-integration bug: `<img class="bmc" src="/bmc-button.png" alt="Buy me a coffee" width="217" height="60">` with CSS overriding to the final size. Aspect-ratio reservation matters even more inside the hover panels, where shift would move neighboring menu items.
- **Lazy loading:** use `loading="lazy"` + `decoding="async"` only for below-the-fold placements (footer, deep sections). Do **not** lazy-load a button inside the header/hero — `loading="lazy"` can delay it on slow connections, and if it's near the LCP element you gain nothing from deferral (the whole file is ~4 KB anyway). For the CQD prototype placements (inside hover panels, under the GitHub card), lazy is fine since the panels are interaction-gated; the image will have loaded by first hover in practice.
- **No preloading needed:** at 4 KB, `rel="preload"` would be over-engineering; avoid adding it.

---

## 5. Placement conventions that convert (indie / free-tool sites)

BMC itself frames its brand page around promotion: ["Over 13 million web pages link to a Buy Me a Coffee page"](https://buymeacoffee.com/brand) — the ecosystem norm for free tools is:

1. **Where value is confirmed, not before it.** For a downloader tool, that's after the install/download CTA and inside product/overview panels — which is exactly what the prototype does (under the green tile in all 4 navbar hover panels, and under the GitHub mirror card). This "beside the primary CTA, visually quieter" pattern is the standard indie convention (BMC's own WordPress plugin defaults to a widget in the site's sidebar/footer rather than replacing the main CTA).
2. **Footer presence** — CQD already has the text link; keeping both a plain text link (footer) and the official art button (panels) is consistent and low-risk. Never ship two competing button visuals.
3. **A support/credits line on high-traffic pages** (e.g. overview, install) as a one-line "If this saved you time, [buy me a coffee]" — phrasing the ask around the outcome, which is the classic conversion framing for free tools.
4. **Avoid:** interstitials/popups for donations, moving the button on scroll (that's what BMC's widget does and why it's divisive), and placing the yellow button adjacent to your green primary CTA without spacing — the prototype correctly nests it *under* the tile rather than beside it.

These are community conventions, not BMC-published rules; BMC's published surface (brand page + generator) doesn't mandate placement.

---

## 6. Brand-guideline constraints

BMC's [brand page](https://buymeacoffee.com/brand) is the official source ("Logo and Graphics → Download" links to the official asset pack; "Buttons & Widget" generates embed code). The page itself doesn't spell out a rules list, so the binding conventions from the official assets and generator are:

- **Official colors:** BMC yellow `#FFDD00` and ink `#0D0C22` (visible in the official art itself; the prototype's `--bmc-yellow: #ffdd00` matches). Don't recolor the button art to match CQD's green — the yellow *is* the recognition signal.
- **Don't modify the mark:** use the official art as-is (no stretching — respect the 3.563:1 ratio; no new fonts, no redrawn cup, no outline/shadow baked into the image; effects like the prototype's hover glow are CSS around the intact image, which is fine).
- **Official phrasing:** BMC's own default description string is **"Support me on Buy me a coffee!"** (from the generator's `data-description`). Keep your accessible name/label phrasing consistent with that family ("Buy me a coffee", "Support me on Buy Me a Coffee") rather than inventing phrasing that implies BMC endorsement or partnership.
- **Minimum size:** BMC publishes no numeric minimum; the practical floor is legibility of the Cookie-cursive wordmark — roughly 100-120 px wide / ~30 px tall. The generator's 217x60 and the prototype's 142x40 are both comfortably above it.

---

## 7. Cloudflare Pages specifics

- **Static asset caching: nothing special needed.** Verified against [Cloudflare's Pages serving docs](https://developers.cloudflare.com/pages/configuration/serving-pages/): Pages sends `Cache-Control: public, max-age=0, must-revalidate` plus an `ETag` for assets, and browsers revalidate with `304 Not Modified` — i.e. correct-by-default for a small button image, and the CDN edge caches each asset per data center until your next deployment (gzip/brotli included). If you later want long-lived browser caching for images, a `static/_headers` file can override defaults — optional, not required. (CQD currently ships no `_headers`.)
- **No build step touches `/static`.** The build is plain `vite build` (`website/package.json`), adapter-static copies `static/` verbatim into `build/` (`website/svelte.config.js`), and no image-optimization or file-munging script exists in the pipeline. Any PNG/SVG dropped in `website/static/` is byte-identical in production. Confirmed: nothing in `package.json` or `vite.config.ts` processes `static/`.
- **Base-path safety:** `svelte.config.js` supports `PUBLIC_BASE_PATH`; reference the asset through SvelteKit's base-aware mechanisms (`import { base } from '$app/paths'` in the component, or an asset import) so the button doesn't 404 if the site is ever served under a sub-path.
- **Reliability:** because everything is prerendered and self-hosted, the button shows in production unconditionally — no dependence on `cdnjs.buymeacoffee.com`, no Rocket Loader interactions, no extension can classify it as a third-party tracker (some ad-blockers kill BMC's floating widget script; a plain link/image is never blocked).

---

## Sources

- [Buy Me a Coffee — Brand, Buttons and Widget (official brand page)](https://buymeacoffee.com/brand)
- [Buy Me a Coffee Help Center](https://help.buymeacoffee.com) (collections: [One-Time Supports](https://help.buymeacoffee.com/en/collections/11027066-one-time-supports), [Integrations](https://help.buymeacoffee.com/en/collections/4079507-integrations))
- Official button art (direct HTTP verification): `https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png` (200, PNG, 545x153, 4,431 B, `max-age=31536000`)
- Official button-API endpoint (direct HTTP verification): `https://img.buymeacoffee.com/button-api/` (SVG, `max-age=31536000`)
- [Official BMC WordPress plugin](https://wordpress.org/plugins/buymeacoffee/) (button/widget flow, customization history)
- Widget script snippet corroborations: [eshlox Gatsby guide](https://eshlox.net/2019/11/04/add-buy-me-a-coffee-widget-to-a-gatsbyjs-site.en/), [eight-bites](https://eight-bites.blog/en/2021/07/add-buy-me-coffee-widget-gatsby/), [lowendspirit verification thread](https://lowendspirit.com/discussion/7481/is-this-code-safe-to-run)
- [Google Search Central — Qualify outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links)
- [MDN — rel=noopener](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener)
- [WCAG 2.2 — Link Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html), [Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html)
- [Cloudflare Pages — Serving Pages / caching defaults](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- Repo facts: `website/svelte.config.js`, `website/wrangler.toml`, `website/package.json`, `website/src/lib/components/SiteFooter.svelte`, `website/prototype-bmc-button.html`, `website/prototype-assets/bmc-button.svg`

---

## Recommended implementation for CQD

- [ ] **Use Option 2: plain `<a>` + self-hosted official art.** No `cdnjs.buymeacoffee.com` script, no iframes, no third-party requests.
- [ ] **Asset:** download `https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png` (4,431 B, 545x153) into `website/static/` (e.g. `static/images/bmc-button.png`); use it unmodified — prefer it over the 36.8 KB prototype SVG unless the SVG is optimized.
- [ ] **Markup** (per placement):
  ```svelte
  <a class="bmc" href="https://www.buymeacoffee.com/adhamhaithameid"
     target="_blank" rel="noopener noreferrer nofollow"
     aria-label="Support Classroom Quick Downloader — buy the developer a coffee on Buy Me a Coffee">
    <img src="{base}/images/bmc-button.png" alt="Buy me a coffee" width="217" height="60" loading="lazy" decoding="async">
  </a>
  ```
- [ ] **Keep explicit `width`/`height`** (display size, 3.563:1 ratio, never stretched) on every instance — this is the CLS guard. Adjust the two attributes together if the rendered height is 40 px (width ≈ 142).
- [ ] **`loading="lazy"` + `decoding="async"`** for panel/footer placements only; switch to eager (drop `loading="lazy"`) if any placement ends up above the fold or next to the LCP element.
- [ ] **Placements:** the five prototype spots (under the green tile in the 4 navbar hover panels + under the GitHub mirror card), keep the existing footer text link, and optionally one "If this saved you time…" support line on the overview/install pages. Keyboard-focusable panels + visible `:focus-visible` outline.
- [ ] **Brand rules:** official art only, colors `#FFDD00`/`#0D0C22`, no recoloring/stretching/baked-in effects (CSS hover glow around the intact image is fine); phrasing stays in the "Support me on Buy me a coffee" family.
- [ ] **rel policy:** `noopener noreferrer nofollow` on BMC links; save `sponsored` for genuine paid placements only.
- [ ] **Cloudflare Pages:** no action needed — default ETag/revalidate caching is fine for the image; the build pipeline (`vite build` + adapter-static) copies `static/` untouched; verify the button renders from the prerendered HTML in `build/` after deploy.
- [ ] **Validation:** `pnpm --filter website build`, confirm the image lands in `build/images/`, check CLS in Lighthouse/PageSpeed for a placement page, and tab through the navbar panels to confirm focus + button visibility.
