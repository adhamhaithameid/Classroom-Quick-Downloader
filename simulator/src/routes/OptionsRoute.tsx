import { useEffect, useState } from 'react';
import { OptionsApp } from '../../../extension/entrypoints/options/OptionsApp';
import { installFixtureChrome } from '../fixtures/fixture-chrome';
import { firstRunFixture } from '../fixtures/fixture-state';

/**
 * Route C — the REAL options page. The Legal group's "permissions rows"
 * live there (PermissionsExplainer), and the surface shares the popup's
 * settings store, so the same fixture chrome drives it.
 */
export function OptionsRoute({
  stateId,
  userView = false,
}: {
  stateId: string;
  userView?: boolean;
}) {
  const [appKey, setAppKey] = useState(0);

  useEffect(() => {
    // One fixture today (defaults + pending consents); the re-install keeps
    // the contract identical to the popup route.
    installFixtureChrome(firstRunFixture());
    setAppKey((key) => key + 1);
  }, [stateId]);

  return (
    <div className="sim-layout">
      {!userView && (
      <aside className="sim-panel" aria-label="Options simulator controls">
        <fieldset className="sim-group">
          <legend>About this route</legend>
          <p className="sim-note">
            The real options page (OptionsApp.tsx): all eight settings toggles,
            the standing Permissions reference rows, and the Limited Use block.
            Toggles write through the shared settings store.
          </p>
        </fieldset>
        <fieldset className="sim-group">
          <legend>Actions</legend>
          <div className="sim-row">
            <button type="button" onClick={() => setAppKey((key) => key + 1)}>
              Remount page
            </button>
          </div>
        </fieldset>
      </aside>
      )}
      <main
        className={userView ? 'sim-user-stage' : 'sim-stage'}
        aria-label="Simulated options page"
      >
        <div className="sim-options-frame" data-testid="options-frame">
          <OptionsApp key={appKey} />
        </div>
      </main>
    </div>
  );
}
