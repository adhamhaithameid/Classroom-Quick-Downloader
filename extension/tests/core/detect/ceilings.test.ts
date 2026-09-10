import { describe, it, expect } from 'vitest';
import {
  PARSER_SANITY_CEILING,
  PLAUSIBLE_COMMENT_COUNT,
} from '../../../src/core/detect/ceilings';

describe('core/detect/ceilings', () => {
  it('keeps the two bounds distinct and ordered', () => {
    expect(PARSER_SANITY_CEILING).toBe(100_000);
    expect(PLAUSIBLE_COMMENT_COUNT).toBe(10_000);
    expect(PARSER_SANITY_CEILING).toBeGreaterThan(PLAUSIBLE_COMMENT_COUNT);
  });
});
