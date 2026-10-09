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
import { isApiConfigured } from '../../src/engines/v3/api/config';
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
      {/* Legal round 2, surface 02 Treatment 2 (legal-round2.html): the
          standing Permissions reference — every permission the manifest asks
          for, each row expanding on tap to the plain-language reason plus the
          exact mechanism name in faint type. No first-run interruption. */}
      <PermissionsExplainer />
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

/** Small decorative icons for the three permission rows (legal-round2.html
 *  stage 02 T2 .acc-ic). Purely decorative — the names carry the meaning. */
function PermIcon({ kind }: { kind: 'downloads' | 'storage' | 'identity' }) {
  if (kind === 'downloads') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2v8m0 0 3-3m-3 3L5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.5 12.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'storage') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.5 6.5h5M5.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 13.5c.7-2.4 2.7-3.5 5-3.5s4.3 1.1 5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

interface PermRowSpec {
  kind: 'downloads' | 'storage' | 'identity';
  name: string;
  /** The exact mechanism, in faint type under the name (prototype .acc-name small). */
  mechanism: string;
  reason: string;
  note: string;
  /** The identity row appears only for users who see the beta. */
  betaOnly?: boolean;
}

const PERM_ROWS: PermRowSpec[] = [
  {
    kind: 'downloads',
    name: 'Downloads',
    mechanism: 'chrome.downloads',
    reason: 'Saves the attachments you choose into your Downloads folder, and shows progress as they arrive.',
    note: 'Core feature — nothing downloads without this.',
  },
  {
    kind: 'storage',
    name: 'Storage',
    mechanism: 'chrome.storage.local',
    reason: 'Remembers your settings on this device. It never stores your files.',
    note: 'Settings only — engine choice, highlights, flags.',
  },
  {
    kind: 'identity',
    name: 'Your Google account',
    mechanism: 'chrome.identity · beta only',
    reason:
      "Used only when you start the API beta. It lists your own Classroom files through Google's official API. The sign-in token stays in your browser and never reaches the developer.",
    note: 'This row appears only for users who see the beta.',
    betaOnly: true,
  },
];

/**
 * The Permissions explainer (legal round 2, surface 02 Treatment 2,
 * owner-approved): a standing reference in Options — each row expands on tap
 * to the plain-language reason plus the mechanism name. Chrome's own prompt
 * is coarse; these rows close the gap on demand, with zero first-run
 * interruptions anywhere else. Keyboard: each head is a real button with
 * aria-expanded/aria-controls; the collapsed body is visibility:hidden so it
 * leaves the tab order. The collapse animation rides the shared Stillwater
 * token; the global reduce-motion collapse flattens it.
 */
export function PermissionsExplainer() {
  // S13: the identity row renders only when the install can actually run the
  // beta (identity permission + oauth2 client_id) — the same single gate the
  // popup's API segment reads. The manifest does not change while open.
  const [apiConfigured] = useState(isApiConfigured);
  // Downloads starts expanded — the prototype's initial state (acc-1 open).
  const [openKinds, setOpenKinds] = useState<Set<string>>(() => new Set(['downloads']));

  const toggle = (kind: string): void => {
    setOpenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <section className="cqd-options-perms" aria-label="Permissions">
      <h2 className="cqd-options-perms-title">Permissions</h2>
      {PERM_ROWS.filter((row) => !row.betaOnly || apiConfigured).map((row) => {
        const open = openKinds.has(row.kind);
        const bodyId = `cqd-perm-body-${row.kind}`;
        return (
          <div key={row.kind} className={`cqd-perm-row ${open ? 'open' : ''}`}>
            <button
              type="button"
              className="cqd-perm-head"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => toggle(row.kind)}
            >
              <span className="cqd-perm-ic" aria-hidden="true">
                <PermIcon kind={row.kind} />
              </span>
              <span className="cqd-perm-name">
                <b>{row.name}</b>
                <small>{row.mechanism}</small>
              </span>
              <span className="cqd-perm-chevron" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
            <div id={bodyId} className={`cqd-perm-collapse ${open ? 'open' : ''}`}>
              <div className="cqd-perm-body">
                <p>
                  {row.reason}
                  <em>{row.note}</em>
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
