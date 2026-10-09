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
  corruptStatsStorage,
  firstRunFixture,
  historyRowsFixtureHelpers,
  localStatsStorage,
  preSchemaSettingsStorage,
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

  // --- Milestones ---
  {
    id: 'milestone-mid-ladder',
    label: 'Mid-ladder milestone',
    group: 'Milestones',
    description:
      '137 lifetime downloads, level 5, tracker bar walking toward 250. No toast pending.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...settingsStorage(),
          ...statsStorage(137, { last: 100 }),
          ...localStatsStorage({ pdf: 90, doc: 30, slide: 17 }),
        },
        historyRows: historyRowsFixtureHelpers.mixed(),
      }),
  },
  {
    id: 'milestone-1m-legend',
    label: '1M legend state',
    group: 'Milestones',
    description:
      'One million lifetime downloads: compact "1M" count, level 18, the legend line past the final rung.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...settingsStorage(),
          ...statsStorage(1_000_000, { last: 1_000_000 }),
          ...localStatsStorage({ pdf: 600_000, doc: 250_000, sheet: 150_000 }),
        },
        historyRows: historyRowsFixtureHelpers.mixed(),
      }),
  },
  {
    id: 'milestone-pending-replay',
    label: 'Pending milestone replay',
    group: 'Milestones',
    description:
      'Milestone 50 still pending on a count of 50: toast + confetti replay on mount, then the flag clears.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...settingsStorage(),
          ...statsStorage(50, { pending: 50, last: 50 }),
          ...localStatsStorage({ pdf: 30, doc: 20 }),
        },
        historyRows: historyRowsFixtureHelpers.mixed(),
      }),
  },

  // --- Levels (tracker framings) ---
  {
    id: 'level-0',
    label: 'Level 0 (tracker empty)',
    group: 'Levels',
    description: 'The tracker empty state: "Level 0 — download your first file".',
    createFixture: () => firstRunFixture(),
  },
  {
    id: 'level-5',
    label: 'Level 5 (mid ladder)',
    group: 'Levels',
    description: 'Level badge 5 next to 137; progress bar shows the run to 250.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...settingsStorage(),
          ...statsStorage(137, { last: 100 }),
          ...localStatsStorage({ pdf: 90, doc: 30, slide: 17 }),
        },
      }),
  },
  {
    id: 'level-18',
    label: 'Level 18 (max)',
    group: 'Levels',
    description: 'Level 18 at one million — no bar, the legend line instead.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...settingsStorage(),
          ...statsStorage(1_000_000, { last: 1_000_000 }),
          ...localStatsStorage({ pdf: 600_000, doc: 250_000, sheet: 150_000 }),
        },
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
  {
    id: 'history-failed',
    label: 'History failures',
    group: 'History',
    description: 'Failed rows carry the ✕ state and the error code tooltip.',
    createFixture: () => fixtureWith({ historyRows: historyRowsFixtureHelpers.failed() }),
  },
  {
    id: 'history-corrupt',
    label: 'History corrupt record',
    group: 'History',
    description:
      'A row with an empty name and NaN timestamp — the panel renders it without crashing.',
    createFixture: () =>
      fixtureWith({ historyRows: [historyRowsFixtureHelpers.corrupt()] }),
  },
  {
    id: 'history-read-fail',
    label: 'History read fails',
    group: 'History',
    description:
      'CQD_HISTORY_GET answers ok:false — the panel falls back to the empty state.',
    createFixture: () => fixtureWith({ historyFails: true }),
  },

  // --- Changelog ---
  {
    id: 'changelog-loaded',
    label: 'Changelog loaded',
    group: 'Changelog',
    description:
      'The manual changelog resolves: entries render, "Current" tag on the installed version.',
    createFixture: () => firstRunFixture(),
  },
  {
    id: 'changelog-fetch-fail',
    label: 'Changelog fetch fails',
    group: 'Changelog',
    description:
      'The fetch answers status "error": the warn/error line with the Retry button.',
    createFixture: () => fixtureWith({ changelog: 'fail' }),
  },
  {
    id: 'changelog-offline',
    label: 'Changelog offline',
    group: 'Changelog',
    description:
      'The fetch answers "cache-fallback": the offline warn line and the cached entries render under it.',
    createFixture: () => fixtureWith({ changelog: 'offline' }),
  },

  // --- Storage integrity ---
  {
    id: 'stats-corrupt-reset',
    label: 'Corrupt stats record',
    group: 'Storage integrity',
    description:
      'A stats record claiming 137 carries a bad checksum: the integrity check resets it to an honest level 0, count 0.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...settingsStorage(),
          ...corruptStatsStorage(),
          ...localStatsStorage({}),
        },
      }),
  },
  {
    id: 'upgraded-install',
    label: 'Upgraded install (pre-schema)',
    group: 'Storage integrity',
    description:
      'Storage predates the settings schema: loadSettings back-fills the new keys and stamps cqdSettingsSchemaVersion 2 on load.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...preSchemaSettingsStorage(),
          ...statsStorage(0),
          ...localStatsStorage({}),
        },
      }),
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
  {
    id: 'engine-new',
    label: 'Engine: New (default)',
    group: 'Engine selector',
    description: 'No saved mode: resolveEngineMode falls back to "v2" (New selected).',
    createFixture: () => firstRunFixture(),
  },
  {
    id: 'engine-api-gated',
    label: 'Engine: API gated',
    group: 'Engine selector',
    description:
      'No OAuth client: the API (beta) segment is disabled with the setup tooltip.',
    createFixture: () => firstRunFixture(),
  },
  {
    id: 'engine-api-confirmed',
    label: 'Engine: API confirmed',
    group: 'Engine selector',
    description:
      'OAuth configured and apiBetaConfirmed saved: the API segment selects cleanly.',
    createFixture: () =>
      fixtureWith({
        apiConfigured: true,
        storage: { ...settingsStorage({ apiBetaConfirmed: true }), cqdV2Mode: 'v3' },
      }),
  },

  // --- Legal ---
  {
    id: 'api-beta-confirm',
    label: 'API beta confirm card',
    group: 'Legal',
    description:
      'First v3 pick without consent: the real confirm card opens on the API segment click.',
    createFixture: () =>
      fixtureWith({
        apiConfigured: true,
        storage: { ...settingsStorage({ apiBetaConfirmed: false }), cqdV2Mode: 'v2' },
      }),
    drive: (root) => click(root, 'button[data-mode="v3"]'),
  },
  {
    id: 'privacy-ledger-expanded',
    label: 'Privacy ledger expanded',
    group: 'Legal',
    description:
      'The footer "Privacy & data" pill expands the Reads / Keeps / Sends ledger in place.',
    createFixture: () => firstRunFixture(),
    drive: (root) => click(root, '.cqd-priv-pill'),
  },

  // --- Flag pills ---
  {
    id: 'flags-all-on',
    label: 'Flags all on',
    group: 'Flag pills',
    description: 'Comment, Edited and Both pills all pressed (defaults).',
    createFixture: () => firstRunFixture(),
  },
  {
    id: 'flags-comment-only',
    label: 'Flags: comment only',
    group: 'Flag pills',
    description: 'Edited and Both off — only the Comment pill stays pressed.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...settingsStorage({
            commentsFlagEnabled: true,
            editedFlagEnabled: false,
            combinedFlagEnabled: false,
          }),
        },
      }),
  },
  {
    id: 'flags-edited-only',
    label: 'Flags: edited only',
    group: 'Flag pills',
    description: 'Comment and Both off — only the Edited pill stays pressed.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...settingsStorage({
            commentsFlagEnabled: false,
            editedFlagEnabled: true,
            combinedFlagEnabled: false,
          }),
        },
      }),
  },
  {
    id: 'flags-all-off',
    label: 'Flags all off',
    group: 'Flag pills',
    description: 'Every flag pill released.',
    createFixture: () =>
      fixtureWith({
        storage: {
          ...settingsStorage({
            commentsFlagEnabled: false,
            editedFlagEnabled: false,
            combinedFlagEnabled: false,
          }),
        },
      }),
  },

  // --- Reduce motion ---
  {
    id: 'reduce-motion-on',
    label: 'Reduce motion on',
    group: 'Reduce motion',
    description:
      'reducedMotionPreferred on: the app root gets cqd-reduce-motion; celebrations skip confetti.',
    createFixture: () =>
      fixtureWith({ storage: { ...settingsStorage({ reducedMotionPreferred: true }) } }),
  },
  {
    id: 'reduce-motion-off',
    label: 'Reduce motion off (default)',
    group: 'Reduce motion',
    description: 'Motion allowed — the explicit off state.',
    createFixture: () => firstRunFixture(),
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
  {
    id: 'share-panel-open',
    label: 'Share panel open',
    group: 'Views',
    description: 'The share toggle expands the browser-link rows with copy buttons.',
    createFixture: () => firstRunFixture(),
    drive: (root) => click(root, 'button[aria-label="Share extension links"]'),
  },
  {
    id: 'bmc-shimmer',
    label: 'BMC star shimmer',
    group: 'Views',
    description:
      'Scrolls the real popup to the About card: the Buy Me a Coffee button with its star shimmer.',
    createFixture: () => firstRunFixture(),
    drive: (root) => {
      const scroller = root.querySelector<HTMLElement>('.cqd-scroll-container');
      if (!scroller) return;
      scroller.scrollTop = scroller.scrollHeight;
      scroller.dispatchEvent(new Event('scroll'));
    },
  },
];

/** Convenience lookup used by the router and the map. */
export function getPopupState(id: string | null | undefined): PopupState | undefined {
  if (!id) return undefined;
  return POPUP_STATES.find((state) => state.id === id);
}
