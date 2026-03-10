# Manual Testing Checklist — Phase 0 Baseline

> Complete this checklist by visiting each page type with the extension loaded in dev mode.
> Save screenshots to `verification/baseline/2026-03-06/screenshots/`.

## Setup

- [ ] Load extension: `pnpm -C extension dev`
- [ ] Open Google Classroom with test account
- [ ] Open DevTools Console (filter for "CQD")

---

## Account Matrix

### Single Google Account (en, ar, es)

#### Stream Page (`/c/{classId}`)
- [ ] **en**: Download buttons on all file attachments
- [ ] **en**: No duplicate buttons
- [ ] **en**: Comment flags on commented posts
- [ ] **en**: Edited flags on edited posts
- [ ] **en**: "Both" badge when both flags present
- [ ] **en**: "Download All" groups files correctly (≥2 files)
- [ ] **ar**: RTL layout correct — badges on left side
- [ ] **ar**: Detection works (Arabic keywords)
- [ ] **es**: Detection works (Spanish keywords)

#### Classwork List (`/w/{classId}/t/all`)
- [ ] **en**: Buttons appear on expanded posts
- [ ] **en**: Buttons hidden on collapsed posts
- [ ] **en**: "Download All" appears in header
- [ ] **en**: Comment count matches actual count
- [ ] **ar**: RTL layout correct
- [ ] **es**: Detection works

#### Topic Classwork (`/w/{classId}/tc/{topicId}`)
- [ ] **en**: Posts always expanded (no folding)
- [ ] **en**: Buttons and badges render correctly
- [ ] **ar**: RTL layout correct

#### Assignment Details (`/c/{classId}/a/{itemId}/details`)
- [ ] **en**: Buttons on all attached files
- [ ] **en**: Verify partial coverage issue (KNOWN-003)
- [ ] **ar**: RTL layout correct

#### Material Details (`/c/{classId}/m/{itemId}/details`)
- [ ] **en**: Buttons on all attached files
- [ ] **ar**: RTL layout correct

#### Student Submissions (`/c/{classId}/a/{itemId}/submissions/{studentId}`)
- [ ] **en**: Verify NO buttons (KNOWN-001 — expected missing)
- [ ] Document DOM structure for V2

#### Student Work Teacher View (`/c/{classId}/a/{itemId}/submissions`)
- [ ] **en**: Verify NO buttons (KNOWN-002 — expected missing)
- [ ] Document DOM structure for V2

#### Announcement Detail (`/c/{classId}/p/{postId}`)
- [ ] **en**: Buttons on attachment files
- [ ] **en**: Flags render correctly

---

### Dual Account (personal + school) — en, fr

- [ ] Switch accounts via authuser parameter
- [ ] Verify buttons still work after switching
- [ ] Verify no stale state from previous account
- [ ] Verify flags don't carry over

---

### Theme & Layout

- [ ] **Light mode**: All elements visible and styled
- [ ] **Dark mode**: All elements visible, proper contrast
- [ ] **Toggle mid-session**: Theme change propagates to CQD elements
- [ ] **RTL language**: Layout mirrored correctly

---

## Performance Observations

- [ ] Page load time feels acceptable
- [ ] Scrolling is smooth (no visible jank)
- [ ] Memory usage (DevTools → Performance → Memory) < 50MB
- [ ] No console errors from CQD

---

## Screenshots To Save

For each page type tested, save:
1. Full page screenshot
2. Close-up of download button(s)
3. Close-up of flag badge(s)
4. Console output (any CQD logs)

Save to: `verification/baseline/2026-03-06/screenshots/<page-type>-<lang>/`
