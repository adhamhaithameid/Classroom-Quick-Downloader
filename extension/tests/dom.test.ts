/**
 * DOM INTEGRATION TESTS
 * 
 * Uses JSDOM to render HTML snippets and test the Smart Detector
 * against realistic Google Classroom DOM structures.
 * 
 * Key tests:
 * - Semantic Triangulation (aria-label detection when CSS classes missing)
 * - Multi-language support (RTL, CJK, Indic)
 * - Exclusion patterns (action buttons)
 * - 4-Layer Nuclear Fallback
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { detectComments } from '../entrypoints/content/smart-detector-comments';
import { detectEdited } from '../entrypoints/content/smart-detector';
import { COMMENT_TEST_CASES, EDITED_TEST_CASES, COMBINED_TEST_CASES } from './fixtures';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a mock DOM element from HTML snippet
 */
function createMockDOM(htmlSnippet: string): { document: Document; element: HTMLElement } {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${htmlSnippet}</body></html>`);
  const document = dom.window.document;
  const element = document.querySelector('[data-stream-item-id]') as HTMLElement;
  
  if (!element) {
    throw new Error('Test fixture must contain element with data-stream-item-id');
  }
  
  return { document, element };
}

/**
 * Mock getComputedStyle for JSDOM
 */
function setupJSDOM() {
  // JSDOM doesn't fully implement getComputedStyle
  // We need to ensure it returns sensible defaults
}

// ============================================================================
// COMMENT DETECTION TESTS
// ============================================================================

describe('detectComments() - DOM Integration', () => {
  beforeEach(() => {
    setupJSDOM();
  });

  describe('RTL Languages', () => {
    const rtlCases = COMMENT_TEST_CASES.filter(c => ['ar', 'he'].includes(c.language.split('-')[0]));
    
    rtlCases.forEach((testCase) => {
      it(`[${testCase.id}] ${testCase.description}`, () => {
        const { element } = createMockDOM(testCase.htmlSnippet);
        const result = detectComments(element, testCase.language);
        
        expect(result.count).toBe(testCase.expected.count);
        if (testCase.expected.count > 0) {
          expect(result.hasComments).toBe(true);
        } else {
          expect(result.hasComments).toBe(false);
        }
      }, 15000);
    });
  });

  describe('CJK Languages', () => {
    const cjkCases = COMMENT_TEST_CASES.filter(c => ['ja', 'zh', 'ko'].includes(c.language));
    
    cjkCases.forEach((testCase) => {
      it(`[${testCase.id}] ${testCase.description}`, () => {
        const { element } = createMockDOM(testCase.htmlSnippet);
        const result = detectComments(element, testCase.language);
        
        expect(result.count).toBe(testCase.expected.count);
      });
    });
  });

  describe('Indic Languages', () => {
    const indicCases = COMMENT_TEST_CASES.filter(c => ['hi', 'bn'].includes(c.language));
    
    indicCases.forEach((testCase) => {
      it(`[${testCase.id}] ${testCase.description}`, () => {
        const { element } = createMockDOM(testCase.htmlSnippet);
        const result = detectComments(element, testCase.language);
        
        expect(result.count).toBe(testCase.expected.count);
      });
    });
  });

  describe('European Languages', () => {
    const euCases = COMMENT_TEST_CASES.filter(c => 
      ['en', 'es', 'fr', 'de', 'ru'].includes(c.language)
    );
    
    euCases.forEach((testCase) => {
      it(`[${testCase.id}] ${testCase.description}`, () => {
        const { element } = createMockDOM(testCase.htmlSnippet);
        const result = detectComments(element, testCase.language);
        
        expect(result.count).toBe(testCase.expected.count);
      });
    });
  });

  describe('Joke Languages', () => {
    const jokeCases = COMMENT_TEST_CASES.filter(c => c.language.startsWith('xx-'));
    
    jokeCases.forEach((testCase) => {
      it(`[${testCase.id}] ${testCase.description}`, () => {
        const { element } = createMockDOM(testCase.htmlSnippet);
        const result = detectComments(element, testCase.language);
        
        // Joke languages fallback to English keywords
        expect(result.count).toBe(testCase.expected.count);
      });
    });
  });

  describe('Edge Cases & Exclusions', () => {
    const edgeCases = COMMENT_TEST_CASES.filter(c => c.id.startsWith('edge-'));
    
    edgeCases.forEach((testCase) => {
      it(`[${testCase.id}] ${testCase.description}`, () => {
        const { element } = createMockDOM(testCase.htmlSnippet);
        const result = detectComments(element, testCase.language);
        
        expect(result.count).toBe(testCase.expected.count);
      });
    });
  });

  describe('Semantic Triangulation (CSS-less Detection)', () => {
    it('should detect via aria-label when CSS classes are missing', () => {
      const htmlSnippet = `
        <div data-stream-item-id="semantic-1">
          <div aria-label="3 class comments">3 comments</div>
        </div>
      `;
      const { element } = createMockDOM(htmlSnippet);
      const result = detectComments(element, 'en');
      
      expect(result.hasComments).toBe(true);
      expect(result.count).toBe(3);
      expect(result.detectionLayer).toBe(1); // Layer 1 = Accessibility
    });

    it('should detect via role="button" (Layer 2)', () => {
      const htmlSnippet = `
        <div data-stream-item-id="semantic-2">
          <div role="button">5 comments</div>
        </div>
      `;
      const { element } = createMockDOM(htmlSnippet);
      const result = detectComments(element, 'en');
      
      expect(result.hasComments).toBe(true);
      expect(result.count).toBe(5);
    });

    it('should detect via title attribute', () => {
      const htmlSnippet = `
        <div data-stream-item-id="semantic-3">
          <span title="2 class comments">▼</span>
        </div>
      `;
      const { element } = createMockDOM(htmlSnippet);
      const result = detectComments(element, 'en');
      
      expect(result.hasComments).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe('4-Layer Nuclear Fallback', () => {
    it('Layer 1: Should prioritize aria-label over other layers', () => {
      const htmlSnippet = `
        <div data-stream-item-id="layer-1">
          <div aria-label="7 class comments">View comments</div>
          <span>7 comments in button</span>
        </div>
      `;
      const { element } = createMockDOM(htmlSnippet);
      const result = detectComments(element, 'en');
      
      expect(result.count).toBe(7);
      expect(result.detectionLayer).toBe(1);
    });

    it('Layer 2: Should use button heuristic when aria missing', () => {
      const htmlSnippet = `
        <div data-stream-item-id="layer-2">
          <div role="button">4 comments</div>
        </div>
      `;
      const { element } = createMockDOM(htmlSnippet);
      const result = detectComments(element, 'en');
      
      expect(result.count).toBe(4);
      expect(result.detectionLayer).toBe(2);
    });
  });
});

// ============================================================================  
// EDITED DETECTION TESTS
// ============================================================================

describe('detectEdited() - DOM Integration', () => {
  beforeEach(() => {
    setupJSDOM();
  });

  EDITED_TEST_CASES.forEach((testCase) => {
    it(`[${testCase.id}] ${testCase.description}`, () => {
      const { element } = createMockDOM(testCase.htmlSnippet);
      const result = detectEdited(element, testCase.language);
      
      expect(result.isEdited).toBe(testCase.expected.isEdited);
    });
  });

  describe('Edited Keyword Detection', () => {
    it('should detect English "(edited)"', () => {
      const htmlSnippet = `
        <div data-stream-item-id="edit-1">
          <div class="IMvYId">Jan 20, 2026 (edited)</div>
        </div>
      `;
      const { element } = createMockDOM(htmlSnippet);
      const result = detectEdited(element, 'en');
      
      expect(result.isEdited).toBe(true);
      expect(result.matchedText).toContain('edited');
    });

    it('should detect Arabic "تم تعديله"', () => {
      const htmlSnippet = `
        <div data-stream-item-id="edit-2">
          <div class="IMvYId">٢٠ يناير (تم تعديله)</div>
        </div>
      `;
      const { element } = createMockDOM(htmlSnippet);
      const result = detectEdited(element, 'ar');
      
      expect(result.isEdited).toBe(true);
    });

    it('should detect Hacker "3d1t3d"', () => {
      const htmlSnippet = `
        <div data-stream-item-id="edit-3">
          <div class="IMvYId">Jan 20 (3d1t3d)</div>
        </div>
      `;
      const { element } = createMockDOM(htmlSnippet);
      const result = detectEdited(element, 'xx-hacker');
      
      // Hacker language should still work via fallback
      expect(result.isEdited).toBe(true);
    });

    it('should NOT detect when no edited marker present', () => {
      const htmlSnippet = `
        <div data-stream-item-id="no-edit">
          <div class="IMvYId">Jan 20, 2026</div>
        </div>
      `;
      const { element } = createMockDOM(htmlSnippet);
      const result = detectEdited(element, 'en');
      
      expect(result.isEdited).toBe(false);
    });
  });
});

// ============================================================================
// COMBINED DETECTION TESTS
// ============================================================================

describe('Combined Comment + Edited Detection', () => {
  COMBINED_TEST_CASES.forEach((testCase) => {
    it(`[${testCase.id}] ${testCase.description}`, () => {
      const { element } = createMockDOM(testCase.htmlSnippet);
      
      const commentResult = detectComments(element, testCase.language);
      const editedResult = detectEdited(element, testCase.language);
      
      expect(commentResult.count).toBe(testCase.expected.count);
      expect(editedResult.isEdited).toBe(testCase.expected.isEdited);
    });
  });

  it('should handle "Both Badge" scenario', () => {
    const htmlSnippet = `
      <div data-stream-item-id="both-badge">
        <div class="IMvYId">Jan 20, 2026 (edited)</div>
        <div aria-label="10 class comments" role="button">10 comments</div>
      </div>
    `;
    const { element } = createMockDOM(htmlSnippet);
    
    const commentResult = detectComments(element, 'en');
    const editedResult = detectEdited(element, 'en');
    
    expect(commentResult.hasComments).toBe(true);
    expect(commentResult.count).toBe(10);
    expect(editedResult.isEdited).toBe(true);
    
    // Both detected = "Both Badge" should be rendered
    expect(commentResult.hasComments && editedResult.isEdited).toBe(true);
  });
});

// ============================================================================
// REGRESSION TESTS
// ============================================================================

describe('Regression Tests', () => {
  it('REGRESSION: CSS class removal should not break detection', () => {
    // Scenario: Google removes all CSS classes
    const htmlSnippet = `
      <div data-stream-item-id="regression-1">
        <div aria-label="5 class comments">View</div>
      </div>
    `;
    const { element } = createMockDOM(htmlSnippet);
    const result = detectComments(element, 'en');
    
    expect(result.hasComments).toBe(true);
    expect(result.count).toBe(5);
  });

  it('REGRESSION: Arabic word-number "واحد" should be detected', () => {
    const htmlSnippet = `
      <div data-stream-item-id="regression-2">
        <div aria-label="تعليق واحد من الصف">تعليق واحد</div>
      </div>
    `;
    const { element } = createMockDOM(htmlSnippet);
    const result = detectComments(element, 'ar');
    
    expect(result.hasComments).toBe(true);
    expect(result.count).toBe(1);
  });

  it('REGRESSION: "Add comment" button should NOT trigger false positive', () => {
    const htmlSnippet = `
      <div data-stream-item-id="regression-3">
        <button aria-label="Add class comment" role="button">Add comment</button>
      </div>
    `;
    const { element } = createMockDOM(htmlSnippet);
    const result = detectComments(element, 'en');
    
    expect(result.hasComments).toBe(false);
    expect(result.count).toBe(0);
  });

  it('REGRESSION: Unicode normalization must work for Bengali numerals', () => {
    const htmlSnippet = `
      <div data-stream-item-id="regression-4">
        <div aria-label="৫টি মন্তব্য" role="button">৫ মন্তব্য</div>
      </div>
    `;
    const { element } = createMockDOM(htmlSnippet);
    const result = detectComments(element, 'bn');
    
    expect(result.hasComments).toBe(true);
    expect(result.count).toBe(5);
  });

  it('REGRESSION: Mixed ASCII and Eastern Arabic numerals', () => {
    const htmlSnippet = `
      <div data-stream-item-id="regression-5">
        <div aria-label="٧ تعليقات" role="button">7 تعليقات</div>
      </div>
    `;
    const { element } = createMockDOM(htmlSnippet);
    const result = detectComments(element, 'ar');
    
    expect(result.hasComments).toBe(true);
    expect(result.count).toBe(7);
  });
});
