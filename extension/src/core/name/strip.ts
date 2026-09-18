// filepath: extension/src/core/name/strip.ts
/**
 * ============================================================================
 * STRIP — remove trailing type labels from filenames (D10 / S7)
 * ============================================================================
 *
 * Anchored and corroborated: a label is only removed when the remaining stem
 * still ends in a real file extension — either glued straight onto it
 * ("example.zipTömörített archívum", Classroom renders filename + localized
 * label with no separator) or after it across a space ("report.pdf Microsoft
 * Word"). A genuine file named "Design Document" has no extension before the
 * label and is left alone, in every locale.
 */

import { getTypeLabels } from './type-labels';

export function stripTrailingTypeLabel(name: string, lang?: string): string {
  const labels = getTypeLabels(lang);
  const lowerName = name.toLowerCase();

  let best: { stem: string } | null = null;
  for (const label of labels) {
    const lowerLabel = label.toLowerCase();
    if (!lowerName.endsWith(lowerLabel)) continue;
    if (lowerName.length === lowerLabel.length) continue; // stem would be empty
    const stem = name.slice(0, name.length - label.length).trim();
    if (stem.length === 0) continue;
    // Corroboration: the stem must end in a real extension.
    if (!/\.[a-zA-Z0-9]{1,10}$/.test(stem)) continue;
    if (!best || stem.length < best.stem.length) best = { stem };
  }

  return best ? best.stem : name;
}
