# CQD Selector Catalog — Baseline 2026-03-06

> Every CSS selector, URL pattern, Google class name, `data-*` attribute, `aria-*` usage,
> and `jscontroller`/`jsaction` reference used by the extension, organized by source file.

---

## 1. `state.ts` — Core Constants

### URL Patterns
| Name | Pattern | Type |
|------|---------|------|
| `CLASSROOM_URL_PATTERN` | `/^https:\/\/classroom\.google\.com\//` | RegExp |
| `DRIVE_URL_PATTERNS[0]` | `/https:\/\/drive\.google\.com\/file\/d\//` | RegExp |
| `DRIVE_URL_PATTERNS[1]` | `/https:\/\/drive\.google\.com\/open\?/` | RegExp |
| `DRIVE_URL_PATTERNS[2]` | `/https:\/\/drive\.google\.com\/uc\?/` | RegExp |
| `DRIVE_URL_PATTERNS[3]` | `/https:\/\/classroom\.google\.com\/drive\//` | RegExp |

### DOM Selectors
| Name | Selector | Risk Level |
|------|----------|------------|
| `DRIVE_ANCHOR_SELECTOR` | `a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]` | 🟢 Low (href-based) |
| `ATTACHMENT_CONTAINER_SELECTOR` | `.KlRXdf, .z3vRcc, .VfPpkd-aPP78e, [data-drive-id], [data-id][data-item-id]` | 🔴 High (3 class names) |

### Data Attributes (CQD-owned)
| Attribute | Purpose |
|-----------|---------|
| `data-cqd-injected` | Marks CQD-injected elements |
| `data-cqd-processed` | Marks processed containers |

---

## 2. `tab-detector.ts` — Page Classification

### URL Regex Patterns
| Pattern | Detects |
|---------|---------|
| `/\/w\/[^/]+\/t\//` | Classwork list |
| `/\/w\/[^/]+\/tc\//` | Topic category view |
| `/\/c\/[^/]+\/a\/[^/]+\/details/` | Assignment details |
| `/\/c\/[^/]+\/m\/[^/]+\/details/` | Material details |
| `/\/r\/[^/]+\/sort-/` | People tab |
| `/\/g\/[^/]+/` | Grades |
| `/\/u\/[^/]+\/g\//` | Grades (alt) |
| `/\/c\/[^/]+\/?$/` | Stream home |
| `/\/c\/[^/]+\/p\/[^/]+/` | Stream post |

### Element Selectors
| Selector | Purpose | Risk |
|----------|---------|------|
| `li.tfGBod` | Classwork list item | 🔴 Class |
| `li[data-stream-item-id]` | Classwork post | 🟢 Data attr |
| `div.etr9pd` | Topic view post | 🔴 Class |
| `div.i8Wprc` | Topic view post | 🔴 Class |
| `div.sVNOQ[data-stream-item-id]` | Topic view + data attr | 🟡 Mixed |
| `div[data-stream-item-id][data-material-parent-id]` | Topic view material | 🟢 Data attr |
| `div[data-stream-item-id]` | Stream post | 🟢 Data attr |
| `[data-stream-item-id]` | Unified post selector | 🟢 Data attr |

---

## 3. `detection-keywords.ts` — Golden Selectors & Weights

### GOLDEN_SELECTORS.dateContainer
| Selector | Purpose | Risk |
|----------|---------|------|
| `.IMvYId.dDKhVc.Vu2fZd` | Stream date container | 🔴 Class |
| `.IMvYId.Vu2fZd` | Stream date (alt) | 🔴 Class |
| `.IMvYId` | Stream date (fallback) | 🔴 Class |
| `.jzdBjc` | Date label | 🔴 Class |
| `.EZrbnd` | Date container (alt) | 🔴 Class |
| `.vGGYOe.Vu2fZd` | Classwork expanded date | 🔴 Class |
| `.vGGYOe` | Classwork date | 🔴 Class |
| `li[data-stream-item-id] .Vu2fZd` | Classwork item date | 🟡 Mixed |

### GOLDEN_SELECTORS.commentContainer
| Selector | Purpose | Risk |
|----------|---------|------|
| `.asQXV.QRiHXd` | Stream comment area | 🔴 Class |
| `.mUIrbf-vQzf8d` | Comment text | 🔴 Class |
| `.z3vRcc-aD1xae` | Comment section | 🔴 Class |
| `.z3vRcc` | Comment container | 🔴 Class |
| `.qCWAqb.seqYL` | Classwork comment indicator | 🔴 Class |
| `.qCWAqb` | Comment wrapper | 🔴 Class |
| `.huI6Cb.Cx437e` | Comment icon+count div | 🔴 Class |
| `li[data-stream-item-id] .seqYL` | Classwork item comment | 🟡 Mixed |
| `[data-stream-item-id] .asQXV` | Post comment area | 🟡 Mixed |
| `[jsname="z3vRcc"]` | Comment jsname | 🟡 jsname |
| `[jscontroller] .QRiHXd` | Controller comment | 🟡 Mixed |
| `.yqQS0c` | Click area | 🔴 Class |
| `.gVJHxe` | Comment button | 🔴 Class |
| `[aria-label*="comment"]` | Aria comment (en) | 🟢 Semantic |
| `[aria-label*="Comment"]` | Aria comment (en) | 🟢 Semantic |
| `[aria-label*="تعليق"]` | Aria comment (ar) | 🟢 Semantic |
| `[aria-label*="コメント"]` | Aria comment (ja) | 🟢 Semantic |
| `[aria-label*="评论"]` | Aria comment (zh) | 🟢 Semantic |
| `[aria-label*="комментар"]` | Aria comment (ru) | 🟢 Semantic |

### GOLDEN_SELECTORS.userContentExclusions
| Selector | Purpose | Risk |
|----------|---------|------|
| `.n8F6Jd` | User content area | 🔴 Class |
| `.a3j8U` | User content area | 🔴 Class |
| `.gM4mlb` | User text area | 🔴 Class |
| `.A6dC2c` | User content area | 🔴 Class |
| `[contenteditable="true"]` | Edit areas | 🟢 Semantic |
| `input` | Input fields | 🟢 Tag |
| `textarea` | Textareas | 🟢 Tag |

### Confidence Weights
| Weight | Value |
|--------|-------|
| `LAYER_1_GOLDEN` | 40 |
| `LAYER_2_SEMANTIC` | 35 |
| `LAYER_3_STRUCTURAL` | 20 |
| `LAYER_4_EXCLUSION` | -25 |
| `HIGH_CONFIDENCE` | 60 |
| `MEDIUM_CONFIDENCE` | 35 |
| `LOW_CONFIDENCE` | 15 |

---

## 4. `smart-detector-comments.ts` — Comment Detection Selectors

### Layer 0: DOM Truth
| Selector | Purpose | Risk |
|----------|---------|------|
| `.qCWAqb .huI6Cb` | Primary comment indicator | 🔴 Class |
| `.qCWAqb.seqYL` | Comment container | 🔴 Class |
| `.mUIrbf-vQzf8d, .jzdBjc, span[aria-hidden="true"]` | Text span inside container | 🔴 Class |
| `.huI6Cb` | Icon div (within container) | 🔴 Class |
| `.seqYL` | Comment section (fallback) | 🔴 Class |

### Layers 1-4
| Layer | Selectors Used | Risk |
|-------|---------------|------|
| Layer 1 (Accessibility) | `[aria-label]`, `[title]` | 🟢 Semantic |
| Layer 2 (Button) | `[role="button"], button, [jsaction*="click"]` | 🟢 Semantic |
| Layer 3 (Golden) | Uses `GOLDEN_SELECTORS.commentContainer` ↑ | 🔴 Class |
| Layer 4 (Nuclear) | `TreeWalker` — no selectors, scans text nodes | 🟢 N/A |

### Action Button Exclusion Patterns
14 regex patterns for "Add comment" in: English, Arabic (3 variants), Russian, Japanese, Chinese, French, German, Spanish + generic patterns.

---

## 5. `smart-detector.ts` — Edited Detection Selectors

### Layers
| Layer | Selectors Used | Risk |
|-------|---------------|------|
| Layer 1 (Golden) | Uses `GOLDEN_SELECTORS.dateContainer` ↑ | 🔴 Class |
| Layer 2 (Semantic) | `[aria-label]`, `[title]` | 🟢 Semantic |
| Layer 3 (TreeWalker) | `TreeWalker` with `getComputedStyle` visibility checks | 🟢 N/A |
| Layer 4 (Exclusion) | Uses `GOLDEN_SELECTORS.userContentExclusions` ↑ | 🟡 Mixed |

### TreeWalker Filter Selectors
| Selector | Purpose |
|----------|---------|
| `button` / `[role="button"]` | Skip show more/less buttons |
| Text regex: `/more\|less\|show\|hide\|voir\|mehr\|menos/i` | Skip UI toggle text |

---

## 6. `observers.ts` — DOM Observation

| Selector | Purpose |
|----------|---------|
| `DRIVE_ANCHOR_SELECTOR` (from state.ts) | Find Drive anchors |
| `ATTACHMENT_CONTAINER_SELECTOR` (from state.ts) | Find containers |
| `[data-drive-id]` | Drive file elements |
| `[data-id][data-item-id]` | File meta elements |
| `[data-id][data-tooltip]` | File with tooltip |
| `.cqd-download-btn` | Own buttons (for cleanup) |

### MutationObserver Config
- Observes: `document.body`
- Options: `childList: true, subtree: true, attributes: true`
- Attribute filter: `['class', 'style', 'data-cqd-processed']`

---

## 7. `comment_frame.content.ts` + `edited_frame.content.ts`

### Shared Selectors
| Selector | Both Use |
|----------|----------|
| `[data-stream-item-id]` | Post selector |
| `.cqd-overlay-container` | Overlay presence check |
| `.cqd-comment-badge` / `.cqd-edited-badge` | Badge check |
| `.cqd-both-badge` | Combined badge check |

### Each has its own MutationObserver + heartbeat + URL observer (3× cost)

---

## 8. `download_all.content.ts` — Download All

### Google Class Selectors
| Selector | Purpose | Risk |
|----------|---------|------|
| `.N5dSp` | Stream header | 🔴 Class |
| `.RcHwO` | Header row | 🔴 Class |
| `span.nZCyt` | Classwork title | 🔴 Class |
| `.jWCzBe.gmNu1d` | Classwork header | 🔴 Class |
| `.JZicYb.gmNu1d` | Stream internal header | 🔴 Class |
| `.JZicYb` | Header (fallback) | 🔴 Class |
| `.vFkiub.kpDQ8` | Dots container | 🔴 Class |
| `.kpDQ8` | Action menu | 🔴 Class |
| `.WyjGac` | Topic menu | 🔴 Class |
| `.pYTkkf-Bz112c-LgbsSe` | Three-dots button class | 🔴 Class |
| `li.lXuxY` | Expanded classwork item | 🔴 Class |
| `li.AZd1I` | Collapsed classwork item | 🔴 Class |
| `.SFCE1b` / `.JUr7jb` | Expand toggle classes | 🔴 Class |
| `div.sVNOQ` | Classwork attachments | 🔴 Class |

### Data/Semantic Selectors
| Selector | Purpose | Risk |
|----------|---------|------|
| `[data-stream-item-id]` | Post root | 🟢 Data attr |
| `[data-guided-help-id="streamItemActionMenuGH"]` | Three-dots chunk | 🟢 Data attr |
| `div[role="button"][aria-expanded]` | Accordion toggle | 🟢 Semantic |
| `[aria-expanded]` | Expand state | 🟢 Semantic |
| `[aria-haspopup="menu"]` | Menu button | 🟢 Semantic |
| `[aria-label*="More"]` / `[aria-label*="more"]` | More button | 🟢 Semantic |
| `a[href*="/details/"], h2 a` | Post title link | 🟢 Semantic |

### jscontroller Attributes
| Attribute | Purpose |
|-----------|---------|
| `jscontroller="h38nBf"` | Three-dots controller |
| `jscontroller="ZvHseb"` | Three-dots controller (alt) |
| `jscontroller="PIVayb"` | Three-dots controller (alt) |
| `jscontroller="yP6Lwf"` | Topic view post controller |

---

## 9. `both-badge.ts` — Combined Badge

| Selector | Purpose |
|----------|---------|
| `a[href*="/details/"], h2 a` | Post title link for click |
| `.cqd-overlay-container` | Overlay check |
| `.cqd-both-badge` / `.cqd-comment-badge` / `.cqd-edited-badge` | Badge management |

---

## Risk Summary

| Risk Level | Count | Description |
|------------|-------|-------------|
| 🔴 High | **42** | Pure Google class names — will break when Google renames |
| 🟡 Medium | **8** | Mixed (data attr + class, jsname, jscontroller) |
| 🟢 Low | **24** | Data attributes, aria attributes, semantic HTML, tags |

**Critical finding**: 42 of 74 selectors (57%) are pure class-name based and vulnerable to Google's deployment changes. The V2 5-level selector priority chain is essential.
