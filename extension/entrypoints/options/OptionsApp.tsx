// filepath: extension/entrypoints/options/OptionsApp.tsx
/**
 * The options page (bead 0h4d.1.8): settings leave the popup. All toggles
 * go through the shared settings store (src/ui/settings/store.ts) — the
 * same flat keys, the same live-apply contract the popup has; the two
 * surfaces stay in sync via watchSettings.
 */
import { useEffect, useState } from 'react';
// Stillwater foundation (tokens, reset, focus, motion collapse) — the same
// sheet the popup imports; this page's surface rules live in options.css.
import '../../src/ui/stillwater.css';
import './options.css';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSetting,
  watchSettings,
  type Settings,
  type SettingsKey,
} from '../../src/ui/settings/store';

interface Row {
  key: SettingsKey;
  label: string;
  description: string;
  primary?: boolean;
}

const ROWS: Row[] = [
  {
    key: 'extensionEnabled',
    label: 'Enable Extension',
    description: 'Turn the extension on or off globally.',
    primary: true,
  },
  {
    key: 'downloadAllEnabled',
    label: 'Download All button',
    description: 'Show the per-post Download All control.',
  },
  {
    key: 'commentsFlagEnabled',
    label: 'Comment flags',
    description: 'Highlight posts that have student comments.',
  },
  {
    key: 'editedFlagEnabled',
    label: 'Edited flags',
    description: 'Highlight posts that were edited after publishing.',
  },
  {
    key: 'combinedFlagEnabled',
    label: 'Combined flags',
    description: 'Merge comment and edited markers into one flag.',
  },
  {
    key: 'reducedMotionPreferred',
    label: 'Reduce motion',
    description: 'Minimize animations across the extension.',
  },
];

export function OptionsApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadSettings().then((s) => {
      if (alive) {
        setSettings(s);
        setLoading(false);
      }
    });
    const unwatch = watchSettings((s) => {
      if (alive) setSettings(s);
    });
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  const toggle = (key: SettingsKey): void => {
    if (loading) return;
    setSettings((prev) => ({ ...prev, [key]: !prev[key] })); // optimistic
    void saveSetting(key, !settings[key]);
  };

  return (
    <main className={`cqd-options ${settings.reducedMotionPreferred ? 'cqd-reduce-motion' : ''}`}>
      <header className="cqd-options-header">
        <h1>Classroom Quick Downloader</h1>
        <p className="cqd-options-sub">Settings apply immediately — no save button needed.</p>
      </header>
      <section className="cqd-options-card" aria-label="Settings">
        {ROWS.map((row) => (
          <div key={row.key} className="cqd-options-row">
            <div className="cqd-options-row-text">
              <span className={`cqd-options-label ${row.primary ? 'cqd-options-label-primary' : ''}`}>
                {row.label}
              </span>
              <span className="cqd-options-description">{row.description}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings[row.key]}
              aria-label={row.label}
              disabled={loading}
              className={`cqd-options-toggle ${settings[row.key] ? 'on' : 'off'}`}
              onClick={() => toggle(row.key)}
            >
              <span className="cqd-options-knob" />
            </button>
          </div>
        ))}
      </section>
      {/* Legal round 2, surface 05 Treatment 1 (legal-round2.html): the
          Limited Use two-line block — the plain-language line first, the
          exact Chrome Web Store sentence second, smaller and dimmer, fixed
          order, never merged into one paragraph. Hardcoded English matches
          this page's convention; the i18n sweep bead will adopt it. */}
      <section className="cqd-options-lu" aria-label="API beta data use">
        <h4>API (beta) — data use</h4>
        <p>The beta only lists and downloads files from classrooms you are enrolled in.</p>
        <p className="cqd-options-lu-line">
          The use of information received from Google APIs will adhere to the
          Chrome Web Store User Data Policy, including the Limited Use
          requirements.
        </p>
      </section>
      <p className="cqd-options-note">
        Everything here stays on your machine. Quick controls live in the toolbar popup.
      </p>
      <button
        type="button"
        className="cqd-options-diag-link"
        onClick={() => {
          const browserApi = (globalThis as { chrome?: { tabs?: { create?: Function } } }).chrome;
          browserApi?.tabs?.create?.({ url: 'diagnostics.html' });
        }}
      >
        Diagnostics report
      </button>
      {/* The approved affiliation notice, verbatim from the popup footer
          (legal.html surface 03). Same copy, same 10px legal step via the
          .cqd-options-affil rule that lives with the other options styles in
          the page's own options.css. Hardcoded English matches this page's
          convention. */}
      <footer className="cqd-options-affil">
        <strong>Not affiliated with Google.</strong> Downloads belong to their
        owners — follow your school's policies.
      </footer>
    </main>
  );
}
