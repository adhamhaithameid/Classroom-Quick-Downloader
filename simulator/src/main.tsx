import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnnotateOverlay } from './annotate/AnnotateOverlay';
import { installFixtureChrome } from './fixtures/fixture-chrome';
import { getPopupState } from './fixtures/states';
import { parseHash, type Route } from './hash';
import { MapRoute } from './routes/MapRoute';
import { ClassroomRoute } from './routes/ClassroomRoute';
import { OptionsRoute } from './routes/OptionsRoute';
import { PopupRoute } from './routes/PopupRoute';
import './styles.css';

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

const USER_VIEW_KEY = 'cqd-sim-userview';

function readUserView(): boolean {
  // User view is the DEFAULT: the owner opens the simulator to see the real
  // extension UI exactly as users see it, not the scenario chrome.
  try {
    return localStorage.getItem(USER_VIEW_KEY) !== '0';
  } catch {
    return true;
  }
}

function Root() {
  const route = useHashRoute();
  const [annotateOn, setAnnotateOn] = useState(false);
  const [userView, setUserView] = useState(readUserView);
  const setUserViewPersisted = (on: boolean): void => {
    setUserView(on);
    try {
      localStorage.setItem(USER_VIEW_KEY, on ? '1' : '0');
    } catch {
      // Private mode: the in-memory toggle still works.
    }
  };
  return (
    <>
      {userView ? (
        <div className="sim-pill" role="toolbar" aria-label="Simulator pill">
          <button
            type="button"
            onClick={() => setUserViewPersisted(false)}
            title="Show scenario controls and navigation"
          >
            Controls
          </button>
          <button
            type="button"
            className="sim-annotate-toggle"
            aria-pressed={annotateOn}
            onClick={() => setAnnotateOn((on) => !on)}
          >
            Annotate
          </button>
        </div>
      ) : (
        <header className="sim-header">
          <strong>CQD Simulator</strong>
          <nav aria-label="Simulator routes">
            <a href="#/" aria-current={route.kind === 'map' ? 'page' : undefined}>
              State map
            </a>
            <a
              href="#popup=first-run"
              aria-current={route.kind === 'popup' ? 'page' : undefined}
            >
              Popup
            </a>
            <a
              href="#page=mixed-links-post-en"
              aria-current={route.kind === 'classroom' ? 'page' : undefined}
            >
              Classroom
            </a>
            <a
              href="#options=permissions"
              aria-current={route.kind === 'options' ? 'page' : undefined}
            >
              Options
            </a>
          </nav>
          <span className="sim-header-spacer" />
          <button type="button" onClick={() => setUserViewPersisted(true)}>
            User view
          </button>
          <button
            type="button"
            className="sim-annotate-toggle"
            aria-pressed={annotateOn}
            onClick={() => setAnnotateOn((on) => !on)}
          >
            Annotate
          </button>
        </header>
      )}
      {route.kind === 'popup' ? (
        <PopupRoute stateId={route.stateId} userView={userView} />
      ) : route.kind === 'classroom' ? (
        <ClassroomRoute pageId={route.pageId} params={route.params} userView={userView} />
      ) : route.kind === 'options' ? (
        <OptionsRoute stateId={route.stateId} userView={userView} />
      ) : (
        <MapRoute />
      )}
      <AnnotateOverlay route={route} enabled={annotateOn} />
    </>
  );
}

function main() {
  // The fixture chrome MUST exist before the real App renders: mount-time
  // reads (manifest, active tab, storage, API gate) consume it.
  const route = parseHash(window.location.hash);
  const state = route.kind === 'popup' ? getPopupState(route.stateId) : undefined;
  installFixtureChrome((state ?? getPopupState('first-run'))!.createFixture());

  const root = createRoot(document.getElementById('root')!);
  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
main();
