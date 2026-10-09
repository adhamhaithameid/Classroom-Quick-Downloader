import { useState } from 'react';
import { saveSetting, SETTINGS_KEYS, type SettingsKey } from '../../../extension/src/ui/settings/store';
import { createEmptyStats, saveDownloadStats } from '../../../extension/src/history/download-stats';
import { fixture, installFixtureChrome, notifyFixtureChanged } from '../fixtures/fixture-chrome';
import {
  CLASSROOM_TAB_URL,
  OTHER_TAB_URL,
  historyRowsFixtureHelpers,
  localStatsStorage,
  queueRowsFixtureHelpers,
} from '../fixtures/fixture-state';
import { POPUP_STATES } from '../fixtures/states';
import { popupHash } from '../hash';
import { useFixtureVersion } from '../hooks/useFixtureVersion';

const SETTING_LABELS: Record<SettingsKey, string> = {
  extensionEnabled: 'Enable Extension',
  downloadAllEnabled: 'Download All button',
  commentsFlagEnabled: 'Comment flags',
  editedFlagEnabled: 'Edited flags',
  combinedFlagEnabled: 'Combined flags',
  reducedMotionPreferred: 'Reduce motion',
  apiBetaConfirmed: 'API beta confirmed',
  copyrightReminderAcknowledged: 'Copyright reminder acknowledged',
};

function boolSetting(key: SettingsKey): boolean {
  const value = fixture().storage[key];
  return typeof value === 'boolean' ? value : false;
}

/**
 * Route A control panel. Writes go through the REAL production write paths
 * (saveSetting, saveDownloadStats, chrome.storage.local.set) so the popup
 * reacts exactly as it would in the extension.
 */
export function ControlPanel({
  activeStateId,
  onRemount,
}: {
  activeStateId: string;
  onRemount: () => void;
}) {
  useFixtureVersion();
  const [, setBump] = useState(0);
  const bump = () => setBump((n) => n + 1);

  const current = fixture();

  async function writeSetting(key: SettingsKey, value: boolean) {
    await saveSetting(key, value);
    bump();
  }

  async function writeEngineMode(mode: string) {
    const chromeRef = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>, cb?: () => void) => void } } } }).chrome;
    chromeRef?.storage?.local?.set({ cqdV2Mode: mode }, () => {});
    bump();
  }

  async function writeStats(count: number, pending: number | null, last: number | null) {
    const stats = {
      ...createEmptyStats(),
      lifetimeCount: count,
      milestonePending: pending,
      lastMilestoneReached: last,
      countedDownloadIds: Array.from({ length: Math.min(count, 5) }, (_, i) => `panel-${i + 1}`),
    };
    await saveDownloadStats(stats);
    bump();
  }

  function writeLocalStats(byType: Record<string, number>) {
    const chromeRef = (globalThis as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>, cb?: () => void) => void } } } }).chrome;
    chromeRef?.storage?.local?.set(localStatsStorage(byType), () => {});
    bump();
  }

  function setQueue(kind: 'running' | 'paused' | 'clear') {
    if (kind === 'running') {
      current.queueRows = queueRowsFixtureHelpers.running();
      current.queuePaused = false;
    } else if (kind === 'paused') {
      current.queueRows = queueRowsFixtureHelpers.running();
      current.queuePaused = true;
    } else {
      current.queueRows = [];
      current.queuePaused = false;
    }
    notifyFixtureChanged();
  }

  function setHistory(kind: 'empty' | 'mixed' | 'failed' | 'corrupt' | 'readfail') {
    if (kind === 'empty') {
      current.historyRows = [];
      current.historyFails = false;
    } else if (kind === 'mixed') {
      current.historyRows = historyRowsFixtureHelpers.mixed();
      current.historyFails = false;
    } else if (kind === 'failed') {
      current.historyRows = historyRowsFixtureHelpers.failed();
      current.historyFails = false;
    } else if (kind === 'corrupt') {
      current.historyRows = [historyRowsFixtureHelpers.corrupt()];
      current.historyFails = false;
    } else {
      current.historyRows = [];
      current.historyFails = true;
    }
    notifyFixtureChanged();
    onRemount(); // the popup refetches history only on query changes
  }

  function replaceFixture(patch: Partial<ReturnType<typeof fixture>>) {
    installFixtureChrome({ ...fixture(), ...patch });
    onRemount();
  }

  return (
    <aside className="sim-panel" aria-label="Simulator controls">
      <fieldset className="sim-group">
        <legend>Scenario</legend>
        <label className="sim-field">
          <span>State</span>
          <select
            value={activeStateId}
            onChange={(event) => {
              window.location.hash = popupHash(event.target.value);
            }}
          >
            {POPUP_STATES.map((state) => (
              <option key={state.id} value={state.id}>
                {state.group} — {state.label}
              </option>
            ))}
          </select>
        </label>
        <div className="sim-row">
          <button type="button" onClick={onRemount}>
            Remount App
          </button>
          <a className="sim-button-link" href={popupHash(activeStateId)}>
            Replay state
          </a>
        </div>
      </fieldset>

      <fieldset className="sim-group">
        <legend>Settings (live)</legend>
        {SETTINGS_KEYS.map((key) => (
          <label key={key} className="sim-check">
            <input
              type="checkbox"
              checked={boolSetting(key)}
              onChange={(event) => void writeSetting(key, event.target.checked)}
            />
            <span>{SETTING_LABELS[key]}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="sim-group">
        <legend>Engine (live)</legend>
        <label className="sim-field">
          <span>cqdV2Mode storage</span>
          <select
            defaultValue={String(fixture().storage.cqdV2Mode ?? 'v2')}
            onChange={(event) => void writeEngineMode(event.target.value)}
            key={`engine-${String(fixture().storage.cqdV2Mode ?? 'v2')}`}
          >
            <option value="legacy">legacy</option>
            <option value="v2">v2 (New)</option>
            <option value="v3">v3 (API beta)</option>
          </select>
        </label>
        <label className="sim-check">
          <input
            type="checkbox"
            checked={current.apiConfigured}
            onChange={(event) => replaceFixture({ apiConfigured: event.target.checked })}
          />
          <span>OAuth configured (remounts)</span>
        </label>
      </fieldset>

      <fieldset className="sim-group">
        <legend>Lifetime stats (live)</legend>
        <div className="sim-row">
          <button type="button" onClick={() => void writeStats(0, null, null)}>
            0 files
          </button>
          <button type="button" onClick={() => void writeStats(1, 1, 1)}>
            1 + milestone pending
          </button>
        </div>
        <div className="sim-row">
          <button type="button" onClick={() => void writeStats(137, null, 100)}>
            137 files
          </button>
          <button type="button" onClick={() => void writeStats(50, 50, 50)}>
            50 + pending replay
          </button>
          <button type="button" onClick={() => void writeStats(1_000_000, null, 1_000_000)}>
            1M legend
          </button>
        </div>
      </fieldset>

      <fieldset className="sim-group">
        <legend>Donut data (live)</legend>
        <div className="sim-row">
          <button type="button" onClick={() => writeLocalStats({})}>
            empty
          </button>
          <button type="button" onClick={() => writeLocalStats({ pdf: 90, doc: 30, slide: 17 })}>
            three types
          </button>
          <button
            type="button"
            onClick={() =>
              writeLocalStats({ pdf: 500, doc: 300, sheet: 120, slide: 90, image: 40, zip: 12 })
            }
          >
            six types (Other)
          </button>
        </div>
      </fieldset>

      <fieldset className="sim-group">
        <legend>Queue (live)</legend>
        <div className="sim-row">
          <button type="button" onClick={() => setQueue('clear')}>
            idle
          </button>
          <button type="button" onClick={() => setQueue('running')}>
            running
          </button>
          <button type="button" onClick={() => setQueue('paused')}>
            paused
          </button>
        </div>
      </fieldset>

      <fieldset className="sim-group">
        <legend>History (remounts)</legend>
        <div className="sim-row">
          <button type="button" onClick={() => setHistory('empty')}>
            empty
          </button>
          <button type="button" onClick={() => setHistory('mixed')}>
            populated
          </button>
          <button type="button" onClick={() => setHistory('failed')}>
            failed rows
          </button>
        </div>
        <div className="sim-row">
          <button type="button" onClick={() => setHistory('corrupt')}>
            corrupt record
          </button>
          <button type="button" onClick={() => setHistory('readfail')}>
            read fails
          </button>
        </div>
      </fieldset>

      <fieldset className="sim-group">
        <legend>Tab &amp; identity (remounts)</legend>
        <div className="sim-row">
          <button type="button" onClick={() => replaceFixture({ tabUrl: CLASSROOM_TAB_URL })}>
            Classroom tab
          </button>
          <button type="button" onClick={() => replaceFixture({ tabUrl: OTHER_TAB_URL })}>
            Other tab
          </button>
        </div>
        <label className="sim-field">
          <span>Version</span>
          <input
            type="text"
            defaultValue={current.version}
            onBlur={(event) => {
              const version = event.target.value.trim();
              if (version && version !== current.version) replaceFixture({ version });
            }}
          />
        </label>
        <div className="sim-row">
          <button type="button" onClick={() => replaceFixture({ changelog: 'real' })}>
            Changelog: real
          </button>
          <button type="button" onClick={() => replaceFixture({ changelog: 'fail' })}>
            Changelog: fail
          </button>
        </div>
      </fieldset>
    </aside>
  );
}
