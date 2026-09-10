import { describe, it, expect } from 'vitest';
import {
  ACTION_BUTTON_PATTERNS,
  findActionButtonPattern,
} from '../../../src/core/detect/action-buttons';

describe('core/detect/action-buttons', () => {
  it('is the union of the two historical literal tables', () => {
    const sources = new Set(ACTION_BUTTON_PATTERNS.map((p) => p.source));
    // keyword-scoring table (combined Arabic alternation form)
    for (const source of [
      'add\\s+(?:class\\s+)?comment',
      '(?:اضافة|إضافة|أضف)\\s+تعليق',
      'добавить\\s+комментарий',
      'コメントを追加',
      '添加评论',
      'ajouter.*commentaire',
      'kommentar.*hinzufügen',
      'añadir.*comentario',
      'write.*comment',
      'type.*comment',
      'post.*comment',
      'new\\s+comment',
      'leave.*comment',
    ]) {
      expect(sources.has(source), source).toBe(true);
    }
    // smart-detector's split Arabic variants are kept too
    for (const source of ['اضافة\\s+تعليق', 'إضافة\\s+تعليق', 'أضف\\s+تعليق']) {
      expect(sources.has(source), source).toBe(true);
    }
  });

  it('has no duplicate regex sources', () => {
    const sources = ACTION_BUTTON_PATTERNS.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('matches the English action buttons it exists to exclude', () => {
    expect(ACTION_BUTTON_PATTERNS.some((p) => p.test('Add class comment'))).toBe(true);
    expect(ACTION_BUTTON_PATTERNS.some((p) => p.test('Add comment'))).toBe(true);
    expect(ACTION_BUTTON_PATTERNS.some((p) => p.test('إضافة تعليق'))).toBe(true);
  });

  it('looks patterns up by source and fails loudly on a miss', () => {
    expect(findActionButtonPattern('add\\s+(?:class\\s+)?comment').test('Add comment')).toBe(true);
    expect(() => findActionButtonPattern('nonexistent.*pattern')).toThrow();
  });
});
