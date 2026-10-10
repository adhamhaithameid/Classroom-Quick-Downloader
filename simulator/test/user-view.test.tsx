import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installFixtureChrome } from '../src/fixtures/fixture-chrome';
import { firstRunFixture } from '../src/fixtures/fixture-state';
import { PopupRoute } from '../src/routes/PopupRoute';
import { ClassroomRoute } from '../src/routes/ClassroomRoute';

let root: Root | null = null;
let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  installFixtureChrome(firstRunFixture());
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container.remove();
  window.localStorage.clear();
  window.location.hash = '';
});

async function mount(ui: React.ReactElement): Promise<void> {
  root = createRoot(container);
  await act(async () => {
    root!.render(ui);
  });
}

describe('user view (default on in Root; route-level contract here)', () => {
  it('user view: renders the real popup WITHOUT scenario controls', async () => {
    await mount(<PopupRoute stateId="first-run" userView />);
    expect(document.querySelector('[data-testid="popup-frame"]')).toBeTruthy();
    expect(document.querySelector('[aria-label="Simulator controls"]')).toBeNull();
    expect(document.querySelector('.sim-user-stage')).toBeTruthy();
  });

  it('controls mode: keeps the scenario controls and the popup frame', async () => {
    await mount(<PopupRoute stateId="first-run" userView={false} />);
    expect(document.querySelector('[aria-label="Simulator controls"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="popup-frame"]')).toBeTruthy();
  });

  it('user view: hides classroom controls, keeps the frame', async () => {
    await mount(
      <ClassroomRoute pageId="mixed-links-post-en" params={new URLSearchParams()} userView />,
    );
    expect(document.querySelector('[aria-label="Classroom simulator controls"]')).toBeNull();
    expect(document.querySelector('[data-testid="classroom-frame-wrap"]')).toBeTruthy();
    expect(document.querySelector('.sim-user-stage .sim-classroom-frame')).toBeTruthy();
  });

  it('controls mode: keeps classroom controls', async () => {
    await mount(
      <ClassroomRoute
        pageId="mixed-links-post-en"
        params={new URLSearchParams()}
        userView={false}
      />,
    );
    expect(document.querySelector('[aria-label="Classroom simulator controls"]')).toBeTruthy();
  });
});
