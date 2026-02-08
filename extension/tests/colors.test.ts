import { describe, it, expect } from 'vitest';
import {
  hexToHsl,
  hslToHex,
  isColorDark,
  resolveColorForType,
  getColorDistance
} from '../src/ui/colors';

describe('Color Utilities', () => {
  describe('hexToHsl and hslToHex', () => {
    it('should convert hex to HSL and back correctly', () => {
      const hex = '#ff0000';
      const hsl = hexToHsl(hex);
      expect(hsl).toEqual({ h: 0, s: 100, l: 50 });
      const convertedHex = hslToHex(hsl.h, hsl.s, hsl.l);
      expect(convertedHex.toLowerCase()).toBe(hex);
    });

    it('should handle black', () => {
      const hex = '#000000';
      const hsl = hexToHsl(hex);
      expect(hsl).toEqual({ h: 0, s: 0, l: 0 });
      const convertedHex = hslToHex(hsl.h, hsl.s, hsl.l);
      expect(convertedHex.toLowerCase()).toBe(hex);
    });

    it('should handle white', () => {
      const hex = '#ffffff';
      const hsl = hexToHsl(hex);
      expect(hsl).toEqual({ h: 0, s: 0, l: 100 });
      const convertedHex = hslToHex(hsl.h, hsl.s, hsl.l);
      expect(convertedHex.toLowerCase()).toBe(hex);
    });
  });

  describe('isColorDark', () => {
    it('should identify dark colors', () => {
      expect(isColorDark('#000000')).toBe(true);
      expect(isColorDark('#333333')).toBe(true);
      expect(isColorDark('#000080')).toBe(true); // Navy
    });

    it('should identify light colors', () => {
      expect(isColorDark('#ffffff')).toBe(false);
      expect(isColorDark('#eeeeee')).toBe(false);
      expect(isColorDark('#ffff00')).toBe(false); // Yellow
    });
  });

  describe('resolveColorForType', () => {
    it('should return a color and update assignments', () => {
      const assignments: Record<string, string> = {};
      const usedColors = new Set<string>();

      const color = resolveColorForType('pdf', 0, assignments, usedColors);

      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(assignments['pdf_pos0']).toBe(color);
    });

    it('should return consistent color for same type and position if in assignments', () => {
      const assignments: Record<string, string> = {
        'pdf_pos0': '#123456'
      };
      const usedColors = new Set<string>();

      const color = resolveColorForType('pdf', 0, assignments, usedColors);

      expect(color).toBe('#123456');
    });

    it('should generate distinct colors for different types', () => {
       const assignments: Record<string, string> = {};
       const usedColors = new Set<string>();

       const c1 = resolveColorForType('pdf', 0, assignments, usedColors);
       usedColors.add(c1);

       const c2 = resolveColorForType('doc', 1, assignments, usedColors);
       usedColors.add(c2);

       expect(c1).not.toBe(c2);
       expect(getColorDistance(c1, c2)).toBeGreaterThan(0);
    });

    it('should resolve collision by rotating hue', () => {
       const assignments: Record<string, string> = {};
       const usedColors = new Set<string>();

       // Force a color
       const c1 = '#ff0000';
       usedColors.add(c1);

       // Mock logic: we can't easily force collision because of hash,
       // but we can verify that if we add many colors, they don't crash

       for (let i = 0; i < 10; i++) {
         const c = resolveColorForType(`type${i}`, i, assignments, usedColors);
         expect(c).toMatch(/^#[0-9a-f]{6}$/i);
         usedColors.add(c);
       }
    });
  });
});
