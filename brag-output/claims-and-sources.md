# Product evidence and editorial decisions

Inspected local working tree on 2026-09-21. It contains substantial pre-existing uncommitted work. This launch task did not edit production code. This is an implementation-informed illustrative demonstration, not a recording of a network download or a benchmark.

| Claim | Evidence | Use |
|---|---|---|
| Download one attachment or all attachments in a post | README; content/download-handler.ts; src/download-all/button-controller.ts and refresh.ts | Central story. Scope always a post, never the entire Classroom account. |
| Blue action and green success state | content/styles.ts; content/button-state.ts; content/icons.ts; README usage screenshots | CSS and icon assets extracted directly. Completion green deepened to #008522 for video readability. Source UI scaled for the frame. |
| Chrome, Firefox, Edge | README official store links; extension/package.json browser builds; wxt.config.ts | Named browsers only. No Safari or universal compatibility claim. |
| Local activity stats and settings | popup/App.tsx reads local_stats and browser storage; extension enable/disable and settings controls | Share copy. Not fabricated as a video dashboard. |
| Anonymous operational telemetry | analytics/types.ts: status, type, browser, OS, version, duration, bypass, error, language, timestamp; PRIVACY.md | Trust scene. No claim of zero telemetry or no network use. |
| No file contents in telemetry | AnalyticsEvent schema lacks file content; README/PRIVACY describe operational metrics | Precisely scoped to telemetry. Does not imply the downloader never processes bytes. |
| Free extension | Website SoftwareApplication Offer price 0; README personal-use licensing | CTA. Avoid “free forever” warranty. |
| Source available | README license section | Technical share copy. Never call it open source. |
| Independent of Google | Live site disclosure; user brief | Persistent film footer and publishing copy. |
| React, TypeScript, WXT | extension/package.json, wxt.config.ts and popup source | Technical share copy. No technology parade in the short film. |
| Version 1.8.0 in local checkout | extension/package.json, README Ops Status | Report only. Live site response showed 1.5.5; film omits version. |

## Architecture understanding
Content scripts detect downloadable attachments and inject controls. Actions send messages to the background download handler, which starts browser downloads and manages confirmation, authentication, retry and outcome handling. Native controls transition through idle, loading, trying, success, cancelled or error states. Popup React UI reads local activity statistics and settings from browser storage. Operational events are queued and sent to a Cloudflare Worker. The current Worker documentation describes an Oracle-free live data path, with Durable Objects and D1 archive storage; older diagrams and PRIVACY.md still describe Oracle. Infrastructure claims are omitted from public launch copy.

## Explicit exclusions
- “Fastest”, guaranteed time savings, fixed download duration, zero failures, fabricated user numbers or testimonials.
- Whole-course/whole-account export and API-beta capabilities. Current work is in progress; not a stable launch promise.
- Edited/comment flags as a reliability promise: popup labels flag detection experimental.
- No tracking/no data/entirely offline: website navigation copy conflicts with documented telemetry.
- “Never handles OAuth tokens”: API beta and identity configuration make that absolute unsafe.
- Manifest V3 across all browsers: Firefox build documentation includes MV2.
- Every browser, every language and every operating system without qualification.

## Public pages inspected
- https://classroom-quick-downloader.adhamhaithameid.is-a.dev/
- https://github.com/heygen-com/hyperframes/blob/main/docs/guides/skills.mdx

## Publishing notes
Reconcile the site's “We collect nothing / No download analytics” navigation copy with its operational-metrics language before directing a large launch audience there. This is a documented inconsistency, not a source edit in this task. Resolve live version metadata separately. Use the installation URL in every post accompanying the film, since the end card says “Install links in the post.”
