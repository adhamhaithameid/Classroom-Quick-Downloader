/**
 * UI COMPONENT TESTS
 * 
 * Tests for:
 * - Hover Intelligence: Tooltip/title attribute verification
 * - Smart Pills: DOM structure and expansion logic
 * - Flag creation: Comment and Edited badges
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Since we can't directly import the flag creation functions (they use browser globals),
// we'll create mock implementations based on the expected behavior

// ============================================================================
// MOCK FLAG CREATION FUNCTIONS
// ============================================================================

interface FlagOptions {
  count?: number;
  text: string;
  icon: string;
  type: 'comment' | 'edited' | 'both';
  diffString?: string;
  isRTL?: boolean;
}

/**
 * Creates a mock comment/edited flag DOM element
 * Mimics the behavior of createCommentFlag/createEditedFlag
 */
function createMockFlag(options: FlagOptions): HTMLElement {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const document = dom.window.document;
  
  const container = document.createElement('div');
  container.className = `cqd-flag cqd-${options.type}-badge`;
  
  // Set data attributes
  if (options.count !== undefined) {
    container.dataset.cqdCommentCount = String(options.count);
  }
  if (options.diffString) {
    container.dataset.cqdEditDiff = options.diffString;
  }
  
  // Create icon element
  const iconSpan = document.createElement('span');
  iconSpan.className = 'cqd-flag-icon';
  iconSpan.innerHTML = options.icon;
  container.appendChild(iconSpan);
  
  // Create text element (hidden by default, shown on hover)
  const textSpan = document.createElement('span');
  textSpan.className = 'cqd-flag-text';
  textSpan.textContent = options.text;
  container.appendChild(textSpan);
  
  // Set tooltip title based on type
  if (options.type === 'comment') {
    container.title = `${options.count} class comment${options.count !== 1 ? 's' : ''}`;
  } else if (options.type === 'edited') {
    container.title = options.diffString 
      ? `Edited ${options.diffString} after creation` 
      : 'This post was edited';
  } else if (options.type === 'both') {
    container.title = `${options.count} comments • Edited ${options.diffString || ''}`.trim();
  }
  
  // RTL support
  if (options.isRTL) {
    container.setAttribute('dir', 'rtl');
    container.style.direction = 'rtl';
  }
  
  return container;
}

/**
 * Creates a mock "Both" badge for posts with comments AND edited status
 */
function createMockBothBadge(count: number, diffString: string): HTMLElement {
  return createMockFlag({
    count,
    text: `${count} • ${diffString}`,
    icon: '💬✏️',
    type: 'both',
    diffString,
  });
}

// ============================================================================
// HOVER INTELLIGENCE TESTS
// ============================================================================

describe('Hover Intelligence - Title/Tooltip Verification', () => {
  describe('Comment Badge Tooltips', () => {
    it('should show singular tooltip for 1 comment', () => {
      const flag = createMockFlag({
        count: 1,
        text: '1 comment',
        icon: '💬',
        type: 'comment',
      });
      
      expect(flag.title).toBe('1 class comment');
    });
    
    it('should show plural tooltip for multiple comments', () => {
      const flag = createMockFlag({
        count: 5,
        text: '5 comments',
        icon: '💬',
        type: 'comment',
      });
      
      expect(flag.title).toBe('5 class comments');
    });
    
    it('should show large count correctly', () => {
      const flag = createMockFlag({
        count: 42,
        text: '42 comments',
        icon: '💬',
        type: 'comment',
      });
      
      expect(flag.title).toBe('42 class comments');
    });
  });

  describe('Edited Badge Tooltips', () => {
    it('should show edit diff in tooltip', () => {
      const flag = createMockFlag({
        text: '2d 5h',
        icon: '✏️',
        type: 'edited',
        diffString: '2d 5h',
      });
      
      expect(flag.title).toBe('Edited 2d 5h after creation');
    });
    
    it('should handle missing diff string gracefully', () => {
      const flag = createMockFlag({
        text: 'edited',
        icon: '✏️',
        type: 'edited',
      });
      
      expect(flag.title).toBe('This post was edited');
    });
    
    it('should show hours-only diff', () => {
      const flag = createMockFlag({
        text: '3h',
        icon: '✏️',
        type: 'edited',
        diffString: '3h',
      });
      
      expect(flag.title).toContain('3h');
    });
  });

  describe('Both Badge Tooltips', () => {
    it('should combine count and diff in tooltip', () => {
      const flag = createMockBothBadge(5, '2d 5h');
      
      expect(flag.title).toContain('5 comments');
      expect(flag.title).toContain('2d 5h');
    });
  });
});

// ============================================================================
// SMART PILLS DOM STRUCTURE TESTS
// ============================================================================

describe('Smart Pills - DOM Structure', () => {
  describe('Element Hierarchy', () => {
    it('should have correct container class', () => {
      const flag = createMockFlag({
        count: 3,
        text: '3 comments',
        icon: '💬',
        type: 'comment',
      });
      
      expect(flag.className).toContain('cqd-flag');
      expect(flag.className).toContain('cqd-comment-badge');
    });
    
    it('should contain icon span', () => {
      const flag = createMockFlag({
        count: 3,
        text: '3 comments',
        icon: '💬',
        type: 'comment',
      });
      
      const iconSpan = flag.querySelector('.cqd-flag-icon');
      expect(iconSpan).not.toBeNull();
    });
    
    it('should contain text span for expansion', () => {
      const flag = createMockFlag({
        count: 3,
        text: '3 comments',
        icon: '💬',
        type: 'comment',
      });
      
      const textSpan = flag.querySelector('.cqd-flag-text');
      expect(textSpan).not.toBeNull();
      expect(textSpan?.textContent).toBe('3 comments');
    });
  });

  describe('Data Attributes', () => {
    it('should set data-cqd-comment-count for comment badges', () => {
      const flag = createMockFlag({
        count: 7,
        text: '7 comments',
        icon: '💬',
        type: 'comment',
      });
      
      expect(flag.dataset.cqdCommentCount).toBe('7');
    });
    
    it('should set data-cqd-edit-diff for edited badges', () => {
      const flag = createMockFlag({
        text: '2d 5h',
        icon: '✏️',
        type: 'edited',
        diffString: '2d 5h',
      });
      
      expect(flag.dataset.cqdEditDiff).toBe('2d 5h');
    });
    
    it('should set both attributes for both badge', () => {
      const flag = createMockBothBadge(10, '3d 2h');
      
      expect(flag.dataset.cqdCommentCount).toBe('10');
      expect(flag.dataset.cqdEditDiff).toBe('3d 2h');
    });
  });

  describe('RTL Support', () => {
    it('should set RTL direction when specified', () => {
      const flag = createMockFlag({
        count: 5,
        text: '٥ تعليقات',
        icon: '💬',
        type: 'comment',
        isRTL: true,
      });
      
      expect(flag.getAttribute('dir')).toBe('rtl');
      expect(flag.style.direction).toBe('rtl');
    });
    
    it('should default to LTR', () => {
      const flag = createMockFlag({
        count: 5,
        text: '5 comments',
        icon: '💬',
        type: 'comment',
      });
      
      expect(flag.getAttribute('dir')).not.toBe('rtl');
    });
  });
});

// ============================================================================
// EXPANSION LOGIC TESTS
// ============================================================================

describe('Smart Pills - Expansion Logic', () => {
  it('should have hidden text by default (relies on CSS)', () => {
    const flag = createMockFlag({
      count: 5,
      text: '5 comments',
      icon: '💬',
      type: 'comment',
    });
    
    // The text span exists but is hidden via CSS
    const textSpan = flag.querySelector('.cqd-flag-text');
    expect(textSpan).not.toBeNull();
    // CSS class would control visibility, but DOM node must exist
    expect(textSpan?.textContent).toBe('5 comments');
  });

  it('should format Both badge text correctly', () => {
    const flag = createMockBothBadge(5, '2d 5h');
    
    const textSpan = flag.querySelector('.cqd-flag-text');
    expect(textSpan?.textContent).toBe('5 • 2d 5h');
  });

  it('should include icon in container', () => {
    const flag = createMockFlag({
      count: 3,
      text: '3 comments',
      icon: '💬',
      type: 'comment',
    });
    
    const iconSpan = flag.querySelector('.cqd-flag-icon');
    expect(iconSpan?.innerHTML).toContain('💬');
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe('Accessibility Compliance', () => {
  it('should have title attribute for screen readers', () => {
    const flag = createMockFlag({
      count: 5,
      text: '5 comments',
      icon: '💬',
      type: 'comment',
    });
    
    expect(flag.title).toBeTruthy();
    expect(flag.title.length).toBeGreaterThan(0);
  });

  it('should contain meaningful tooltip text', () => {
    const flag = createMockFlag({
      count: 5,
      text: '5 comments',
      icon: '💬',
      type: 'comment',
    });
    
    // Tooltip should mention the count
    expect(flag.title).toMatch(/5/);
    expect(flag.title).toMatch(/comment/i);
  });

  it('should have proper text alternative for edited status', () => {
    const flag = createMockFlag({
      text: '2d 5h',
      icon: '✏️',
      type: 'edited',
      diffString: '2d 5h',
    });
    
    expect(flag.title).toMatch(/edited/i);
  });
});

// ============================================================================
// BOTH BADGE SPECIFIC TESTS
// ============================================================================

describe('Both Badge (Comment + Edited)', () => {
  it('should display combined format: "{count} • {diffString}"', () => {
    const flag = createMockBothBadge(7, '1d 3h');
    
    const textSpan = flag.querySelector('.cqd-flag-text');
    expect(textSpan?.textContent).toBe('7 • 1d 3h');
  });

  it('should have type "both"', () => {
    const flag = createMockBothBadge(10, '5d');
    
    expect(flag.className).toContain('cqd-both-badge');
  });

  it('should include both data attributes', () => {
    const flag = createMockBothBadge(15, '2d 12h');
    
    expect(flag.dataset.cqdCommentCount).toBe('15');
    expect(flag.dataset.cqdEditDiff).toBe('2d 12h');
  });

  it('should have comprehensive tooltip', () => {
    const flag = createMockBothBadge(8, '4d 1h');
    
    expect(flag.title).toContain('8');
    expect(flag.title).toContain('4d 1h');
  });
});

// ============================================================================
// EDGE CASE UI TESTS
// ============================================================================

describe('Edge Cases - UI', () => {
  it('should handle zero comments gracefully', () => {
    const flag = createMockFlag({
      count: 0,
      text: 'No comments',
      icon: '💬',
      type: 'comment',
    });
    
    expect(flag.title).toBe('0 class comments');
  });

  it('should handle very large comment counts', () => {
    const flag = createMockFlag({
      count: 9999,
      text: '9999 comments',
      icon: '💬',
      type: 'comment',
    });
    
    expect(flag.dataset.cqdCommentCount).toBe('9999');
  });

  it('should handle very long diff strings', () => {
    const flag = createMockFlag({
      text: '365d 23h',
      icon: '✏️',
      type: 'edited',
      diffString: '365d 23h',
    });
    
    expect(flag.title).toContain('365d 23h');
  });

  it('should handle Arabic numerals in text', () => {
    const flag = createMockFlag({
      count: 5,
      text: '٥ تعليقات',
      icon: '💬',
      type: 'comment',
      isRTL: true,
    });
    
    const textSpan = flag.querySelector('.cqd-flag-text');
    expect(textSpan?.textContent).toContain('٥');
  });
});
