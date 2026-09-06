// filepath: extension/tests/contracts/theme.test.ts
import { describe, it, expect } from 'vitest';
import {
  KEYWORD_THEME,
  STRUCTURAL_THEME,
  THEME_ROLES,
  type Theme,
} from '../../src/contracts/theme';

const HEX = /^#[0-9a-f]{6}$/;

function roleValues(theme: Theme): string[] {
  return THEME_ROLES.map((role) => theme[role]);
}

describe('compare-mode themes', () => {
  it('uses lowercase 6-digit hex for every role', () => {
    for (const theme of [KEYWORD_THEME, STRUCTURAL_THEME]) {
      for (const role of THEME_ROLES) {
        expect(theme[role], `${theme.name}.${role}`).toMatch(HEX);
      }
    }
  });

  it('gives every role within a theme a distinct colour', () => {
    for (const theme of [KEYWORD_THEME, STRUCTURAL_THEME]) {
      const values = roleValues(theme);
      expect(new Set(values).size, `${theme.name} has a colliding role`).toBe(values.length);
    }
  });

  it('never reuses a colour for a different role across the two themes', () => {
    for (const role of THEME_ROLES) {
      for (const otherRole of THEME_ROLES) {
        if (role === otherRole) continue;
        expect(
          KEYWORD_THEME[role],
          `${role} in keyword theme collides with ${otherRole} in structural theme`,
        ).not.toBe(STRUCTURAL_THEME[otherRole]);
      }
    }
  });

  it('keeps the two themes fully distinguishable role-for-role', () => {
    for (const role of THEME_ROLES) {
      expect(KEYWORD_THEME[role], `${role} identical in both themes`).not.toBe(
        STRUCTURAL_THEME[role],
      );
    }
  });

  it('names the themes after their detector', () => {
    expect(KEYWORD_THEME.name).toBe('keyword');
    expect(STRUCTURAL_THEME.name).toBe('structural');
  });
});
