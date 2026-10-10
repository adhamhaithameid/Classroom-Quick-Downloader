import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../../extension/entrypoints/popup/App';
import ErrorBoundary from '../../extension/entrypoints/popup/ErrorBoundary';
import { installFixtureChrome } from './fixtures/fixture-chrome';
import { getPopupState } from './fixtures/states';

/**
 * The popup document of the simulator's User view.
 *
 * This file runs INSIDE the popup iframe (simulator/popup.html), which
 * means the only stylesheets in this document are the ones the real
 * extension loads — stillwater.css + App.css via App.tsx — so App.css's
 * body rules (360x600, shell background, overflow) apply exactly as they
 * do in the real Chrome popup. Nothing from the simulator shell leaks in.
 *
 * State protocol: the parent route names the scenario with `?state=` on
 * load and with `postMessage({ type: 'cqd-sim-state', stateId })` after
 * that; each state re-installs the fixture chrome and remounts the App so
 * every mount-time read (manifest, tab, API gate, storage) sees it. The
 * ready ping lets the parent deliver the first state even when the hash
 * changed while the iframe was still loading.
 */

let reactRoot: ReactDOM.Root | null = null;
let instance = 0;

function mount(stateId: string | null): void {
  const state = getPopupState(stateId ?? 'first-run') ?? getPopupState('first-run')!;
  installFixtureChrome(state.createFixture());
  instance += 1;
  const key = `instance-${instance}`;
  if (!reactRoot) {
    reactRoot = ReactDOM.createRoot(document.getElementById('root')!);
  }
  reactRoot.render(
    <React.StrictMode>
      {/* Key remounts the subtree so mount-time reads re-run per state. */}
      <ErrorBoundary key={key}>
        <App key={key} />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

const initial = new URLSearchParams(window.location.search).get('state');
mount(initial);

window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type !== 'cqd-sim-state') return;
  mount(typeof event.data.stateId === 'string' ? event.data.stateId : null);
});

window.parent.postMessage({ type: 'cqd-sim-popup-ready' }, '*');
