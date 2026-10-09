import { useEffect, useState } from 'react';
import App from '../../../extension/entrypoints/popup/App';
import { installFixtureChrome } from '../fixtures/fixture-chrome';
import { getPopupState } from '../fixtures/states';
import { ControlPanel } from '../ui/ControlPanel';

/**
 * Route A — the REAL popup App mounted inside a phone-sized frame, with a
 * control panel driving the fixture chrome beside it.
 */
export function PopupRoute({ stateId }: { stateId: string }) {
  const [appKey, setAppKey] = useState(0);

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
