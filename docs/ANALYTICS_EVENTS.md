# Analytics Event Inventory (Privacy Audit)

Complete inventory of every analytics event CQD collects, audited
2026-09-12. Governing principle:

> CQD measures product interactions, not user content.

No event carries file names, file contents, Classroom course/assignment text,
account identifiers, cookies, tokens, or raw URLs of user content. Payload
fields are allow-listed server-side (`meta` keys ≤ 8, strings ≤ 120 chars),
events are deduped by random `eventId`, and everything is aggregated at the
edge before storage — no raw event store exists.

## Website events (`websiteEvents.ts` → Worker → Oracle)

| Event type | Action | Placement(s) | Payload | Purpose |
| --- | --- | --- | --- | --- |
| `cta` | `install_click` | `nav_install`, `nav_install_firefox`, `nav_install_edge`, `nav_menu_install`, `nav_mobile_install`, `hero_install`, `footer_download` | browser/extension version via snapshot, placement | Which install entry points convert |
| `cta` | `guide_cta_click` | `guide_primary`, `guide_secondary` | `pagePath` (guide path) | Do guide pages drive install intent |
| `cta` | `download_click` | `final_download` | placement | Footer download clicks |
| `map` | `map_yes` / `map_no` | `map_prompt_yes`, `map_prompt_no`, `map_prompt_install` | placement | Globe opt-in interaction |
| `content` | `faq_expand` | `faq_item` | `meta.question`, `meta.section` (both are **site's own FAQ text**, not user input), `pagePath` | Which questions users actually open → content strategy |
| `content` | `guide_engaged` | `guide_scroll` | `meta.percent` (75), `pagePath` | Guide depth-of-read, once per page |

Request envelope: `schemaVersion`, random `sessionId` (per-browser random
UUID, not linked to any account), `pagePath`, `tsUtc`. Flushed in batches of
≤24 via `sendBeacon`/fetch every 15s or on page hide.

## Extension events (`recordDownloadEvent` → Worker `/track`)

| Field | Values | Notes |
| --- | --- | --- |
| `type` | file extension bucket (e.g. `pdf`, `unknown`) | never the file name |
| `status` | `success` / `fail` / `cancel` | |
| `duration_ms` | integer | timing only |
| `bypass_used` | boolean | Drive interstitial handling used |
| `error_type` | e.g. `BROWSER_START_FAIL`, `AUTH_ALL_FAILED`, `ACCESS_DENIED_FIREFOX` | coarse category |
| country | derived from request edge metadata, immediately aggregated | no raw IP stored |

## Retention & aggregation

- Edge aggregation in Cloudflare Workers → pre-aggregated counters only;
  raw events are discarded after aggregation.
- Aggregate counters retained for lifetime stats (documented in `PRIVACY.md`
  and the website privacy page).
- Rate-limiting state is ephemeral.

## Verdict

No user-identifying data in any event. The `faq_expand` metadata is the
site's own published FAQ text (which question was opened), not user content.
No changes required to the privacy model; the website privacy page wording
was updated to name aggregate interaction counts explicitly.
