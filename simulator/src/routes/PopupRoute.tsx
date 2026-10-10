import { useEffect, useRef, useState } from 'react';
import App from '../../../extension/entrypoints/popup/App';
import { installFixtureChrome } from '../fixtures/fixture-chrome';
import { getPopupState } from '../fixtures/states';
import { ControlPanel } from '../ui/ControlPanel';

/**
 * Route A — the REAL popup App.
 *
 * Controls mode mounts App directly beside the control panel (fast, and the
 * jsdom suite drives this path). User view renders the popup INSIDE an
 * iframe of simulator/popup.html: the iframe document carries only the
 * extension's own stylesheets, so App.css's 360x600 body rules apply
 * exactly as they do in the real Chrome popup — and the bubble is dressed
 * as Chrome dresses it (radius, shadow, anchored under the toolbar icon,
 * click-outside dismisses).
 */
export function PopupRoute({
  stateId,
  userView = false,
}: {
  stateId: string;
  userView?: boolean;
}) {
  const [appKey, setAppKey] = useState(0);
  const [bubbleOpen, setBubbleOpen] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Applying a scenario rebuilds the fixture storage and remounts the App so
  // every mount-time read (manifest, tab, api gate, storage) sees it.
  useEffect(() => {
    const state = getPopupState(stateId);
    installFixtureChrome((state ?? getPopupState('first-run'))!.createFixture());
    setAppKey((key) => key + 1);
  }, [stateId]);

  // Gesture-driven states replay the user action on the REAL markup.
  useEffect(() => {
    const state = getPopupState(stateId);
    if (!state?.drive) return;
    const timer = window.setTimeout(() => state.drive?.(document), 400);
    return () => window.clearTimeout(timer);
  }, [stateId, appKey]);

  // User view: state delivery into the popup iframe. The iframe pings
  // `cqd-sim-popup-ready` after its first mount (covers deep links that
  // changed the hash while it was still loading); every state change is
  // forwarded as `cqd-sim-state`.
  useEffect(() => {
    if (!userView || !bubbleOpen) return;
    const post = (): void => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'cqd-sim-state', stateId },
        '*',
      );
    };
    post();
    const onMessage = (event: MessageEvent): void => {
      if (event.data?.type === 'cqd-sim-popup-ready') post();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [stateId, userView, bubbleOpen]);

  // User view: the Chrome presentation.
  if (userView) {
    return (
      <main
        className="sim-user-stage sim-browser-stage"
        aria-label="Simulated popup (Chrome user view)"
      >
        <div className="sim-chrome-toolbar">
          <span className="sim-chrome-tool-dot" aria-hidden="true" />
          <span className="sim-chrome-tool-dot" aria-hidden="true" />
          <span className="sim-chrome-tool-dot" aria-hidden="true" />
          <span className="sim-chrome-omnibox" aria-hidden="true" />
          <span className="sim-chrome-tool-icon" aria-hidden="true" />
          <button
            type="button"
            className="sim-chrome-ext-icon"
            data-testid="chrome-ext-icon"
            aria-label="Classroom Quick Downloader — toggle popup"
            title="Classroom Quick Downloader"
            onClick={(event) => {
              event.stopPropagation();
              setBubbleOpen((open) => !open);
            }}
          >
            <img src="../../../extension/src/icon/48.png" alt="" width={20} height={20} />
          </button>
          <span className="sim-chrome-tool-icon" aria-hidden="true" />
        </div>
        <div
          className="sim-browser-page"
          data-testid="chrome-backdrop"
          onClick={() => setBubbleOpen(false)}
        >
          <iframe
            className="sim-page-behind"
            src="/sim/classroom/stream-flagged-post-en.html"
            title="Page behind the popup"
            tabIndex={-1}
          />
          <div className="sim-page-dim" aria-hidden="true" />
          {bubbleOpen && (
            <div
              className="sim-chrome-bubble"
              data-testid="chrome-bubble"
              onClick={(event) => event.stopPropagation()}
            >
              <iframe
                ref={iframeRef}
                className="sim-chrome-popup-frame"
                data-testid="chrome-popup-iframe"
                title="Extension popup"
                src={`/popup.html?state=${encodeURIComponent(stateId)}`}
              />
            </div>
          )}
        </div>
      </main>
    );
  }

  const state = getPopupState(stateId);

  return (
    <div className="sim-layout">
      <ControlPanel
        activeStateId={state?.id ?? 'first-run'}
        onRemount={() => setAppKey((key) => key + 1)}
      />
      <main className="sim-stage" aria-label="Simulated popup">
        <p className="sim-stage-note">
          Real extension App.tsx — no chrome global substitutions beyond the
          fixture store.
        </p>
        <div className="sim-popup-frame" data-testid="popup-frame">
          <App key={appKey} />
        </div>
      </main>
    </div>
  );
}
