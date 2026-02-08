import { describe, it } from 'node:test';
import assert from 'node:assert';
import { safeCompare } from '../src/utils.ts';

describe('safeCompare', () => {
  it('should return true for identical strings', () => {
    assert.strictEqual(safeCompare('secret123', 'secret123'), true);
  });

  it('should return false for different strings', () => {
    assert.strictEqual(safeCompare('secret123', 'wrong123'), false);
  });

  it('should return false for strings of different lengths', () => {
    assert.strictEqual(safeCompare('short', 'longerstring'), false);
  });

  it('should return false for empty string vs non-empty', () => {
    assert.strictEqual(safeCompare('', 'secret'), false);
  });

  it('should return true for two empty strings', () => {
    assert.strictEqual(safeCompare('', ''), true);
  });

  it('should return false for partial match', () => {
    assert.strictEqual(safeCompare('secret', 'secre'), false);
  });

  it('should return false for non-string inputs', () => {
    // @ts-expect-error Testing invalid input
    assert.strictEqual(safeCompare(null, 'secret'), false);
    // @ts-expect-error Testing invalid input
    assert.strictEqual(safeCompare('secret', undefined), false);
  });
});
