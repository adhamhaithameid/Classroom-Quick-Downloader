import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_DRIVER_OPTIONS,
  clearGroupProgress,
  findAttachmentAnchors,
  findPosts,
  forceButtonState,
  forceGroupProgress,
  injectRealStylesInto,
  renderButtonsIn,
  renderFlagVerdictIn,
  runCopyrightGate,
  type DriverOptions,
  type FlagVerdict,
} from '../fixtures/classroom-driver';
import { CLASSROOM_PAGES, getClassroomPage } from '../fixtures/pages';
import { classroomFixtureUrl } from '../fixtures/page-html';
import { classroomHash } from '../hash';

const BUTTON_STATES = [
  'idle',
  'loading',
  'trying',
  'success',
  'error',
  'cancelled',
] as const;

/**
 * Route B — the REAL content-script renderers against a REAL captured
 * fixture page. Controls force what the extension's pipelines decide at
 * runtime: button state classes, flag verdicts, the group water fill, and
 * the copyright gate.
 */
export function ClassroomRoute({ pageId, params }: { pageId: string; params: URLSearchParams }) {
  const page = getClassroomPage(pageId) ?? CLASSROOM_PAGES[0]!;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [options, setOptions] = useState<DriverOptions>({
    ...DEFAULT_DRIVER_OPTIONS,
    flagVerdict: (params.get('verdict') as FlagVerdict | null) ?? DEFAULT_DRIVER_OPTIONS.flagVerdict,
    renderButtons: params.get('demo') === 'buttons' || params.get('demo') === 'all',
    renderDownloadAll: params.get('demo') === 'buttons' || params.get('demo') === 'all',
  });
  const [errorState, setErrorState] = useState('');
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState({ posts: 0, attachments: 0 });

  const runRenderers = useCallback(() => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc || !iframeDoc.body) return;
    renderButtonsIn(iframeDoc, options);
    renderFlagVerdictIn(iframeDoc, options);
    setSummary({
      posts: findPosts(iframeDoc).length,
      attachments: findAttachmentAnchors(iframeDoc).length,
    });
  }, [options]);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument;
    if (!iframe || !iframeDoc || !iframeDoc.body) return;
    injectRealStylesInto(iframeDoc, options.legacyV1Sheet);
    runRenderers();
    if (params.get('demo') === 'copyright') {
      void runCopyrightGate(iframeDoc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runRenderers, options.legacyV1Sheet, params]);

  useEffect(() => {
    // Re-render after option flips without reloading the fixture page.
    if (iframeRef.current?.contentDocument?.body) runRenderers();
  }, [runRenderers]);

  return (
    <div className="sim-classroom">
      <aside className="sim-panel" aria-label="Classroom simulator controls">
        <fieldset className="sim-group">
          <legend>Fixture page</legend>
          <label className="sim-field">
            <span>Captured page</span>
            <select
              value={page.id}
              onChange={(event) => {
                window.location.hash = classroomHash(event.target.value);
              }}
            >
              {CLASSROOM_PAGES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <p className="sim-note">{page.note}</p>
          <p className="sim-note">
            {summary.posts} post(s), {summary.attachments} attachment anchor(s) detected.
          </p>
        </fieldset>

        <fieldset className="sim-group">
          <legend>Download buttons</legend>
          <label className="sim-check">
            <input
              type="checkbox"
              checked={options.renderButtons}
              onChange={(event) =>
                setOptions((prev) => ({ ...prev, renderButtons: event.target.checked }))
              }
            />
            <span>Render single buttons</span>
          </label>
          <label className="sim-check">
            <input
              type="checkbox"
              checked={options.renderDownloadAll}
              onChange={(event) =>
                setOptions((prev) => ({ ...prev, renderDownloadAll: event.target.checked }))
              }
            />
            <span>Render Download All on header</span>
          </label>
          <label className="sim-field">
            <span>Force state class (all buttons)</span>
            <select
              value=""
              onChange={(event) => {
                const iframeDoc = iframeRef.current?.contentDocument;
                if (!iframeDoc) return;
                const state = event.target.value as (typeof BUTTON_STATES)[number];
                forceButtonState(iframeDoc, state, state === 'error' ? errorState || undefined : undefined);
              }}
            >
              <option value="" disabled>
                apply to real buttons…
              </option>
              {BUTTON_STATES.map((state) => (
                <option key={state} value={state}>
                  cqd-{state}
                </option>
              ))}
            </select>
          </label>
          <label className="sim-field">
            <span>Error detail message</span>
            <input
              type="text"
              value={errorState}
              placeholder="e.g. Drive returned 403"
              onChange={(event) => setErrorState(event.target.value)}
            />
          </label>
          <label className="sim-field">
            <span>Group water fill: {progress}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              aria-label="Download All water fill percent"
              onChange={(event) => {
                const value = Number(event.target.value);
                setProgress(value);
                const iframeDoc = iframeRef.current?.contentDocument;
                if (!iframeDoc) return;
                if (value === 0) clearGroupProgress(iframeDoc);
                else forceGroupProgress(iframeDoc, value);
              }}
            />
          </label>
        </fieldset>

        <fieldset className="sim-group">
          <legend>Flag badges</legend>
          <label className="sim-field">
            <span>Verdict</span>
            <select
              value={options.flagVerdict}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  flagVerdict: event.target.value as FlagVerdict,
                }))
              }
            >
              <option value="none">none</option>
              <option value="comment">comment</option>
              <option value="edited">edited</option>
              <option value="both">both</option>
            </select>
          </label>
          <label className="sim-field">
            <span>Comment count</span>
            <input
              type="number"
              min={0}
              value={options.flagCommentCount}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  flagCommentCount: Math.max(0, Number(event.target.value)),
                }))
              }
            />
          </label>
        </fieldset>

        <fieldset className="sim-group">
          <legend>Engine sheets &amp; legal</legend>
          <label className="sim-check">
            <input
              type="checkbox"
              checked={options.legacyV1Sheet}
              onChange={(event) => {
                setOptions((prev) => ({ ...prev, legacyV1Sheet: event.target.checked }));
                const iframeDoc = iframeRef.current?.contentDocument;
                if (iframeDoc) injectRealStylesInto(iframeDoc, event.target.checked);
              }}
            />
            <span>Add V1 legacy sheet (cqd-style)</span>
          </label>
          <div className="sim-row">
            <button
              type="button"
              onClick={() => {
                const iframeDoc = iframeRef.current?.contentDocument;
                if (iframeDoc) void runCopyrightGate(iframeDoc);
              }}
            >
              Run copyright gate
            </button>
          </div>
        </fieldset>
      </aside>

      <main className="sim-stage" aria-label="Simulated Classroom page">
        <p className="sim-stage-note">
          Captured fixture markup with the REAL injected stylesheets and renderers.
          {page.rtl ? ' RTL page: body[data-cqd-dir] mirrors production applyDirection.' : ''}
        </p>
        <div className="sim-frame-wrap" data-testid="classroom-frame-wrap">
          <iframe
            ref={iframeRef}
            className="sim-classroom-frame"
            title={`Simulated Classroom fixture: ${page.label}`}
            onLoad={handleLoad}
            src={classroomFixtureUrl(page)}
          />
        </div>
      </main>
    </div>
  );
}
