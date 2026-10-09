/**
 * Annotate mode overlay — dev tool only, never part of the extension.
 *
 * When enabled from the top-bar toggle:
 * - clicks on the rendered surface place a numbered pin (the underlying UI
 *   interaction is suppressed while the mode is on);
 * - clicking a pin opens a tiny editor (label + note + delete);
 * - a side panel lists notes for the current state (or all states) and
 *   jumps to each pin;
 * - Route B (classroom) captures clicks inside the same-origin fixture
 *   iframe document.
 *
 * When disabled it renders nothing over the surfaces.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { describeElement, percentOfRect } from './describe';
import { routeMeta } from './route-info';
import { clearAnnotations, loadAllGroups, loadAnnotations, saveAnnotations } from './store';
import type { Annotation, AnnotationGroup, AnnotationTarget } from './types';
import type { Route } from '../hash';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

let idCounter = 0;

function newId(): string {
  idCounter += 1;
  return `note-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

/** Cross-realm-safe element check (classroom elements come from the iframe realm). */
function isElementLike(node: EventTarget | null): node is Element {
  if (!node || typeof node !== 'object') return false;
  const candidate = node as Partial<Element>;
  if (candidate.nodeType !== 1 || typeof candidate.tagName !== 'string') return false;
  return typeof candidate.closest === 'function';
}

function percentOfPoint(x: number, y: number, box: Box, iframeMode: boolean) {
  return percentOfRect({ left: x, top: y, width: 0, height: 0 }, box, iframeMode);
}

function surfaceSelector(kind: string): string {
  if (kind === 'popup') return '.sim-popup-frame';
  if (kind === 'options') return '.sim-options-frame';
  if (kind === 'classroom') return '.sim-frame-wrap';
  return '.sim-map';
}

export function AnnotateOverlay({ route, enabled }: { route: Route; enabled: boolean }) {
  const meta = routeMeta(route);
  const routeKey = `${meta.kind}:${meta.stateId}:${route.kind === 'classroom' ? route.params.toString() : ''}`;

  const [notes, setNotes] = useState<Annotation[]>([]);
  const [surfaceEl, setSurfaceEl] = useState<HTMLElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNew, setEditingNew] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [groups, setGroups] = useState<AnnotationGroup[]>([]);
  const pendingFocusId = useRef<string | null>(null);

  const stateId = meta.stateId;

  // Restore notes for the current state; close any stale editor.
  useEffect(() => {
    setNotes(loadAnnotations(stateId));
    setEditingId(null);
    setEditingNew(false);
  }, [stateId]);

  // Refresh the side panel (all states when toggled, current state leads).
  useEffect(() => {
    setGroups(loadAllGroups(showAll ? undefined : stateId));
  }, [notes, showAll, stateId]);

  // Find the surface that hosts the pin layer (after the route committed).
  useEffect(() => {
    if (!enabled) {
      setSurfaceEl(null);
      return;
    }
    const host =
      document.querySelector<HTMLElement>(surfaceSelector(meta.kind)) ?? null;
    setSurfaceEl(host && host.isConnected ? host : null);
  }, [enabled, routeKey, meta.kind]);

  const openEditor = useCallback((id: string, isNew: boolean) => {
    setEditingId(id);
    setEditingNew(isNew);
    const note = loadAnnotations(stateId).find((entry) => entry.id === id);
    setDraftLabel(note?.label ?? '');
    setDraftNote(note?.note ?? '');
  }, [stateId]);

  const createAnnotation = useCallback(
    (eventTarget: EventTarget | null, x: number, y: number, box: Box, iframeMode: boolean) => {
      let target: AnnotationTarget;
      if (isElementLike(eventTarget) && eventTarget !== surfaceEl) {
        target = describeElement(eventTarget, surfaceEl, iframeMode, box);
      } else {
        const { xPct, yPct } = percentOfPoint(x, y, box, iframeMode);
        target = { kind: 'percent', xPct, yPct };
      }
      const note: Annotation = {
        id: newId(),
        route: meta.kind,
        stateId,
        deepLink: meta.deepLink,
        label: '',
        note: '',
        createdAt: new Date().toISOString(),
        target,
      };
      setNotes((prev) => {
        const next = [...prev, note];
        saveAnnotations(stateId, next);
        return next;
      });
      openEditor(note.id, true);
    },
    [meta.deepLink, meta.kind, openEditor, stateId, surfaceEl],
  );

  // Click capture on same-document surfaces (popup, options, map).
  useEffect(() => {
    if (!enabled || !surfaceEl || meta.kind === 'classroom') return;
    const handler = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      if (isElementLike(ev.target) && ev.target.closest('.sim-annotate-ui')) return;
      ev.preventDefault();
      ev.stopPropagation();
      const rect = surfaceEl.getBoundingClientRect();
      createAnnotation(ev.target, ev.clientX, ev.clientY, rect, false);
    };
    surfaceEl.addEventListener('click', handler, true);
    return () => surfaceEl.removeEventListener('click', handler, true);
  }, [enabled, surfaceEl, meta.kind, createAnnotation]);

  // Click capture inside the same-origin classroom iframe document.
  useEffect(() => {
    if (!enabled || meta.kind !== 'classroom') return;
    const iframe = document.querySelector<HTMLIFrameElement>('.sim-classroom-frame');
    if (!iframe) return;
    let attachedDoc: Document | null = null;
    const inner = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      if (isElementLike(ev.target) && ev.target.closest('.sim-annotate-ui')) return;
      ev.preventDefault();
      ev.stopPropagation();
      const docEl = iframe.contentDocument?.documentElement;
      const box: Box = {
        left: 0,
        top: 0,
        width: docEl?.clientWidth || iframe.clientWidth,
        height: docEl?.clientHeight || iframe.clientHeight,
      };
      createAnnotation(ev.target, ev.clientX, ev.clientY, box, true);
    };
    const attach = () => {
      const doc = iframe.contentDocument;
      if (!doc || doc === attachedDoc) return;
      if (attachedDoc) attachedDoc.removeEventListener('click', inner, true);
      doc.addEventListener('click', inner, true);
      attachedDoc = doc;
    };
    attach();
    iframe.addEventListener('load', attach);
    return () => {
      iframe.removeEventListener('load', attach);
      if (attachedDoc) attachedDoc.removeEventListener('click', inner, true);
    };
  }, [enabled, meta.kind, routeKey, createAnnotation]);

  // Focus a pin requested through a panel jump (possibly across states).
  useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    const pin = document.querySelector<HTMLElement>(`[data-annotation-id="${id}"]`);
    if (pin) {
      pin.focus();
      pendingFocusId.current = null;
    }
  }, [notes, stateId]);

  const persist = useCallback(
    (updater: (prev: Annotation[]) => Annotation[]) => {
      setNotes((prev) => {
        const next = updater(prev);
        saveAnnotations(stateId, next);
        return next;
      });
    },
    [stateId],
  );

  const closeEditor = useCallback(() => {
    setEditingId(null);
    setEditingNew(false);
  }, []);

  const saveEditing = useCallback(() => {
    if (!editingId) return;
    persist((prev) =>
      prev.map((note) =>
        note.id === editingId
          ? { ...note, label: draftLabel.trim(), note: draftNote.trim() }
          : note,
      ),
    );
    closeEditor();
  }, [closeEditor, draftLabel, draftNote, editingId, persist]);

  const deleteEditing = useCallback(() => {
    if (!editingId) return;
    persist((prev) => prev.filter((note) => note.id !== editingId));
    closeEditor();
  }, [closeEditor, editingId, persist]);

  const cancelEditing = useCallback(() => {
    if (editingNew && editingId) {
      persist((prev) => prev.filter((note) => note.id !== editingId));
    }
    closeEditor();
  }, [closeEditor, editingId, editingNew, persist]);

  const jumpTo = useCallback(
    (note: Annotation) => {
      pendingFocusId.current = note.id;
      if (note.stateId !== stateId) {
        window.location.hash = note.deepLink;
        return;
      }
      const pin = document.querySelector<HTMLElement>(`[data-annotation-id="${note.id}"]`);
      if (pin) {
        pin.focus();
        pendingFocusId.current = null;
      }
    },
    [stateId],
  );

  const clearCurrent = useCallback(() => {
    const count = notes.length;
    if (count === 0) return;
    const question = `Delete all ${count} note(s) on this state?`;
    if (!window.confirm(question)) return;
    clearAnnotations(stateId);
    setNotes([]);
    closeEditor();
  }, [closeEditor, notes.length, stateId]);

  if (!enabled) return null;

  const editing = editingId ? notes.find((note) => note.id === editingId) : undefined;
  const editingNumber = editing ? notes.indexOf(editing) + 1 : 0;

  const panel = (
    <aside className="sim-annotate-panel sim-annotate-ui" aria-label="Annotation notes">
      <h2>Notes</h2>
      <p className="sim-note">
        {notes.length} on this state — {groups.reduce((sum, g) => sum + g.notes.length, 0)} total
      </p>
      <label className="sim-check">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(event) => setShowAll(event.target.checked)}
        />
        <span>Show all states</span>
      </label>
      <ul className="sim-annotate-list">
        {(showAll
          ? groups.flatMap((group) =>
              group.notes.map((note) => ({ note, n: group.notes.indexOf(note) + 1, group })),
            )
          : notes.map((note, idx) => ({
              note,
              n: idx + 1,
              group: { stateId, title: meta.title },
            }))
        ).map(({ note, n, group }) => (
          <li key={note.id}>
            <button type="button" className="sim-annotate-item" onClick={() => jumpTo(note)}>
              <span className="sim-pin-num" aria-hidden="true">
                {n}
              </span>
              <span className="sim-annotate-item-text">
                {showAll ? <span className="sim-annotate-state">{group.stateId}</span> : null}
                {note.label || note.note || '(empty note)'}
              </span>
            </button>
          </li>
        ))}
        {!showAll && notes.length === 0 ? (
          <li className="sim-note">Click the surface to place a pin.</li>
        ) : null}
      </ul>
      <div className="sim-row">
        <button type="button" onClick={clearCurrent}>
          Clear notes
        </button>
      </div>
    </aside>
  );

  const layer = surfaceEl ? (
    <div className="sim-annotate-layer sim-annotate-ui" data-testid="annotate-layer">
      {notes.map((note, idx) => (
        <button
          key={note.id}
          type="button"
          className={`sim-pin${editingId === note.id ? ' sim-pin-active' : ''}`}
          data-annotation-id={note.id}
          style={{ left: `${note.target.xPct}%`, top: `${note.target.yPct}%` }}
          aria-label={`Note ${idx + 1}${note.label ? `: ${note.label}` : ''}`}
          title={note.label || note.note || `Note ${idx + 1}`}
          onClick={() => openEditor(note.id, false)}
        >
          {idx + 1}
        </button>
      ))}
      {editing ? (
        <div
          className="sim-annotate-editor"
          role="dialog"
          aria-label={`Edit note ${editingNumber}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') cancelEditing();
          }}
        >
          <label className="sim-field">
            <span>Label (optional)</span>
            <input
              type="text"
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
            />
          </label>
          <label className="sim-field">
            <span>Note</span>
            <textarea
              rows={3}
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
            />
          </label>
          <div className="sim-row">
            <button type="button" onClick={saveEditing}>
              Save
            </button>
            <button type="button" onClick={deleteEditing}>
              Delete
            </button>
            <button type="button" onClick={cancelEditing}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      {surfaceEl ? createPortal(layer, surfaceEl) : null}
      {panel}
    </>
  );
}
