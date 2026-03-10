// filepath: extension/tests/v2-exclusion-engine.test.ts
/**
 * Tests for the V2 Exclusion Engine.
 *
 * The exclusion engine prevents false-positive flag detection by
 * identifying text that looks like keywords but is actually:
 * - Action buttons ("Add comment", "Write comment")
 * - Student-authored text ("I edited my homework")
 * - Placeholder/template text
 * - Content inside input/textarea/contenteditable
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isExcludedText,
  applyExclusions,
  isInExcludedArea,
  getUserContentSelectors,
  getAllRules,
  getRulesByCategory,
  totalPenalty,
} from '../src/v2/decision/exclusion-engine';

// ============================================================================
// HELPERS
// ============================================================================

function createPost(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

// ============================================================================
// TEST SUITE: isExcludedText
// ============================================================================

describe('isExcludedText (fast path)', () => {
  it('excludes "Add comment" for comment type', () => {
    expect(isExcludedText('Add comment', 'comment')).toBe(true);
  });

  it('excludes "Add class comment" for comment type', () => {
    expect(isExcludedText('Add class comment', 'comment')).toBe(true);
  });

  it('excludes "Write a comment" for comment type', () => {
    expect(isExcludedText('Write a comment', 'comment')).toBe(true);
  });

  it('excludes Arabic action button', () => {
    expect(isExcludedText('اضافة تعليق', 'comment')).toBe(true);
  });

  it('excludes Japanese action button', () => {
    expect(isExcludedText('コメントを追加', 'comment')).toBe(true);
  });

  it('excludes Russian action button', () => {
    expect(isExcludedText('добавить комментарий', 'comment')).toBe(true);
  });

  it('does NOT exclude "3 comments"', () => {
    expect(isExcludedText('3 comments', 'comment')).toBe(false);
  });

  it('does NOT exclude "1 class comment"', () => {
    expect(isExcludedText('1 class comment', 'comment')).toBe(false);
  });

  it('excludes "I edited my homework" for edited type', () => {
    expect(isExcludedText('I edited my homework', 'edited')).toBe(true);
  });

  it('excludes "can be edited" for edited type', () => {
    expect(isExcludedText('can be edited', 'edited')).toBe(true);
  });

  it('excludes "editor" for edited type', () => {
    expect(isExcludedText('editor', 'edited')).toBe(true);
  });

  it('does NOT exclude "Edited Dec 14" for edited type', () => {
    expect(isExcludedText('Edited Dec 14', 'edited')).toBe(false);
  });

  it('does NOT exclude comment exclusions for edited type', () => {
    expect(isExcludedText('Add comment', 'edited')).toBe(false);
  });

  it('does NOT exclude edited exclusions for comment type', () => {
    expect(isExcludedText('I edited', 'comment')).toBe(false);
  });
});

// ============================================================================
// TEST SUITE: applyExclusions (full trace)
// ============================================================================

describe('applyExclusions', () => {
  it('returns empty array for non-matching text', () => {
    const post = createPost('<div>3 comments</div>');
    const results = applyExclusions('3 comments', post, 'comment');
    expect(results).toHaveLength(0);
  });

  it('returns exclusion result for action button text', () => {
    const post = createPost('<div>Add comment</div>');
    const results = applyExclusions('Add comment', post, 'comment');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ruleId).toContain('ACTION_BTN');
    expect(results[0].penalty).toBeLessThan(0);
  });

  it('returns exclusion for text in user content area', () => {
    const post = createPost('<div class="n8F6Jd">5 comments</div>');
    const results = applyExclusions('5 comments', post, 'comment');
    // Should find it in the selector-based user content rule
    const selectorMatch = results.find(r => r.ruleId.includes('USER_CONTENT'));
    expect(selectorMatch).toBeDefined();
  });

  it('returns exclusion for text inside contenteditable', () => {
    const post = createPost('<div contenteditable="true">edited</div>');
    const results = applyExclusions('edited', post, 'edited');
    const match = results.find(r => r.ruleId === 'USER_CONTENT_EDITABLE');
    expect(match).toBeDefined();
  });

  it('includes penalty and reason in results', () => {
    const post = createPost('<div>Write a comment</div>');
    const results = applyExclusions('Write a comment', post, 'comment');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('penalty');
    expect(results[0]).toHaveProperty('reason');
    expect(results[0]).toHaveProperty('category');
    expect(results[0].penalty).toBeLessThan(0);
  });
});

// ============================================================================
// TEST SUITE: isInExcludedArea
// ============================================================================

describe('isInExcludedArea', () => {
  it('returns true for element inside .n8F6Jd', () => {
    const container = document.createElement('div');
    container.className = 'n8F6Jd';
    const target = document.createElement('span');
    target.textContent = 'text';
    container.appendChild(target);
    document.body.appendChild(container);
    expect(isInExcludedArea(target)).toBe(true);
  });

  it('returns true for element inside contenteditable', () => {
    const container = document.createElement('div');
    container.setAttribute('contenteditable', 'true');
    const target = document.createElement('span');
    target.textContent = 'text';
    container.appendChild(target);
    document.body.appendChild(container);
    expect(isInExcludedArea(target)).toBe(true);
  });

  it('returns false for element outside any excluded area', () => {
    const container = document.createElement('div');
    container.className = 'regular';
    const target = document.createElement('span');
    target.textContent = 'text';
    container.appendChild(target);
    document.body.appendChild(container);
    expect(isInExcludedArea(target)).toBe(false);
  });
});

// ============================================================================
// TEST SUITE: Rule registry
// ============================================================================

describe('Rule Registry', () => {
  it('getAllRules returns non-empty array', () => {
    const rules = getAllRules();
    expect(rules.length).toBeGreaterThan(20);
  });

  it('every rule has required fields', () => {
    for (const rule of getAllRules()) {
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('type');
      expect(rule).toHaveProperty('pattern');
      expect(rule).toHaveProperty('applies_to');
      expect(rule).toHaveProperty('penalty');
      expect(rule).toHaveProperty('reason');
      expect(rule).toHaveProperty('category');
      expect(rule.penalty).toBeLessThanOrEqual(0);
      expect(rule.applies_to.length).toBeGreaterThan(0);
    }
  });

  it('getRulesByCategory returns only matching rules', () => {
    const actionRules = getRulesByCategory('action_button');
    for (const rule of actionRules) {
      expect(rule.category).toBe('action_button');
    }
    expect(actionRules.length).toBeGreaterThan(5);
  });

  it('getUserContentSelectors returns CSS selectors', () => {
    const selectors = getUserContentSelectors();
    expect(selectors.length).toBeGreaterThan(0);
    // Each should be a valid CSS-like string
    for (const s of selectors) {
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it('totalPenalty sums correctly', () => {
    const results = [
      { ruleId: 'A', category: 'action_button' as const, penalty: -25, reason: '', matchedText: '' },
      { ruleId: 'B', category: 'user_content' as const, penalty: -15, reason: '', matchedText: '' },
    ];
    expect(totalPenalty(results)).toBe(-40);
  });

  it('totalPenalty returns 0 for empty array', () => {
    expect(totalPenalty([])).toBe(0);
  });
});
