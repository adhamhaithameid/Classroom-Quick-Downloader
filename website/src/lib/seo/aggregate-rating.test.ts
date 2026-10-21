import { describe, expect, it } from 'vitest';
import { AGGREGATE_RATING, computeAggregateRating } from './aggregate-rating';

describe('computeAggregateRating', () => {
  it('computes the rating-count-weighted mean across stores', () => {
    const result = computeAggregateRating([
      { rating: '4.7', ratingCount: 28 },
      { rating: '4.0', ratingCount: 4 },
      { rating: '5.0', ratingCount: 3 },
    ]);
    // (4.7*28 + 4.0*4 + 5.0*3) / 35 = 162.6 / 35 = 4.6457… → "4.6"
    expect(result).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.6',
      ratingCount: 35,
      bestRating: '5',
      worstRating: '1',
    });
  });

  it('returns null when no store carries usable rating data', () => {
    expect(computeAggregateRating([])).toBeNull();
    expect(computeAggregateRating([{ rating: '', ratingCount: 0 }])).toBeNull();
    expect(computeAggregateRating([{ rating: 'n/a', ratingCount: 12 }])).toBeNull();
  });

  it('rejects out-of-range ratings and negative counts instead of emitting them', () => {
    expect(computeAggregateRating([{ rating: '9.9', ratingCount: 5 }])).toBeNull();
    expect(computeAggregateRating([{ rating: '-1', ratingCount: 5 }])).toBeNull();
    expect(computeAggregateRating([{ rating: '4.5', ratingCount: -3 }])).toBeNull();
  });

  it('ignores unusable stores but keeps usable ones in the same list', () => {
    const result = computeAggregateRating([
      { rating: '4.8', ratingCount: 20 },
      { rating: '', ratingCount: 0 },
    ]);
    expect(result?.ratingCount).toBe(20);
    expect(result?.ratingValue).toBe('4.8');
  });

  it('accepts numeric ratings as well as strings', () => {
    const result = computeAggregateRating([{ rating: 5, ratingCount: 2 }]);
    expect(result?.ratingValue).toBe('5.0');
    expect(result?.ratingCount).toBe(2);
  });
});

describe('AGGREGATE_RATING (build-time constant from the bootstrap snapshot)', () => {
  it('derives a valid aggregate from the checked-in bootstrap snapshot', () => {
    // The bootstrap file is refreshed by the monthly auto-PR; whenever it
    // carries rating data this must stay a real, in-range value.
    expect(AGGREGATE_RATING).not.toBeNull();
    expect(Number(AGGREGATE_RATING?.ratingValue)).toBeGreaterThanOrEqual(1);
    expect(Number(AGGREGATE_RATING?.ratingValue)).toBeLessThanOrEqual(5);
    expect(AGGREGATE_RATING?.ratingCount).toBeGreaterThan(0);
  });
});
