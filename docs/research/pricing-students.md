# Pricing Research — CQD Pro for a Student Audience

**Date:** 2026-09-22 · **Bead:** `Classroom-Quick-Downloader-0h4d.5` · **Scope:** what pricing model and price points maximize revenue without pricing out students. Current (2025–2026) comparables, freemium extension conversion norms, one-time vs subscription trade-offs for a solo developer, and student pricing psychology. Feeds bead `0h4d.2.4` (pricing page) and the positioning decision in `0h4d.2.5`.

---

## 1. Recommendation (TL;DR)

**Model: freemium with a one-time "CQD Pro" license.** No monthly subscription. Optional cheap annual tier as a secondary choice, not the headline.

| Item | Recommendation |
|---|---|
| Primary model | **One-time license**, per person, unlocks Pro on all browsers |
| Standard price | **$9.99** (charm-prixed; global baseline, already student-priced) |
| Launch / early-bird price | **$7.99** for the first weeks — rewards early users, creates urgency, seeds reviews |
| Optional supporter tier | Pay-what-you-want above base (e.g., $14.99 "Supporter" badge) — proven pattern from Dark Reader |
| Optional annual tier (secondary) | **$4.99/yr** ("one coffee a year") for people who prefer subscriptions — same features, not gated |
| Refund policy | **30 days, no questions asked** (the norm; real refund rates run ~5–7%) |
| Checkout | Merchant-of-record (Paddle or Lemon Squeezy) or ExtensionPay — handles global VAT, which matters for a worldwide student base |
| Regional pricing | Yes — localized/PPP pricing for lower-income countries |
| Acceptable range if owner wants to test differently | **$7.99–$14.99 one-time**; do not exceed ~$19.99 for this audience; avoid monthly-only pricing |

Rationale in one line: CQD Pro is a **utility** (organization, archive, sync), not an ongoing service with real marginal server costs, and utility extensions sold one-time both convert better and dodge subscription fatigue — while a sub-$10 one-time sits below every student's mental "is this worth it?" threshold.

---

## 2. Comparables (2025–2026 prices)

### Student productivity tools

| Tool | Model | Price | Notes |
|---|---|---|---|
| Todoist Pro | Subscription | **$7/mo or $60/yr** ($5/mo billed yearly, ~30% off = "≈3.5 months free") | Raised annual from $4→$5/mo in Dec 2025; no formal student discount |
| Quizlet Plus | Subscription | **$35.99/yr** (~$2.99/mo) or $7.99/mo; $44.99/yr for Unlimited tier | 15% student discount via UNiDAYS; 7-day trial |
| Notion | Freemium | **Free education plan** for students (Plus features free) | The aggressive end: free for verified students |
| Anki (iOS) | One-time | **$24.99** | Free everywhere except iOS; the classic "pay once for the study utility" precedent |
| Dark Reader (Safari/Apple) | One-time | **$4.99–$9.99** | Open-source utility that charges once on Apple platforms; pays-with-a-tip model on desktop browsers |
| Noir / Darker (Safari) | One-time | ~$5 | Same category; all thrive at sub-$10 one-time |
| Hulu student / DoorDash student | Subscription | $1.99/mo / $4.99/mo | Anchor what students are *accustomed* to paying: $2–5/mo, heavily discounted |

Pattern: student-priced productivity tools cluster at **$3–5/mo or $30–60/yr** when subscription, and **$5–25 one-time** when utility. Nothing successful charges students $10+/mo for a single-purpose tool.

### Browser extensions with paid tiers

Utility extensions (the closest category to CQD) overwhelmingly sell **one-time with a license key** — per Dodo Payments' 2026 roundup it is "the most common model for utility extensions: pay once, receive a key, unlock forever." One-time converts better for extensions because it needs no account system, avoids subscription fatigue, and fits tools with no marginal cost (extpower.dev, crxbase.com). AI-wrapped extensions (MaxAI, Eightify, etc.) do run $5–15/mo subscriptions — but they sell ongoing API costs, which CQD does not have.

**Lifetime/one-time pricing rule of thumb:** price at **3–4x a hypothetical annual price** (chromegoldmine.com), or 6–24x monthly depending on how essential the tool is (elitecontentmarketer.com). Sanity check against our recommendation: $9.99 one-time ≈ 2 years of a $4.99/yr plan ≈ cheap side of the norm — intentional, because the audience is students.

---

## 3. Conversion-rate norms (free → paid)

- **Freemium SaaS overall:** ~**2–5%** free-to-paid is the widely cited benchmark; median closer to 2–4% (OpenView / ProfitWell-era figures, echoed by Schematic, KissMetrics, Crazy Egg).
- **Browser extensions:** typically **1–2%**, sometimes lower — installs are low-intent compared to sign-up products (no account was created, so there is no identity to upsell). This is the most important discount versus generic SaaS advice.
- **WordPress/plugin ecosystem (closest distribution analog):** Freemius' Vova Feldman has long cited ~**1–2%** of free users converting, with well-executed checkouts doing better.
- **Free trials:** opt-in trials convert ~3–5% to paid; credit-card-required trials higher but from a smaller pool. A 7–14-day Pro trial is a stronger lever than a permanently free tier alone.
- **Refund reality:** one public teardown (TanStack Ship) saw ~6.4% refunds on a 30-day policy; abuse is rare. Budget 5–8%.

**Planning number for CQD: 0.5% (low) / 1.2% (mid) / 2.5% (high)** of *active* installs becoming Pro — the low band respects extension reality and the fact that most CQD installs skew young/price-sensitive/global; the high band assumes the Pro paywall lands at a genuine "aha" moment (first ZIP archive, first Course Sync hit).

> Measurement caveat that matters for the formula below: convert off **active installs** (what the Worker dashboard scrapes per-browser), not cumulative store installs, which inflate the denominator and make conversion look 3–10x worse than it is.

---

## 4. One-time vs subscription for a solo dev

| Factor | One-time | Subscription |
|---|---|---|
| Conversion | Higher (no recurring commitment; students are sub-fatigued) | Lower, but each sale compounds |
| Revenue shape | Spike at launch, then tied to new-install flow | Compounds if retention beats churn |
| Infrastructure | License key + entitlement check (already planned: `0h2.2`/`0h2.3`) | Same, plus billing-cycle states, dunning, failed-payment churn |
| Support expectations | Indefinite goodwill; lifetime buyers can be *more* demanding than subscribers (Dodo Payments, Freemius) | Support justified while subscribed; churn self-selects |
| Refund norms | 30-day no-questions is standard; ~5–7% actual | Same window, but "cancel anytime" is the alternative to refunds |
| Regional pricing | Works, but doesn't compound (Indie Hackers) | Compounds year over year in low-ARPU markets |
| Failure mode | Underpriced forever if the product grows | Churn + card-declines silently eat 5–15%/yr |

**Why one-time wins here:** CQD's Pro features (folders, templates, ZIP+manifest, multi-select, duplicate detection) are compute-once, client-side. Only **Course Sync** has an ongoing flavor — and as planned it is client-driven detection against Classroom, not a server-side service, so marginal cost stays ~zero. The honest one-time trap is support-in-perpetuity; mitigations: (a) price at ~2–3 years of expected support value (hence $9.99, not $4.99), or (b) the common hybrid — *"includes 1 year of updates, works forever"* — which caps the obligation honestly and creates a natural annual upsell for people who want updates. Decide that at implementation; either is compatible with the price points above.

If the owner prefers recurring revenue anyway, the research-backed shape is **annual-only** (never monthly for students): $4.99/yr, framed as 2–3 months free versus a hypothetical monthly, with Todoist's ~30% annual discount as the precedent. Expected LTV per converted student over a degree-length horizon (~2 years active use) is similar to the one-time price; the difference is operational burden.

---

## 5. Pricing psychology for students

- **"Less than a coffee" framing works, but pick the coffee carefully.** The tactic is reference-price anchoring: small denominations reduce payment pain (HBS framing-effect research; Decision Lab). $9.99 once ≈ "two coffees, once, ever" — while $3.99/mo reads as a *recurring* coffee, which students (Hulu $1.99, Spotify-style tiers) have been trained to treat as a real commitment. One-time lets CQD borrow the framing without the commitment backlash.
- **Charm pricing:** $9.99, not $10. Standard, cheap to implement, measurable in checkout A/B later.
- **Annual = 2–3 months free:** the universal framing for annual-vs-monthly (Todoist's ~30% off is exactly this). Applies to the secondary annual tier and to the "1 year of updates" variant.
- **Three-option menu:** even with one-time as the hero, show three options — **$7.99–9.99 one-time (hero) / $4.99 per year / $14.99 supporter** — the middle-anchoring effect reliably nudges buyers toward the hero option and gives generous users an outlet (Dark Reader's pay-what-you-want above a $4.99 base is direct evidence this works for beloved utilities).
- **The low price IS the student discount.** Verification (SheerID/UNiDAYS) costs integration effort and ~5% fees; at a $9.99 base the residual value of a 50% student coupon ($5) is small, while PPP/localized pricing for low-income countries (auto-handled by Paddle/Lemon Squeezy) captures the global-audience need more fairly. Skip formal student verification for v1; revisit if the base price ever rises above ~$15.

---

## 6. Payment rails (matters for a global, price-sensitive base)

- **Merchant-of-record (Paddle ~5% + $0.50, Lemon Squeezy ~5% + $0.50):** they become the seller of record and handle **worldwide VAT/sales tax** — near-mandatory for a solo dev selling to students in 100+ countries. Costs ~2 points more than raw Stripe; buys off an entire compliance problem.
- **ExtensionPay** (Stripe-based, extension-native): least code, built for exactly this (one-time + sub tiers, cross-browser license sync); Stripe is 2.9% + $0.30 underneath but you own VAT compliance.
- **Freemius:** 3.5% + $0.30, also MoR-style, aimed at WordPress but used beyond it.
- Either way, keep the Buy-Me-a-Coffee link as the zero-friction tip path it already is (popup already links it).

---

## 7. The profitability formula

Apply these with real numbers from the Worker dashboard (`/admin` store stats + telemetry). All variables:

```
ActiveInstalls  = sum of per-browser active users (CWS + AMO + Edge add-ons)
conv%           = share of ActiveInstalls that buy Pro   (plan: 0.5% / 1.2% / 2.5%)
P               = average realized price                 ($7.99 launch / $9.99 standard; blend ~$9.50)
platformMix     = per-browser share — informational only; one license covers all browsers,
                  so it does NOT multiply revenue (it matters only if prices differ per store)
refundRate  r   ≈ 5–8%
feeRate     f   ≈ 7–10% (MoR fee + currency + failed payments; use 8% planning)

Gross revenue   ≈ ActiveInstalls × conv% × P
Net revenue     ≈ Gross × (1 − r − f)                    (use (1 − 0.06 − 0.08) ≈ 0.86)
Annualized (one-time): Net × (newActiveInstalls / ActiveInstalls)  — one-time revenue re-accrues
                  only as the active base grows; budget for that, don't extrapolate launch month
```

**Worked example — 10,000 active installs, $9.99 list (~$9.50 realized):**

| Scenario | conv% | Sales | Gross | Net (~86%) |
|---|---|---|---|---|
| Low | 0.5% | 50 | ~$475 | ~$410 |
| Mid | 1.2% | 120 | ~$1,140 | ~$980 |
| High | 2.5% | 250 | ~$2,375 | ~$2,040 |

Scale linearly: at 50,000 active installs the same table reads ~$2,050 / ~$4,900 / ~$10,200 net. **Break-even intuition:** at mid conversion, every 10,000 active installs ≈ one month of modest server + tooling costs — meaning the economics work if (and only if) the free product keeps growing the active base, which is exactly why the roadmap gates Pro work behind the free reliability gate.

**If the secondary annual tier is used:** LTV per converted user ≈ P × expected active years (students ~2y: graduation churns them) ≈ $9–10 — i.e., the same as the one-time price with more bookkeeping. That symmetry is the strongest argument for keeping one-time as the hero.

**Honest failure modes to watch post-launch:** (1) conversion under 0.5% → the paywall moment is wrong or the price reads high; test trial-first before cutting price; (2) refunds above 8% → feature promise mismatch (usually Course Sync expectations); (3) one-time revenue decaying faster than the install base grows → consider the "1 year of updates" hybrid.

---

## 8. Sources

- [Dodo Payments — How to Monetize a Chrome Extension in 2026](https://dodopayments.com) (license-key one-time as the standard for utility extensions; lifetime-buyer support burden)
- [crxbase — Subscription vs Lifetime pricing compared](https://crxbase.com) (Stripe/Paddle fees, refund & churn factors)
- [extpower — One-time vs subscription for Chrome extensions](https://extpower.dev) (conversion + infra arguments)
- [chromegoldmine — Chrome extension lifetime deals](https://chromegoldmine.com) (3–4x annual pricing rule; AppSumo/PitchGround channels)
- [Elite Content Marketer — lifetime AI software deals 2026](https://www.elitecontentmarketer.com) (6–24x monthly lifetime multiples)
- [Indie Hackers — subscriptions vs one-time](https://www.indiehackers.com) (regional pricing compounds on subs)
- [Todoist — Pro subscription pricing](https://www.todoist.com) ($7/mo, $60/yr, ~30% annual discount)
- Quizlet upgrade page (quizlet.com): $35.99/$44.99 annual tiers, UNiDAYS student discount
- [Dark Reader for Safari](https://darkreader.org/safari) ($4.99–9.99 one-time; pay-what-you-want precedent)
- [Freemius — lifetime deal structure guide](https://freemius.com) and [freemium strategy guide](https://freemius.com); [DominoPress — Freemius fees](https://dominopress.com) (3.5% + $0.30)
- [Delicious Brains — Freemius review](https://deliciousbrains.com) (checkout-driven conversion lift)
- [TanStack Ship teardown](https://tanstackship.com) (~6.4% real refund rate on 30-day policy); [PayPro Global — refund windows](https://payproglobal.com)
- [The Decision Lab — Pricing Psychology](https://thedecisionlab.com); HBS "The Framing Effect of Price Format" (2006) (reference-price / small-denomination framing)
- [ExtensionPay](https://extensionpay.com) (extension-native payments, one-time + subscription)
- General freemium benchmarks (2–5%; extensions 1–2%; trial 3–5%/8% median): OpenView/ProfitWell-era figures as echoed by Schematic, KissMetrics, Crazy Egg, Userpilot, Appcues summaries found via 2026 searches

*Numbers for CQD scenarios are planning assumptions, not measurements — replace with dashboard data per the formula in §7.*
