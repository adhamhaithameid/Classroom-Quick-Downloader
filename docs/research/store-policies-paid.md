# Store Policies: Paid Extensions and Pro Features (CWS, AMO, Edge Add-ons)

Researched 2026-09-22. Sources are the stores' own policy pages, current as of that date (individual "last updated" dates noted where the page shows one). Question: what do the three stores permit for paid extensions / paid features, and is "one free extension with entitlement-gated Pro features" or "a separate paid listing" the lower-risk model for CQD?

## 1. Chrome Web Store

### What is allowed

**No store-side payments exist at all.** Chrome Web Store Payments (the old 5%-fee store billing, including the in-app payments API and the licensing check API) was deprecated in 2020: new paid items and in-app items were blocked from March 2020, made permanent on 2020-09-21, and the system was fully shut down in 2021 (announcement: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/sS3W-7QdaX4). There is no "paid listing" type today, no store-processed one-time purchases, and no store-processed subscriptions. Every extension in the store is free to download.

**External monetization is permitted.** A developer may charge for features through their own checkout (Stripe, Paddle, ExtensionPay, gumroad-style license keys, etc.) with subscriptions, one-time purchases, or freemium tiers. The policy constraints are:

- "Accepting Payment From Users" (https://developer.chrome.com/docs/webstore/program-policies/accepting-payment, last updated 2022-11-01): you must securely handle any payment data; "clearly and honestly describe the products or services that you are selling and conspicuously post your terms of sale (including any refund and return policies)"; if paying is required for core features, "you must make that clear in the description that the user sees when choosing whether to install it"; and you must "clearly identify that you, not Google, are the seller." Payments must not be for anything on Google's prohibited-transactions lists.
- "Disclosure Requirements" (https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements): if the product handles user data, it must "prominently disclose what user data will be collected and how it will be used" and obtain affirmative, informed consent before installation.
- "Spam and Abuse" (https://developer.chrome.com/docs/webstore/program-policies/spam-and-abuse): "We don't allow any developer, related developer accounts, or their affiliates to submit multiple extensions that provide duplicate experiences or functionality on the Chrome Web Store." The Spam FAQ (https://developer.chrome.com/docs/webstore/program-policies/spam-faq) adds that repetitive content bars extensions "that provide the same user experience, even if the metadata or code are not identical" — the only allowed near-duplicates are enterprise/white-label or test versions (unlisted, or clearly labeled as beta builds).

**Remote code (MV3)** (https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements, last updated 2024-04-03): all logic must ship in the package; "external resources... must not contain any logic"; no `eval` of remote strings, no remote interpreters. Explicitly still allowed: "syncing user account data with a server," fetching remote configuration/feature flags as long as all logic is local, and server-side data operations. An entitlement/license server call is squarely in the permitted "server-side data operations" and "syncing with a server" categories.

**License validation calls and user-data policy.** The Limited Use policy (https://developer.chrome.com/docs/webstore/program-policies/limited-use) allows data collection that serves "the extension's disclosed single purpose," and "all other transfers, uses, or sale of user data is completely prohibited." Sending a license key / install ID to your own licensing backend is fine **if** (a) it is disclosed in the privacy tab and privacy policy, (b) the data is not repurposed, sold, or shared beyond what is necessary, and (c) CQD's OAuth2 `identity` usage stays within the declared scopes. This is a well-trodden pattern (ExtensionPay and similar services exist for exactly this).

**Listing requirements for paid items** (https://developer.chrome.com/docs/webstore/program-policies/listing-requirements): complete description, icon, screenshots, accurate metadata; combined with the payments policy above, a listing whose Pro features are paywalled must say so plainly in the description, post terms of sale/refunds, and name the seller. Store listing screenshots/description must not suggest the store itself processes payment (it does not).

**2024-2026 changes that matter here:**

- MV3 remote-code policy finalization (2024) — already covered above.
- Spam policy update (2025-05-22) — added the "related developer accounts, or their affiliates" language to the duplicate-extension rule, tightening the screw on second listings.
- Privacy/limited-use tightening announced 2026-07-01 on the Chrome for Developers blog ("Chrome Web Store policy updates: Enhancing user privacy"), with enforcement from 2026-08-01 — stronger disclosure and data-use limits; enforcement against email-tracking-style reuse of user data. License validation is unaffected as long as the data flow is disclosed and single-purpose.
- Chrome Web Store payments were never revived; there is no 2024-2026 development restoring store-side billing.

### Risk notes (CWS)

Low risk for freemium-with-external-checkout; this is the dominant monetization model in the store today. Main hazards: undisclosed paywalled functionality (rejection/removal), vague privacy-tab disclosures covering the licensing call (the 2026 privacy enforcement wave makes this the most likely audit point), and any attempt to run payment/licensing logic as remotely fetched code (MV3 violation — keep all license-parsing logic local; the server only returns a verdict).

## 2. Firefox Add-ons (AMO)

### What is allowed

**AMO itself is permanently free-to-download.** Mozilla's own monetization guide (https://extensionworkshop.com/documentation/publish/make-money-from-browser-extensions/, updated 2025-04-30) states: "Mozilla intends to maintain AMO as a free to download source of browser extensions and themes." To the FAQ "Will I ever be able to sell through AMO?" the answer is effectively no — there is no purchase mechanism and none is planned. External payment links and in-extension upgrade flows are explicitly described as the way to monetize: the same page endorses "charging for features" (freemium, trials, usage limits), DIY license-key systems and services like ExtensionPay, and donations (including an AMO contributions button).

**Disclosure rules** (Add-on Policies, https://extensionworkshop.com/documentation/publish/add-on-policies/, last updated 2026-04-30): "Listings must disclose when payment is required to enable any add-on functionality." Monetization rules ban crypto miners, undisclosed affiliate tag injection ("Modifying web content or facilitating redirects to include affiliate promotion tags is not permitted"), and page-injected ads that don't identify themselves. Add-ons "must use encryption when transporting data remotely."

**`data_collection_permissions: required: ["none"]` compatibility with license validation.** Since 2025-11-03 every *new* AMO submission must declare `browser_specific_settings.gecko.data_collection_permissions` (MDN: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings). The key describes "the optional and required data types that the extension collects and transmits for storage and processing outside the extension." Categories include `authenticationInfo`, `personallyIdentifyingInfo`, `financialAndPaymentInfo`, `technicalAndInteraction` (optional-only), etc. Consequences for CQD:

- `none` is only accurate if the extension transmits **no** data off-device for storage/processing. A license check that sends a license key, account email, Google account ID, or payment-derived identifier to CQD's server is transmitting data — most naturally `authenticationInfo` (credential/token used to prove entitlement) and arguably `financialAndPaymentInfo` if the server holds purchase records keyed to the user. Declaring `none` while phoning home for validation risks rejection in review and is exactly the kind of mismatch Mozilla's 2025-2026 data-consent rollout is hunting.
- Two clean options: (a) keep Pro entitlement validation off the default path in a way that transmits nothing until the user buys/enters a key, and design the call to send only an opaque random install ID plus a signed token (no email, no Google ID) — defensible as near-`none`, though conservative reviewers may still expect a declaration; or (b) when Pro ships, change the declaration to the honest categories and (for Firefox 140+, the built-in consent experience) let users opt in — see "Firefox built-in consent for data collection and transmission" (https://extensionworkshop.com/documentation/develop/data-collection-permissions/). Option (b) is the safe harbor; option (a) is workable but is a judgment call, not a documented exemption.

### Risk notes (AMO)

A "paid listing" is impossible by design — AMO is free-to-download, period. Freemium with disclosed external payments is allowed and documented by Mozilla itself. Risks: undeclared data transmission for license checks (review rejection; Mozilla reviewers do read server calls), undisclosed paywalled features in the listing, and remote-code rules (same as always — no remotely hosted executable code; a JSON entitlement response is fine).

## 3. Microsoft Edge Add-ons

### What is allowed

**The store does not process payments, but paid features are explicitly contemplated.** The developer policies (https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies, ms.date 2026-07-24) contain a whole section on financial transactions:

- 1.8 "If your product includes in-product purchase, subscriptions, virtual currency, billing functionality, or captures financial information; the requirements in the following sections apply."
- 1.8.1 Paid features: "You must use a secure third-party purchase API for purchases of physical goods or services"; you must "clearly and honestly describe the type of products you sell and clearly and honestly post the terms of sale"; in-product offerings must not be convertible to legal currency.
- 1.8.2 Disclosing paid features: "Your extension and associated metadata must clearly provide information about the types of in-product purchases offered and the range of prices," trial scope must be honest, and access restrictions during/after trials must be flagged "in every step of the process."

So: subscriptions and one-time purchases handled through an external processor are allowed, with price-range and trial disclosure in the listing metadata. The store itself has no checkout — all listings are free to download.

**Other relevant rules.** 1.2 Security: "Bulk submissions of extensions with the same functionality and code are not allowed." 1.1.7: obfuscated code is banned (keep license-check code readable — reviewers must see it). 1.5: personal information may be collected/transmitted "only if required by and only for use in a prominently disclosed, user-facing feature," with a privacy policy and secure transport; third-party sharing is restricted to disclosed processors for product improvement/analytics (data brokering is banned outright). 1.3.2: "If your extension requires access to a server, the server must be functional" — the licensing backend must be up during certification.

### Risk notes (Edge)

Low risk for entitlement-gated Pro via external checkout. The distinctive Edge hazards: (1) price-range disclosure in metadata is an explicit written requirement here (weakest enforcement, but in writing); (2) the licensing server must be live and responsive during review; (3) no obfuscation anywhere near the billing path; (4) a second near-identical "Pro" listing collides with the "bulk submissions... same functionality and code" rule.

## 4. One listing vs. two listings

The stores do treat the two models differently, and not in the direction the "separate paid extension" idea assumes:

- **Chrome Web Store:** The spam policy's repetitive-content rule ("duplicate experiences or functionality... even if the metadata or code are not identical") reads directly onto a free listing plus a paid twin of the same product. The Spam FAQ's only sanctioned near-duplicates are unlisted enterprise builds and clearly labeled beta copies. A free/paid pair on one developer account invites a spam takedown, and since the store has no billing, the "paid" twin would still be a free download with a lock — i.e., a duplicate with worse disclosure.
- **Edge:** Same shape — "bulk submissions of extensions with the same functionality and code are not allowed" (1.2), plus 1.1.1's single-purpose rule makes splitting one product into two listings look artificial.
- **AMO:** A separate paid listing is not possible at all (AMO is free-to-download only). A second free listing with everything locked would just be confusing duplication, and Mozilla reviewers are already the most likely of the three to flag redundant listings during human review.
- **Discoverability and reviews:** one listing concentrates ratings, install counts, and update-momentum in one place per store; two listings split them and double the review surface (two privacy disclosures, two certification passes, two licensing-server checkouts during review). "Pro" branding inside a single listing also survives store searches better than a second listing, which stores may rank as duplicate.

**Verdict: one free extension per store with entitlement-gated Pro features is clearly the lower-risk model on all three stores**, and on AMO it is the only possible model. Nothing in any of the three policy sets rewards the second listing, and two of the three have written rules that can be read against it.

## Recommendation

Ship a single free extension per store with Pro unlocked by entitlement (license key / account), purchased through an external processor (e.g., Stripe) with terms of sale and refund policy on the site, and the seller identity stated in the listing. Concretely:

1. Disclose the paywall in every store listing ("Pro features require a paid license; CQD (developer), not the store, is the seller"), and post terms of sale/refunds on the purchase page. Edge metadata should state the price range and trial terms (policy 1.8.2).
2. Keep all license-parsing/feature-gating logic local in the package; the server only returns a signed verdict (MV3 remote-code rule; Edge no-obfuscation rule).
3. Privacy plumbing: disclose the licensing call in the CWS privacy tab and privacy policy as single-purpose (Limited Use); on AMO, when Pro ships, move `data_collection_permissions` from `required: ["none"]` to the honest categories (at minimum `authenticationInfo`; add `financialAndPaymentInfo` if purchase records are user-linked) or design the check to transmit only an opaque install ID — and use Firefox's built-in consent flow (140+). Do not ship Pro while still declaring `none` if any identifier is transmitted.
4. Do not create second "Pro" listings on any store.
5. Keep the licensing backend live and documented in the Edge certification notes (1.3.2), and provide test credentials for the Pro flow to reviewers (Edge 1.3.1).

## Sources

- CWS Developer Program Policies index: https://developer.chrome.com/docs/webstore/program-policies/
- CWS Accepting Payment From Users: https://developer.chrome.com/docs/webstore/program-policies/accepting-payment
- CWS Spam and Abuse: https://developer.chrome.com/docs/webstore/program-policies/spam-and-abuse
- CWS Spam Policy FAQ (repetitive content): https://developer.chrome.com/docs/webstore/program-policies/spam-faq
- CWS Disclosure Requirements: https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements
- CWS Limited Use: https://developer.chrome.com/docs/webstore/program-policies/limited-use
- CWS Listing Requirements: https://developer.chrome.com/docs/webstore/program-policies/listing-requirements
- CWS MV3 requirements (remote code): https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- CWS distribution/visibility docs: https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
- CWS payments deprecation (2020 announcement): https://groups.google.com/a/chromium.org/g/chromium-extensions/c/sS3W-7QdaX4
- CWS privacy policy update announcement (2026-07-01, enforcement 2026-08-01): Chrome for Developers blog, "Chrome Web Store policy updates: Enhancing user privacy"
- Mozilla Add-on Policies (updated 2026-04-30): https://extensionworkshop.com/documentation/publish/add-on-policies/
- Mozilla Add-on Policies FAQ: https://extensionworkshop.com/documentation/publish/add-on-policies-faq/
- Mozilla, Make money from browser extensions: https://extensionworkshop.com/documentation/publish/make-money-from-browser-extensions/
- MDN, browser_specific_settings (data_collection_permissions): https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
- Mozilla blog, updated add-on policies (2025-06-23) and data consent experience (2025-05): https://blog.mozilla.org/addons/
- Edge developer policies (ms.date 2026-07-24): https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies
