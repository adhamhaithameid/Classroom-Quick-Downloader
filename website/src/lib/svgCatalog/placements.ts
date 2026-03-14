/**
 * Element placement model for overview decorative assets.
 * Supports a safe draft -> publish workflow and schema migration.
 */

import { categories as svgCategories, doodleItems, threeDElements } from './index';
import defaultPlacementsSeed from './defaultPlacements.v2.json';

export type PlacementType = 'float' | 'doodle' | '3d';

export type PlacementSection =
  | 'hero'
  | 'students'
  | 'problem'
  | 'features'
  | 'steps'
  | 'proof'
  | 'map'
  | 'cta'
  | 'general';

export interface ElementPlacement {
  id: string;
  /** Catalog item ID (e.g. 'F-1-1') or 'custom:xxx' for inline SVGs */
  sampleId: string;
  type: PlacementType;
  section: PlacementSection;
  /** Percent-based x from left (-25..125 allowed for bleed) */
  x: number;
  /** Percent-based y from top of entire page (-25..125 allowed for bleed) */
  y: number;
  /** Optional mobile-only x override in percent (-25..125) */
  mobileX?: number;
  /** Optional mobile-only y override in percent (-25..125) */
  mobileY?: number;
  /** Pixel width */
  size: number;
  /** Optional mobile-only size override in px */
  mobileSize?: number;
  /** 0..1 */
  opacity: number;
  /** Optional mobile-only opacity override (0..1) */
  mobileOpacity?: number;
  /** Degrees */
  rotate: number;
  /** Optional mobile-only rotation override (deg) */
  mobileRotate?: number;
  /** Animation speed in seconds (0 disables animation) */
  animDuration: number;
  /** Optional mobile-only animation duration override in seconds */
  mobileAnimDuration?: number;
  /** Paint color used as currentColor */
  color?: string;
  /** Optional mobile-only color override */
  mobileColor?: string;
  /** Layer order */
  zIndex?: number;
  /** Optional mobile-only z-index override */
  mobileZIndex?: number;
  /** Hidden but still kept in config */
  hidden?: boolean;
  /** Optional mobile-only visibility override */
  mobileHidden?: boolean;
  /** Locked against drag edits */
  locked?: boolean;
  /** Custom inline SVG markup (used when sampleId starts with 'custom:') */
  customSvg?: string;
  /** SVG viewBox (default '0 0 64 64') */
  viewBox?: string;
}

interface PlacementDocumentV2 {
  version: 2;
  updatedAt: string;
  placements: ElementPlacement[];
}

export interface PlacementImportResult {
  ok: boolean;
  placements: ElementPlacement[];
  errors: string[];
  warnings: string[];
}

const STORAGE_KEY_LEGACY = 'cqd-element-placements';
const STORAGE_KEY_PUBLISHED = 'cqd-element-placements:published:v2';
const STORAGE_KEY_DRAFT = 'cqd-element-placements:draft:v2';
const STORAGE_KEY_SEED_APPLIED = 'cqd-element-placements:seed-applied:v2';

const DOC_VERSION = 2;
const CURRENT_DEFAULT_SEED_ID = `${defaultPlacementsSeed.updatedAt}:${defaultPlacementsSeed.placements.length}`;
const MIN_XY = -25;
const MAX_XY = 125;
const MIN_SIZE = 16;
const MAX_SIZE = 640;
const MAX_PLACEMENTS = 400;
const MIN_ANIM = 0;
const MAX_ANIM = 120;
const MIN_ROTATE = -360;
const MAX_ROTATE = 360;
const MAX_Z_INDEX = 30000;

const SECTION_VALUES: PlacementSection[] = [
  'hero',
  'students',
  'problem',
  'features',
  'steps',
  'proof',
  'map',
  'cta',
  'general'
];

const TYPE_VALUES: PlacementType[] = ['float', 'doodle', '3d'];

/** Built-in inline SVGs for semantic defaults and legacy mappings. */
const builtinSvgs: Record<string, { svg: string; viewBox: string }> = {
  'builtin:download-arrow': {
    viewBox: '0 0 64 64',
    svg: '<path d="M32 8v32"/><path d="M20 30l12 12 12-12"/><rect x="12" y="48" width="40" height="6" rx="2"/>'
  },
  'builtin:browser-puzzle': {
    viewBox: '0 0 64 64',
    svg: '<rect x="6" y="10" width="52" height="44" rx="4"/><line x1="6" y1="22" x2="58" y2="22"/><circle cx="14" cy="16" r="2"/><circle cx="22" cy="16" r="2"/><circle cx="30" cy="16" r="2"/><path d="M40 34h6v-4a3 3 0 0 1 6 0v4h6v6h-4a3 3 0 0 0 0 6h4v6H40V34z"/>'
  },
  'builtin:clock-forward': {
    viewBox: '0 0 64 64',
    svg: '<circle cx="28" cy="32" r="20"/><path d="M28 18v14l10 6"/><path d="M52 22l6 4-6 4"/><path d="M56 26l6 4-6 4"/>'
  },
  'builtin:stacked-files': {
    viewBox: '0 0 64 64',
    svg: '<rect x="10" y="8" width="32" height="40" rx="3"/><rect x="16" y="14" width="32" height="40" rx="3"/><line x1="22" y1="26" x2="42" y2="26"/><line x1="22" y1="34" x2="38" y2="34"/><line x1="22" y1="42" x2="34" y2="42"/><circle cx="50" cy="16" r="8"/><path d="M46 16l3 3 6-6"/>'
  },
  'builtin:split-screen': {
    viewBox: '0 0 64 64',
    svg: '<rect x="4" y="8" width="24" height="48" rx="3"/><rect x="36" y="8" width="24" height="48" rx="3"/><path d="M10 28l12 12M22 28L10 40"/><path d="M42 30l5 5 10-10"/>'
  },
  'builtin:shield-lock': {
    viewBox: '0 0 64 64',
    svg: '<path d="M32 6L10 16v16c0 16 22 24 22 24s22-8 22-24V16L32 6z"/><rect x="25" y="28" width="14" height="12" rx="2"/><path d="M28 28v-4a4 4 0 0 1 8 0v4"/><circle cx="32" cy="34" r="1.5"/>'
  },
  'builtin:code-brackets': {
    viewBox: '0 0 64 64',
    svg: '<path d="M22 14L6 32l16 18"/><path d="M42 14l16 18-16 18"/><line x1="36" y1="10" x2="28" y2="54"/>'
  },
  'builtin:globe-pins': {
    viewBox: '0 0 64 64',
    svg: '<circle cx="32" cy="32" r="24"/><ellipse cx="32" cy="32" rx="10" ry="24"/><path d="M8 32h48"/><path d="M12 18h40"/><path d="M12 46h40"/><circle cx="42" cy="18" r="4" fill="currentColor" opacity="0.15"/><circle cx="22" cy="40" r="3" fill="currentColor" opacity="0.15"/>'
  },
  'builtin:grad-cap': {
    viewBox: '0 0 64 64',
    svg: '<path d="M32 10L4 26l28 16 28-16L32 10z"/><path d="M16 34v14c0 4 16 8 16 8s16-4 16-8V34"/><line x1="56" y1="26" x2="56" y2="48"/><circle cx="56" cy="50" r="2"/>'
  },
  'builtin:rocket': {
    viewBox: '0 0 64 64',
    svg: '<path d="M32 4c-6 12-10 28-10 40h20c0-12-4-28-10-40z"/><path d="M22 44l-6 14h6z"/><path d="M42 44l6 14h-6z"/><circle cx="32" cy="28" r="4"/><path d="M28 58q4 4 8 0"/><circle cx="32" cy="62" r="1"/>'
  },
  'builtin:doodle-hero-files': {
    viewBox: '0 0 80 80',
    svg: '<rect x="10" y="20" width="24" height="30" rx="2" stroke="var(--green)" stroke-width="1.5" opacity="0.18"/><rect x="18" y="12" width="24" height="30" rx="2" stroke="var(--green)" stroke-width="1.5" opacity="0.14"/><rect x="26" y="4" width="24" height="30" rx="2" stroke="var(--green)" stroke-width="1.5" opacity="0.10"/><path d="M20 58v12h40V58" stroke="var(--green)" stroke-width="1.5" opacity="0.15" stroke-linecap="round"/><path d="M40 42v16" stroke="var(--green)" stroke-width="1.5" opacity="0.15" stroke-linecap="round"/><path d="M34 52l6 6 6-6" stroke="var(--green)" stroke-width="1.5" opacity="0.15" stroke-linecap="round" stroke-linejoin="round"/>'
  },
  'builtin:doodle-hero-browser': {
    viewBox: '0 0 70 70',
    svg: '<rect x="8" y="14" width="54" height="38" rx="4" stroke="var(--green)" stroke-width="1.5" opacity="0.15"/><line x1="8" y1="24" x2="62" y2="24" stroke="var(--green)" stroke-width="1" opacity="0.12"/><circle cx="16" cy="19" r="2" stroke="var(--green)" stroke-width="1" opacity="0.12"/><circle cx="23" cy="19" r="2" stroke="var(--green)" stroke-width="1" opacity="0.12"/><circle cx="30" cy="19" r="2" stroke="var(--green)" stroke-width="1" opacity="0.12"/><path d="M24 36h22M24 42h14" stroke="var(--green)" stroke-width="1" opacity="0.10" stroke-linecap="round"/>'
  }
};

const ALL_SAMPLE_IDS = new Set<string>([
  ...Object.keys(builtinSvgs),
  ...svgCategories.flatMap((category) => category.items.map((item) => item.id)),
  ...doodleItems.map((item) => item.id),
  ...threeDElements.map((item) => item.id)
]);

const DEFAULT_Z_BASE = 12000;

function withHighDefaultZIndex(placements: ElementPlacement[]): ElementPlacement[] {
  return placements.map((placement, index) => ({
    ...placement,
    zIndex: (() => {
      const raw = typeof placement.zIndex === 'number' ? Math.max(0, Math.round(placement.zIndex)) : index;
      return raw >= DEFAULT_Z_BASE ? raw : DEFAULT_Z_BASE + raw;
    })()
  }));
}

/** Default placements used for fresh installs and hard reset.
 * Visual identity guard: maintain float + doodle + 3d mix and pinned star.
 * Guard assertions live in src/routes/overview.visual-guard.test.ts.
 */
export const defaultPlacements: ElementPlacement[] = withHighDefaultZIndex(
  defaultPlacementsSeed.placements as ElementPlacement[]
);

let nextId = 100;

/** Look up a builtin SVG by sampleId. */
export function getBuiltinSvg(sampleId: string): { svg: string; viewBox: string } | null {
  return builtinSvgs[sampleId] ?? null;
}

/** Generate a unique element ID. */
export function genPlacementId(type: PlacementType): string {
  const prefix = type === 'float' ? 'fs' : type === 'doodle' ? 'dd' : 'td';
  return `${prefix}-${Date.now()}-${nextId++}`;
}

export function maxPlacementZIndex(placements: ElementPlacement[]): number {
  let max = 0;
  for (const placement of placements) {
    if (typeof placement.zIndex === 'number' && Number.isFinite(placement.zIndex)) {
      max = Math.max(max, Math.round(placement.zIndex));
    }
  }
  return max;
}

export function clonePlacements(placements: ElementPlacement[]): ElementPlacement[] {
  return placements.map((placement) => ({ ...placement }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function sanitizeId(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 72);
}

function parseType(value: unknown): PlacementType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (TYPE_VALUES.includes(normalized as PlacementType)) return normalized as PlacementType;
  if (normalized === 'float' || normalized === 'floating') return 'float';
  if (normalized === 'doodle' || normalized === 'draw') return 'doodle';
  if (normalized === '3d' || normalized === '3-d' || normalized === 'three-d' || normalized === 'threed') return '3d';
  return null;
}

function parseSection(value: unknown): PlacementSection {
  if (typeof value !== 'string') return 'general';
  const normalized = value.trim().toLowerCase();
  if (SECTION_VALUES.includes(normalized as PlacementSection)) {
    return normalized as PlacementSection;
  }
  return 'general';
}

function parseColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > 64) return undefined;
  if (/[;<>]/.test(normalized)) return undefined;
  return normalized;
}

function parseViewBox(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (!/^-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?$/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function isSafeSvgMarkup(svg: string): boolean {
  const normalized = svg.toLowerCase();
  if (normalized.includes('<script')) return false;
  if (normalized.includes('<foreignobject')) return false;
  if (normalized.includes('<iframe')) return false;
  if (/on[a-z]+\s*=/.test(normalized)) return false;
  if (normalized.includes('javascript:')) return false;
  return true;
}

function fallbackSampleForType(type: PlacementType): string {
  if (type === 'float') return 'F-1-1';
  if (type === 'doodle') return doodleItems[0]?.id || 'D-1';
  return threeDElements[0]?.id || '3D-1';
}

function sortByZIndex(placements: ElementPlacement[]): ElementPlacement[] {
  return [...placements].sort((a, b) => {
    const az = a.zIndex ?? 0;
    const bz = b.zIndex ?? 0;
    if (az !== bz) return az - bz;
    return a.id.localeCompare(b.id);
  });
}

function normalizePlacementArray(rawPlacements: unknown): PlacementImportResult {
  if (!Array.isArray(rawPlacements)) {
    return {
      ok: false,
      placements: [],
      errors: ['Expected an array of placements.'],
      warnings: []
    };
  }

  if (rawPlacements.length > MAX_PLACEMENTS) {
    return {
      ok: false,
      placements: [],
      errors: [`Too many placements: ${rawPlacements.length}. Limit is ${MAX_PLACEMENTS}.`],
      warnings: []
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const usedIds = new Set<string>();

  const placements: ElementPlacement[] = rawPlacements.map((raw, index) => {
    const fallbackType: PlacementType = 'float';

    let type: PlacementType = fallbackType;
    if (isRecord(raw)) {
      const parsedType = parseType(raw.type);
      if (parsedType) {
        type = parsedType;
      } else if (raw.type !== undefined) {
        warnings.push(`Placement #${index + 1}: unknown type '${String(raw.type)}', falling back to '${fallbackType}'.`);
      }
    } else {
      errors.push(`Placement #${index + 1}: invalid object.`);
      return {
        id: genPlacementId(fallbackType),
        sampleId: fallbackSampleForType(fallbackType),
        type: fallbackType,
        section: 'general',
        x: 50,
        y: 50,
        size: 72,
        opacity: 0.6,
        rotate: 0,
        animDuration: 12,
        zIndex: index
      };
    }

    const idCandidate = sanitizeId(raw.id);
    let id = idCandidate || genPlacementId(type);
    if (!idCandidate) {
      warnings.push(`Placement #${index + 1}: missing/invalid id, generated '${id}'.`);
    }
    if (usedIds.has(id)) {
      const deduped = `${id}-${index + 1}`;
      warnings.push(`Placement #${index + 1}: duplicate id '${id}', renamed to '${deduped}'.`);
      id = deduped;
    }
    usedIds.add(id);

    let sampleId = typeof raw.sampleId === 'string' ? raw.sampleId.trim() : '';
    const customSvg = typeof raw.customSvg === 'string' ? raw.customSvg.trim() : undefined;
    if (!sampleId) {
      sampleId = fallbackSampleForType(type);
      warnings.push(`Placement '${id}': sampleId missing, defaulted to '${sampleId}'.`);
    }

    if (!ALL_SAMPLE_IDS.has(sampleId) && !sampleId.startsWith('custom:')) {
      if (customSvg) {
        sampleId = sampleId.startsWith('custom:') ? sampleId : `custom:${id}`;
      } else {
        const fallbackSample = fallbackSampleForType(type);
        warnings.push(`Placement '${id}': unknown sample '${sampleId}', defaulted to '${fallbackSample}'.`);
        sampleId = fallbackSample;
      }
    }

    let safeCustomSvg: string | undefined;
    if (customSvg) {
      if (isSafeSvgMarkup(customSvg)) {
        safeCustomSvg = customSvg;
      } else {
        warnings.push(`Placement '${id}': unsafe customSvg removed.`);
      }
    }

    const viewBox = parseViewBox(raw.viewBox);
    if (raw.viewBox !== undefined && !viewBox) {
      warnings.push(`Placement '${id}': invalid viewBox ignored.`);
    }

    return {
      id,
      sampleId,
      type,
      section: parseSection(raw.section),
      x: Number(clamp(parseNumber(raw.x, 50), MIN_XY, MAX_XY).toFixed(2)),
      y: Number(clamp(parseNumber(raw.y, 50), MIN_XY, MAX_XY).toFixed(2)),
      mobileX:
        raw.mobileX === undefined ? undefined : Number(clamp(parseNumber(raw.mobileX, 50), MIN_XY, MAX_XY).toFixed(2)),
      mobileY:
        raw.mobileY === undefined ? undefined : Number(clamp(parseNumber(raw.mobileY, 50), MIN_XY, MAX_XY).toFixed(2)),
      size: Math.round(clamp(parseNumber(raw.size, type === '3d' ? 120 : 72), MIN_SIZE, MAX_SIZE)),
      mobileSize:
        raw.mobileSize === undefined
          ? undefined
          : Math.round(clamp(parseNumber(raw.mobileSize, type === '3d' ? 120 : 72), MIN_SIZE, MAX_SIZE)),
      opacity: Number(clamp(parseNumber(raw.opacity, type === 'float' ? 0.06 : 0.7), 0, 1).toFixed(3)),
      mobileOpacity:
        raw.mobileOpacity === undefined
          ? undefined
          : Number(clamp(parseNumber(raw.mobileOpacity, type === 'float' ? 0.06 : 0.7), 0, 1).toFixed(3)),
      rotate: Number(clamp(parseNumber(raw.rotate, 0), MIN_ROTATE, MAX_ROTATE).toFixed(2)),
      mobileRotate:
        raw.mobileRotate === undefined
          ? undefined
          : Number(clamp(parseNumber(raw.mobileRotate, 0), MIN_ROTATE, MAX_ROTATE).toFixed(2)),
      animDuration: Number(clamp(parseNumber(raw.animDuration, 14), MIN_ANIM, MAX_ANIM).toFixed(2)),
      mobileAnimDuration:
        raw.mobileAnimDuration === undefined
          ? undefined
          : Number(clamp(parseNumber(raw.mobileAnimDuration, 14), MIN_ANIM, MAX_ANIM).toFixed(2)),
      color: parseColor(raw.color),
      mobileColor: parseColor(raw.mobileColor),
      zIndex: Math.round(clamp(parseNumber(raw.zIndex, index), 0, MAX_Z_INDEX)),
      mobileZIndex:
        raw.mobileZIndex === undefined
          ? undefined
          : Math.round(clamp(parseNumber(raw.mobileZIndex, index), 0, MAX_Z_INDEX)),
      hidden: Boolean(raw.hidden),
      mobileHidden: raw.mobileHidden === undefined ? undefined : Boolean(raw.mobileHidden),
      locked: Boolean(raw.locked),
      customSvg: safeCustomSvg,
      viewBox
    };
  });

  if (errors.length > 0) {
    return { ok: false, placements: [], errors, warnings };
  }

  return {
    ok: true,
    placements: sortByZIndex(placements),
    errors,
    warnings
  };
}

function overview2TypeToPlacementType(value: unknown): PlacementType {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'DOODLE') return 'doodle';
  if (raw === '3D') return '3d';
  return 'float';
}

function extractPlacementsLike(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload;

  if (!isRecord(payload)) return null;

  if (Array.isArray(payload.placements)) {
    return payload.placements;
  }

  // Import from overview2 prototype format
  if (Array.isArray(payload.slots)) {
    return payload.slots.map((slot, index) => {
      if (!isRecord(slot)) return slot;
      const type = overview2TypeToPlacementType(slot.type);
      const xPercent = parseNumber(slot.xPercent, NaN);
      const yPercent = parseNumber(slot.yPercent, NaN);
      const xPixel = parseNumber(slot.x, 0);
      const yPixel = parseNumber(slot.y, 0);

      const normalizedX = Number.isFinite(xPercent) ? xPercent : (xPixel / 1300) * 100;
      const normalizedY = Number.isFinite(yPercent) ? yPercent : (yPixel / 6000) * 100;

      return {
        id: slot.slotId ?? slot.id ?? `slot-${index + 1}`,
        sampleId: slot.sampleId ?? fallbackSampleForType(type),
        type,
        section: slot.section ?? 'general',
        x: normalizedX,
        y: normalizedY,
        size: type === '3d' ? 110 : 72,
        opacity: type === 'float' ? 0.08 : 0.7,
        rotate: 0,
        animDuration: 14,
        zIndex: index
      };
    });
  }

  return null;
}

function normalizeUnknownPayload(payload: unknown): PlacementImportResult {
  const extracted = extractPlacementsLike(payload);
  if (!extracted) {
    return {
      ok: false,
      placements: [],
      errors: ['JSON must be either a placements array, a { placements } document, or an overview2 { slots } document.'],
      warnings: []
    };
  }

  return normalizePlacementArray(extracted);
}

function storageGet(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storageSet(key: string, placements: ElementPlacement[]): void {
  if (typeof window === 'undefined') return;
  const doc: PlacementDocumentV2 = {
    version: DOC_VERSION,
    updatedAt: new Date().toISOString(),
    placements: sortByZIndex(clonePlacements(placements))
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(doc));
  } catch {
    // Best effort only
  }
}

function storageRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best effort only
  }
}

function ensureDefaultSeedApplied(): void {
  if (typeof window === 'undefined') return;
  try {
    const appliedSeed = window.localStorage.getItem(STORAGE_KEY_SEED_APPLIED);
    if (appliedSeed === CURRENT_DEFAULT_SEED_ID) return;

    storageSet(STORAGE_KEY_PUBLISHED, defaultPlacements);
    storageSet(STORAGE_KEY_DRAFT, defaultPlacements);
    window.localStorage.setItem(STORAGE_KEY_SEED_APPLIED, CURRENT_DEFAULT_SEED_ID);
  } catch {
    // Best effort only
  }
}

function loadFromKey(key: string): ElementPlacement[] | null {
  const payload = storageGet(key);
  if (!payload) return null;
  const normalized = normalizeUnknownPayload(payload);
  if (!normalized.ok || normalized.placements.length === 0) return null;
  return normalized.placements;
}

function migrateLegacyToPublished(): ElementPlacement[] | null {
  const payload = storageGet(STORAGE_KEY_LEGACY);
  if (!payload) return null;
  const normalized = normalizeUnknownPayload(payload);
  if (!normalized.ok || normalized.placements.length === 0) return null;
  storageSet(STORAGE_KEY_PUBLISHED, normalized.placements);
  return normalized.placements;
}

/** Returns published placements (used by non-edit overview). */
export function loadPublishedPlacements(): ElementPlacement[] {
  ensureDefaultSeedApplied();

  const fromPublished = loadFromKey(STORAGE_KEY_PUBLISHED);
  if (fromPublished && fromPublished.length > 0) return fromPublished;

  const migrated = migrateLegacyToPublished();
  if (migrated && migrated.length > 0) return migrated;

  return clonePlacements(defaultPlacements);
}

/** Loads draft placements, defaulting to published placements. */
export function loadDraftPlacements(publishedFallback?: ElementPlacement[]): ElementPlacement[] {
  const fromDraft = loadFromKey(STORAGE_KEY_DRAFT);
  if (fromDraft && fromDraft.length > 0) return fromDraft;

  const fallback = publishedFallback && publishedFallback.length > 0
    ? clonePlacements(publishedFallback)
    : loadPublishedPlacements();

  storageSet(STORAGE_KEY_DRAFT, fallback);
  return fallback;
}

/** Saves draft placements only (safe staging). */
export function saveDraftPlacements(placements: ElementPlacement[]): void {
  const normalized = normalizePlacementArray(placements);
  if (!normalized.ok) return;
  storageSet(STORAGE_KEY_DRAFT, normalized.placements);
}

/** Publish draft placements to the live dataset used by /overview. */
export function publishPlacements(placements: ElementPlacement[]): ElementPlacement[] {
  const normalized = normalizePlacementArray(placements);
  if (!normalized.ok || normalized.placements.length === 0) {
    return loadPublishedPlacements();
  }

  storageSet(STORAGE_KEY_PUBLISHED, normalized.placements);
  storageSet(STORAGE_KEY_DRAFT, normalized.placements);
  return clonePlacements(normalized.placements);
}

/** Discard draft and reset it to the currently published placements. */
export function discardDraftPlacements(published?: ElementPlacement[]): ElementPlacement[] {
  storageRemove(STORAGE_KEY_DRAFT);
  const fallback = published && published.length > 0 ? clonePlacements(published) : loadPublishedPlacements();
  storageSet(STORAGE_KEY_DRAFT, fallback);
  return fallback;
}

/** Reset published and draft placements to code defaults. */
export function resetAllPlacementsToDefault(): ElementPlacement[] {
  const defaults = clonePlacements(defaultPlacements);
  storageSet(STORAGE_KEY_PUBLISHED, defaults);
  storageSet(STORAGE_KEY_DRAFT, defaults);
  storageRemove(STORAGE_KEY_LEGACY);
  return defaults;
}

/** Legacy API: loads published placements. */
export function loadPlacements(): ElementPlacement[] {
  return loadPublishedPlacements();
}

/** Legacy API: writes to published placements. */
export function savePlacements(placements: ElementPlacement[]): void {
  publishPlacements(placements);
}

/** Legacy API: resets both published and draft placements. */
export function resetPlacements(): ElementPlacement[] {
  return resetAllPlacementsToDefault();
}

/** Export placements as a versioned JSON document. */
export function exportPlacementsJSON(placements: ElementPlacement[]): string {
  const normalized = normalizePlacementArray(placements);
  const safePlacements = normalized.ok ? normalized.placements : clonePlacements(defaultPlacements);
  const doc: PlacementDocumentV2 = {
    version: DOC_VERSION,
    updatedAt: new Date().toISOString(),
    placements: safePlacements
  };
  return JSON.stringify(doc, null, 2);
}

/** Import placements from JSON with strict validation and migration support. */
export function importPlacementsJSON(json: string): PlacementImportResult {
  if (!json || !json.trim()) {
    return {
      ok: false,
      placements: [],
      errors: ['Import JSON is empty.'],
      warnings: []
    };
  }

  try {
    const parsed = JSON.parse(json);
    return normalizeUnknownPayload(parsed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown parse error.';
    return {
      ok: false,
      placements: [],
      errors: [`Invalid JSON: ${detail}`],
      warnings: []
    };
  }
}
