# Monetization Provider Research: Selling CQD Pro Licenses

**Ticket:** Classroom-Quick-Downloader-0h4d.4
**Date:** 2026-09-22
**Question:** Which provider should sell and validate CQD Pro licenses across Chrome, Firefox, and Edge?

## Context

CQD is a solo-developer, privacy-first browser extension (Chrome Web Store, Firefox AMO, Edge Add-ons) with a free core and a future Pro tier (organization/archive/sync). Buyers are mostly students, i.e., international and price-sensitive. Two constraints dominate every choice below:

1. **Merchant of record (MoR).** As a solo dev we cannot register for and file VAT/GST in the EU, UK, Australia, and elsewhere. Whoever we pick must legally be the seller of record and remit global sales tax on our behalf — or we take on that liability ourselves.
2. **License validation in MV3.** Any option can work technically: the extension's service worker calls an HTTPS endpoint, caches the result in `chrome.storage.local`, and honors a grace period (14–30 days) when offline or when the provider is unreachable. What varies is who issues keys, what the validation API looks like, and what happens if the provider disappears.

## Pricing Table (fees as of September 2026)

| Provider | Fee per transaction | Merchant of record (global tax) | License keys + validation API | Monthly fee |
|---|---|---|---|---|
| **ExtensionPay** | 5% + Stripe's underlying processing (~2.9% + 30¢), so roughly 7.9% + 30¢ all-in | **No** — "You are responsible for paying taxes for any sales" | No keys. Email-based paid-status login via ExtPay.js, checked server-side | None |
| **Gumroad** | 10% + 50¢ direct (30% if the sale comes via Gumroad Discover) | **Yes** — worldwide tax collection/remittance since Jan 1, 2025 | Yes — license keys per sale, verify API (`api.gumroad.com/v2/licenses/verify`) | None |
| **Lemon Squeezy** | 5% + 50¢ | **Yes** — collects, calculates, and files global VAT/sales tax at no extra cost | Yes — native license API: activate / validate / deactivate with per-key instance (device) limits | None |
| **Paddle** | 5% + 50¢ | **Yes** — the most mature MoR: tax filing, fraud, chargeback defense, dunning, buyer support | **No native keys in Paddle Billing** — you listen for `transaction.completed` webhooks and issue keys yourself (or via Keygen/Cryptlex/etc.) | None |
| **Stripe + self-hosted** | 2.9% + 30¢ US cards; international cards up to ~4.4% + 30¢ (+1.5% cross-border, +1% FX); Stripe Tax adds 0.5% for *calculation only* | **No — you are the MoR.** Stripe Tax calculates and documents, but registration and filing are yours | Fully custom (build issuance + validation on the existing Worker) | None (Stripe Tax usage-based) |

## Comparison

### ExtensionPay (extensionpay.com)

- **Fees:** 5% at time of charge, no monthly fee. Because funds are paid directly into your own Stripe account, Stripe's processing fees (~2.9% + 30¢) also apply, making the effective take roughly **7.9% + 30¢** — the second most expensive option.
- **MoR:** **No.** Their own site states you are responsible for sales taxes; Stripe merely gives you tax data. This alone disqualifies it as the primary choice for a global student audience.
- **Licensing:** No license keys at all — an email-based "paid status" login (fitting, in a way, for our no-accounts stance, but it is still an account of sorts). Validation goes through their servers via the open-source ExtPay.js library. No documented offline/caching story; you'd add your own cache-and-grace layer.
- **Checkout UX:** Purpose-built for extensions: overlay/upgrade page, one-time and recurring plans, free trials, discount codes, 135+ currencies, test mode, supports Chrome/Firefox/Edge/Opera/Brave. The best "extension-native" developer experience of the five.
- **Risk:** Small independent vendor; the extension ecosystem depends on one company's uptime and policies. Mitigating factor: customer and payment data live in *your* Stripe account and are exportable. Their own docs admit client-side check code can be stripped by hackers and recommend not over-investing in prevention.

### Gumroad

- **Fees:** **10% + 50¢** on direct sales — by far the highest. 30% if the buyer arrives via Gumroad's Discover marketplace. No monthly fee.
- **MoR:** Yes, worldwide since January 2025 — the fee partly buys real tax compliance.
- **Licensing:** Issues license keys per sale and has a straightforward verify API supporting an incremental use counter (usable for device caps). The API is older and works, but there is no activation/instance model comparable to Lemon Squeezy's.
- **Checkout UX:** A generic creator-product checkout with a marketplace feel. Works, but reads as "buying an ebook," not "upgrading my extension," and drives buyers through Gumroad's brand and post-purchase funnels.
- **Risk:** Gumroad has pivoted repeatedly (fee restructures, marketplace push, social-seller positioning). Fee direction has been upward (it was a flat 10% before, now 10% + 50¢). For a $15 license, Gumroad costs ~2.2x what Lemon Squeezy or Paddle would.

### Lemon Squeezy

- **Fees:** **5% + 50¢**, no monthly fee. On a $15 sale: $1.25.
- **MoR:** Yes — they take on tax liability, collect and remit globally at no extra cost, and handle fraud and invoices.
- **Licensing:** The strongest native license system of any MoR provider: keys issued per sale, activate/validate/deactivate endpoints, per-key **instance limits** (a natural fit for "one key, multiple browsers"), signed license responses, and webhooks for our Worker.
- **Checkout UX:** Minimal, fast overlay or hosted checkout, PayPal plus up to ~20 payment methods, localized currency display. Good for students: no account creation required, just email + payment.
- **Risk:** **The main caveat.** Acquired by Stripe in 2024; Stripe is building its own MoR product ("Stripe Managed Payments," private preview summer 2025) priced at **6.4% + 30¢** — pricier than Lemon Squeezy itself. As of early 2026 Lemon Squeezy still accepts new signups and has announced no shutdown date, but a forced migration in the medium term is plausible. Mitigation: our validation flow should sit behind our own Worker so a provider swap is a config change, not a client update.

### Paddle

- **Fees:** **5% + 50¢** per checkout, no monthly fee, all-inclusive (tax, fraud, dunning, buyer support). Paddle notes products **under $10** or invoicing needs require custom pricing — potential friction if CQD Pro lands at $9.99.
- **MoR:** Yes, and the most battle-tested: global tax filing with deadline tracking, chargeback defense, 24/7 buyer-facing payment support (they field the "my card was charged" emails).
- **Licensing:** **Paddle Billing does not generate license keys.** Paddle Classic did; Billing is event-driven — you catch `transaction.completed` webhooks and issue keys yourself (our Worker could do this, storing keys in D1/KV). Workable, but it means building and securing an issuance pipeline before launch.
- **Checkout UX:** Localized, professional checkout; heavier and more "commerce" than Lemon Squeezy's overlay, but trustworthy and tax-inclusive pricing is handled cleanly.
- **Risk:** Seller onboarding requires approval (business verification, a real product site with pricing/terms/privacy), which can take days to weeks and occasionally rejects small hobby sellers. Once approved, Paddle is arguably the most durable, lowest-policy-risk MoR for indie software — they have done this for a decade.

### Stripe + self-hosted license keys on the existing Worker

- **Fees:** Cheapest processing: 2.9% + 30¢ US cards; international cards push toward 4.4% + 30¢ with cross-border and FX add-ons. Stripe Tax (+0.5%) calculates and documents tax but **does not file it for you**.
- **MoR:** **No.** This is the catch. Selling to students worldwide means you personally become the seller of record for EU VAT, UK VAT, Australian GST, etc. Stripe Tax removes the arithmetic, not the registrations, filings, and liability. That is a real legal exposure for a solo dev.
- **Licensing:** Fully custom — but we already own the ideal substrate: a Cloudflare Worker with D1/KV. Issuing signed license keys on checkout webhooks, validating with a KV-cached lookup, and revoking on refund is a weekend of work and zero third-party dependency.
- **Checkout UX:** Stripe Checkout/Payment Link is clean, and email-only (no account) fits our privacy stance perfectly.
- **Risk:** Lowest platform risk (Stripe is not going anywhere; keys live in our infrastructure) but the tax/compliance risk transfers entirely to us. Disputes are handled through Stripe's standard flow (we respond to chargebacks ourselves).

## Browser-store rules that apply to any choice

- **Chrome Web Store:** Google shut down its own payment system (2020–2021). There is no store payment requirement or preferred provider; external payment processing is the standard model. A one-time $5 developer fee applies to publishing, and monetization must follow the "Responsible Marketing and Monetization" policy (accurate marketing, transparent pricing, never collecting payment data inside the listing).
- **Firefox AMO:** Paid add-ons cannot be sold *on* AMO, but free add-ons with paid upgrades via external processing are allowed and common; the upgrade path must be clearly disclosed in the listing.
- **Edge Add-ons:** Same practical model — external payments, clear disclosure.

Bottom line: **all five options are store-compatible**; no store mandates or forbids any of them.

## Recommendation

**Primary: Lemon Squeezy.** It is the only provider that combines all four things CQD actually needs at the same price as the alternative: true merchant-of-record status (solves the solo-dev global tax problem outright), a native license-key API with per-key instance limits (fits one key across Chrome/Firefox/Edge without building an issuance pipeline), a lightweight overlay checkout that students can complete without creating an account, and a 5% + 50¢ fee that on a $15 Pro license costs $1.25 — only ~$0.45 more per sale than raw Stripe, which is cheap insurance against personally filing VAT in a dozen countries.

Its real weakness — post-acquisition uncertainty under Stripe — is manageable: keep the extension's license validation pointed at *our* Worker endpoint (which proxies Lemon Squeezy's validate API and caches entitlements in KV), so a future swap to Paddle or Stripe Managed Payments is a Worker config change with no extension update required.

**Runner-up: Paddle.** Choose Paddle instead if the Stripe/Lemon Squeezy situation deteriorates or if CQD Pro evolves toward SaaS-style recurring billing where Paddle's dunning, chargeback defense, and buyer support pay off. Same 5% + 50¢ fee and the most durable MoR operationally — but expect a slower seller-approval process, watch the sub-$10 custom-pricing clause when picking a price point, and budget time to build webhook-driven license issuance on the Worker (Billing has no native license keys).

**Not recommended now, worth revisiting: Stripe self-hosted.** Technically the best fit for our existing Worker and the cheapest per sale, but it makes us the merchant of record. Revisit only if we ever deliberately limit sales geography, or once Stripe Managed Payments' pricing settles enough to act as a middle ground. **ExtensionPay** is the fastest extension-native integration but fails the MoR requirement and is effectively ~8% all-in. **Gumroad** is a working MoR with license keys but at 10% + 50¢ costs more than double the leaders, with a checkout experience that doesn't match a browser-extension product.

## What This Means for CQD

1. **Price point:** Set CQD Pro at **$15** (one-time or annual) — comfortably above Paddle's sub-$10 custom-pricing threshold, plausible for students, and fees stay flat-rate (5% + 50¢ = $1.25/sale; ~$13.75 net before payouts). In the EU the displayed price will be tax-inclusive since Lemon Squeezy remits VAT.
2. **Architecture (keeps the free core free and privacy-first):** Options page "Upgrade" button opens the Lemon Squeezy overlay checkout → `order_created` webhook hits the Worker → Worker stores the license (hashed) in D1 and confirms. The extension never talks to Lemon Squeezy directly; it validates the pasted key against `api.cqd.<domain>/license/validate`, which proxies Lemon Squeezy and caches results. CQD servers store only a license hash + expiry — no PII beyond the purchase email, which Lemon Squeezy holds, not us. This is consistent with the no-accounts positioning: a Pro user is "an email that paid," nothing more.
3. **MV3 offline/grace:** After successful validation, cache the entitlement (key hash, expiry, plan) in `chrome.storage.local` with a 30-day TTL and a 30-day grace window when validation fails due to network — students on flaky dorm Wi-Fi or airplane Wi-Fi must not lose Pro. Never block startup on validation; check lazily in the background service worker.
4. **Cross-browser:** One key activates on Chrome, Firefox, and Edge (Lemon Squeezy instance limits set generously, e.g., 5 devices). No per-store licensing complexity.
5. **Refunds/disputes:** Handle refunds from the Lemon Squeezy dashboard (refunding revokes the license via webhook → Worker marks the key invalid at next validation). Lemon Squeezy fields the payment-related buyer emails and chargebacks as MoR.
6. **Risk mitigations:** (a) proxy all validation through our Worker so the provider is swappable; (b) export the customer/license list quarterly as a local archive; (c) revisit this decision if Stripe Managed Payments reaches general availability with better pricing, or if Lemon Squeezy announces a migration deadline — at that point, Paddle is the designated landing spot.

## Sources

- [ExtensionPay](https://extensionpay.com) — 5% fee, tax responsibility statement, Stripe payouts, feature list
- [Lemon Squeezy Pricing](https://www.lemonsqueezy.com/pricing) — 5% + 50¢, MoR statement, license key management
- [Paddle Pricing](https://www.paddle.com/pricing) — 5% + 50¢, MoR scope, sub-$10 custom pricing note
- [Gumroad Pricing](https://gumroad.com/pricing) — 10% + 50¢ direct / 30% Discover, worldwide tax handling Jan 2025
- [Gumroad License Keys](https://licenses.gumroad.com/) and `api.gumroad.com/v2/licenses/verify`
- [Stripe + Lemon Squeezy / Managed Payments coverage](https://www.lemonsqueezy.com) and [independent signup-status report (Feb 2026)](https://designrevision.com) — LS still accepting signups; Stripe Managed Payments at 6.4% + 30¢
- [Stripe Pricing](https://stripe.com/pricing) — 2.9% + 30¢ US; international/cross-border/FX add-ons
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/) — monetization rules; CWS payments deprecation
- [Mozilla Add-on Policies FAQ](https://extensionworkshop.com/documentation/publish/add-on-policies/) — paid upgrades allowed via external processing
- [Paddle Billing license-key gap (developer account)](https://blog.eternalstorms.at) and [webhook provisioning pattern](https://hookdeck.com)
