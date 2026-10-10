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

function Root() {
  const route = useHashRoute();
  const [annotateOn, setAnnotateOn] = useState(false);
  return (
    <>
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
        <button
          type="button"
          className="sim-annotate-toggle"
          aria-pressed={annotateOn}
          onClick={() => setAnnotateOn((on) => !on)}
        >
          Annotate
        </button>
      </header>
      {route.kind === 'popup' ? (
        <PopupRoute stateId={route.stateId} />
      ) : route.kind === 'classroom' ? (
        <ClassroomRoute pageId={route.pageId} params={route.params} />
      ) : route.kind === 'options' ? (
        <OptionsRoute stateId={route.stateId} />
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
