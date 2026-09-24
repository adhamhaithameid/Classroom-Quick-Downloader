# Store Testimonials — Collected Data (2026-09-19)

Real user reviews collected from all three extension stores for the planned
website testimonials section. Nothing here is self-written; every entry links
back to its public source.

## Sources

| Store | Rating | Reviews | Link |
|---|---|---|---|
| Chrome Web Store | 4.8 (25 ratings) | 10 written | [reviews page](https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid/reviews) |
| Microsoft Edge Add-ons | 5.0 (2 ratings, 73 users) | 2 written | [addon page](https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn) |
| Firefox Add-ons (AMO) | 4.0 (4 ratings) | 4 written | [reviews page](https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/reviews/) |

## Files

- `data/reviews.json` — master dataset: every review with reviewer, rating,
  date, body, avatar, permalink, and verification note.
- `data/chrome-reviews.json` — raw page-collected Chrome data (with exact
  Google avatar URLs).
- `screenshots/chrome/` — full reviews page + one PNG per 5-star review.
- `screenshots/edge/` — both Edge review cards.
- `screenshots/firefox/` — full reviews section + per-review crops.
- `avatars/chrome/` — downloaded Google profile pictures of Chrome reviewers.

## Authenticity verification (reviews are not from the repo owner, not bots)

- Repo owner / developer: **Adham Haitham Eid** (AMO user 19632882,
  CWS "Offered by"). Any review by this identity is excluded.
- Chrome reviewers are Google accounts with profile pictures; two carry
  university-ID name suffixes (Ahmed 320230045, Ziad 320230025) and wrote
  first-hand usage stories. None match the developer's name.
- Edge reviewer "Adham" **excluded** — name matches the developer and Edge
  offers no public profile to disprove it.
- Firefox reviewers are registered AMO accounts with public profile pages
  (users 19664671 "Omar", 19664678 "rouby", 20012520 "Mtrsov"), none of which
  is the developer's account. AMO profiles show no avatars (common for AMO).
- 1-star reviews (Kelli Holmes / Chrome, anonymous German review / AMO) are
  real feedback; kept in the dataset for honesty, excluded from the showcase
  shortlist.

## Showcase shortlist (11 cards)

8 Chrome 5-star reviews + Edge "Mohamed" + Firefox "Omar" + Firefox "rouby".
`firefox-mtrsov` (5-star, no text) is optional as a rating-only card.

## Known gaps

- Chrome Web Store caps the visible list at 10 written reviews and its
  "Load more" control did not serve additional pages during collection.
  The 15 remaining ratings are rating-only (star math confirms all 5-star).
- Edge shows no reviewer photos; cards should use initials avatars for Edge.
- AMO review dates render as relative ("8 months ago"); absolute months are
  approximations.
