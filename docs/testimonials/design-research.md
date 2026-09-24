# Review / Testimonial Card Design Research

Research for the marketing-site testimonials section (light glassmorphism, Plus Jakarta
Sans, accent #1a8b55, audience: teachers and students). Data to render: the 11 collected
store reviews in `docs/testimonials/data/reviews.json`.

Method: primary sources fetched 2026-09-19 — store pages and their screenshots in this
folder, Google's Chrome Web Store help, Trustpilot's developer API docs and business
TrustBox page, W3C ARIA APG + WCAG 2.2, shadcn/ui docs, Embla autoplay source, and
live marketing pages (Linear, Clerk, Mintlify, Notion). Items I could not fetch are
marked **unverified**. Nothing below is invented.

---

## 1. Card anatomy (element inventory, ranked by universality)

Ranked by how consistently the element appears across every platform and pattern studied.

| Rank | Element | Everywhere? | Notes from sources |
|---|---|---|---|
| 1 | Review text / quote | Near-universal | Every source shows it; AMO reviews may have empty bodies (rating-only rows). AMO truncates with a "Read more" link (verified on live page + screenshot). |
| 2 | Star rating | Near-universal | AMO prints stars as a heading above the byline; Chrome puts stars inline right after the name; Product Hunt adds per-dimension ratings (Ease of use, Reliability, Value for money, Customization). |
| 3 | Reviewer name | Near-universal | Can be anonymized by the platform: AMO shows "Firefox user 10920788" (live page). Edge offers no public profile at all (reviews.json note). |
| 4 | Date | Near-universal | Two formats, both real: absolute "Sep 7, 2026" (Chrome card, screenshot) vs relative "2 months ago" / "5mo ago" (AMO live page, Product Hunt). |
| 5 | Avatar | Common, not universal | Chrome: 32–40px circle, Google photo or colored initial circle (screenshot). Edge: generic person-icon circle, no photos (screenshot). AMO: no avatar rendered in list (live page + screenshot). |
| 6 | Attribution role/company (SaaS pattern) | Common in SaaS quotes | "Guillermo Rauch, CEO, Vercel" (Clerk homepage); Linear links name+company to /customers/<co>. Stores use role-less names. |
| 7 | Source link / store identity | Common in marketing use | Stores don't need it; marketing sites add it. Trustpilot exposes `source: "Organic"` in its review object (developers.trustpilot.com). |
| 8 | Verified badge | Platform-dependent | Trustpilot: `isVerified` boolean + `reviewVerificationLevel: "invited"` (API docs); help article "Why are some reviews marked 'Verified'?". Chrome Web Store: **no** verification signal — "Google doesn't verify the authenticity of reviews and ratings" (support.google.com). Not present on AMO or Edge cards (screenshots). |
| 9 | Helpful votes | Rare in stores | Chrome card: "Was this helpful?" + thumbs up/down icons (screenshot). Product Hunt: "Helpful / Share / Report" action row + view count. Trustpilot API has `numberOfLikes`. AMO list: none. |
| 10 | Location | Rare | Edge shows country next to date: "Feb 16, 2026 · Egypt" (screenshot). Trustpilot API has `consumer.displayLocation`. |
| 11 | Developer reply | Store-only | AMO: "Reply to this review" + "Flag" links under each review (screenshot); Trustpilot API has a `companyReply` object. |

## 2. Store-native row anatomy (verified from this repo's screenshots + live fetches)

These are the three ground truths the cards will represent. Keep column order faithful
when a card claims to be "from the store".

- **Chrome Web Store** (screenshot `screenshots/chrome/00-all-reviews-full.png`):
  rounded light-gray card row; left circular avatar; bold name, then stars, then
  absolute date on the same line ("Ashraful Islam ★★★★★ Sep 7, 2026"); body below;
  "Was this helpful?" + thumb icons under the body; kebab menu far right. Section
  header: big "4.8 out of 5" + stars + "25 ratings"; outlined Filter / Sort ("Recent")
  / Language ("English") dropdowns above the list.
- **Edge Add-ons** (screenshot `screenshots/edge/01-mohamed.png`): minimal — generic
  avatar circle, bold name + stars on line 1, "Feb 16, 2026 · Egypt" on line 2, body
  below. No helpful votes, no permalink.
- **Firefox AMO** (screenshot `screenshots/firefox/00-all-reviews-full.png` + live
  fetch of the uBlock Origin reviews page): left aggregate panel (big stars, "4 Stars
  out of 5", 5→1 histogram with counts); rows are "★★★★★ by Mtrsov, 3 months ago",
  body, optional "Read more", "Reply to this review", "Flag". Relative dates,
  hyperlinked to per-review permalinks; anonymized handles; no avatars in the list.

## 3. Named card patterns

### P1. Platform-native row ("it looks like the store")
```
┌────────────────────────────────────────────────────┐
│ (avatar) Name  ★★★★★  Sep 7, 2026             ⋮   │
│          "Just Works. ONE CLICK, YAY!"             │
│          Was this helpful?  👍 👎                   │
└────────────────────────────────────────────────────┘
 [Chrome: Web Store]  [Chrome: Web Store]  …
```
- Used by: Chrome Web Store review list (verified above). AMO is the same idea with
  relative dates and no avatars.
- Strengths: maximum authenticity — reviewers can see it matches the real listing;
  zero novelty cost; date+stars+name scannable in one line.
- Risks: reads as a data table, not marketing; helpful-vote row is dead weight on a
  marketing site; kebab menu is meaningless off-store.
- Best for: a "real reviews from the stores" section where trust > polish, with a
  link back to the store listing per card.

### P2. Quote-first editorial (SaaS carousel)
```
        “Linear is excellent, just excellent.”
        Gabriel Peal — Staff Software Engineer, OpenAI →
```
- Used by: Linear homepage (one-liner quotes, attribution links to /customers/openai,
  slides duplicated in a carousel track — fetched); Clerk homepage (8 quotes, strict
  "Name, Role, Company" attribution, 1–3 sentences — fetched).
- Strengths: the quote is the hero; works with tiny real quotes like "thanks broo."
  because shortness is the point; fast to scan.
- Risks: needs short source quotes; without stars/store link it stops looking like a
  review and starts looking like an ad claim.
- Best for: rotating highlight of 3–5 punchy store quotes near the CTA.

### P3. Boxed structured review (Product-Hunt-style)
```
┌──────────────────────────────────────────────┐
│ (avatar) Name · ExtensionName · ·6 reviews   │
│ ★★★★★                              5mo ago   │
│ WHAT'S GREAT                                 │
│   body…                                      │
│ Helpful  Share  Report                       │
└──────────────────────────────────────────────┘
```
- Used by: Product Hunt founder reviews (verified fetch: name link, company tag,
  "•6 reviews" count badge, "What's great / What needs improvement" sections,
  dimension ratings, "Helpful/Share/Report", relative "5mo ago", view counts).
- Strengths: reviewer credibility signals (review count) and structured body handle
  longer student/teacher stories without looking like a wall of text.
- Risks: heaviest card; the "count badge" would be fabricated for our reviewers, so
  drop it; overkill for 1-line quotes.
- Best for: a "wall of love" masonry where 2–3 longer stories anchor shorter cards.

### P4. Glass premium (site-native glassmorphism)
```
╭───────────────────────────────────────╮
│ ★★★★★          (frosted blur card)   │
│ “Easy to use, Fast, Efficient and     │
│  free.”                               │
│ (photo avatar) Muhammad Ukasha        │
│ ⌈Chrome Web Store⌉ chip · Jun 2026    │
╰───────────────────────────────────────╯
```
- Used by: no studied product ships glass testimonial cards (Linear/Clerk/Mintlify
  quote styling not visually confirmable from fetched markup — **unverified**);
  structure is shadcn `Card` + `Avatar` composition, which is exactly how shadcn
  expects testimonials to be built since there is no Testimonial component in the
  registry (component index fetched).
- Strengths: only pattern that matches this site's light-glass design language; the
  store chip doubles as the source link; stars-first ordering matches CWS scanning.
- Risks: blur + borders can hurt contrast of small meta text; blur layers are a
  performance cost if animated; keep 4.5:1 text contrast over the blur.
- Best for: the main testimonial section on this site.

### P5. Minimal borderless quote (Notion customers style)
```
   “There's power in a single platform where
    you can do all your work.”
   — Nick Erdenberger, GTM (OpenAI)
```
- Used by: Notion's customers page — modular grid mixing image cards, stat cards
  ("5–10× the number of questions asked daily") and borderless quote cards with
  name/title/company, paginated (fetched).
- Strengths: quiet; pairs perfectly with stat tiles (users, ratings) in a mixed grid;
  no card chrome to fight the glass background.
- Risks: needs generous whitespace; individual cards lack a link target unless the
  attribution is the link.
- Best for: mixing quotes with "4.8 / 25 ratings" stat tiles in one grid.

### P6. Aggregate header + review rows (store listing pattern)
```
 ★★★★☆ 4.0 out of 5        ▂▂▂ 5: 3
 4 ratings                  ▁▁▁ 1: 1
 ─────────────────────────────────────
 ★★★★★ by Omar, 8 months ago
 Best extension ever. Please download !!!
```
- Used by: AMO (histogram + rows, screenshot); Chrome ("4.8 out of 5", "25 ratings",
  filter/sort dropdowns, screenshot); TrustBox widgets highlight "TrustScore, review
  volume, or word rating" (business.trustpilot.com/trustboxes, fetched).
- Strengths: leads with the number skeptical teachers want; honest about the 1-star
  reviews (the dataset keeps them).
- Risks: with only 25 ratings the histogram looks thin — consider aggregate + stars
  only; aggregates differ per store (4.8 vs 5.0 vs 4.0) and need per-store chips.
- Best for: a trust strip above the cards: per-store rating + link to the listing.

## 4. Carousel UX checklist

Numbers below are verified defaults or requirements; anything else is labeled.

- Base it on shadcn/ui `Carousel` (built on Embla — fetched docs): multi-slide via
  `basis-1/3`, responsive `md:basis-1/2 lg:basis-1/3`, gap via `pl-4` on items +
  `-ml-4` on the track, `opts={{ align: "start", loop: true }}`. This is the standard
  peek implementation: `align: "start"` + slide widths < 100% leaves the next card
  visible. Concrete peek guidance beyond this: **unverified** (Tailwind Plus
  testimonial section pages were unreachable — 404/bot-blocked).
- Autoplay default: Embla Autoplay `delay: 4000` ms, `playOnInit: true`,
  `stopOnInteraction: true`, `stopOnFocusIn: true`, `stopOnMouseEnter: false`
  (quoted from `embla-carousel-autoplay` source, unpkg). Recommended settings for
  this site: `stopOnMouseEnter: true`, delay 5–8s for reading-paced cards
  (recommendation, not a cited standard; NN/g's "5 seconds" dwell figure could not
  be fetched — **unverified**).
- If autoplay runs, W3C APG requires (fetched): a visible stop/start control whose
  label says the action ("Stop slide rotation"); rotation stops on keyboard focus and
  does not restart unless the user asks; rotation stops on mouse hover; `aria-live`
  off on the slide wrapper while auto-rotating. Mintlify ships exactly this: a
  "Pause testimonials" control on its marquee (fetched).
- Structure (APG): container `role="region"` + `aria-roledescription="carousel"`;
  slides `role="group"` + `aria-roledescription="slide"`, labeled "3 of 10"; visible
  labels must not contain the word "carousel".
- Controls: side arrows or header arrows both exist in the wild (Linear rotates a
  quote track; AMO/CWS use scroll lists, not carousels — **unverified** which is
  "better"); whatever you pick: native `<button>`, arrows must not move focus (APG),
  and must meet WCAG 2.5.8: target ≥ 24×24 CSS px (spacing exception allows 24px
  circles not intersecting other targets). 44–48px is the comfortable range
  (Apple HIG / Material figures not fetchable this session — **unverified**).
- Dots vs progress: APG offers tabs (tabbed style) or button-group pickers; grouped
  dots are "the least friendly for keyboard users" (each dot = a tab stop) — prefer
  arrows + optional dots with `aria-disabled` on the current one.
- Reduced motion / no-JS: a static grid of all 11 cards (2 rows) with scroll-snap is
  the safe fallback; none of the fetched sources require motion, and autoplay is
  optional per APG ("In some implementations, rotation automatically starts…" —
  optional by phrasing).

## 5. Typography notes for review cards

- Quote vs meta contrast: the studied quote-first sites keep quotes short (1–3
  sentences — Clerk, fetched; one-liners — Linear, fetched) so the quote itself
  carries hierarchy; size the quote up (e.g. text-lg/xl in Plus Jakarta Sans) and
  drop everything else to small. Exact type ramps on those sites are not published —
  **unverified**.
- Truncation: AMO truncates long bodies with a visible "Read more" expander
  (screenshot + live page). For fixed-height cards, clamp bodies at 3–4 lines
  (CSS `line-clamp`; Tailwind's `line-clamp-3` is the common route — convention,
  **unverified** as a "standard") and rely on the store permalink for the full text.
- Name/date de-emphasis: Chrome renders name bold but date in small gray on the same
  line (screenshot); AMO renders "by Name, 3 months ago" as small linked gray text
  (live page). Follow that: name `text-sm font-semibold`, date/source `text-xs`
  muted, never both bold.
- Dates: pick one format per section, not per store — absolute "Jun 15, 2026"
  (Chrome style) reads better on a marketing page than AMO's relative "8 months ago"
  (relative dates also go stale; the dataset notes AMO months are approximations).
- Stars: render as compact star glyphs adjacent to the name (Chrome order: name →
  stars → date, screenshot), not as a big standalone block, except in an aggregate
  header (P6). Keep star glyphs in the accent green #1a8b55 only if contrast on the
  glass surface is ≥ 4.5:1 for accompanying text; star glyphs themselves are
  decorative and need 3:1 (WCAG 1.4.11, general requirement — criterion number
  cited from WCAG 2.2 scope; **not separately fetched**).
- Avoid: review titles (stores here have none — `title: null` in reviews.json),
  fake "helpful" counts, and fake verified badges; Chrome Web Store explicitly does
  not verify reviews (support.google.com quote above), so a "verified" chip would be
  fabricated. The honest equivalent chip is the store name + link (Edge reviewer
  names/avatars can't be verified off-store at all — reviews.json note).

## 6. Sources actually fetched

- W3C ARIA APG Carousel: https://www.w3.org/WAI/ARIA/apg/patterns/carousel/
- WCAG 2.2 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- AMO reviews (live, uBlock Origin): https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/reviews/
- Store cards: screenshots in docs/testimonials/screenshots/{chrome,edge,firefox}/ (local captures of
  https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid/reviews,
  https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn,
  https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/reviews/)
- Chrome Web Store ratings policy: https://support.google.com/chrome_webstore/answer/12225786
- Trustpilot review object (fields incl. isVerified, reviewVerificationLevel, numberOfLikes, consumer.displayLocation): https://developers.trustpilot.com/business-units-api
- Trustpilot TrustBoxes: https://business.trustpilot.com/trustboxes ; "Verified" label: https://help.trustpilot.com (article "Why are some reviews marked 'Verified'?" — title via search snippet)
- Product Hunt founder reviews (Linear): https://www.producthunt.com/products/linear/reviews
- Linear homepage testimonials: https://linear.app/ ; Clerk: https://clerk.com/ ; Mintlify ("Pause testimonials"): https://mintlify.com/ ; Notion customers grid: https://www.notion.com/customers
- shadcn/ui component index (no Testimonial component): https://ui.shadcn.com/docs/components ; Carousel docs (Embla, basis-1/3): https://ui.shadcn.com/docs/components/carousel
- Embla Autoplay defaults (source): https://unpkg.com/embla-carousel-autoplay@8.6.0/esm/embla-carousel-autoplay.esm.js
- Round 2 (famous-site sections, 2026-09-19, raw HTML via curl): https://vercel.com/customers ; https://www.hubspot.com/customer-reviews (fetched via /testimonials canonical redirect) ; https://slack.com/ + https://slack.com/customer-stories ; https://www.intercom.com/customers ; https://webflow.com/customers ; https://www.framer.com/customers/ ; https://www.atlassian.com/customers ; https://github.com/customers ; https://www.shopify.com/case-studies ; https://basecamp.com/ ; https://dribbble.com/testimonials ; https://zapier.com/customer-stories (index only) ; https://stripe.com/customers (client-rendered, structure unverified)
- Round 2 galleries: https://saaslandingpage.com/ (reachable; directory index only, per-category pages not fetched) ; https://mobbin.com/ (homepage reachable; full gallery login-walled)
- Round 2 blocked/unreachable: canva.com (403 bot wall), land-book.com (403), lapa.ninja (403), airtable.com/customers (404), calendly.com/customer-stories (wildcard-resolves to a personal booking-page stub, not a stories page). Fetched but JS-rendered with no quote/story markup in HTML (structure **unverified**): squarespace.com home, zoom.com customer stories, asana.com/customers, monday.com home, dropbox.com home (no testimonial section found).
- Blocked (marked unverified above): G2 reviews page and Capterra (HTTP 403 / bot wall), Trustpilot consumer review page (bot wall), Tailwind Plus testimonial gallery (404), Material Design 3 and Apple HIG pages (JS-rendered), NN/g carousel article (404 on fetch).

---

## 7. Round 2: famous-site testimonial sections

Raw-HTML fetches, 2026-09-19. Question: how do marquee brands design the whole
testimonial/story section — and do any of them put star ratings on quotes?
Only what was verifiable in the fetched markup is stated; everything else is marked unverified.

| Site (page) | Section pattern | Stars? | Controls | One distinctive detail |
|---|---|---|---|---|
| Vercel (/customers) | 1 featured quote card + 12 story cards | No | "Read story" links | Story headlines are metrics: "cut time to prototype 75%", "350 million daily active users" |
| HubSpot (/customer-reviews) | Awards + scale strip, not a quote wall | Award badges only | — | "#2 Best Global Software Company on G2", "#1 on TrustRadius", Capterra Shortlists, "238,000 businesses" |
| Slack (home) | Single inline quote between feature blocks + customer-video swiper | No | Swiper prev/next + pagination, autoplay hint in markup | Quote slotted mid-page ("Kate Jenson, Head of Americas, Anthropic"), not its own section |
| Intercom (/customers) | Mixed wall-of-love card grid (markup: `grid-cols-1 md:2 xl:3`) | No | None visible | Attributes quotes to "G2 Reviewer, Mid-Market (51–1000 emp.)", @handles, and stat-quotes ("86.7% … self-serve") |
| Webflow (/customers) | Story index + size/industry filter forms | No | Filter forms | "Trusted by more than 300,000 … organizations" scale line above the grid |
| Framer (/customers) | Story cards: metric headline + short quote + "Read story" | No | "Next/Previous", "Slideshow pagination controls" (aria-labels) | Double metrics: "conversions by 35%", "built their site with 0 developers" |
| Atlassian (/customers) | Full-width quote blocks (3 in markup) near the top | No | "Read customer story" links | Quotes carry hard numbers ("tooling spend is down 54% annually"); C-level attributions (Mercedes-Benz, Cisco, Domino's) |
| GitHub (/customers) | Single-quote carousel, 4 slides | No | aria-labels "View previous/next testimonial"; numbered "1 / 4" counter | Numbered counter instead of dots; "Role @ Company" attribution (Uber, Redfin, Veritas, Costco) |
| Shopify (/case-studies) | Metric-led story cards with category tags | No | — | Card summaries are before/after metrics ("site visitors up 88% … AOV €1,250 → €1,650") |
| Basecamp (home) | Founder letter + customer video + static Q&A quote list | No | None (static) | One shared question — "What changed for the better since you switched to Basecamp?" — with short named answers (Name, Company) |
| Dribbble (/testimonials) | Static "wall of love" card grid | No | None (static) | Heading literally "Our wall of love"; white cards, 1px border, 23px radius, soft shadow, 15px/26px quote, small round avatar + name only (no roles) |
| Stripe, Zapier, Squarespace, Zoom, Asana, monday.com, Dropbox, Calendly | Client-rendered or stub — no quote markup in fetched HTML | — | — | **unverified**; see Round 2 blocked/unreachable note in sources |

**Steal-worthy, ranked (each tied to a fetched page):**

1. **"Rated X on Y" trust strip** (HubSpot) — ratings live in a dedicated strip of
   third-party badges above the content, not on cards. Ours: per-store aggregate
   chips ("4.8 on Chrome Web Store · 5.0 on Firefox Add-ons") linking to each listing —
   exactly pattern P6, now validated by a marquee brand.
2. **Metric-first story headlines** (Vercel, Framer, Shopify) — every card's second
   line is a number, not praise. Ours: pair each quote with a real stat (25 ratings,
   4.8 avg, "1-click"), or keep quotes pure when there's no metric.
3. **Borrowed-authority attribution** (Intercom's "G2 Reviewer, Mid-Market") — when the
   reviewer has no title, name the platform instead. Ours: "Chrome Web Store review",
   "Firefox Add-ons review" chips do this per card; honest because it's true.
4. **Numbered carousel counter + "View previous/next testimonial" labels** (GitHub) —
   a "1 / 4" counter and verb-first aria-labels beat dots for clarity and a11y; matches
   the APG rules in section 4.
5. **Unified question wall** (Basecamp) — one question ("What changed for the better…?")
   with short answers makes even 1-line reviews feel intentional. Ours: "What do
   teachers say after installing?" groups the tiny store quotes ("thanks broo.") neatly.
6. **Static wall-of-love grid, avatar + name only** (Dribbble) — no carousel, no motion,
   no roles needed; matches our data (store reviewers have no job titles) and the
   reduced-motion/static fallback from section 4.
7. **Single inline quote between feature blocks** (Slack home) — a lone rotating quote
   near the CTA works without a full section; cheap to add above the download button.

**Do famous sites use star ratings in testimonial sections?** No — 0 of the 11 sections
verified above render per-quote stars. Ratings appear only as third-party award badges
on a dedicated page (HubSpot's G2/TrustRadius/Capterra strip) or as text authority
(Intercom's "G2 Reviewer"). Quote sections are deliberately star-free; proof is carried
by names, titles, metrics, and story links instead. Our cards DO have real per-review
store stars — that is store-native honesty (round 1), and on a marketing page it is a
differentiator, not a deviation: keep stars small and per-card in Chrome order
(name → stars → date), and keep section-level aggregates in a HubSpot-style strip
(P6) rather than blowing stars up as decoration.
