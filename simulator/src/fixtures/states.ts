/**
 * Popup state registry — Route A's simulatable states.
 *
 * Each entry names one state the REAL popup can show, builds the fixture
 * that produces it, and (where a state needs a user gesture) carries a
 * `drive` that performs that gesture on the real mounted markup — a click
 * on the actual button, never a re-implementation.
 */

import {
  CLASSROOM_TAB_URL,
  OTHER_TAB_URL,
  firstRunFixture,
  historyRowsFixtureHelpers,
  localStatsStorage,
  queueRowsFixtureHelpers,
  settingsStorage,
  statsStorage,
  type FixtureState,
} from './fixture-state';

export interface PopupState {
  id: string;
  label: string;
  group: string;
  description: string;
  /** Deep-link target for the map: `#popup=<id>`. */
  createFixture: () => FixtureState;
  /** Optional gesture performed on the real mounted App after it settles. */
  drive?: (root: Document) => void;
}

function click(root: Document, selector: string): void {
  root.querySelector<HTMLElement>(selector)?.click();
}

function fixtureWith(patch: Partial<FixtureState>): FixtureState {
  return { ...firstRunFixture(), ...patch };
}

export const POPUP_STATES: PopupState[] = [
  // --- First run ---
  {
    id: 'first-run',
    label: 'First run',
    group: 'First run',
    description:
      'Fresh install: level 0, empty history, zero stats, consent keys still pending.',
    createFixture: () => firstRunFixture(),
  },
  {
    id: 'extension-disabled',
    label: 'Extension disabled',
    group: 'First run',
    description: 'The master toggle is off — status dot grey, banner text updates.',
    createFixture: () =>
      fixtureWith({ storage: { ...settingsStorage({ extensionEnabled: false }) } }),
  },

  // --- First download ---
  {
    id: 'first-download',
    label: 'First download (milestone 1)',
    group: 'First download',
    description:
      'Lifetime count 1 with milestone 1 pending: the real confetti burst fires and the level-1 toast plays.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...settingsStorage(),
          ...statsStorage(1, { pending: 1, last: 1 }),
          ...localStatsStorage({ pdf: 1 }),
        },
        historyRows: historyRowsFixtureHelpers.firstSuccess(),
      }),
  },

  // --- Queue ---
  {
    id: 'queue-idle',
    label: 'Queue idle',
    group: 'Queue',
    description: 'No rows — the queue panel is hidden entirely.',
    createFixture: () => firstRunFixture(),
  },
  {
    id: 'queue-running',
    label: 'Queue running',
    group: 'Queue',
    description: 'Two active downloads and two queued, with cancel affordances.',
    createFixture: () =>
      fixtureWith({ queueRows: queueRowsFixtureHelpers.running() }),
  },
  {
    id: 'queue-paused',
    label: 'Queue paused',
    group: 'Queue',
    description: 'Work in flight with the pause latched — the button reads Resume.',
    createFixture: () =>
      fixtureWith({ queueRows: queueRowsFixtureHelpers.running(), queuePaused: true }),
  },

  // --- History ---
  {
    id: 'history-empty',
    label: 'History empty',
    group: 'History',
    description: 'The "No downloads yet" empty state with search field.',
    createFixture: () => firstRunFixture(),
  },
  {
    id: 'history-populated',
    label: 'History populated',
    group: 'History',
    description: 'Success and failed rows with dates, re-download and clear.',
    createFixture: () =>
      fixtureWith({ historyRows: historyRowsFixtureHelpers.mixed() }),
  },

  // --- Engine selector ---
  {
    id: 'engine-legacy',
    label: 'Engine: Legacy',
    group: 'Engine selector',
    description: 'cqdV2Mode "legacy" — the Legacy segment is selected.',
    createFixture: () =>
      fixtureWith({ storage: { ...settingsStorage(), cqdV2Mode: 'legacy' } }),
  },

  // --- Views ---
  {
    id: 'non-classroom',
    label: 'Non-Classroom tab',
    group: 'Views',
    description: 'The active tab is not Classroom: the friendly redirect card.',
    createFixture: () => fixtureWith({ tabUrl: OTHER_TAB_URL }),
  },
  {
    id: 'classroom-tab',
    label: 'Classroom tab (default)',
    group: 'Views',
    description: 'Active tab on classroom.google.com — the main control surface.',
    createFixture: () => fixtureWith({ tabUrl: CLASSROOM_TAB_URL }),
  },
];

/** Convenience lookup used by the router and the map. */
export function getPopupState(id: string | null | undefined): PopupState | undefined {
  if (!id) return undefined;
  return POPUP_STATES.find((state) => state.id === id);
}
