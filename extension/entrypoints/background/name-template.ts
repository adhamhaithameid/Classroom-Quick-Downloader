// filepath: extension/entrypoints/background/name-template.ts
/**
 * ============================================================================
 * BACKGROUND NAME TEMPLATE — cached settings read + suggestion composition
 * (bead 0h4d.3.1)
 * ============================================================================
 *
 * The onDeterminingFilename listener must call suggest() synchronously, so
 * the template lives in a module-level cache kept fresh by a
 * storage.onChanged watcher (started once with the background). A missed
 * change costs at most one download with the previous template.
 *
 * Render path: composeSuggestedFilename produces the flat base name exactly
 * as before; when a template is active the base becomes the {filename} part
 * and the template supplies the folder shape. Every dynamic segment is
 * hardened per-segment inside renderNamingTemplate (templates compose with
 * the S1 chokepoint, never bypass it).
 */

import { renderNamingTemplate } from '../../src/core/name/template';
import { loadSettings, watchSettings } from '../../src/ui/settings/store';

let cachedTemplate: string | null = null;
let watcherStarted = false;

/** Start the watcher once; safe to call from every background entry path. */
export function startNameTemplateWatcher(): void {
  if (watcherStarted) return;
  watcherStarted = true;
  void loadSettings().then((settings) => {
    cachedTemplate = settings.namingTemplate;
  }).catch(() => undefined);
  try {
    watchSettings((settings) => {
      cachedTemplate = settings.namingTemplate;
    });
  } catch {
    // No storage.onChanged (tests, exotic contexts): the per-call read below
    // still keeps the value fresh.
  }
}

/**
 * SYNC accessor for the onDeterminingFilename listener (suggest() must stay
 * synchronous on the critical download path). Returns the watcher cache;
 * "" (template off) while the first loadSettings is still in flight — the
 * watcher kicks that read at background start, long before a real download
 * settles, so the miss window is a cold-start race measured in milliseconds.
 */
export function getNamingTemplateSync(): string {
  return cachedTemplate ?? '';
}

/** Read-through async accessor for non-hot-path callers and tests. */
export async function getNamingTemplate(): Promise<string> {
  if (cachedTemplate !== null) return cachedTemplate;
  try {
    const settings = await loadSettings();
    cachedTemplate = settings.namingTemplate;
  } catch {
    cachedTemplate = '';
  }
  return cachedTemplate;
}

export interface TemplateSuggestionInput {
  /** Flat base name from composeSuggestedFilename. */
  baseName: string;
  courseTitle?: string;
  kind?: string;
}

/**
 * Apply the active template to a flat suggestion. Returns the input
 * unchanged when no template is active — the free path (and every
 * template-off user) sees byte-identical behavior.
 */
export function applyNamingTemplate(
  input: TemplateSuggestionInput,
  template: string,
): string {
  if (!template || !template.includes('{')) return input.baseName;
  const index = nextRenderOrdinal();
  return renderNamingTemplate(template, {
    course: input.courseTitle,
    type: input.kind,
    filename: input.baseName,
    index,
  });
}

/**
 * {index} ordinal: monotonic per service-worker life. A mid-batch SW
 * restart resets it; download.uniquify absorbs the collision. Documented
 * honestly in the token contract (template.ts).
 */
let renderOrdinal = 0;
function nextRenderOrdinal(): number {
  renderOrdinal += 1;
  return renderOrdinal;
}

/** Test seam: reset the module's cached state. */
export function resetNameTemplateForTests(): void {
  cachedTemplate = null;
  watcherStarted = false;
  renderOrdinal = 0;
}
