function normalizeHex(value: string): string {
  const clean = value.trim().replace('#', '');
  if (clean.length === 3) return clean.split('').map((char) => `${char}${char}`).join('');
  return clean.padStart(6, '0').slice(0, 6);
}

function parseHex(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex);
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16)
  ];
}

export function blendHex(hex: string, target: string, ratio: number): string {
  const [r1, g1, b1] = parseHex(hex);
  const [r2, g2, b2] = parseHex(target);
  const weight = Math.max(0, Math.min(1, ratio));
  const mix = (a: number, b: number): number => Math.round(a + (b - a) * weight);
  const toHex = (value: number): string => value.toString(16).padStart(2, '0');
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`;
}

export interface BalloonPaletteColors {
  color: string;
  accentColor: string;
  shadowColor: string;
  stringColor: string;
}

export function deriveBalloonPalette(baseColor: string): BalloonPaletteColors {
  return {
    color: baseColor,
    accentColor: blendHex(baseColor, '#ffffff', 0.34),
    shadowColor: blendHex(baseColor, '#000000', 0.22),
    stringColor: blendHex(baseColor, '#334155', 0.56)
  };
}
