import { afterEach, describe, expect, it } from 'vitest';
import defaultPlacementsSeed from './defaultPlacements.v2.json';
import {
  clonePlacements,
  defaultPlacements,
  discardDraftPlacements,
  exportPlacementsJSON,
  importPlacementsJSON,
  loadDraftPlacements,
  loadPublishedPlacements,
  maxPlacementZIndex,
  publishPlacements,
  saveDraftPlacements
} from './placements';

class MemoryStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const SEED_APPLIED_KEY = 'cqd-element-placements:seed-applied:v2';
const CURRENT_SEED_ID = `${defaultPlacementsSeed.updatedAt}:${defaultPlacementsSeed.placements.length}`;

function withWindowStorage(storage: MemoryStorage): void {
  (globalThis as any).window = {
    localStorage: storage as unknown as Storage
  };
}

function clearWindowStorage(): void {
  (globalThis as any).window = undefined;
}

afterEach(() => {
  clearWindowStorage();
});

describe('placements import/export', () => {
  it('exports a versioned document', () => {
    const json = exportPlacementsJSON(defaultPlacements);
    const parsed = JSON.parse(json) as { version: number; placements: unknown[] };

    expect(parsed.version).toBe(2);
    expect(Array.isArray(parsed.placements)).toBe(true);
    expect(parsed.placements.length).toBeGreaterThan(0);
  });

  it('imports overview2 slot JSON and migrates to placements', () => {
    const input = {
      version: 1,
      slots: [
        {
          slotId: 'F1',
          type: 'FLOAT',
          sampleId: 'F-1-1',
          xPercent: 22.5,
          yPercent: 41.8,
          section: 'Hero'
        },
        {
          slotId: 'T2',
          type: '3D',
          sampleId: '3D-2',
          xPercent: 50,
          yPercent: 90,
          section: 'CTA'
        }
      ]
    };

    const result = importPlacementsJSON(JSON.stringify(input));

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.placements).toHaveLength(2);
    expect(result.placements[0]?.id).toBe('F1');
    expect(result.placements[0]?.type).toBe('float');
    expect(result.placements[1]?.type).toBe('3d');
    expect(result.placements[1]?.section).toBe('cta');
  });

  it('rejects invalid JSON payloads', () => {
    const result = importPlacementsJSON('{not-json');

    expect(result.ok).toBe(false);
    expect(result.placements).toHaveLength(0);
    expect(result.errors[0]).toContain('Invalid JSON');
  });

  it('sanitizes unsafe custom SVG markup', () => {
    const input = [
      {
        id: 'custom-1',
        sampleId: 'custom:test',
        type: 'doodle',
        section: 'general',
        x: 10,
        y: 10,
        size: 60,
        opacity: 0.7,
        rotate: 0,
        animDuration: 10,
        customSvg: '<script>alert(1)</script>'
      }
    ];

    const result = importPlacementsJSON(JSON.stringify(input));

    expect(result.ok).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('unsafe customSvg'))).toBe(true);
    expect(result.placements[0]?.customSvg).toBeUndefined();
  });

  it('keeps mobile-only placement overrides when importing JSON', () => {
    const input = [
      {
        id: 'mobile-1',
        sampleId: 'F-1-1',
        type: 'float',
        section: 'hero',
        x: 12,
        y: 14,
        size: 80,
        opacity: 0.1,
        rotate: 4,
        animDuration: 18,
        mobileX: 24.5,
        mobileY: 30.1,
        mobileSize: 96,
        mobileOpacity: 0.22,
        mobileRotate: -9.2,
        mobileAnimDuration: 12.6,
        mobileColor: '#22c55e',
        mobileZIndex: 14000,
        mobileHidden: true
      }
    ];

    const result = importPlacementsJSON(JSON.stringify(input));

    expect(result.ok).toBe(true);
    expect(result.placements[0]?.mobileX).toBe(24.5);
    expect(result.placements[0]?.mobileY).toBe(30.1);
    expect(result.placements[0]?.mobileSize).toBe(96);
    expect(result.placements[0]?.mobileOpacity).toBe(0.22);
    expect(result.placements[0]?.mobileRotate).toBe(-9.2);
    expect(result.placements[0]?.mobileAnimDuration).toBe(12.6);
    expect(result.placements[0]?.mobileColor).toBe('#22c55e');
    expect(result.placements[0]?.mobileZIndex).toBe(14000);
    expect(result.placements[0]?.mobileHidden).toBe(true);
  });
});

describe('placements draft/publish storage', () => {
  it('publishes and loads placements from browser storage', () => {
    const storage = new MemoryStorage();
    withWindowStorage(storage);
    storage.setItem(SEED_APPLIED_KEY, CURRENT_SEED_ID);

    const custom = clonePlacements(defaultPlacements).slice(0, 2).map((placement, index) => ({
      ...placement,
      id: `x-${index + 1}`,
      zIndex: index + 10
    }));

    publishPlacements(custom);
    const loaded = loadPublishedPlacements();

    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.id).toBe('x-1');
    expect(maxPlacementZIndex(loaded)).toBe(11);
  });

  it('loads draft from published when draft is absent and can discard draft changes', () => {
    const storage = new MemoryStorage();
    withWindowStorage(storage);
    storage.setItem(SEED_APPLIED_KEY, CURRENT_SEED_ID);

    const published = publishPlacements(clonePlacements(defaultPlacements).slice(0, 1));
    const draft = loadDraftPlacements(published);
    expect(draft).toHaveLength(1);

    const draftItem = draft[0];
    if (!draftItem) throw new Error('draft item missing');
    const changedDraft = [{ ...draftItem, id: 'draft-override' }];
    saveDraftPlacements(changedDraft);

    const reverted = discardDraftPlacements(published);
    expect(reverted[0]?.id).toBe(published[0]?.id);
  });

  it('migrates legacy placement array key to published model', () => {
    const storage = new MemoryStorage();
    withWindowStorage(storage);
    storage.setItem(SEED_APPLIED_KEY, CURRENT_SEED_ID);

    storage.setItem(
      'cqd-element-placements',
      JSON.stringify([
        {
          id: 'legacy-1',
          sampleId: 'F-1-1',
          type: 'float',
          section: 'hero',
          x: 10,
          y: 10,
          size: 80,
          opacity: 0.1,
          rotate: 0,
          animDuration: 20
        }
      ])
    );

    const loaded = loadPublishedPlacements();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe('legacy-1');
  });
});
