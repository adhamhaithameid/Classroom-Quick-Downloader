export type UninstallNoteInput = {
  reason: string;
  confidenceToReinstall: string;
  urgency: string;
  selectedFeatures: string[];
  notes: string;
};

export function detectBrowserFromUserAgent(userAgent: string): string {
  const ua = String(userAgent || '').toLowerCase();
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('chrome')) return 'chrome';
  return 'unknown';
}

export function buildUninstallNotesPayload(input: UninstallNoteInput): string {
  const sections = [
    `Reason: ${input.reason}`,
    `Reinstall chance: ${input.confidenceToReinstall}`,
    `Urgency: ${input.urgency}`,
    input.selectedFeatures.length ? `Requested improvements: ${input.selectedFeatures.join(', ')}` : '',
    input.notes.trim() ? `Details: ${input.notes.trim()}` : ''
  ].filter((line) => line.length > 0);
  return sections.join('\n');
}
