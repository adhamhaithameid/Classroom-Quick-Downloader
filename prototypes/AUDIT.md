# Phase 3 Audit + Prototypes — Classroom Quick Downloader 1.8.9

Branch `prototypes/1.8.9`, all files in `/prototypes`. No production UI touched.

## 1. Audit findings

### Typography (the 5 known, with fixes)
1. **Dead boilerplate** — `style.css` (67 ln) ships dark-theme Inter rules conflicting with `App.css`. Fix: delete the file; one stack, `system-ui`.
2. **Heading sizes 15/16/17/20** — no scale. Fix: fixed scale **11 / 12 / 13 / 15 / 17** (10 reserved for legal only).
3. **Micro-copy mixes 10/11/12** — Fix: 11px floor for UI micro-copy; 12px for captions/meta; 10px only for the legal line.
4. **Buttons 11/12/13px, weights 500/600/700** — Fix: primary CTA 15/600 (A) or 13/600 (B); controls 12/500; weight set is 400/500/600 — 700 nowhere.
5. **Three font stacks in pills** (system-ui / Google Sans / Roboto) — Fix: one stack everywhere, including content-script pills.

### Added findings (spacing, color, motion, structure)
6. **Spacing has no grid** — adjacent cards use different paddings. Fix: strict 4/8 scale (4/8/12/16/24), applied in both directions.
7. **"Both" flag color #FF4036 == error color** — users read "both" posts as failed. Fix: purple→cyan gradient badge/ring (components.html §B).
8. **Comment purple #9B00FF fails contrast on dark bg** — Fix: text/icon variant #B983FF; #9B00FF stays fill-only. Same split for edited (#00D6EE text) and success (#4AE376 text).
9. **~14 keyframes, zero `prefers-reduced-motion` support** (popup-surface.md) — Fix: every animation gated by media query + an in-app "Reduce motion" setting (effects.html, working toggle).
10. **Error pill expands to 350×60** (styles.ts:809-819) — nearly full popup width. Fix: errors are rows/banners inside the popup geometry, never breakout elements.
11. **No first-run surface exists** — needed home for privacy summary + copyright acknowledgment (legal.html).
12. **Fresh-install engine label quirk** (App.tsx:755 `|| 'legacy'` vs DEFAULT_MODE='v2') — selector redesign must read via `readMode()`; both prototypes render "New" pre-selected.
13. **History/meta numbers jitter** — no tabular numerals. Fix: `font-variant-numeric: tabular-nums` on all counts/progress.

## 2. Design decisions per direction
- **A — Stillwater (calm glass):** one hero (classroom action), 16px gutters, translucent layers, 200–360ms, single soft ease `cubic-bezier(0.22,1,0.36,1)`, continuous liquid water fill, ambient history. For trust-first, low-frequency users.
- **B — Gridline (compact utility):** status strip answers "is anything running?" first; everything is a 36px row; 90–200ms, no travel/overshoot; per-file stepped fill; tabular data, speeds, clock times. For daily batch users.
- **Shared:** both keep engine rollback copy permanently visible, show all 5 states without layout shift, and ship the same type/spacing scale. Components and effects are direction-agnostic unless noted.

## 3. Name proposals for the classroom action (task 2.7)
1. **"Download Classroom"** — names the object; shortest; zero overlap with post-level "Download All (N files)". **RECOMMENDED.**
2. **"Download All Materials"** — most precise payload description; but 21 chars + still contains "All", the word we are retiring.
3. **"Download Everything"** — energetic, unmistakably "the big one"; but overclaims (nothing touches announcements/grades) — trust risk.
Temporary constant in prototypes; rename is one line in Phase 4.

## 4. Policy notes (from CWS Program Policies research)
- **REQUIRED:** privacy policy posted + accurate dashboard data disclosures; prominent disclosure + affirmative consent before install; narrowest-permission justifications (downloads, storage, identity for the beta); Limited Use affirmation (Google APIs); no false endorsement/impersonation → "Not affiliated with Google" treated as required mitigation.
- **RECOMMENDED:** in-product privacy summary row, permissions explainer, API-beta risk warning, one-time copyright/ToS acknowledgment before first classroom-wide run.
- Details + rendered surfaces: legal.html (each labeled, with a required-vs-recommended summary table).

## 5. Citations
- Chrome Web Store Program Policies (permissions, disclosures, impersonation, Limited Use): https://developer.chrome.com/docs/webstore/program-policies and https://developer.chrome.com/docs/webstore/program-policies/policies
- CWS privacy-standards deadlines: https://cyberinsider.com/google-chrome-extensions-must-meet-new-privacy-standards-by-august-1
- Loading-state timing (0.1–1s none, indeterminate 1–10s, determinate >10s; progress for multi-step): https://altersquare.io
- Liquid/progress loader pattern references: https://codefronts.com
- Subtle shine practice (low-opacity sweep, transform-only, hover/single-pass, overflow hidden): https://github.com/IanLunn/Hover
- Reduced motion (soften, don't just delete; media query): https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion and https://www.atomica11y.com
- Popup hierarchy (max 800×600, one/two primary actions, minimal scrolling): synthesis of dev guides incl. https://www.groovyweb.co and freecodecamp accessible-extensions audit (2025).

## 6. Open questions for the owner (Stop Gate)
1. Direction: A, B, or hybrid (e.g. A's hierarchy + B's status strip)?
2. Final name for 2.7 (recommend "Download Classroom").
3. Which flags ship in the popup: Comment/Edited/Both all three, or keep "Both" Options-only?
4. Expose `downloadConcurrency` (Sequential 1 / Parallel 3, parallel default) in popup, Options, or both?
5. Accent: keep violet #8F7BFF or move toward Classroom green?
6. Adopt the one-time copyright dialog at first classroom-wide download? (legal appetite)
7. BMC button: popup footer (both prototypes) vs today's About-card row?
8. Should the privacy summary row + permissions explainer be part of 1.8.9 or defer to 1.9.x?
