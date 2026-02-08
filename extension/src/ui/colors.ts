
// Base colors - vibrant starting points for triadic harmony generation
export const BASE_COLORS = [
  '#dc2626', // Red
  '#ea580c', // Orange
  '#d97706', // Amber
  '#65a30d', // Lime
  '#16a34a', // Green
  '#059669', // Emerald
  '#0d9488', // Teal
  '#0891b2', // Cyan
  '#0284c7', // Sky
  '#2563eb', // Blue
  '#4f46e5', // Indigo
  '#7c3aed', // Violet
  '#9333ea', // Purple
  '#c026d3', // Fuchsia
  '#db2777', // Pink
  '#e11d48', // Rose
  '#78350f', // Brown
  '#1e3a8a', // Navy
  '#064e3b', // Forest
  '#7f1d1d', // Maroon
];

// LocalStorage key for persistent color assignments
export const COLOR_STORAGE_KEY = 'cqd_type_color_assignments_v2';

/**
 * Convert hex to HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 70, l: 50 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Convert HSL to hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate triadic color - rotate hue by 120° or 240° (complementary positions on color wheel)
 */
export function getTriadicColor(baseHex: string, position: number): string {
  const hsl = hexToHsl(baseHex);
  // Rotate hue by 120° * position for triadic harmony
  const newHue = (hsl.h + (120 * position)) % 360;
  return hslToHex(newHue, Math.min(hsl.s + 5, 85), Math.max(hsl.l, 40));
}

/**
 * Simple hash function to convert string to number
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Determine if a hex color is dark (needs white border) or light (needs black border)
 */
export function isColorDark(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * Calculate distance between two hex colors (simple RGB Euclidean distance)
 * Returns value between 0 (identical) and ~441 (opposite)
 */
export function getColorDistance(hex1: string, hex2: string): number {
  const c1 = hexToHsl(hex1); // Use HSL for better perceptual tracking? Actually RGB is easier for simple diff
  // Let's use RGB for distance
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);

  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);

  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

export function getStoredColorAssignments(): Record<string, string> {
  try {
    const stored = localStorage.getItem(COLOR_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveColorAssignments(assignments: Record<string, string>): void {
  try {
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(assignments));
  } catch {
    // Ignore
  }
}

/**
 * Get distinct color for a file type, ensuring no collisions with already used colors.
 * This function updates the passed 'assignments' object in place.
 *
 * @param typeId - file type ID
 * @param position - position in the list (for triadic harmony)
 * @param assignments - mutable record of all assignments
 * @param usedColors - set of already assigned colors to avoid (for visual distinctness in current view)
 */
export function resolveColorForType(
  typeId: string,
  position: number,
  assignments: Record<string, string>,
  usedColors: Set<string>
): string {

  const key = `${typeId}_pos${position}`;

  // Deterministic candidate generation
  const baseIndex = hashString(typeId) % BASE_COLORS.length;
  let baseColor = BASE_COLORS[baseIndex];
  let candidate = getTriadicColor(baseColor, position);

  // Use stored if available AND distinct enough from *others* in the current used list
  // Note: We prioritize the *stored* color if it exists, but we MUST check collision
  if (assignments[key]) {
    candidate = assignments[key];
  }

  // Conflict resolution: if candidate is too close to any used color, shift it
  // Threshold 100 is roughly "visually distinct"
  let attempts = 0;
  let isdistinct = false;

  while (!isdistinct && attempts < 20) {
    let collision = false;
    for (const used of usedColors) {
      if (getColorDistance(candidate, used) < 100) { // Collision threshold
        collision = true;
        break;
      }
    }

    if (collision) {
      // Rotate hue by 45 degrees to find a free spot
      const hsl = hexToHsl(candidate);
      candidate = hslToHex((hsl.h + 45) % 360, hsl.s, hsl.l);
      attempts++;
    } else {
      isdistinct = true;
    }
  }

  // If we still have collision after rotations (crowded), try lightening/darkening
  if (!isdistinct) {
     const hsl = hexToHsl(candidate);
     candidate = hslToHex(hsl.h, hsl.s, Math.max(20, Math.min(80, hsl.l + (attempts % 2 === 0 ? 20 : -20))));
  }

  // Update assignments in place
  assignments[key] = candidate;

  return candidate;
}
