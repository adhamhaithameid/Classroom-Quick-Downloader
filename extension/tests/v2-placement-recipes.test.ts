// filepath: extension/tests/v2-placement-recipes.test.ts
/**
 * ============================================================================
 * V2 PLACEMENT RECIPES — Test Suite
 * ============================================================================
 *
 * Tests for the per-ViewKind placement recipe system.
 *
 * Recipes define WHERE buttons go on each type of Google Classroom page.
 * These tests verify that every ViewKind has a recipe, recipes produce
 * valid insertion points, and the convenience functions work correctly.
 *
 * @author Adham — recipes make button placement data-driven, not hardcoded
 * @since v4.0.0
 */

import { describe, it, expect } from 'vitest';
import { ViewKind } from '../src/engines/types';
import {
  getRecipe,
  getAllRecipes,
  viewSupportsAccordion,
  shouldHideWhenCollapsed,
  type PlacementRecipe,
  type InsertionPoint,
  type AnchorStrategy,
} from '../src/v2/decision/placement-recipes';

// ============================================================================
// VALID VALUES — For constraint checking
// ============================================================================

const VALID_INSERTION_POINTS: InsertionPoint[] = ['before', 'after', 'append', 'prepend'];
const VALID_ANCHOR_STRATEGIES: AnchorStrategy[] = ['header', 'file-element', 'post-root'];

// All ViewKind values that we expect recipes for
const ALL_VIEW_KINDS: ViewKind[] = [
  ViewKind.STREAM,
  ViewKind.CLASSWORK_LIST,
  ViewKind.CLASSWORK_TOPIC,
  ViewKind.ASSIGNMENT_DETAILS,
  ViewKind.MATERIAL_DETAILS,
  ViewKind.STUDENT_SUBMISSIONS,
  ViewKind.STUDENT_WORK_TEACHER,
  ViewKind.ANNOUNCEMENT_DETAIL,
  ViewKind.UNKNOWN,
];

// ============================================================================
// RECIPE REGISTRY
// ============================================================================

describe('Placement Recipes: Registry', () => {
  it('every ViewKind has a recipe', () => {
    for (const vk of ALL_VIEW_KINDS) {
      const recipe = getRecipe(vk);
      expect(recipe).toBeTruthy();
      expect(recipe.viewKind).toBe(vk);
    }
  });

  it('getAllRecipes returns all registered recipes', () => {
    const all = getAllRecipes();
    expect(all.length).toBeGreaterThanOrEqual(ALL_VIEW_KINDS.length);

    // Every ViewKind should be represented
    const viewKinds = new Set(all.map(r => r.viewKind));
    for (const vk of ALL_VIEW_KINDS) {
      expect(viewKinds.has(vk)).toBe(true);
    }
  });

  it('unknown ViewKind falls back to UNKNOWN recipe', () => {
    // Force a non-existent ViewKind — getRecipe should return UNKNOWN fallback
    const recipe = getRecipe('totally_fake_view' as ViewKind);
    expect(recipe).toBeTruthy();
    expect(recipe.viewKind).toBe(ViewKind.UNKNOWN);
  });
});

// ============================================================================
// RECIPE STRUCTURE VALIDATION
// ============================================================================

describe('Placement Recipes: Structure Validation', () => {
  it('every recipe has valid singleButton config', () => {
    for (const recipe of getAllRecipes()) {
      expect(VALID_ANCHOR_STRATEGIES).toContain(recipe.singleButton.anchorStrategy);
      expect(VALID_INSERTION_POINTS).toContain(recipe.singleButton.insertionPoint);
      expect(recipe.singleButton.minFilesForButton).toBeGreaterThanOrEqual(1);
    }
  });

  it('every recipe has valid downloadAll config', () => {
    for (const recipe of getAllRecipes()) {
      expect(VALID_ANCHOR_STRATEGIES).toContain(recipe.downloadAll.anchorStrategy);
      expect(VALID_INSERTION_POINTS).toContain(recipe.downloadAll.insertionPoint);
      expect(recipe.downloadAll.minFilesForDownloadAll).toBeGreaterThanOrEqual(2);
    }
  });

  it('accordion flags are boolean', () => {
    for (const recipe of getAllRecipes()) {
      expect(typeof recipe.supportsAccordion).toBe('boolean');
      expect(typeof recipe.hideWhenCollapsed).toBe('boolean');
    }
  });

  it('hideWhenCollapsed is only true when supportsAccordion is true', () => {
    // If accordion isn't supported, it doesn't make sense to hide when collapsed
    for (const recipe of getAllRecipes()) {
      if (recipe.hideWhenCollapsed) {
        expect(recipe.supportsAccordion).toBe(true);
      }
    }
  });
});

// ============================================================================
// SPECIFIC VIEW KIND RECIPES
// ============================================================================

describe('Placement Recipes: Stream', () => {
  it('stream uses file-element for single buttons', () => {
    const recipe = getRecipe(ViewKind.STREAM);
    expect(recipe.singleButton.anchorStrategy).toBe('file-element');
  });

  it('stream uses header for Download All', () => {
    const recipe = getRecipe(ViewKind.STREAM);
    expect(recipe.downloadAll.anchorStrategy).toBe('header');
  });

  it('stream does not support accordion', () => {
    const recipe = getRecipe(ViewKind.STREAM);
    expect(recipe.supportsAccordion).toBe(false);
  });
});

describe('Placement Recipes: Classwork List', () => {
  it('classwork list supports accordion', () => {
    const recipe = getRecipe(ViewKind.CLASSWORK_LIST);
    expect(recipe.supportsAccordion).toBe(true);
    expect(recipe.hideWhenCollapsed).toBe(true);
  });

  it('classwork list uses header for Download All', () => {
    const recipe = getRecipe(ViewKind.CLASSWORK_LIST);
    expect(recipe.downloadAll.anchorStrategy).toBe('header');
  });
});

describe('Placement Recipes: Detail Views', () => {
  it('assignment details uses file-element for single buttons', () => {
    const recipe = getRecipe(ViewKind.ASSIGNMENT_DETAILS);
    expect(recipe.singleButton.anchorStrategy).toBe('file-element');
  });

  it('material details uses file-element for single buttons', () => {
    const recipe = getRecipe(ViewKind.MATERIAL_DETAILS);
    expect(recipe.singleButton.anchorStrategy).toBe('file-element');
  });

  it('detail views do not support accordion', () => {
    expect(getRecipe(ViewKind.ASSIGNMENT_DETAILS).supportsAccordion).toBe(false);
    expect(getRecipe(ViewKind.MATERIAL_DETAILS).supportsAccordion).toBe(false);
    expect(getRecipe(ViewKind.ANNOUNCEMENT_DETAIL).supportsAccordion).toBe(false);
  });
});

describe('Placement Recipes: Student Views', () => {
  it('student submissions uses post-root for Download All', () => {
    const recipe = getRecipe(ViewKind.STUDENT_SUBMISSIONS);
    expect(recipe.downloadAll.anchorStrategy).toBe('post-root');
  });

  it('student work teacher uses header for Download All', () => {
    const recipe = getRecipe(ViewKind.STUDENT_WORK_TEACHER);
    expect(recipe.downloadAll.anchorStrategy).toBe('header');
  });
});

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

describe('Placement Recipes: Convenience Functions', () => {
  it('viewSupportsAccordion returns true only for classwork_list', () => {
    expect(viewSupportsAccordion(ViewKind.CLASSWORK_LIST)).toBe(true);
    expect(viewSupportsAccordion(ViewKind.STREAM)).toBe(false);
    expect(viewSupportsAccordion(ViewKind.ASSIGNMENT_DETAILS)).toBe(false);
    expect(viewSupportsAccordion(ViewKind.UNKNOWN)).toBe(false);
  });

  it('shouldHideWhenCollapsed returns true only for classwork_list', () => {
    expect(shouldHideWhenCollapsed(ViewKind.CLASSWORK_LIST)).toBe(true);
    expect(shouldHideWhenCollapsed(ViewKind.STREAM)).toBe(false);
    expect(shouldHideWhenCollapsed(ViewKind.CLASSWORK_TOPIC)).toBe(false);
  });
});

// ============================================================================
// DOWNLOAD ALL THRESHOLDS
// ============================================================================

describe('Placement Recipes: Download All Thresholds', () => {
  it('all recipes require at least 2 files for Download All', () => {
    for (const recipe of getAllRecipes()) {
      expect(recipe.downloadAll.minFilesForDownloadAll).toBeGreaterThanOrEqual(2);
    }
  });

  it('single button threshold is 1 for all recipes', () => {
    for (const recipe of getAllRecipes()) {
      expect(recipe.singleButton.minFilesForButton).toBe(1);
    }
  });
});
