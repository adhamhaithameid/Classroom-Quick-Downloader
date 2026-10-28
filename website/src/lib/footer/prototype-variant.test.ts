import { describe, expect, it } from 'vitest';
import {
  PROTOTYPE_CURTAIN_PATH,
  PROTOTYPE_STATIC_PATH,
  resolveFooterVariant,
} from './prototype-variant';

describe('footer prototype variants (w403)', () => {
  it('maps the two prototype routes, including sub-paths', () => {
    expect(resolveFooterVariant('/prototype-footer-a')).toBe('static');
    expect(resolveFooterVariant('/prototype-footer-a/')).toBe('static');
    expect(resolveFooterVariant('/prototype-footer-b')).toBe('curtain');
    expect(resolveFooterVariant('/prototype-footer-b/x')).toBe('curtain');
  });

  it('keeps every other route on the shipped reveal', () => {
    expect(resolveFooterVariant('/')).toBe('reveal');
    expect(resolveFooterVariant('/faq')).toBe('reveal');
    expect(resolveFooterVariant('/prototype-footer-imposter')).toBe('reveal');
  });

  it('exports the canonical paths the routes live at', () => {
    expect(PROTOTYPE_STATIC_PATH).toBe('/prototype-footer-a');
    expect(PROTOTYPE_CURTAIN_PATH).toBe('/prototype-footer-b');
  });
});
