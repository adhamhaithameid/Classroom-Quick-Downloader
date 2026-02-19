# 🧪 Testing Guide

> Last updated: 2026-02-19 (v1.3.5).

> Update (2026-02-15): Latest changes include CI coverage-gate hardening for extension analytics storage migration fallback, popup stats race-condition guards, structured step-up auth error handling in Oracle dashboard, and backend/worker auth-security hardening. See /CHANGELOG.md for details.

This document describes the comprehensive test suite for the **Universal V4 Detection System**.

## Quick Start

```bash
cd extension

# Run all tests once
pnpm test

# Watch mode (auto-reruns on file changes)
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

---

## Test Suite Overview

| File | Tests | Purpose |
|------|-------|---------|
| `tests/fixtures.ts` | - | Data warehouse with 30+ test cases |
| `tests/core.test.ts` | 60 | Unit tests for normalization, parsing, keywords |
| `tests/dom.test.ts` | 45 | DOM integration with JSDOM |
| `tests/ui.test.ts` | 29 | UI component tests for Smart Pills |
| **Total** | **134** | Complete coverage of detection system |

---

## Test Categories

### 1. Core Logic Tests (`core.test.ts`)

#### Text Normalization
- BiDi control character stripping
- Unicode whitespace normalization
- Empty string handling
- RTL text preservation

#### Unicode Integer Parsing
Validates parsing of digits from all scripts:
| Script | Example | Value |
|--------|---------|-------|
| Arabic-Indic | `٥` | 5 |
| Devanagari | `७` | 7 |
| Bengali | `৩` | 3 |
| Thai | `๕` | 5 |
| Gurmukhi | `੯` | 9 |

#### Word-Number Parsing
Tests for languages that use words instead of digits:
- Arabic: `واحد` → 1, `اثنان` → 2, `ثلاثة` → 3
- English: `one` → 1, `five` → 5
- Spanish/French: `un` → 1, `dos`/`deux` → 2

#### Exclusion Patterns
Validates that action buttons are correctly excluded:
- ✅ Exclude: "Add class comment", "إضافة تعليق"
- ❌ Don't exclude: "5 class comments", "٥ تعليقات"

#### Date Parsing
Tests `parseUnicodeDate()` with various formats:
- ISO: `2026-01-20`
- American: `Jan 20, 2026`
- European: `20 Jan 2026`

---

### 2. DOM Integration Tests (`dom.test.ts`)

#### Language Coverage
Tests comment detection across language families:

| Category | Languages Tested |
|----------|------------------|
| **RTL** | Arabic (ar), Hebrew (he) |
| **CJK** | Japanese (ja), Chinese (zh), Korean (ko) |
| **Indic** | Hindi (hi), Bengali (bn) |
| **European** | English, Spanish, French, German, Russian |
| **Joke** | Pirate, Hacker (1337), Bork (Swedish Chef) |

#### Semantic Triangulation
Validates the 4-Layer Nuclear Fallback:
1. **Layer 1**: `aria-label` detection (highest priority)
2. **Layer 2**: `role="button"` heuristic
3. **Layer 3**: Golden CSS selectors
4. **Layer 4**: Full DOM text scan (nuclear fallback)

#### Regression Tests
Ensures known edge cases don't break:
- CSS class removal doesn't break detection
- Arabic word-numbers are detected
- "Add comment" buttons don't trigger false positives
- Bengali numerals are correctly parsed

---

### 3. UI Component Tests (`ui.test.ts`)

#### Hover Intelligence
Validates tooltip content:
```
Comment Badge: "5 class comments"
Edited Badge: "Edited 2d 5h after creation"
Both Badge: "5 comments • Edited 2d 5h"
```

#### Smart Pills Structure
Validates DOM structure:
```html
<div class="cqd-flag cqd-comment-badge" data-cqd-comment-count="5">
  <span class="cqd-flag-icon">💬</span>
  <span class="cqd-flag-text">5 comments</span>
</div>
```

#### Accessibility
- All badges have `title` attributes
- Meaningful tooltip text
- RTL support with `dir="rtl"`

---

## Running Specific Tests

```bash
# Run only core logic tests
pnpm vitest run tests/core.test.ts

# Run only DOM tests
pnpm vitest run tests/dom.test.ts

# Run only UI tests
pnpm vitest run tests/ui.test.ts

# Run tests matching a pattern
pnpm vitest run -t "Arabic"

# Verbose output (see all test names)
pnpm vitest run --reporter=verbose
```

---

## Watch Mode Controls

When running `pnpm test:watch`:

| Key | Action |
|-----|--------|
| `a` | Run all tests |
| `f` | Run only failed tests |
| `p` | Filter by filename pattern |
| `t` | Filter by test name pattern |
| `q` | Quit |

---

## Coverage Report

Run `pnpm test:coverage` to generate a coverage report:

```
----------------------|---------|----------|---------|---------|
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
detection-keywords.ts |   85.2  |   78.4   |   92.1  |   85.2  |
smart-detector.ts     |   82.3  |   75.6   |   88.5  |   82.3  |
...                   |   ...   |   ...    |   ...   |   ...   |
----------------------|---------|----------|---------|---------|
```

The HTML report is generated in `coverage/` directory.

---

## Adding New Tests

### 1. Add Test Case to Fixtures

```typescript
// tests/fixtures.ts
{
  id: 'new-1',
  language: 'en',
  description: 'Description of test case',
  htmlSnippet: `
    <div data-stream-item-id="123">
      <div aria-label="3 class comments">3 comments</div>
    </div>
  `,
  expected: { count: 3, isEdited: false, diffString: null },
}
```

### 2. Add New Test

```typescript
// tests/dom.test.ts
it('should handle new edge case', () => {
  const { element } = createMockDOM(htmlSnippet);
  const result = detectComments(element, 'en');
  
  expect(result.count).toBe(3);
  expect(result.hasComments).toBe(true);
});
```

---

## CI Integration

The test suite is designed for CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run Tests
  run: |
    cd extension
    pnpm install
    pnpm test
```

Tests will fail the build if any assertion fails, ensuring **0% regression**.

---

## Troubleshooting

### Tests failing after code changes?
1. Run `pnpm test` to see which tests fail
2. Check if new patterns need to be added to keywords
3. Verify Unicode digit parsing for new scripts

### JSDOM errors?
Make sure `@types/jsdom` is installed:
```bash
pnpm add -D @types/jsdom
```

### Coverage not working?
Install the coverage provider:
```bash
pnpm add -D @vitest/coverage-v8
```
