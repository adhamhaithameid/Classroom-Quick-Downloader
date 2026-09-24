import { describe, expect, it } from 'vitest';
import {
  BRANDED_STATES,
  CURSOR_LAG_MS,
  CURSOR_SIZE_PX,
  SEEK_SELECTOR,
  clamp01,
  easeExponential,
  resolveCursorState,
  seekAngleDeg
} from './cursorStates';

function sample(overrides: Partial<Parameters<typeof resolveCursorState>[0]> = {}) {
  return {
    keyword: 'auto',
    hasDemo: false,
    isAction: false,
    isDisabled: false,
    isTextAction: false,
    isPrimary: false,
    isRingTarget: false,
    isClearer: false,
    textSelected: false,
    ...overrides
  };
}

describe('cursor constants', () => {
  it('pins the approved size and lag values', () => {
    expect(CURSOR_SIZE_PX).toBe(52);
    expect(CURSOR_LAG_MS).toBe(80);
  });

  it('seek targets cover the hero and footer primary CTAs', () => {
    expect(SEEK_SELECTOR).toContain('.l2-cta-current');
    expect(SEEK_SELECTOR).toContain('.ft-cta-primary');
    expect(SEEK_SELECTOR).toContain('[data-cursor-seek]');
  });

  it('covers the 36 keyword states plus the ring escalation state, none removed', () => {
    expect(BRANDED_STATES.has('none')).toBe(false);
    expect(BRANDED_STATES.has('cta')).toBe(true);
    expect(BRANDED_STATES.has('ring')).toBe(true);
    for (const keyword of [
      'default', 'auto', 'pointer', 'text', 'vertical-text', 'crosshair', 'cell',
      'grab', 'grabbing', 'move', 'all-scroll', 'ew-resize', 'ns-resize',
      'nwse-resize', 'nesw-resize', 'n-resize', 's-resize', 'e-resize', 'w-resize',
      'ne-resize', 'nw-resize', 'se-resize', 'sw-resize', 'col-resize',
      'row-resize', 'wait', 'progress', 'not-allowed', 'no-drop', 'copy',
      'alias', 'help', 'context-menu', 'zoom-in', 'zoom-out'
    ]) {
      expect(BRANDED_STATES.has(keyword), keyword).toBe(true);
    }
    expect(BRANDED_STATES.size).toBe(37);
  });
});

describe('resolveCursorState', () => {
  it('ambient pointer over plain content stays ambient', () => {
    expect(resolveCursorState(sample())).toBe('auto');
  });

  it('an explicit branded CSS keyword wins over action escalation (wait, grab, resize...)', () => {
    expect(resolveCursorState(sample({ keyword: 'grab', isAction: true }))).toBe('grab');
    expect(resolveCursorState(sample({ keyword: 'ew-resize', isAction: true }))).toBe('ew-resize');
    expect(resolveCursorState(sample({ keyword: 'wait' }))).toBe('wait');
  });

  it('the UA pointer keyword on links is demoted: hovering a link gives the ring state', () => {
    expect(resolveCursorState(sample({ keyword: 'pointer', isAction: true }))).toBe('ring');
    expect(resolveCursorState(sample({ keyword: 'pointer', isRingTarget: true }))).toBe('ring');
  });

  it('actions and ring targets (cards, text, media, chrome) get the ring-only state', () => {
    expect(resolveCursorState(sample({ keyword: 'default', isAction: true }))).toBe('ring');
    expect(resolveCursorState(sample({ isAction: true }))).toBe('ring');
    expect(resolveCursorState(sample({ isRingTarget: true }))).toBe('ring');
  });

  it('text actions get the text state, even though inputs are also ring targets', () => {
    expect(resolveCursorState(sample({ isAction: true, isTextAction: true, isRingTarget: true }))).toBe('text');
  });

  it('selecting text (pressed pointer, live selection) shows text, over actions too', () => {
    expect(resolveCursorState(sample({ textSelected: true }))).toBe('text');
    expect(resolveCursorState(sample({ textSelected: true, isAction: true, isRingTarget: true }))).toBe('text');
  });

  it('disabled buttons stay ambient unless a ring target surface is under the pointer', () => {
    expect(resolveCursorState(sample({ isAction: true, isDisabled: true }))).toBe('auto');
    expect(resolveCursorState(sample({ isAction: true, isDisabled: true, isRingTarget: true }))).toBe('ring');
  });

  it('explicit demo state passes through when branded, falls back to ambient otherwise', () => {
    expect(resolveCursorState(sample({ hasDemo: true, keyword: 'copy' }))).toBe('copy');
    expect(resolveCursorState(sample({ hasDemo: true, keyword: 'not-a-cursor' }))).toBe('auto');
  });

  it('unknown keywords fall back to ambient', () => {
    expect(resolveCursorState(sample({ keyword: 'unset' }))).toBe('auto');
  });
});

describe('easeExponential', () => {
  it('snaps when tau is zero (reduced motion / locked follow)', () => {
    expect(easeExponential(10, 90, 16, 0)).toBe(90);
  });

  it('closes a fixed fraction of the gap per tau of elapsed time', () => {
    const afterOneTau = easeExponential(0, 100, CURSOR_LAG_MS, CURSOR_LAG_MS);
    expect(afterOneTau).toBeCloseTo(100 * (1 - Math.exp(-1)), 5);
  });

  it('is frame-rate independent: two 8ms steps equal one 16ms step', () => {
    const stepped = easeExponential(easeExponential(0, 100, 8, 100), 100, 8, 100);
    const single = easeExponential(0, 100, 16, 100);
    expect(stepped).toBeCloseTo(single, 6);
  });

  it('clamps pathological frame gaps so the cursor never teleports past the target', () => {
    expect(easeExponential(0, 100, 5000, 100)).toBeLessThan(100);
    expect(easeExponential(0, 100, -5, 100)).toBeGreaterThanOrEqual(0);
  });
});

describe('seekAngleDeg', () => {
  it('points the down-resting arrow at the target', () => {
    expect(seekAngleDeg(0, 0, 0, -10)).toBeCloseTo(180);   /* target above */
    expect(seekAngleDeg(0, 0, 0, 10)).toBeCloseTo(0);      /* target below */
    expect(seekAngleDeg(0, 0, 10, 0)).toBeCloseTo(-90);    /* target right */
    expect(seekAngleDeg(0, 0, -10, 0)).toBeCloseTo(90);    /* target left */
  });

  it('is zero when the target sits on the pointer', () => {
    expect(seekAngleDeg(5, 5, 5, 5)).toBe(0);
  });
});

describe('clamp01', () => {
  it('clamps the progress fill input', () => {
    expect(clamp01(-0.4)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1.7)).toBe(1);
  });
});
