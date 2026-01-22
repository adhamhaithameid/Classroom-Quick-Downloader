// filepath: entrypoints/popup/App.tsx

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import './App.css';
import logoSrc from '../../assets/CQD.png';
import logoGraySrc from '../../assets/CQD-gray.png';
import bmcLogoSrc from '../../public/bmc-logo.svg';

// External Links
const SURVEY_URL = 'https://forms.gle/wPU2b1Qxa7svHqJa6';
const GITHUB_REPO_URL =
  'https://github.com/adhamhaithameid/classroom-quick-downloader';
const EXTENSION_STORE_URL = 'https://chromewebstore.google.com/';
const BUY_ME_COFFEE_URL = 'https://buymeacoffee.com/adhamhaithameid';

type Settings = {
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

type StatItem = { id: string; label: string; value: number; color: string };

type TabState = {
  desiredEnabled: boolean;
  effectiveEnabled: boolean;
};

// Color mapping for file types
const TYPE_COLORS: Record<string, string> = {
  pdf: 'var(--cqd-red, #ef4444)',
  docs: 'var(--cqd-blue, #3b82f6)',
  images: '#10b981',
  archive: '#f59e0b',
  sheets: '#10b981',
  slides: '#f59e0b',
  other: '#9ca3af',
};

function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tabState, setTabState] = useState<TabState | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const tabIdRef = useRef<number | null>(null);

  const [isClassroomTab, setIsClassroomTab] = useState(false);
  const [loadingState, setLoadingState] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  const [shareStatus, setShareStatus] =
    useState<'idle' | 'copied' | 'error'>('idle');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // REAL STATS STATE
  const [stats, setStats] = useState<StatItem[]>([]);
  const [totalDownloads, setTotalDownloads] = useState(0);

  // Keep ref in sync for onMessage filter
  useEffect(() => {
    tabIdRef.current = tabId;
  }, [tabId]);

  // Track scroll to add blur/shadow under header when not at top
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrolled(el.scrollTop > 0);
    };

    el.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // --- STATS LOADING LOGIC ---
  useEffect(() => {
    // 1. Function to process stats from storage format to Chart format
    const loadStats = async () => {
      try {
        // Wrapper for Firefox which doesn't return Promise for 'chrome' namespace
        const result = await new Promise<any>((resolve) => {
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           (chrome.storage.local as any).get('local_stats', (res: any) => {
             // In Firefox/Chrome callback, result is the object
             if (chrome.runtime.lastError) {
               resolve({});
             } else {
               resolve(res || {});
             }
           });
        });
        const raw = result.local_stats || { total: 0, byType: {} };
        
        setTotalDownloads(raw.total || 0);

        // Convert byType object to sorted array
        const entries = Object.entries(raw.byType as Record<string, number>);
        
        // Sort by count descending
        entries.sort((a, b) => b[1] - a[1]);

        // Take top 4, group others
        const top = entries.slice(0, 4);
        const others = entries.slice(4);
        const otherCount = others.reduce((acc, curr) => acc + curr[1], 0);

        const mapped: StatItem[] = top.map(([key, val]) => ({
          id: key,
          label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize
          value: val,
          color: TYPE_COLORS[key] || TYPE_COLORS.other
        }));

        if (otherCount > 0) {
          mapped.push({
            id: 'other',
            label: 'Other',
            value: otherCount,
            color: TYPE_COLORS.other
          });
        }

        setStats(mapped);

      } catch (e) {
        console.warn('Failed to load stats', e);
      }
    };

    loadStats();

    // 2. Listen for live updates (if user downloads while popup is open)
    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes.local_stats) {
        loadStats();
      }
    };
    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  // Initial: get active tab + version + per-tab state
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome as typeof chrome | undefined;

    // extension version
    try {
      const manifest = browserApi?.runtime?.getManifest();
      if (manifest?.version) {
        setVersion(manifest.version);
      }
    } catch {
      // ignore
    }

    if (!browserApi?.tabs) {
      // fallback for non-extension env
      setSettings(DEFAULT_SETTINGS);
      setTabState({ desiredEnabled: true, effectiveEnabled: true });
      setIsClassroomTab(false);
      setLoadingState(false);
      return;
    }

    browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || tab.id == null) {
        setLoadingState(false);
        return;
      }

      setTabId(tab.id);
      tabIdRef.current = tab.id;

      const url = tab.url || '';
      const classroomMatch = /^https:\/\/classroom\.google\.com\//.test(url);
      setIsClassroomTab(classroomMatch);

      if (!classroomMatch) {
        // Popup opened on a non-Classroom page
        setSettings({ ...DEFAULT_SETTINGS, extensionEnabled: false });
        setTabState({ desiredEnabled: false, effectiveEnabled: false });
        setLoadingState(false);
        return;
      }

      // Ask THIS tab's content script for its local state
      browserApi.tabs.sendMessage(
        tab.id,
        { type: 'CQD_POPUP_QUERY_STATE' },
        (response) => {
          if (browserApi.runtime.lastError || !response) {
            // If content script not ready, assume enabled by default
            const defaultState: TabState = {
              desiredEnabled: true,
              effectiveEnabled: true,
            };
            setSettings({
              ...DEFAULT_SETTINGS,
              extensionEnabled: defaultState.desiredEnabled,
            });
            setTabState(defaultState);
          } else {
            const desired =
              typeof response.desiredEnabled === 'boolean'
                ? response.desiredEnabled
                : true;
            const effective =
              typeof response.effectiveEnabled === 'boolean'
                ? response.effectiveEnabled
                : desired;
            setSettings({
              ...DEFAULT_SETTINGS,
              extensionEnabled: desired,
            });
            setTabState({ desiredEnabled: desired, effectiveEnabled: effective });
          }
          setLoadingState(false);
        },
      );
    });
  }, []);

  // Listen for live effective-state changes from THIS tab only
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome as typeof chrome | undefined;
    if (!browserApi?.runtime?.onMessage) return;

    const handler = (
      message: any,
      sender: chrome.runtime.MessageSender,
    ): void => {
      if (message?.type !== 'CQD_EFFECTIVE_STATE_CHANGED') return;

      const currentTabId = tabIdRef.current;
      if (!currentTabId || sender.tab?.id !== currentTabId) return;

      setTabState((prev) => {
        if (!prev) {
          return {
            desiredEnabled: !!message.enabled,
            effectiveEnabled: !!message.enabled,
          };
        }
        return {
          ...prev,
          effectiveEnabled: !!message.enabled,
        };
      });
    };

    browserApi.runtime.onMessage.addListener(handler);
    return () => {
      try {
        browserApi.runtime.onMessage.removeListener(handler);
      } catch {
        // ignore
      }
    };
  }, []);

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

  function handleToggleExtension() {
    if (!settings || !isClassroomTab || tabId == null) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome as typeof chrome | undefined;
    if (!browserApi?.tabs) return;

    const prevSettings = settings;
    const prevTabState = tabState;

    const nextDesired = !settings.extensionEnabled;

    setSaving(true);
    setError(null);
    // Optimistic switch UI
    setSettings({ ...settings, extensionEnabled: nextDesired });

    browserApi.tabs.sendMessage(
      tabId,
      { type: 'CQD_POPUP_SET_DESIRED_STATE', enabled: nextDesired },
      (response) => {
        setSaving(false);

        if (browserApi.runtime.lastError || !response) {
          setError(
            "I couldn’t update the extension on this Classroom tab. Try reloading the page and toggling again.",
          );
          setSettings(prevSettings);
          setTabState(prevTabState);
          return;
        }

        const desired =
          typeof response.desiredEnabled === 'boolean'
            ? response.desiredEnabled
            : nextDesired;
        const effective =
          typeof response.effectiveEnabled === 'boolean'
            ? response.effectiveEnabled
            : desired;

        setSettings({ ...settings, extensionEnabled: desired });
        setTabState({ desiredEnabled: desired, effectiveEnabled: effective });
      },
    );
  }

  function handleOpenClassroomClick() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome as typeof chrome | undefined;
    if (!browserApi?.tabs) return;

    try {
      browserApi.tabs.create({
        url: 'https://classroom.google.com/',
      });
    } catch {
      // ignore
    }
  }

  // --- Donut chart calculation (Dynamic) ---
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

  const isLoadingSettings = loadingState || settings == null;

  const effectiveEnabled = tabState?.effectiveEnabled ?? false;

  let extensionStatusLabel: string;
  if (!isClassroomTab) {
    extensionStatusLabel = 'Open on Google Classroom';
  } else if (isLoadingSettings) {
    extensionStatusLabel = 'Checking this tab…';
  } else {
    extensionStatusLabel = effectiveEnabled
      ? 'Running on this tab'
      : 'Paused on this tab';
  }

  // Choose logo based on whether we’re on a Classroom tab
  const logoToUse = isClassroomTab ? logoSrc : logoGraySrc;

  return (
    <main className="cqd-app">
      <div className="cqd-scroll-container" ref={scrollRef}>
        {/* HEADER – always visible */}
        <header
          className={`cqd-header ${scrolled ? 'cqd-header-scrolled' : ''}`}
        >
          <div className="cqd-brand-row">
            <img
              src={logoToUse}
              alt="Extension logo"
              className="cqd-brand-logo"
            />
            <div className="cqd-brand-text">
              <div className="cqd-brand-name">Classroom Quick Downloader</div>
              <div className="cqd-brand-meta">
                {/* Dot reflects this tab's effective state only */}
                <span
                  className={`cqd-brand-status-dot ${
                    isClassroomTab && effectiveEnabled ? 'on' : ''
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
          {/* Error banner */}
          {error && (
            <div className="cqd-banner cqd-banner-error" role="alert">
              <div className="cqd-banner-content">
                <div className="cqd-banner-indicator" aria-hidden="true" />
                <div className="cqd-banner-text">
                  <strong>Oops.</strong> {error}
                </div>
              </div>
              <button
                type="button"
                className="cqd-banner-close"
                onClick={() => setError(null)}
                aria-label="Dismiss error message"
              >
                ×
              </button>
            </div>
          )}

          {/* MAIN BODY: depends on whether we are on Classroom */}
          {isClassroomTab ? (
            <>
              {/* Section 1: Analytics (only on Classroom) */}
              <section className="cqd-panel">
                <div className="cqd-card cqd-card-analytics">
                  <div className="cqd-card-header">
                    <h2 className="cqd-card-title">Download Activity</h2>
                    <p className="cqd-card-subtitle">
                      Your lifetime downloads with this extension.
                    </p>
                  </div>
                  <div className="cqd-analytics-layout">
                    <div
                      className="cqd-analytics-circle-wrapper"
                      aria-hidden="true"
                    >
                      <svg
                        width="100"
                        height="100"
                        viewBox="0 0 100 100"
                        className="cqd-analytics-svg"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="none"
                          stroke="var(--cqd-surface)"
                          strokeWidth="10"
                        />
                        {totalDownloads > 0 ? (
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
                          ))
                        ) : (
                          // Empty state ring
                          <circle
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="10"
                            className="cqd-ring-segment"
                          />
                        )}
                      </svg>
                      <div className="cqd-analytics-circle-inner">
                        <div className="cqd-analytics-main-number">
                          {totalDownloads}
                        </div>
                      </div>
                    </div>

                    <div className="cqd-analytics-side">
                      <ul className="cqd-analytics-legend">
                        {stats.length > 0 ? (
                          stats.map((stat) => (
                            <li key={stat.id}>
                              <span
                                className="cqd-legend-dot"
                                style={{ backgroundColor: stat.color }}
                              />
                              <span className="cqd-legend-label">{stat.label}</span>
                              <span className="cqd-legend-val">({stat.value})</span>
                            </li>
                          ))
                        ) : (
                          <li className="cqd-muted-text">No downloads yet</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Settings (per-tab enable/disable) */}
              <section className="cqd-panel">
                <div className="cqd-card cqd-card-settings">
                  <div className="cqd-card-header">
                    <h2 className="cqd-card-title">Extension Settings</h2>
                    <p className="cqd-card-subtitle">
                      Turn the extension on or off for this Classroom tab only.
                    </p>
                  </div>

                  <div className="cqd-toggle-group">
                    <ToggleRow
                      label="Enable on this tab"
                      description="This only affects the current Classroom tab, not other tabs."
                      checked={settings?.extensionEnabled ?? false}
                      loading={isLoadingSettings || saving}
                      onToggle={handleToggleExtension}
                      disabled={isLoadingSettings}
                      primary
                    />
                  </div>
                </div>
              </section>
            </>
          ) : (
            // Non-Classroom view: friendly message + redesigned button
            <section className="cqd-panel">
              <div className="cqd-card">
                <div className="cqd-card-header">
                  <h2 className="cqd-card-title">Use it on Google Classroom</h2>
                  <p className="cqd-card-subtitle">
                    This extension is built specifically for{' '}
                    <strong>classroom.google.com</strong>.
                  </p>
                </div>
                <p className="cqd-muted-text" style={{ marginTop: 8 }}>
                  Open Google Classroom, then click the extension again from
                  that tab to see your download controls.
                </p>
                <button
                  type="button"
                  className="cqd-button cqd-open-classroom-btn"
                  onClick={handleOpenClassroomClick}
                  aria-label="Open Google Classroom in a new tab"
                >
                  <span>Open Google Classroom</span>
                </button>
              </div>
            </section>
          )}

          {/* Section 3: Info & Credits – always visible */}
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
                      UI/UX Designer
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
                  aria-label="Open the GitHub repository"
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
                  aria-label="Support the developer on Buy Me a Coffee"
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
                  aria-label={
                    shareStatus === 'copied'
                      ? 'Extension link copied'
                      : 'Copy extension link to clipboard'
                  }
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

          {/* FOOTER – always visible */}
          <footer className="cqd-footer">
            <div className="cqd-footer-inner">
              <p className="cqd-footer-text">
                Have a suggestion or problem?{' '}
                <a
                  href={SURVEY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="cqd-footer-link"
                >
                  Report it here
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

  const handleKeyDown = (e: KeyboardEvent<HTMLLabelElement>) => {
    if (isDisabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleChange();
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
        role="switch"
        aria-checked={checked}
        aria-disabled={isDisabled || undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
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