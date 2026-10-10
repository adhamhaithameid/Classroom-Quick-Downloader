/**
 * Annotation persistence — localStorage, keyed per deep-link state id.
 *
 * Keys: `cqd-sim-annotations:v1:<stateId>` holding a JSON array. State
 * switches, reloads, and remounts keep the notes; `Clear notes` drops the
 * current state's key (with a confirm in the UI).
 */

import { getClassroomPage } from '../fixtures/pages';
import { getPopupState } from '../fixtures/states';
import type { Annotation, AnnotationGroup, SimRouteKind } from './types';

const KEY_PREFIX = 'cqd-sim-annotations:v1:';

function storageKey(stateId: string): string {
  return `${KEY_PREFIX}${stateId}`;
}

export function loadAnnotations(stateId: string): Annotation[] {
  try {
    const raw = window.localStorage.getItem(storageKey(stateId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is Annotation => {
      const note = entry as Annotation | null;
      return typeof note?.id === 'string' && typeof note?.stateId === 'string';
    });
  } catch {
    return [];
  }
}

export function saveAnnotations(stateId: string, notes: Annotation[]): void {
  try {
    if (notes.length === 0) {
      window.localStorage.removeItem(storageKey(stateId));
    } else {
      window.localStorage.setItem(storageKey(stateId), JSON.stringify(notes));
    }
  } catch {
    // Storage full or unavailable — Annotate still works for this session.
  }
}

export function clearAnnotations(stateId: string): void {
  saveAnnotations(stateId, []);
}

/** Every state id that currently has notes (insertion order). */
export function listAnnotatedStateIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(KEY_PREFIX)) ids.push(key.slice(KEY_PREFIX.length));
  }
  return ids;
}

/** Resolve the display title for a stored state id (registry-first). */
export function resolveStateTitle(route: SimRouteKind, stateId: string): string {
  // Classroom demo variants store `pageId?demo=x`; registries know the base id.
  const baseId = stateId.split('?')[0]!;
  if (route === 'popup') return getPopupState(baseId)?.label ?? stateId;
  if (route === 'classroom') return getClassroomPage(baseId)?.label ?? stateId;
  if (route === 'options') return 'Permissions rows';
  return 'State map';
}

/**
 * All notes grouped per state, sorted by state id — the deterministic order
 * the Markdown export uses. The current state (when provided) leads.
 */
export function loadAllGroups(currentStateId?: string): AnnotationGroup[] {
  const groups: AnnotationGroup[] = [];
  for (const stateId of listAnnotatedStateIds()) {
    const notes = loadAnnotations(stateId);
    if (notes.length === 0) continue;
    const first = notes[0]!;
    groups.push({
      stateId,
      route: first.route,
      title: resolveStateTitle(first.route, stateId),
      deepLink: first.deepLink,
      notes,
    });
  }
  groups.sort((a, b) => a.stateId.localeCompare(b.stateId));
  if (currentStateId) {
    const idx = groups.findIndex((group) => group.stateId === currentStateId);
    if (idx > 0) {
      const [current] = groups.splice(idx, 1);
      groups.unshift(current!);
    }
  }
  return groups;
}
