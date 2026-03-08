# CQD Selector Catalog — 2026-03-08

This file is generated from the current extension source files that drive legacy download and flag behavior.

Purpose:

1. freeze the current selector surface before deeper refactors,
2. show where class-selector risk remains high,
3. support Phase 0 baseline review and V2 migration work.

## extension/entrypoints/content/state.ts

### URL / regex patterns

| Pattern |
|---------|
| `/\/classroom\.google\.com\/` |
| `/\/docs\.google\.com\/` |
| `/\/drive\.google\.com\/` |
| `/\/drive\.google\.com\/u` |
| `/\/file\/` |

### Selectors

| Selector | Risk |
|----------|------|
| `.KlRXdf` | 🔴 high |
| `.ndfuHe` | 🔴 high |
| `.nQ1Fvb` | 🔴 high |
| `.VfPpkd-aPP78e` | 🔴 high |
| `.z3vRcc` | 🔴 high |
| `[data-drive-id]` | 🟢 low |
| `[data-id][data-item-id]` | 🟢 low |
| `[data-resource-id]` | 🟢 low |
| `[data-submission-attachment-id]` | 🟢 low |
| `a[href*="/file/d/"]` | 🟡 medium |

## extension/entrypoints/content/tab-detector.ts

### URL / regex patterns

| Pattern |
|---------|
| `/\/c\/` |
| `/\/g\/` |
| `/\/r\/` |
| `/\/u\/` |
| `/\/w\/` |

### Selectors

| Selector | Risk |
|----------|------|
| `[data-stream-item-id]` | 🟢 low |
| `div.etr9pd` | 🔴 high |
| `div.i8Wprc` | 🔴 high |
| `div.sVNOQ[data-stream-item-id]` | 🟢 low |
| `div[data-stream-item-id]` | 🟢 low |
| `div[data-stream-item-id][data-material-parent-id]` | 🟢 low |
| `li.tfGBod` | 🔴 high |
| `li[data-stream-item-id]` | 🟢 low |

## extension/entrypoints/content/smart-detector-comments.ts

### Selectors

| Selector | Risk |
|----------|------|
| `.huI6Cb` | 🔴 high |
| `.jzdBjc` | 🔴 high |
| `.mUIrbf-vQzf8d` | 🔴 high |
| `.qCWAqb .huI6Cb` | 🔴 high |
| `.qCWAqb.seqYL` | 🔴 high |
| `.seqYL` | 🔴 high |
| `[aria-label]` | 🟢 low |
| `[jsaction*="click"]` | 🟡 medium |
| `[role="button"]` | 🟢 low |
| `[title]` | 🟡 medium |
| `button` | 🟡 medium |
| `div` | 🟡 medium |
| `noscript` | 🟡 medium |
| `script` | 🟡 medium |
| `span` | 🟡 medium |
| `span[aria-hidden="true"]` | 🟢 low |
| `style` | 🟡 medium |

## extension/entrypoints/content/smart-detector.ts

### Selectors

| Selector | Risk |
|----------|------|
| `[aria-label]` | 🟢 low |
| `[title]` | 🟡 medium |
| `button` | 🟡 medium |
| `noscript` | 🟡 medium |
| `script` | 🟡 medium |
| `style` | 🟡 medium |

## extension/entrypoints/download_all.content.ts

### URL / regex patterns

| Pattern |
|---------|
| `/\/d\/` |

### Selectors

| Selector | Risk |
|----------|------|
| `:hover` | 🟡 medium |
| `.cqd-download-all-btn` | 🔴 high |
| `.cqd-download-all-icon` | 🔴 high |
| `.cqd-download-all-main` | 🔴 high |
| `.cqd-download-all-sub` | 🔴 high |
| `.cqd-download-btn` | 🔴 high |
| `.cqd-download-icon` | 🔴 high |
| `.cqd-error-detail` | 🔴 high |
| `.cqd-label` | 🔴 high |
| `.jWCzBe` | 🔴 high |
| `.jWCzBe.gmNu1d` | 🔴 high |
| `.JZicYb` | 🔴 high |
| `.JZicYb.gmNu1d` | 🔴 high |
| `.kpDQ8` | 🔴 high |
| `.N5dSp` | 🔴 high |
| `.nQ1Fvb` | 🔴 high |
| `.nZCyt` | 🔴 high |
| `.pYTkkf-Bz112c-LgbsSe` | 🔴 high |
| `.RcHwO` | 🔴 high |
| `.TBvOpe` | 🔴 high |
| `.vFkiub.kpDQ8` | 🔴 high |
| `.WyjGac` | 🔴 high |
| `[aria-expanded]` | 🟢 low |
| `[aria-haspopup="menu"]` | 🟢 low |
| `[aria-label*="more"]` | 🟢 low |
| `[aria-label*="More"]` | 🟢 low |
| `[data-assignee-id]` | 🟢 low |
| `[data-cqd-right-wrapper="1"]` | 🟢 low |
| `[data-guided-help-id="streamItemActionMenuGH"]` | 🟢 low |
| `[data-stream-item-id]` | 🟢 low |
| `[data-studentid]` | 🟢 low |
| `[data-submission-id]` | 🟢 low |
| `[jscontroller="h38nBf"]` | 🟡 medium |
| `[jscontroller="PIVayb"]` | 🟡 medium |
| `[jscontroller="ZvHseb"]` | 🟡 medium |
| `button` | 🟡 medium |
| `button[aria-haspopup="menu"]` | 🟢 low |
| `div[data-stream-item-id]` | 🟢 low |
| `div[role="button"]` | 🟢 low |
| `div[role="button"][aria-expanded]` | 🟢 low |
| `div[role="button"][aria-haspopup="menu"]` | 🟢 low |
| `div[role="button"][aria-haspopup="true"]` | 🟢 low |
| `div[role="main"]` | 🟢 low |
| `li[data-stream-item-id]` | 🟢 low |
| `span` | 🟡 medium |
| `span.nZCyt` | 🔴 high |

