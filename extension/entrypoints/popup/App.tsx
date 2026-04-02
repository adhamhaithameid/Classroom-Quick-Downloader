// filepath: entrypoints/popup/App.tsx

import { useEffect, useId, useMemo, useRef, useState, useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import './App.css';
import logoSrc from '../../assets/CQD.png';
import logoGraySrc from '../../assets/CQD-gray.png';
import bmcLogoSrc from '../../assets/bmc-logo.svg';
import chromeSvg from '../../assets/Chrome.svg';
import firefoxSvg from '../../assets/Firefox.svg';
import edgeSvg from '../../assets/Edge.svg';
import avatarSrc from '../../assets/me.jpg';
import {
  fetchChangelogDetailed,
  getMatchingRule,
  getRuleClasses,
  isVersionSeen,
  markAsSeen,
  getLatestChange,
  type ChangelogData,
  type ChangelogFetchResult
} from '../utils/changelog';
import { CHANGELOG_SITE_URL } from '../utils/analytics/constants';

// External Links
const SURVEY_URL = 'https://forms.gle/wPU2b1Qxa7svHqJa6';
const GITHUB_REPO_URL =
  'https://github.com/adhamhaithameid/classroom-quick-downloader';
const GITHUB_PROFILE_URL = 'https://github.com/adhamhaithameid';
const GITHUB_STAR_URL = `${GITHUB_REPO_URL}/stargazers`;
const GITHUB_AVATAR_URL = avatarSrc;
const BUY_ME_COFFEE_URL = 'https://buymeacoffee.com/adhamhaithameid';

// Extension Store URLs for each browser
const EXTENSION_STORE_URLS = {
  chrome: 'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn',
};

type BrowserType = 'chrome' | 'firefox' | 'edge';

type BrowserDetection = {
  browser: BrowserType;
  isCertain: boolean;
};

function detectBrowser(): BrowserDetection {
  const ua = navigator.userAgent.toLowerCase();
  // Firefox detection - certain
  if (ua.includes('firefox')) {
    return { browser: 'firefox', isCertain: true };
  }
  // Edge detection - certain (edg/ for desktop, edga/ for Android, edgios/ for iOS)
  if (ua.includes('edg/') || ua.includes('edga/') || ua.includes('edgios/')) {
    return { browser: 'edge', isCertain: true };
  }
  // Chrome detection - only certain if explicitly Chrome
  if (ua.includes('chrome') && !ua.includes('opr') && !ua.includes('opera') && !ua.includes('brave')) {
    return { browser: 'chrome', isCertain: true };
  }
  // Default to Chrome for other Chromium browsers - not certain
  return { browser: 'chrome', isCertain: false };
}

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

// Base colors - vibrant starting points for triadic harmony generation
const BASE_COLORS = [
  '#dc2626', // Red
  '#ea580c', // Orange
  '#d97706', // Amber
  '#65a30d', // Lime
  '#16a34a', // Green
  '#059669', // Emerald
  '#0d9488', // Teal
  '#0891b2', // Cyan
  '#0284c7', // Sky
  '#2563eb', // Blue
  '#4f46e5', // Indigo
  '#7c3aed', // Violet
  '#9333ea', // Purple
  '#c026d3', // Fuchsia
  '#db2777', // Pink
  '#e11d48', // Rose
  '#78350f', // Brown
  '#1e3a8a', // Navy
  '#064e3b', // Forest
  '#7f1d1d', // Maroon
];

// LocalStorage key for persistent color assignments
const COLOR_STORAGE_KEY = 'cqd_type_color_assignments_v2';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Convert hex to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 70, l: 50 };
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Convert HSL to hex
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate triadic color - rotate hue by 120° or 240° (complementary positions on color wheel)
 */
function getTriadicColor(baseHex: string, position: number): string {
  const hsl = hexToHsl(baseHex);
  // Rotate hue by 120° * position for triadic harmony
  const newHue = (hsl.h + (120 * position)) % 360;
  return hslToHex(newHue, Math.min(hsl.s + 5, 85), Math.max(hsl.l, 40));
}

/**
 * Simple hash function to convert string to number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Determine if a hex color is dark (needs white border) or light (needs black border)
 */
function isColorDark(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * Calculate distance between two hex colors (simple RGB Euclidean distance)
 * Returns value between 0 (identical) and ~441 (opposite)
 */
function getColorDistance(hex1: string, hex2: string): number {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

/**
 * Get distinct color for a file type, ensuring no collisions with already used colors
 * @param typeId - file type ID
 * @param position - position in the list (for triadic harmony)
 * @param usedColors - set of already assigned colors to avoid
 * @param assignments - in-memory color assignment map
 */
function getDistinctColorForTypeAtPosition(
  typeId: string, 
  position: number, 
  usedColors: Set<string>,
  assignments: Record<string, string>
): string {
  const key = `${typeId}_pos${position}`;
  
  // Deterministic candidate generation
  const baseIndex = hashString(typeId) % BASE_COLORS.length;
  let baseColor = BASE_COLORS[baseIndex];
  let candidate = getTriadicColor(baseColor, position);
  
  // Use stored if available AND distinct enough from *others* in the current used list
  // Note: We prioritize the *stored* color if it exists, but we MUST check collision
  if (assignments[key]) {
    candidate = assignments[key];
  }
  
  // Conflict resolution: if candidate is too close to any used color, shift it
  // Threshold 100 is roughly "visually distinct"
  let attempts = 0;
  let isdistinct = false;
  
  while (!isdistinct && attempts < 20) {
    let collision = false;
    for (const used of usedColors) {
      if (getColorDistance(candidate, used) < 100) { // Collision threshold
        collision = true;
        break;
      }
    }
    
    if (collision) {
      // Rotate hue by 45 degrees to find a free spot
      const hsl = hexToHsl(candidate);
      candidate = hslToHex((hsl.h + 45) % 360, hsl.s, hsl.l);
      attempts++;
    } else {
      isdistinct = true;
    }
  }
  
  // If we still have collision after rotations (crowded), try lightening/darkening
  if (!isdistinct) {
     const hsl = hexToHsl(candidate);
     candidate = hslToHex(hsl.h, hsl.s, Math.max(20, Math.min(80, hsl.l + (attempts % 2 === 0 ? 20 : -20))));
  }
  
  // Save into the shared in-memory assignment map.
  assignments[key] = candidate;

  return candidate;
}

function loadColorAssignments(): Record<string, string> {
  try {
    const stored = localStorage.getItem(COLOR_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const sanitized: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'string' && HEX_COLOR_RE.test(value)) {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
  } catch {
    // Ignore storage parse/read failures and fall back to empty map.
  }
  return {};
}

function saveColorAssignments(assignments: Record<string, string>): void {
  try {
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(assignments));
  } catch {
    // Ignore storage write failures.
  }
}

function haveColorAssignmentsChanged(
  previous: Record<string, string>,
  next: Record<string, string>
): boolean {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) {
    return true;
  }

  for (const key of nextKeys) {
    if (previous[key] !== next[key]) {
      return true;
    }
  }

  return false;
}

function App() {
  const [settings, setSettings] = useState<Settings | null>(null);

  const [isClassroomTab, setIsClassroomTab] = useState(false);
  const [loadingState, setLoadingState] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  const [copiedBrowser, setCopiedBrowser] = useState<BrowserType | null>(null);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [browserDetection] = useState<BrowserDetection>(detectBrowser);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // REAL STATS STATE
  const [stats, setStats] = useState<StatItem[]>([]);
  const [totalDownloads, setTotalDownloads] = useState(0);
  const [hoveredStatId, setHoveredStatId] = useState<string | null>(null);

  // CHANGELOG STATE
  const [changelogData, setChangelogData] = useState<ChangelogData | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogStatus, setChangelogStatus] = useState<'loading' | 'ready' | 'offline' | 'error'>('loading');
  const [changelogStatusMessage, setChangelogStatusMessage] = useState<string | null>(null);

  // ENGINE MODE STATE
  const [engineMode, setEngineMode] = useState<string>('legacy');
  const [engineModeLoading, setEngineModeLoading] = useState(true);

  // COLLAPSIBLE SETTINGS STATE (persisted)
  const [settingsCollapsed, setSettingsCollapsed] = useState(true);

  // Load collapse state from storage
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome;
    if (!browserApi?.storage?.local) return;
    browserApi.storage.local.get('cqdSettingsCollapsed', (res: { cqdSettingsCollapsed?: boolean }) => {
      setSettingsCollapsed(res.cqdSettingsCollapsed !== false); // default collapsed
    });
  }, []);

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

  // --- DETECT IF ON CLASSROOM & LOAD VERSION ---
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome;
    
    // Dev environment fallback
    if (!browserApi || !browserApi.tabs || !browserApi.tabs.query) {
       setIsClassroomTab(true); // Default to true in dev so we see the main UI
       setVersion('dev');
       return;
    }

    // Load version from manifest
    try {
      const manifest = browserApi.runtime.getManifest();
      if (manifest && manifest.version) {
        setVersion(manifest.version);
      }
    } catch {
      // Ignore version loading errors
    }

    // Query active tab
    browserApi.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      if (browserApi.runtime.lastError) {
        // Fallback or ignore
        return;
      }
      if (tabs && tabs.length > 0) {
        const url = tabs[0].url || '';
        // Use proper URL parsing to avoid security issues with substring matching
        try {
          const parsedUrl = new URL(url);
          const hostname = parsedUrl.hostname.toLowerCase();
          setIsClassroomTab(hostname === 'classroom.google.com');
        } catch {
          // Invalid URL, not a Classroom tab
          setIsClassroomTab(false);
        }
      }
    });
  }, []);

  // --- STATS LOADING LOGIC ---
  useEffect(() => {
    let isMounted = true;
    let latestStatsRequestId = 0;

    // 1. Function to process stats from storage format to Chart format
    const loadStats = async () => {
      const requestId = ++latestStatsRequestId;
      const isStale = () => !isMounted || requestId !== latestStatsRequestId;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const browserApi = (globalThis as any).chrome;
        if (!browserApi || !browserApi.storage || !browserApi.storage.local) {
            if (isStale()) return;
            setTotalDownloads(0);
            setStats([]); // Empty stats in dev
            return;
        }

        // Wrapper for Firefox which doesn't return Promise for 'chrome' namespace
        const result = await new Promise<any>((resolve) => {
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           (browserApi.storage.local as any).get('local_stats', (res: any) => {
             // In Firefox/Chrome callback, result is the object
             if (browserApi.runtime.lastError) {
               resolve({});
             } else {
               resolve(res || {});
             }
           });
        });
        if (isStale()) return;
        const raw = result.local_stats || { total: 0, byType: {} };
        const totalDownloadsNext = raw.total || 0;

        // Convert byType object to sorted array
        const entries = Object.entries(raw.byType as Record<string, number>);
        
        // Sort by count descending
        entries.sort((a, b) => b[1] - a[1]);

        // Take top 4, group others
        const top = entries.slice(0, 4);
        const others = entries.slice(4);
        const otherCount = others.reduce((acc, curr) => acc + curr[1], 0);

        const usedColors = new Set<string>();
        const persistedAssignments = loadColorAssignments();
        const colorAssignments = { ...persistedAssignments };

        const mapped: StatItem[] = top.map(([key, val], index) => {
          const color = getDistinctColorForTypeAtPosition(key, index, usedColors, colorAssignments);
          usedColors.add(color);
          return {
            id: key,
            label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize
            value: val,
            color
          };
        });

        if (otherCount > 0) {
          const otherColor = getDistinctColorForTypeAtPosition('other', mapped.length, usedColors, colorAssignments);
          usedColors.add(otherColor);
          mapped.push({
            id: 'other',
            label: 'Other',
            value: otherCount,
            color: otherColor
          });
        }

        if (isStale()) return;
        if (haveColorAssignmentsChanged(persistedAssignments, colorAssignments)) {
          saveColorAssignments(colorAssignments);
        }
        if (isStale()) return;
        setTotalDownloads(totalDownloadsNext);
        setStats(mapped);

      } catch (e) {
        if (!isStale()) {
          console.warn('Failed to load stats', e);
        }
      }
    };

    loadStats();

    // 2. Listen for live updates (if user downloads while popup is open)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let listener: ((changes: any, area: string) => void) | null = null;
    if (browserApi && browserApi.storage && browserApi.storage.onChanged) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        listener = (changes: any, area: string) => {
          if (area === 'local' && changes.local_stats) {
            loadStats();
          }
        };
        browserApi.storage.onChanged.addListener(listener);
    }
    return () => {
      isMounted = false;
      latestStatsRequestId += 1;
      if (listener && browserApi && browserApi.storage && browserApi.storage.onChanged) {
        browserApi.storage.onChanged.removeListener(listener);
      }
    };
  }, []);

  // --- CHANGELOG LOADING ---
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const applyChangelogFetchResult = (result: ChangelogFetchResult) => {
      if (cancelled) return;
      if (result.data) {
        setChangelogData(result.data);
      }
      if (result.status === 'cache-fallback') {
        setChangelogStatus('offline');
        setChangelogStatusMessage(result.error || 'Oracle is unreachable. Showing cached changelog.');
        return;
      }
      if (result.status === 'error') {
        setChangelogStatus('error');
        setChangelogStatusMessage(result.error || 'Unable to load changelog from Oracle.');
        return;
      }
      setChangelogStatus('ready');
      if (result.status === 'empty') {
        setChangelogStatusMessage('No changelog entries are available yet.');
      } else {
        setChangelogStatusMessage(null);
      }
    };

    const loadChangelog = async () => {
      if (inFlight) return;
      inFlight = true;
      if (!changelogData) {
        setChangelogStatus('loading');
      }
      try {
        const result = await fetchChangelogDetailed(true);
        applyChangelogFetchResult(result);
      } finally {
        inFlight = false;
      }
    };

    void loadChangelog();

    return () => {
      cancelled = true;
    };
  }, []);

  // --- ESCAPE KEY TO CLOSE CHANGELOG ---
  useEffect(() => {
    if (!showChangelog) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowChangelog(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showChangelog]);

  // --- SEEN STATE ---
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (version) {
       isVersionSeen(version, changelogData).then(setSeen);
    }
  }, [version, changelogData?.revisionToken]);

  // --- GLOBAL SETTINGS LOGIC ---
  useEffect(() => {
    // Safety check for non-extension environment (e.g. pnpm dev)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome;
    if (!browserApi || !browserApi.storage || !browserApi.storage.local) {
      setSettings((prev) => ({
        ...DEFAULT_SETTINGS,
        ...prev,
        extensionEnabled: true, // Default to true in dev
      }));
      setLoadingState(false);
      return;
    }

    // Initial load — load ALL settings keys
    const settingsKeys = [
      'extensionEnabled',
      'downloadAllEnabled',
      'commentsFlagEnabled',
      'editedFlagEnabled',
      'combinedFlagEnabled',
    ];
    browserApi.storage.local.get(settingsKeys, (res: Record<string, boolean | undefined>) => {
      setSettings((prev) => ({
        ...DEFAULT_SETTINGS,
        ...prev,
        extensionEnabled: res.extensionEnabled !== false,
        downloadAllEnabled: res.downloadAllEnabled !== false,
        commentsFlagEnabled: res.commentsFlagEnabled !== false,
        editedFlagEnabled: res.editedFlagEnabled !== false,
        combinedFlagEnabled: res.combinedFlagEnabled !== false,
      }));
      setLoadingState(false);
    });

    // Listen for changes (cross-tab sync)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listener = (changes: any, area: string) => {
      if (area !== 'local') return;
      setSettings((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        if ('extensionEnabled' in changes) updated.extensionEnabled = changes.extensionEnabled.newValue !== false;
        if ('commentsFlagEnabled' in changes) updated.commentsFlagEnabled = changes.commentsFlagEnabled.newValue !== false;
        if ('editedFlagEnabled' in changes) updated.editedFlagEnabled = changes.editedFlagEnabled.newValue !== false;
        if ('combinedFlagEnabled' in changes) updated.combinedFlagEnabled = changes.combinedFlagEnabled.newValue !== false;
        return updated;
      });
    };
    
    if (browserApi.storage.onChanged) {
      browserApi.storage.onChanged.addListener(listener);
      return () => browserApi.storage.onChanged.removeListener(listener);
    }
  }, []);

  function handleToggleExtension() {
    if (!settings) return;
    const nextState = !settings.extensionEnabled;
    
    // Optimistic update
    setSettings({ ...settings, extensionEnabled: nextState });
    
    // Save to storage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome;
    if (browserApi && browserApi.storage && browserApi.storage.local) {
      browserApi.storage.local.set({ extensionEnabled: nextState });
    }
  }

  function handleToggleSettingsCollapse() {
    const next = !settingsCollapsed;
    setSettingsCollapsed(next);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome;
    if (browserApi?.storage?.local) {
      browserApi.storage.local.set({ cqdSettingsCollapsed: next });
    }
  }

  function handleToggleFlag(flag: 'commentsFlagEnabled' | 'editedFlagEnabled' | 'combinedFlagEnabled') {
    if (!settings) return;
    const nextState = !settings[flag];
    const updatedSettings = { ...settings, [flag]: nextState };
    setSettings(updatedSettings);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome;
    if (browserApi?.storage?.local) {
      browserApi.storage.local.set({ [flag]: nextState });
    }
    // Notify content scripts
    if (browserApi?.tabs?.query) {
      browserApi.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs?.[0]?.id) {
          browserApi.tabs.sendMessage(tabs[0].id, {
            type: 'cqd-flag-toggle',
            flag,
            enabled: nextState,
          });
        }
      });
    }
  }

  // --- ENGINE MODE LOADING ---
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome;
    if (!browserApi?.storage?.local) {
      setEngineModeLoading(false);
      return;
    }
    browserApi.storage.local.get('cqdV2Mode', (res: { cqdV2Mode?: string }) => {
      setEngineMode(res.cqdV2Mode || 'legacy');
      setEngineModeLoading(false);
    });

    // Listen for mode changes from content script or other tabs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes.cqdV2Mode) {
        setEngineMode(changes.cqdV2Mode.newValue || 'legacy');
      }
    };
    if (browserApi.storage.onChanged) {
      browserApi.storage.onChanged.addListener(listener);
      return () => browserApi.storage.onChanged.removeListener(listener);
    }
  }, []);

  function handleToggleV2Engine() {
    const nextMode = engineMode === 'v2' ? 'legacy' : 'v2';
    setEngineMode(nextMode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome;
    if (browserApi?.storage?.local) {
      browserApi.storage.local.set({ cqdV2Mode: nextMode });
    }
    // Also notify content script via message
    if (browserApi?.tabs?.query) {
      browserApi.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs?.[0]?.id) {
          browserApi.tabs.sendMessage(tabs[0].id, { type: 'cqd-set-mode', mode: nextMode });
        }
      });
    }
  }

  function handleToggleLegacyEngine() {
    const nextMode = engineMode === 'legacy' ? 'v2' : 'legacy';
    setEngineMode(nextMode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome;
    if (browserApi?.storage?.local) {
      browserApi.storage.local.set({ cqdV2Mode: nextMode });
    }
    // Also notify content script via message
    if (browserApi?.tabs?.query) {
      browserApi.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs?.[0]?.id) {
          browserApi.tabs.sendMessage(tabs[0].id, { type: 'cqd-set-mode', mode: nextMode });
        }
      });
    }
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

  function openExternalUrl(url: string): void {
    if (!url) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const browserApi = (globalThis as any).chrome as typeof chrome | undefined;
    if (browserApi?.tabs?.create) {
      try {
        browserApi.tabs.create({ url });
        return;
      } catch {
        // fallback below
      }
    }

    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  }

  function handleChangelogWebsiteClick(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    openExternalUrl(CHANGELOG_SITE_URL);
  }

  const handleCopyLink = async (browser: BrowserType) => {
    try {
      await navigator.clipboard.writeText(EXTENSION_STORE_URLS[browser]);
      setCopiedBrowser(browser);
      setTimeout(() => setCopiedBrowser(null), 2000);
    } catch {
      // Silent fail
    }
  };

  const browserIcons: Record<BrowserType, React.ReactNode> = {
    chrome: <img src={chromeSvg} alt="Chrome" width="20" height="20" />,
    firefox: <img src={firefoxSvg} alt="Firefox" width="20" height="20" />,
    edge: <img src={edgeSvg} alt="Edge" width="20" height="20" />,
  };

  // --- Donut chart calculation (Dynamic) ---
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const gapAngle = 3; // Gap angle in degrees between segments
  const gapLength = (gapAngle / 360) * circumference; // Convert gap to stroke units
  const chartSegments = useMemo(() => {
    let offset = 0;
    return stats.map((stat, index) => {
      const percentage = totalDownloads === 0 ? 0 : stat.value / totalDownloads;
      const fullStrokeLength = percentage * circumference;
      const strokeLength = Math.max(0, fullStrokeLength - gapLength);
      const currentOffset = offset + (gapLength / 2);
      offset += fullStrokeLength;
      return {
        ...stat,
        strokeLength,
        offset: -currentOffset,
        index,
      };
    });
  }, [stats, totalDownloads, circumference, gapLength]);

  const matchedRule = version ? getMatchingRule(changelogData?.config, version) : null;
  const fallbackRule = !matchedRule && changelogData?.entries?.length
    ? {
        id: 'fallback-unseen',
        target: 'all',
        priority: 'minor' as const,
        effect: 'glow' as const,
      }
    : null;
  const effectiveRule = matchedRule ?? fallbackRule;

  const isLoadingSettings = loadingState || settings == null;
  const isEnabled = settings?.extensionEnabled ?? true;

  let extensionStatusLabel: string;
  if (!isClassroomTab) {
    extensionStatusLabel = 'Open on Google Classroom';
  } else if (isLoadingSettings) {
    extensionStatusLabel = 'Loading…';
  } else {
    extensionStatusLabel = isEnabled
      ? 'Extension Enabled'
      : 'Extension Disabled';
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
                    isClassroomTab && isEnabled ? 'on' : ''
                  }`}
                  aria-hidden="true"
                />
                <span className="cqd-brand-status-text">
                  {extensionStatusLabel}
                </span>
                {version && (
                  <button
                    className={`cqd-brand-version ${getRuleClasses(effectiveRule, seen)}`}
                    aria-label={`Version ${version} - View changelog`}
                    title={getLatestChange(changelogData) ? `Latest: ${getLatestChange(changelogData)}` : "View changelog"}
                    onClick={async () => {
                       setShowChangelog(true);
                       // Only fetch if we don't have data yet or last fetch was >30s ago
                       if (!changelogData) {
                         const latest = await fetchChangelogDetailed(true);
                         if (latest.data) {
                           setChangelogData(latest.data);
                         }
                         if (latest.status === 'cache-fallback') {
                           setChangelogStatus('offline');
                           setChangelogStatusMessage(latest.error || 'Oracle is unreachable. Showing cached changelog.');
                         } else if (latest.status === 'error') {
                           setChangelogStatus('error');
                           setChangelogStatusMessage(latest.error || 'Unable to load changelog from Oracle.');
                         } else {
                           setChangelogStatus('ready');
                           setChangelogStatusMessage(latest.status === 'empty' ? 'No changelog entries are available yet.' : null);
                         }
                       }
                       if (version) {
                         await markAsSeen(version, changelogData);
                         setSeen(true);
                       }
                    }}
                  >
                    <span>v{version}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="cqd-content-area">
          {/* ChangeLog Overlay */}
          <div
            className={`cqd-changelog-overlay ${showChangelog ? 'open' : ''}`}
            aria-hidden={!showChangelog}
          >
            <div
              className="cqd-changelog-card"
              role={showChangelog ? 'dialog' : undefined}
              aria-modal={showChangelog ? true : undefined}
              aria-labelledby={showChangelog ? 'changelog-title' : undefined}
            >
              <div className="cqd-cl-header">
                <h3 id="changelog-title" className="cqd-cl-title">
                  <span className="btn-bullet">📜</span> What's New
                </h3>
                <button
                  type="button"
                  className="cqd-cl-back"
                  onClick={() => setShowChangelog(false)}
                  aria-label="Go back"
                  title="Go back"
                >
                  <svg
                    className="cqd-cl-back-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>
              <div className="cqd-cl-body">
                {changelogStatus === 'loading' && (
                  <div className="cqd-cl-state cqd-cl-state-loading">Loading latest changelog from Oracle…</div>
                )}

                {changelogStatus === 'offline' && (
                  <div className="cqd-cl-state cqd-cl-state-warn">
                    {changelogStatusMessage || 'Offline fallback active. Showing cached changelog.'}
                  </div>
                )}

                {changelogStatus === 'error' && (
                  <div className="cqd-cl-state cqd-cl-state-error">
                    <div>{changelogStatusMessage || 'Could not load changelog.'}</div>
                    <button
                      type="button"
                      className="cqd-cl-retry-btn"
                      onClick={async () => {
                        setChangelogStatus('loading');
                        const retryResult = await fetchChangelogDetailed(true);
                        if (retryResult.data) setChangelogData(retryResult.data);
                        if (retryResult.status === 'cache-fallback') {
                          setChangelogStatus('offline');
                          setChangelogStatusMessage(retryResult.error || 'Oracle is unreachable. Showing cached changelog.');
                        } else if (retryResult.status === 'error') {
                          setChangelogStatus('error');
                          setChangelogStatusMessage(retryResult.error || 'Unable to load changelog from Oracle.');
                        } else {
                          setChangelogStatus('ready');
                          setChangelogStatusMessage(retryResult.status === 'empty' ? 'No changelog entries are available yet.' : null);
                        }
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {changelogData?.entries?.length ? (
                  changelogData.entries.map((entry) => {
                    const isCurrent = version && entry.version === version;
                    const isNewerThanInstalled = version && entry.version !== version && 
                      entry.version.localeCompare(version, undefined, { numeric: true }) > 0;
                    return (
                      <div key={entry.id} className="cqd-cl-entry">
                        <div className="cqd-cl-ver-row">
                          <span className="cqd-cl-version">v{entry.version}</span>
                          {isCurrent && (
                            <span className="cqd-cl-tag cqd-cl-tag-current">Current</span>
                          )}
                          {!isCurrent && isNewerThanInstalled && (
                            <span className="cqd-cl-tag cqd-cl-tag-new">New</span>
                          )}
                          <span className="cqd-cl-date">{new Date(entry.date).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span>
                        </div>
                        <ul className="cqd-cl-list">
                          {entry.changes.map((change, i) => (
                            <li key={i}>{change}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
                ) : (
                  <div className="cqd-cl-empty">
                    {changelogStatusMessage || 'No changelog entries found.'}
                  </div>
                )}
              </div>
              
              {/* Footer Link */}
              <div className="cqd-cl-footer">
                <a
                  href={CHANGELOG_SITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleChangelogWebsiteClick}
                  aria-label="Open changelog website"
                  className="cqd-cl-footer-link cqd-cl-footer-link-secondary"
                >
                  <span className="cqd-cl-footer-link-content">
                    <span className="cqd-cl-footer-link-title">Changelog</span>
                  </span>
                </a>
                <a 
                  href={SURVEY_URL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label="Report an issue or request a feature"
                  className="cqd-cl-footer-link"
                >
                  <span className="cqd-cl-footer-link-content">
                    <span className="cqd-cl-footer-link-title">Report Issue</span>
                  </span>
                </a>
              </div>
            </div>
          </div>

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
                title="Dismiss error message"
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
                              strokeWidth={hoveredStatId === seg.id ? '12' : '10'}
                              strokeDasharray={`${seg.strokeLength} ${circumference}`}
                              strokeDashoffset={seg.offset}
                              className={`cqd-ring-segment ${hoveredStatId === seg.id ? 'hovered' : ''}`}
                              style={{ cursor: 'pointer', transition: 'stroke-width 0.15s ease' }}
                              onMouseEnter={() => setHoveredStatId(seg.id)}
                              onMouseLeave={() => setHoveredStatId(null)}
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
                            <li 
                              key={stat.id}
                              className={`cqd-legend-item ${hoveredStatId === stat.id ? 'hovered' : ''}`}
                              onMouseEnter={() => setHoveredStatId(stat.id)}
                              onMouseLeave={() => setHoveredStatId(null)}
                              onFocus={() => setHoveredStatId(stat.id)}
                              onBlur={() => setHoveredStatId(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setHoveredStatId(stat.id);
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              style={{ cursor: 'pointer' }}
                            >
                              <span
                                className={`cqd-legend-dot ${hoveredStatId === stat.id ? 'hovered' : ''}`}
                                style={{
                                  backgroundColor: stat.color,
                                  border: isColorDark(stat.color)
                                    ? '1.5px solid rgba(255, 255, 255, 0.8)'
                                    : '1.5px solid rgba(0, 0, 0, 0.25)',
                                }}
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

              {/* Section 2: Settings (collapsible) */}
              <section className="cqd-panel">
                <div className="cqd-card cqd-card-settings">
                  <button
                    type="button"
                    className="cqd-card-header cqd-settings-collapse-btn"
                    onClick={handleToggleSettingsCollapse}
                    aria-expanded={!settingsCollapsed}
                    aria-controls="cqd-settings-body"
                  >
                    <div>
                      <h2 className="cqd-card-title">Extension Settings</h2>
                      <p className="cqd-card-subtitle">
                        Downloads and flags.
                      </p>
                    </div>
                    <span className="cqd-settings-toggle-pill" aria-hidden="true">
                      <span className="cqd-settings-toggle-pill-label">
                        {settingsCollapsed ? 'Open' : 'Close'}
                      </span>
                      <svg
                        className={`cqd-settings-chevron ${settingsCollapsed ? '' : 'cqd-settings-chevron-open'}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        width="16"
                        height="16"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>

                  <div
                    id="cqd-settings-body"
                    className={`cqd-settings-body ${settingsCollapsed ? 'cqd-settings-body-collapsed' : ''}`}
                  >
                    <div className="cqd-settings-list">
                      <div className="cqd-settings-section">
                        <div className="cqd-settings-section-label">General</div>
                        <div className="cqd-toggle-group">
                          <ToggleRow
                            label="Enable Extension"
                            description="Turn the extension on or off globally."
                            checked={settings?.extensionEnabled ?? true}
                            loading={isLoadingSettings}
                            onToggle={handleToggleExtension}
                            disabled={isLoadingSettings}
                            primary
                          />
                        </div>
                      </div>

                      <div className="cqd-settings-section">
                        <div className="cqd-settings-section-label">Flags</div>
                        <div className="cqd-toggle-group">
                          <div className="cqd-flag-toggle-row cqd-flag-toggle-comment">
                            <ToggleRow
                              label="Comment Flags"
                              description="Badges for posts with comments."
                              checked={settings?.commentsFlagEnabled ?? true}
                              loading={isLoadingSettings}
                              onToggle={() => handleToggleFlag('commentsFlagEnabled')}
                              disabled={isLoadingSettings}
                            />
                          </div>

                          <div className="cqd-flag-toggle-row cqd-flag-toggle-edited">
                            <ToggleRow
                              label="Edited Flags"
                              description="Badges for edited posts."
                              checked={settings?.editedFlagEnabled ?? true}
                              loading={isLoadingSettings}
                              onToggle={() => handleToggleFlag('editedFlagEnabled')}
                              disabled={isLoadingSettings}
                            />
                          </div>
                        </div>
                        <div className="cqd-settings-section-note">Flag detection is experimental and may not always be accurate.</div>
                      </div>
                    </div>
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
                    <a
                      className="cqd-designer-main-line"
                      href={GITHUB_PROFILE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open Adham Haitham GitHub profile"
                      title="Open GitHub profile"
                    >
                      <img
                        src={GITHUB_AVATAR_URL}
                        alt="Adham Haitham avatar"
                        className="cqd-designer-avatar"
                      />
                      <span>
                        Designed &amp; built by{' '}
                        <span className="cqd-designer-name">Adham Haitham</span>
                      </span>
                    </a>
                    <span className="cqd-designer-extra">
                      Junior Software Engineer • UI/UX Designer
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
                  title="Open the GitHub repository"
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
                  title="Support the developer on Buy Me a Coffee"
                >
                  <img
                    src={bmcLogoSrc}
                    alt="Buy Me a Coffee"
                    className="cqd-coffee-icon"
                  />
                </button>

                <button
                  type="button"
                  className={`cqd-button cqd-button-ghost ${showSharePanel ? 'active' : ''}`}
                  onClick={() => setShowSharePanel(!showSharePanel)}
                  title="Share extension links"
                  aria-label="Share extension links"
                  aria-expanded={showSharePanel}
                >
                  <span className="cqd-button-icon">
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
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* Share Panel - Expandable */}
          {showSharePanel && (
            <section className="cqd-panel">
              <div className="cqd-card cqd-card-share">
                <div className="cqd-card-header">
                  <h2 className="cqd-card-title">Share Extension</h2>
                  <p className="cqd-card-subtitle">
                    Copy the extension link for your browser.
                  </p>
                </div>
                <div className="cqd-share-links">
                  {(Object.keys(EXTENSION_STORE_URLS) as BrowserType[]).map((browser) => (
                    <div 
                      key={browser} 
                      className={`cqd-share-link-row ${browser === browserDetection.browser && browserDetection.isCertain ? 'detected' : ''}`}
                    >
                      <a 
                        href={EXTENSION_STORE_URLS[browser]}
                        target="_blank"
                        rel="noreferrer"
                        className="cqd-share-browser-icon"
                        title={`Open ${browser.charAt(0).toUpperCase() + browser.slice(1)} Web Store`}
                        aria-label={`Open ${browser.charAt(0).toUpperCase() + browser.slice(1)} Web Store`}
                      >
                        {browserIcons[browser]}
                      </a>
                      <span className="cqd-share-browser-name">
                        {browser.charAt(0).toUpperCase() + browser.slice(1)}
                        {browser === browserDetection.browser && browserDetection.isCertain && (
                          <span className="cqd-share-detected-badge">current</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className={`cqd-share-copy-btn ${copiedBrowser === browser ? 'copied' : ''}`}
                        onClick={() => handleCopyLink(browser)}
                        aria-label={`Copy ${browser} extension link`}
                      >
                        {copiedBrowser === browser ? (
                          <>
                            <svg
                              viewBox="0 0 24 24"
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg
                              viewBox="0 0 24 24"
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

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

export function ToggleRow({
  label,
  description,
  checked,
  onToggle,
  disabled,
  loading,
  primary,
}: ToggleRowProps) {
  const isDisabled = !!disabled || !!loading;
  const descriptionId = useId();
  const inputId = useId();

  const handleChange = () => {
    if (!isDisabled) {
      onToggle();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isDisabled) return;
    if (e.key === 'Enter') {
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
      <label
        className="cqd-toggle-text"
        htmlFor={inputId}
        style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', display: 'block' }}
      >
        <span className="cqd-toggle-label" style={{ display: 'block' }}>{label}</span>
        {description && (
          <span id={descriptionId} className="cqd-toggle-description" style={{ display: 'block' }}>
            {description}
          </span>
        )}
      </label>
      <label
        className={`cqd-switch ${loading ? 'cqd-switch-loading' : ''}`}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={isDisabled}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label={label}
          aria-describedby={description ? descriptionId : undefined}
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
