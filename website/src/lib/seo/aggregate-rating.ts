/**
 * ============================================================================
 * AGGREGATE RATING — real store ratings as schema.org JSON-LD (bead 6dq)
 * ============================================================================
 *
 * Google will only show review stars when the aggregateRating on the
 * SoftwareApplication node carries REAL, current numbers. Fabricated or
 * stale-by-hand values risk a manual action, so the numbers come from the
 * checked-in bootstrap snapshot (website/static/data/bootstrap-snapshot.json)
 * — the same store-scrape data the dashboard shows, refreshed monthly by the
 * bootstrap-refresh auto-PR. The aggregate is the rating-count-weighted mean
 * across Chrome, Firefox and Edge.
 */

interface StoreRatingInput {
  rating?: unknown;
  ratingCount?: unknown;
}

export interface AggregateRatingNode {
  '@type': 'AggregateRating';
  ratingValue: string;
  ratingCount: number;
  bestRating: string;
  worstRating: string;
}

function toRatingValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) return null;
  return parsed;
}

function toCountValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Weighted mean of the per-store ratings, weighted by each store's rating
 * count. Returns null unless at least one store carries an in-range rating
 * with a usable count — the node is omitted from the JSON-LD otherwise.
 */
export function computeAggregateRating(
  stores: readonly StoreRatingInput[],
): AggregateRatingNode | null {
  let weightedSum = 0;
  let totalCount = 0;

  for (const store of stores) {
    const rating = toRatingValue(store.rating);
    const count = toCountValue(store.ratingCount);
    if (rating === null || count === null || count === 0) continue;
    weightedSum += rating * count;
    totalCount += count;
  }

  if (totalCount === 0) return null;
  return {
    '@type': 'AggregateRating',
    ratingValue: (weightedSum / totalCount).toFixed(1),
    ratingCount: totalCount,
    bestRating: '5',
    worstRating: '1',
  };
}

/**
 * Build-time constant. The bootstrap snapshot only ever grows its numbers
 * (the generator refuses to shrink them), so this stays current via the
 * monthly auto-PR without any manual step.
 */
import bootstrapSnapshot from '../../../static/data/bootstrap-snapshot.json';

const bootstrapBrowsers = (
  bootstrapSnapshot as {
    overview?: { installs?: { browsers?: StoreRatingInput[] } };
  }
)?.overview?.installs?.browsers;

export const AGGREGATE_RATING: AggregateRatingNode | null =
  computeAggregateRating(bootstrapBrowsers ?? []);
