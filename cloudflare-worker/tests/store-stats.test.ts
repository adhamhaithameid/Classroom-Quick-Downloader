import { describe, expect, it } from 'vitest';
import {
  createEmptyStoreHealthDoc,
  evaluateScrapeHealth,
  mergeScrapeOutcomes,
  parseChromeStoreStats,
  parseEdgeDetailsStats,
  parseFirefoxAddonStats,
} from '../src/store-stats';
import type { StoreHealthDoc } from '../src/store-stats';

describe('store stats parsers', () => {
  it('parses users, rating, rating count, and version from the Chrome Web Store page', () => {
    const html = `
      <div>Education</div>1,000 users</div>
      <h2><span>4.8 out of 5<div role="img"></div></span></h2>
      <a href="#reviews"><p>25 ratings</p></a>
      <div>Version</div><div class="nBZElf">1.5.5</div>
    `;
    const stats = parseChromeStoreStats(html);
    expect(stats).not.toBeNull();
    expect(stats?.usersCount).toBe(1000);
    expect(stats?.rating).toBe('4.8');
    expect(stats?.ratingCount).toBe(25);
    expect(stats?.version).toBe('1.5.5');
  });

  it('falls back to the escaped JSON version marker and plus-suffixed user counts', () => {
    const html = '10,000+ users ... 4.5 out of 5 ... 120 ratings ... \\"version\\":\\"1.6.0\\"';
    const stats = parseChromeStoreStats(html);
    expect(stats?.usersCount).toBe(10000);
    expect(stats?.version).toBe('1.6.0');
  });

  it('returns null for a Chrome page without any stat markers', () => {
    expect(parseChromeStoreStats('<html><body>maintenance</body></html>')).toBeNull();
    expect(parseChromeStoreStats('')).toBeNull();
  });

  it('parses the Firefox AMO API payload', () => {
    const stats = parseFirefoxAddonStats({
      average_daily_users: 94,
      ratings: { average: 4.0, count: 4 },
      current_version: { version: '1.5.5' },
    });
    expect(stats).toEqual({ usersCount: 94, rating: '4.0', ratingCount: 4, version: '1.5.5' });
  });

  it('returns null for a Firefox payload without user or rating signals', () => {
    expect(parseFirefoxAddonStats({ ratings: {} })).toBeNull();
    expect(parseFirefoxAddonStats(null)).toBeNull();
  });

  it('parses the Edge product details payload', () => {
    const stats = parseEdgeDetailsStats({
      activeInstallCount: 73,
      averageRating: 5.0,
      ratingCount: 2,
      version: '1.5.5',
    });
    expect(stats).toEqual({ usersCount: 73, rating: '5.0', ratingCount: 2, version: '1.5.5' });
  });

  it('returns null for an Edge payload without numbers', () => {
    expect(parseEdgeDetailsStats({ name: 'Classroom Quick Downloader' })).toBeNull();
    expect(parseEdgeDetailsStats('unexpected')).toBeNull();
  });

  it('rejects out-of-range ratings and non-numeric versions', () => {
    const stats = parseEdgeDetailsStats({
      activeInstallCount: 10,
      averageRating: 9.9,
      ratingCount: 1,
      version: 'not-a-version',
    });
    expect(stats?.rating).toBe('');
    expect(stats?.version).toBe('');
  });
});

describe('scrape health', () => {
  const NOW = 1_800_000_000_000;

  it('merges outcomes into per-store entries with consecutive failure counts', () => {
    let doc: StoreHealthDoc = createEmptyStoreHealthDoc();
    doc = mergeScrapeOutcomes(doc, { chrome: 'fail', firefox: 'ok' }, NOW);
    doc = mergeScrapeOutcomes(doc, { chrome: 'fail', firefox: 'ok' }, NOW + 1);
    doc = mergeScrapeOutcomes(doc, { chrome: 'ok' }, NOW + 2);
    expect(doc.stores.chrome.consecutiveFailures).toBe(0);
    expect(doc.stores.chrome.lastOkAtUtc).toBe(NOW + 2);
    expect(doc.stores.firefox.consecutiveFailures).toBe(0);
    expect(doc.stores.firefox.lastOkAtUtc).toBe(NOW + 1);
    expect(doc.updatedAtUtc).toBe(NOW + 2);
  });

  it('alerts after the failure threshold is crossed', () => {
    let doc = createEmptyStoreHealthDoc();
    for (let i = 0; i < 3; i += 1) {
      doc = mergeScrapeOutcomes(doc, { chrome: 'fail' }, NOW + i);
    }
    const alerts = evaluateScrapeHealth(doc, { now: NOW, failThreshold: 3, staleOkMs: 48 * 3_600_000 });
    expect(alerts).toEqual([{ store: 'chrome', reason: 'consecutive_failures_3' }]);
  });

  it('alerts when the last successful scrape is stale (frozen numbers)', () => {
    let doc = createEmptyStoreHealthDoc();
    doc = mergeScrapeOutcomes(doc, { edge: 'ok' }, NOW - 72 * 3_600_000);
    doc = mergeScrapeOutcomes(doc, { edge: 'fail' }, NOW);
    const alerts = evaluateScrapeHealth(doc, { now: NOW, failThreshold: 3, staleOkMs: 48 * 3_600_000 });
    expect(alerts).toEqual([{ store: 'edge', reason: 'last_ok_stale_72h' }]);
  });

  it('stays quiet for healthy stores', () => {
    let doc = createEmptyStoreHealthDoc();
    doc = mergeScrapeOutcomes(doc, { chrome: 'ok', firefox: 'fail' }, NOW - 3_600_000);
    const alerts = evaluateScrapeHealth(doc, { now: NOW, failThreshold: 3, staleOkMs: 48 * 3_600_000 });
    expect(alerts).toEqual([]);
  });
});
