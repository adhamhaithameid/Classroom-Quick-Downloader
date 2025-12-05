// src/App.tsx

import { useEffect, useRef, useState } from 'react';
import './App.css';
import logoSrc from '../../assets/Google Classroom Downloade Icon.png';
import bmcLogoSrc from '../../assets/bmc-logo.svg';

// External Links
const SURVEY_URL = 'https://forms.gle/wPU2b1Qxa7svHqJa6';
const GITHUB_REPO_URL = 'https://github.com/adhamhaithameid/classroom-quick-downloader';
const EXTENSION_STORE_URL = 'https://chromewebstore.google.com/';
const BUY_ME_COFFEE_URL = 'https://buymeacoffee.com/adhamhaithameid';

type Settings = {
  /** Desired master toggle (what the switch represents) */
  extensionEnabled: boolean;
  downloadAllEnabled: boolean;
  commentsFlagEnabled: boolean;
  editedFlagEnabled: boolean;
  combinedFlagEnabled: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  extensionEnabled: true,
  downloadAllEnabled: true,
  commentsFlagEnabled: true,
  editedFlagEnabled: true,
  combinedFlagEnabled: true,
};

type ToggleRowProps = {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
};

// --- Analytics Helper Types ---
type StatItem = { id: string; label: string; value: number; color: string };

/**
 * Try to discover the *effective* runtime state from classroom tabs.
 * This is optional sugar: if no content scripts respond, we just keep the fallback.
 *
 * Expected content-script handler:
 *   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
 *     if (msg.type === 'CQD_QUERY_EFFECTIVE_STATE') {
 *       sendResponse({ enabled: isCurrentlyEnabledOnThisPage });
 *     }
 *   });
 */
function discoverEffectiveStateFromTabs(
  fallback: boolean,
  onState: (state: boolean) => void,
) {
  // Guard: in popup context chrome is defined, but this keeps things safer in tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyChrome = (globalThis as any).chrome as typeof chrome | undefined;
  if (!anyChrome?.tabs) return;

  anyChrome.tabs.query({ url: '*://classroom.google.com/*' }, (tabs) => {
    if (!tabs?.length) return;

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        onState(fallback);
      }
    }, 400);

    tabs.forEach((tab) => {
      if (!tab.id) return;
      try {
        anyChrome.tabs.sendMessage(
          tab.id,
          { type: 'CQD_QUERY_EFFECTIVE_STATE' },
          (response) => {
            if (resolved) return;
            if (anyChrome.runtime.lastError || !response) return;

            if (typeof response.enabled === 'boolean') {
              resolved = true;
              clearTimeout(timeout);
              onState(response.enabled);
            }
          },
        );
      } catch {
        // ignore
      }
    });
  });
}

function App() {
  // Desired global settings (what the switches represent)
  const [settings, setSettings] = useState<Settings | null>(null);

  // Effective state of the extension on Classroom pages (what the dot represents)
  const [siteEnabled, setSiteEnabled] = useState<boolean | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  const [shareStatus, setShareStatus] =
    useState<'idle' | 'copied' | 'error'>('idle');

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // --- MOCK DATA FOR ANALYTICS (Replace with real data logic later) ---
  const stats: StatItem[] = [
    { id: 'docs', label: 'Docs', value: 12, color: 'var(--cqd-blue)' },
    { id: 'pdf', label: 'PDFs', value: 8, color: 'var(--cqd-red)' },
    { id: 'images', label: 'Images', value: 5, color: '#10b981' },
  ];

  const totalDownloads = stats.reduce((acc, curr) => acc + curr.value, 0);

  // Load current settings + version + effective site state on mount
  useEffect(() => {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest?.version) {
        setVersion(manifest.version);
      }
    } catch {
      // ignore
    }

    if (!chrome?.storage?.local) {
      setSettings(DEFAULT_SETTINGS);
      setSiteEnabled(DEFAULT_SETTINGS.extensionEnabled);
      return;
    }

    chrome.storage.local.get(
      {
        cqdEnabled: true,
        cqdDownloadAllEnabled: true,
        cqdCommentsFlagEnabled: true,
        cqdEditedFlagEnabled: true,
        cqdCombinedFlagEnabled: true,
        // New explicit effective-state flag
        cqdEffectiveEnabled: null,
        // For migration from the old "pendingReload" scheme
        cqdPendingReload: false,
      },
      (result) => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message || 'Unknown error');
          setSettings(DEFAULT_SETTINGS);
          setSiteEnabled(DEFAULT_SETTINGS.extensionEnabled);
          return;
        }

        const desiredEnabled = result.cqdEnabled !== false;

        const nextSettings: Settings = {
          extensionEnabled: desiredEnabled,
          downloadAllEnabled: result.cqdDownloadAllEnabled !== false,
          commentsFlagEnabled: result.cqdCommentsFlagEnabled !== false,
          editedFlagEnabled: result.cqdEditedFlagEnabled !== false,
          combinedFlagEnabled: result.cqdCombinedFlagEnabled !== false,
        };

        setSettings(nextSettings);

        // --- Determine effective state (what Classroom is actually running) ---
        let effective: boolean;
        if (typeof result.cqdEffectiveEnabled === 'boolean') {
          // New format: trust the explicit effective flag
          effective = result.cqdEffectiveEnabled;
        } else if (result.cqdPendingReload === true) {
          // Old format: pendingReload meant "pages still running the previous state"
          // -> effective = !desired
          effective = !desiredEnabled;
        } else {
          // No other info: assume pages already match desired
          effective = desiredEnabled;
        }

        setSiteEnabled(effective);

        // Migrate storage to the new shape: explicit effective flag, no pendingReload
        chrome.storage.local.set({
          cqdEffectiveEnabled: effective,
          cqdPendingReload: false,
        });

        // Optional: refine with a live check from Classroom content scripts
        discoverEffectiveStateFromTabs(effective, (runtimeState) => {
          setSiteEnabled(runtimeState);
          chrome.storage.local.set({ cqdEffectiveEnabled: runtimeState });
        });
      },
    );
  }, []);

  // Listen for live effective-state updates broadcasted by content scripts
  // (optional but nice if you ever toggle state from inside the page)
  useEffect(() => {
    if (!chrome?.runtime?.onMessage) return;

    const handler = (
      message: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) => {
      if (
        message?.type === 'CQD_EFFECTIVE_STATE_CHANGED' &&
        typeof message.enabled === 'boolean'
      ) {
        setSiteEnabled(message.enabled);
        if (chrome?.storage?.local) {
          chrome.storage.local.set({ cqdEffectiveEnabled: message.enabled });
        }
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, []);

  async function persistSettings(next: Settings) {
    setSaving(true);
    setError(null);

    const toStore: Record<string, boolean> = {
      cqdEnabled: next.extensionEnabled,
      cqdDownloadAllEnabled: next.downloadAllEnabled,
      cqdCommentsFlagEnabled: next.commentsFlagEnabled,
      cqdEditedFlagEnabled: next.editedFlagEnabled,
      cqdCombinedFlagEnabled: next.combinedFlagEnabled,
      // NOTE: we *do not* touch cqdEffectiveEnabled here.
      // It only changes when the actual site state changes (reload).
    };

    const savePromise = new Promise<void>((resolve, reject) => {
      if (!chrome?.storage?.local) {
        resolve();
        return;
      }
      chrome.storage.local.set(toStore, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    try {
      await savePromise;

      // Notify other parts (content scripts) that settings changed (desired state)
      try {
        chrome.runtime.sendMessage(
          { type: 'CQD_SETTINGS_UPDATED', settings: next },
          () => void chrome.runtime.lastError,
        );
      } catch {
        // ignore if runtime is unavailable
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  function updateSettings(partial: Partial<Settings>) {
    if (!settings) return;
    const prev = settings;
    const next: Settings = { ...settings, ...partial };
    setSettings(next); // optimistic UI
    persistSettings(next).catch(() => {
      // roll back on failure
      setSettings(prev);
    });
  }

  function handleToggleExtension() {
    if (!settings) return;
    updateSettings({ extensionEnabled: !settings.extensionEnabled });
  }

  // --- Action: Reload Tabs (apply desired -> effective) ---
  function handleReloadTabs() {
    if (!chrome?.tabs || !settings) return;

    const desiredEnabled = settings.extensionEnabled;

    chrome.tabs.query({ url: '*://classroom.google.com/*' }, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) chrome.tabs.reload(tab.id);
      });

      // As soon as we trigger reloads, we can treat the effective state as updated.
      if (chrome?.storage?.local) {
        chrome.storage.local.set(
          { cqdEffectiveEnabled: desiredEnabled },
          () => setSiteEnabled(desiredEnabled),
        );
      } else {
        setSiteEnabled(desiredEnabled);
      }
    });
  }

  async function handleShareClick() {
    setShareStatus('idle');
    const linkToCopy = EXTENSION_STORE_URL;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(linkToCopy);
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2500);
      } else {
        setShareStatus('error');
      }
    } catch {
      setShareStatus('error');
    }
  }

  // --- Donut Chart Calculation ---
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  const chartSegments = stats.map((stat) => {
    const percentage = totalDownloads === 0 ? 0 : stat.value / totalDownloads;
    const strokeLength = percentage * circumference;
    const offset = cumulativeOffset;
    cumulativeOffset += strokeLength;

    return {
      ...stat,
      strokeLength,
      offset: -offset,
    };
  });

  const isLoadingSettings = settings == null;

  const extensionStatusLabel =
    settings == null || siteEnabled == null
      ? 'Loading…'
      : siteEnabled
      ? 'Active'
      : 'Disabled';

  const needsReload =
    settings != null &&
    siteEnabled != null &&
    settings.extensionEnabled !== siteEnabled;

  return (
    <main className="cqd-app">
      <div className="cqd-scroll-container" ref={scrollRef}>
        <header className="cqd-header">
          <div className="cqd-brand-row">
            <img src={logoSrc} alt="CQD Logo" className="cqd-brand-logo" />
            <div className="cqd-brand-text">
              <div className="cqd-brand-name">Classroom Quick Downloader</div>
              <div className="cqd-brand-meta">
                {/* Status dot = effective site state (what the pages are actually running) */}
                <span
                  className={`cqd-brand-status-dot ${
                    siteEnabled ? 'on' : ''
                  }`}
                  aria-hidden="true"
                />
                <span className="cqd-brand-status-text">
                  {extensionStatusLabel}
                </span>
                {version && (
                  <span
                    className="cqd-brand-version"
                    aria-label={`Version ${version}`}
                  >
                    v{version}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="cqd-content-area">
          {/* Dynamic Reload Banner:
              Shown ONLY when desired state (switch) !== effective state (dot).
          */}
          {needsReload && (
            <div className="cqd-banner cqd-banner-reload" role="status">
              <div className="cqd-banner-content">
                <div className="cqd-banner-indicator" aria-hidden="true" />
                <div className="cqd-banner-text">
                  <strong>Changes saved.</strong> Reload to apply.
                </div>
              </div>
              <button
                type="button"
                className="cqd-banner-action-btn"
                onClick={handleReloadTabs}
              >
                Reload Now
              </button>
            </div>
          )}

          {error && (
            <div className="cqd-banner cqd-banner-error" role="alert">
              <div className="cqd-banner-content">
                <div className="cqd-banner-indicator" aria-hidden="true" />
                <div className="cqd-banner-text">Error: {error}</div>
              </div>
              <button
                type="button"
                className="cqd-banner-close"
                onClick={() => setError(null)}
              >
                ×
              </button>
            </div>
          )}

          {/* Section 1: Analysis */}
          <section className="cqd-panel">
            <div className="cqd-card cqd-card-analytics">
              <div className="cqd-card-header">
                <h2 className="cqd-card-title">Download Activity</h2>
                <p className="cqd-card-subtitle">
                  Overview of your Classroom downloads.
                </p>
              </div>
              <div className="cqd-analytics-layout">
                {/* SVG Ring Chart */}
                <div className="cqd-analytics-circle-wrapper">
                  <svg
                    width="100"
                    height="100"
                    viewBox="0 0 100 100"
                    className="cqd-analytics-svg"
                  >
                    {/* Background Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke="var(--cqd-surface)"
                      strokeWidth="10"
                    />

                    {/* Data Segments */}
                    {totalDownloads > 0 &&
                      chartSegments.map((seg) => (
                        <circle
                          key={seg.id}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="10"
                          strokeDasharray={`${seg.strokeLength} ${circumference}`}
                          strokeDashoffset={seg.offset}
                          className="cqd-ring-segment"
                        >
                          <title>{`${seg.label}: ${seg.value}`}</title>
                        </circle>
                      ))}
                  </svg>

                  {/* Centered Text */}
                  <div className="cqd-analytics-circle-inner">
                    <div className="cqd-analytics-main-number">
                      {totalDownloads}
                    </div>
                  </div>
                </div>

                <div className="cqd-analytics-side">
                  <ul className="cqd-analytics-legend">
                    {stats.map((stat) => (
                      <li key={stat.id}>
                        <span
                          className="cqd-legend-dot"
                          style={{ backgroundColor: stat.color }}
                        />
                        {stat.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Settings */}
          <section className="cqd-panel">
            <div className="cqd-card cqd-card-settings">
              <div className="cqd-card-header">
                <h2 className="cqd-card-title">Extension Settings</h2>
                <p className="cqd-card-subtitle">Manage core features.</p>
              </div>

              <div className="cqd-toggle-group">
                <ToggleRow
                  label="Enable extension"
                  description="Master switch for all features."
                  checked={settings?.extensionEnabled ?? false}
                  loading={isLoadingSettings || saving}
                  onToggle={handleToggleExtension}
                  disabled={isLoadingSettings}
                  primary
                />
              </div>
            </div>
          </section>

          {/* Section 3: Info & Credits */}
          <section className="cqd-panel">
            <div className="cqd-card cqd-card-info">
              <div className="cqd-card-header">
                <h2 className="cqd-card-title">About</h2>
                <div className="cqd-designer-wrapper">
                  <p className="cqd-designer-credit">
                    <span className="cqd-designer-main-line">
                      Designed &amp; built by{' '}
                      <span className="cqd-designer-name">Adham Haitham</span>
                    </span>
                    <span className="cqd-designer-extra">
                      Junior Software Engineer &amp; UI/UX Designer
                    </span>
                  </p>
                </div>
              </div>

              <div className="cqd-info-actions">
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="cqd-button cqd-button-primary"
                >
                  <span className="cqd-button-icon">
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405 1.02 0 2.04.135 3 .405 2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                      />
                    </svg>
                  </span>
                </a>

                <button
                  type="button"
                  className="cqd-coffee-button"
                  onClick={() =>
                    window.open(
                      BUY_ME_COFFEE_URL,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  <img
                    src={bmcLogoSrc}
                    alt="Buy Me a Coffee"
                    className="cqd-coffee-icon"
                  />
                </button>

                <button
                  type="button"
                  className={`cqd-button cqd-button-ghost ${
                    shareStatus === 'copied' ? 'success' : ''
                  }`}
                  onClick={handleShareClick}
                >
                  <span className="cqd-button-icon">
                    {shareStatus === 'copied' ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line
                          x1="8.59"
                          y1="13.51"
                          x2="15.42"
                          y2="17.49"
                        ></line>
                        <line
                          x1="15.41"
                          y1="6.51"
                          x2="8.59"
                          y2="10.49"
                        ></line>
                      </svg>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </section>

          <footer className="cqd-footer">
            <div className="cqd-footer-inner">
              <p className="cqd-footer-text">
                Have a suggestion?{' '}
                <a
                  href={SURVEY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="cqd-footer-link"
                >
                  Take the survey
                </a>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

// --- Subcomponents ---

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
  disabled,
  loading,
  primary,
}: ToggleRowProps) {
  const isDisabled = !!disabled || !!loading;

  const handleChange = () => {
    if (!isDisabled) {
      onToggle();
    }
  };

  return (
    <div
      className={`cqd-toggle-row ${
        primary ? 'cqd-toggle-row-primary' : ''
      } ${isDisabled ? 'disabled' : ''}`}
    >
      <div className="cqd-toggle-text">
        <div className="cqd-toggle-label">{label}</div>
        {description && (
          <p className="cqd-toggle-description">{description}</p>
        )}
      </div>
      <label
        className={`cqd-switch ${loading ? 'cqd-switch-loading' : ''}`}
        aria-label={label}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={isDisabled}
          onChange={handleChange}
        />
        <div className="cqd-switch-slider">
          <div className="cqd-switch-circle">
            <svg
              className="cqd-switch-cross"
              viewBox="0 0 365.696 365.696"
              width="6"
              height="6"
            >
              <path
                fill="currentColor"
                d="M243.188 182.86 356.32 69.726c12.5-12.5 12.5-32.766 0-45.247L341.238 9.398c-12.504-12.503-32.77-12.503-45.25 0L182.86 122.528 69.727 9.374c-12.5-12.5-32.766-12.5-45.247 0L9.375 24.457c-12.5 12.504-12.5 32.77 0 45.25l113.152 113.152L9.398 295.99c-12.503 12.503-12.503 32.769 0 45.25L24.48 356.32c12.5 12.5 32.766 12.5 45.247 0l113.132-113.132L295.99 356.32c12.503 12.5 32.769 12.5 45.25 0l15.081-15.082c12.5-12.504 12.5-32.77 0-45.25zm0 0"
              />
            </svg>
            <svg
              className="cqd-switch-checkmark"
              viewBox="0 0 24 24"
              width="10"
              height="10"
            >
              <path
                fill="currentColor"
                d="M9.707 19.121a.997.997 0 0 1-1.414 0l-5.646-5.647a1.5 1.5 0 0 1 0-2.121l.707-.707a1.5 1.5 0 0 1 2.121 0L9 14.171l9.525-9.525a1.5 1.5 0 0 1 2.121 0l.707.707a1.5 1.5 0 0 1 0 2.121z"
              />
            </svg>
          </div>
        </div>
      </label>
    </div>
  );
}

export default App;