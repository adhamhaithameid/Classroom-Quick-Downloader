# Manual Testing Checklist — Phase 0 Baseline (2026-03-08)

> Complete this checklist by visiting each page type with the extension loaded in dev mode.
> Save screenshots to `verification/baseline/2026-03-08/screenshots/`.

## Setup

- [ ] Load extension: `pnpm -C extension dev`
- [ ] Open Google Classroom with test account
- [ ] Open DevTools Console (filter for "CQD")
- [ ] If using live capture, run `node tools/run-extension-phase0-baseline.mjs --with-live-capture --profile "<chrome-profile-dir>"`

## Manual Classroom Matrix

### Single Google Account (en, ar, es)

- [ ] Stream: buttons, flags, no duplicates, Download All, RTL check
- [ ] Classwork list: expanded/collapsed behavior, header placement, count accuracy
- [ ] Topic classwork: buttons and badges on always-expanded items
- [ ] Assignment details: all files visible, record partial coverage gaps
- [ ] Material details: all files visible
- [ ] Student submissions: document expected missing-button gap and DOM shape
- [ ] Teacher student-work: document expected missing-button gap and DOM shape
- [ ] Announcement detail: attachment buttons and flags render correctly

### Multi-account scenarios

- [ ] Single account
- [ ] Dual account with authuser switching
- [ ] Three-account scenario
- [ ] Restricted school account where possible

### Theme and layout

- [ ] Light mode
- [ ] Dark mode
- [ ] Mid-session theme switch
- [ ] RTL layout

### Performance observations

- [ ] No visible scroll jank
- [ ] No runaway observer churn
- [ ] No CQD console errors
- [ ] Memory stays acceptable during page navigation

## Screenshots to save

For each relevant page:

1. full page,
2. button close-up,
3. flag close-up,
4. console evidence if abnormal.
