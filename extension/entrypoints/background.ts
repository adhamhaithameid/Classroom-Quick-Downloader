/**
 * Unified background script that delegates to browser-specific implementation.
 * This allows Firefox and Chrome/Edge to have completely separate download logic
 * for easier debugging and maintenance.
 */

import {
  Analytics,
  recordDownloadEvent,
  refreshRemoteAnalyticsConfig,
} from './utils/analytics';
import { t } from './content/i18n';

type FileMetaMsg = {
  name?: string;
  ext?: string;
  kind?: string;
};

type DownloadStatus =
  | 'complete'
  | 'interrupted'
  | 'blocked_html'
  | 'error'
  | 'success'
  | 'trying';

type PendingDownload = {
  requestId: string;
  startTime: number;

  originalUrl: string;
  baseUrl: string;
  isDrive: boolean;

  fileMeta?: FileMetaMsg;
  finalExtension?: string;

  tabId?: number;

  attemptedAuthUsers: number[];
  currentAuthUser?: number;
  initialAuthUser?: number;
  currentDownloadId?: number;

  fallbackStarted?: boolean;

  htmlSeen?: boolean;
  confirmed403?: boolean;
  confirmedVirus?: boolean;
  finalized?: boolean;
};

// --- GLOBAL STATE ---
const pendingByRequestId = new Map<string, PendingDownload>();
const pendingByDownloadId = new Map<number, PendingDownload>();
const pendingByUrl = new Map<string, PendingDownload>();
const pendingByBypassTabId = new Map<number, PendingDownload>();

const cancelledByUs = new Set<number>();
const recentDownloads = new Map<string, number>();
const AUTHUSER_CANDIDATES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;

// --- BROWSER DETECTION ---
function isFirefox(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Firefox/i.test(navigator.userAgent);
}

const IS_FIREFOX = isFirefox();

/* ---------------------------------------------
 * Icon / tab context helpers
 * -------------------------------------------*/

function isClassroomUrl(url?: string | null): boolean {
  if (!url) return false;
  return CLASSROOM_URL_PATTERN.test(url);
}

const COLOR_ICON_PATHS: Record<number, string> = {
  16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 96: 'icon/96.png', 128: 'icon/128.png',
};

const GRAY_ICON_PATHS: Record<number, string> = {
  16: 'icon/16-gray.png', 32: 'icon/32-gray.png', 48: 'icon/48-gray.png', 96: 'icon/96-gray.png', 128: 'icon/128-gray.png',
};

function setActionIcon(tabId: number, classroom: boolean) {
  if (typeof chrome === 'undefined') return;
  const path = classroom ? COLOR_ICON_PATHS : GRAY_ICON_PATHS;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionApi = (chrome as any).action || (chrome as any).browserAction;
  if (!actionApi?.setIcon) return;
  try { actionApi.setIcon({ tabId, path }); } catch {}
}

function updateIconForTab(tabId: number, url?: string | null) {
  setActionIcon(tabId, isClassroomUrl(url));
}

/* ---------------------------------------------
 * Auth user helpers
 * -------------------------------------------*/

function extractAuthUserFromUrl(rawUrl: string): number | undefined {
  try {
    const url = new URL(rawUrl);
    const qp = url.searchParams.get('authuser') ?? url.searchParams.get('u');
    const pathMatch = url.pathname.match(/\/u\/(\d+)\//);
    const raw = qp ?? (pathMatch ? pathMatch[1] : undefined);
    if (raw == null) return undefined;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed) || !AUTHUSER_CANDIDATES.includes(parsed)) return undefined;
    return parsed;
  } catch { return undefined; }
}

function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const idParam = parsed.searchParams.get('id');
    if (idParam) return idParam;
    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) return fileMatch[1];
    const dMatch = parsed.pathname.match(/\/d\/([^/]+)/);
    if (dMatch) return dMatch[1];
    return null;
  } catch { return null; }
}

/* ---------------------------------------------
 * Analytics alarm setup
 * -------------------------------------------*/

let analyticsAlarmInitialized = false;
function ensureAnalyticsAlarm() {
  if (analyticsAlarmInitialized) return;
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  analyticsAlarmInitialized = true;
  try {
    chrome.alarms.create('CQD_ANALYTICS_FLUSH', { periodInMinutes: 5 });
    chrome.alarms.create('CQD_ANALYTICS_CONFIG', { periodInMinutes: 180 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'CQD_ANALYTICS_FLUSH') Analytics.flush();
      else if (alarm.name === 'CQD_ANALYTICS_CONFIG') refreshRemoteAnalyticsConfig().catch(() => {});
    });
  } catch {}
}

/* ---------------------------------------------
 * Firefox file:// tab auto-close
 * -------------------------------------------*/
function checkAndCloseFileTab(tabId: number, url?: string) {
  if (!IS_FIREFOX || !url || !url.startsWith('file://')) return;
  const filename = decodeURIComponent(url.split('/').pop() || '');
  const completionTime = recentDownloads.get(filename);
  if (completionTime && Date.now() - completionTime < 10000) {
    try { chrome.tabs.remove(tabId); recentDownloads.delete(filename); } catch {}
  }
}

/* =====================================================
 * MAIN ENTRYPOINT
 * ===================================================*/

export default defineBackground(() => {
  console.log(`[CQD] Background ready - ${IS_FIREFOX ? 'FIREFOX' : 'CHROME/EDGE'}`);

  ensureAnalyticsAlarm();
  refreshRemoteAnalyticsConfig().catch(() => {});

  // --- Icon Logic (Global + Tab Context) ---
  let isExtensionEnabled = true;

  const updateTabIcon = (tabId: number, url?: string) => {
    if (!isExtensionEnabled) {
      setActionIcon(tabId, false); // Always gray if globally disabled
      return;
    }
    // Gray if not classroom, Color if classroom
    setActionIcon(tabId, isClassroomUrl(url));
  };

  const updateGlobalIcon = (enabled: boolean) => {
    isExtensionEnabled = enabled;
    
    // Set default icon to GRAY. 
    // We only colorize specific tabs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actionApi = (chrome as any).action || (chrome as any).browserAction;
    if (actionApi?.setIcon) {
      actionApi.setIcon({ path: GRAY_ICON_PATHS });
    }

    // Refresh all tabs
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) updateTabIcon(tab.id, tab.url);
      }
    });
  };

  // Initial check
  chrome.storage.local.get('extensionEnabled', (res) => {
    isExtensionEnabled = res.extensionEnabled !== false;
    updateGlobalIcon(isExtensionEnabled);
  });

  // Listen for global toggle
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.extensionEnabled) {
      updateGlobalIcon(changes.extensionEnabled.newValue !== false);
    }
  });

  // Tab updates: Switch icon based on URL
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' || changeInfo.url) {
      updateTabIcon(tabId, tab.url);
    }
  });

  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      updateTabIcon(activeInfo.tabId, tab.url);
    });
  });

  /* -------------------------------------------------------
   * 1) Messages from drive_bypass.content.ts (Drive tab)
   * -----------------------------------------------------*/
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message || !sender.tab || sender.tab.id == null) return false;

    const tabId = sender.tab.id;
    const pending = pendingByBypassTabId.get(tabId);

    if (!pending && typeof message.type === 'string' && message.type.startsWith('CQD_')) {
      return;
    }

    if (message.type === 'CQD_BYPASS_SUCCESS') {
      if (pending) {
        pending.fallbackStarted = true;
        sendStatusToTab(pending, 'success');
        pending.finalized = true;
      }
      pendingByBypassTabId.delete(tabId);
      setTimeout(() => { try { chrome.tabs.remove(tabId); } catch {} }, 5000);
      return;
    }

    if (message.type === 'CQD_403_SEEN' && pending) {
      pending.confirmed403 = true;
      pending.fallbackStarted = true;
      pendingByBypassTabId.delete(tabId);
      try { chrome.tabs.remove(tabId); } catch {}
      
      if (IS_FIREFOX) {
        // Firefox: Don't rotate auth users via bypass tabs - it's too slow and spammy
        // Just report failure immediately
        console.log('[CQD-FF] 403 in bypass tab - failing immediately (no auth rotation for Firefox)');
        sendStatusToTab(pending, 'error', 'Access denied. Try opening the file directly.', 'ACCESS_DENIED');
        recordDownloadEvent({
          type: pending.fileMeta?.ext || 'unknown',
          status: 'fail',
          duration_ms: Date.now() - pending.startTime,
          bypass_used: true,
          error_type: 'ACCESS_DENIED_FIREFOX',
        });
        cleanup(pending);
      } else {
        // Chrome: Try auth rotation with native downloads
        if (!pending.htmlSeen) {
          pending.htmlSeen = true;
          sendStatusToTab(pending, 'trying', 'Trying your other Google accounts…', 'AUTH_LOOP');
        }
        startNextDriveAttempt(pending);
      }
      return;
    }

    if (message.type === 'CQD_REGISTER_BYPASS_URL' && pending && typeof message.url === 'string') {
      pendingByUrl.set(message.url, pending);
      return;
    }
  });

  /* -------------------------------------------------------
   * 2) onDeterminingFilename (Chrome only)
   * -----------------------------------------------------*/
  if (!IS_FIREFOX && chrome.downloads && chrome.downloads.onDeterminingFilename) {
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
      let pending = pendingByDownloadId.get(item.id);
      if (!pending) {
        pending = pendingByUrl.get(item.url) ?? pendingByUrl.get(item.finalUrl || item.url);
        if (pending) {
          pending.currentDownloadId = item.id;
          pendingByDownloadId.set(item.id, pending);
        }
      }
      if (!pending) { suggest(); return; }

      const actualMime = (item.mime || '').toLowerCase();
      const actualExt = getFilenameExt(item.filename);
      if (actualExt) pending.finalExtension = actualExt;

      const expectedKind = pending.fileMeta?.kind;
      const expectedExt = pending.fileMeta?.ext?.toLowerCase();
      const looksLikeHtml = actualMime.includes('html') || actualExt === 'html' || actualExt === 'htm';
      const userWantedHtml = expectedKind === 'html' || expectedExt === 'html' || expectedExt === 'htm';

      if (looksLikeHtml && !userWantedHtml && pending.isDrive) {
        cancelledByUs.add(item.id);
        chrome.downloads.cancel(item.id, () => {
          pendingByDownloadId.delete(item.id);
          if (!pending.htmlSeen) {
            pending.htmlSeen = true;
            sendStatusToTab(pending, 'trying', 'Google Drive needs an extra confirmation…', 'HTML_INTERCEPT');
          }
          if (pending.confirmed403) { startNextDriveAttempt(pending); return; }
          if (!pending.fallbackStarted) {
            pending.fallbackStarted = true;
            openDriveBypassTab(pending, item.finalUrl || item.url || pending.baseUrl);
          }
        });
        return;
      }

      sendStatusToTab(pending, 'success');
      if (pending.fileMeta?.name) {
        suggest({ filename: pending.fileMeta.name, conflictAction: 'uniquify' });
      } else {
        suggest({ filename: 'classroom_download', conflictAction: 'uniquify' });
      }
    });
  }

  /* -------------------------------------------------------
   * 2b) onCreated (Firefox - match downloads by Drive ID)
   * -----------------------------------------------------*/
  if (IS_FIREFOX && chrome.downloads && chrome.downloads.onCreated) {
    chrome.downloads.onCreated.addListener((item) => {
      console.log('[CQD-FF] onCreated:', { id: item.id, url: item.url });
      
      let pending = pendingByDownloadId.get(item.id);
      
      if (!pending && item.url) {
        // Match by Drive file ID - search ALL pending downloads
        // NOTE: We DO NOT skip finalized entries because we still need to track 
        // subsequent downloads (virus bypass) for analytics
        const downloadFileId = extractDriveFileId(item.url);
        if (downloadFileId) {
          // First: Check bypass tabs
          for (const [tabId, p] of pendingByBypassTabId.entries()) {
            const pendingFileId = extractDriveFileId(p.baseUrl) || extractDriveFileId(p.originalUrl);
            if (pendingFileId === downloadFileId) {
              pending = p;
              console.log('[CQD-FF] Matched by Drive ID (bypass):', downloadFileId);
              break;
            }
          }
          // Second: Check by URL map (for virus bypass redirects)
          if (!pending) {
            for (const [url, p] of pendingByUrl.entries()) {
              const pendingFileId = extractDriveFileId(url) || extractDriveFileId(p.baseUrl) || extractDriveFileId(p.originalUrl);
              if (pendingFileId === downloadFileId) {
                pending = p;
                console.log('[CQD-FF] Matched by Drive ID (url map):', downloadFileId);
                break;
              }
            }
          }
          // Third: Check by request ID map
          if (!pending) {
            for (const [reqId, p] of pendingByRequestId.entries()) {
              const pendingFileId = extractDriveFileId(p.baseUrl) || extractDriveFileId(p.originalUrl);
              if (pendingFileId === downloadFileId) {
                pending = p;
                console.log('[CQD-FF] Matched by Drive ID (request):', downloadFileId);
                break;
              }
            }
          }
        }
        // Fallback: URL map exact match
        if (!pending) {
          pending = pendingByUrl.get(item.url);
          if (pending) console.log('[CQD-FF] Matched by URL map');
        }
      }
      
      if (pending) {
        pending.currentDownloadId = item.id;
        pendingByDownloadId.set(item.id, pending);
        const ext = getFilenameExt(item.filename);
        if (ext) pending.finalExtension = ext;
        if (!pending.finalized) {
          sendStatusToTab(pending, 'success');
          pending.finalized = true;
        }
      }
    });
  }

  /* -------------------------------------------------------
   * 3) onChanged: ANALYTICS TRIGGER
   * -----------------------------------------------------*/
  chrome.downloads.onChanged.addListener((delta) => {
    const pending = pendingByDownloadId.get(delta.id);
    if (!pending) return;

    if (delta.state && delta.state.current === 'complete') {
      const duration = Date.now() - pending.startTime;
      const ext = pending.finalExtension || pending.fileMeta?.ext || 'unknown';
      recordDownloadEvent({ type: ext, status: 'success', duration_ms: duration, bypass_used: !!pending.fallbackStarted });
      if (pending.fileMeta?.name) recentDownloads.set(pending.fileMeta.name, Date.now());
      cleanup(pending, delta.id);
      return;
    }

    if (delta.state && delta.state.current === 'interrupted') {
      if (cancelledByUs.has(delta.id)) {
        cancelledByUs.delete(delta.id);
        pendingByDownloadId.delete(delta.id);
        return;
      }
      const duration = Date.now() - pending.startTime;
      const errorType = delta.error?.current || 'UNKNOWN_INTERRUPT';
      const ext = pending.finalExtension || pending.fileMeta?.ext || 'unknown';
      recordDownloadEvent({ type: ext, status: 'fail', duration_ms: duration, bypass_used: !!pending.fallbackStarted, error_type: errorType });
      sendStatusToTab(pending, 'error', t('downloadInterrupted'));
      cleanup(pending, delta.id);
    }
  });

  /* -------------------------------------------------------
   * 4) CQD_DOWNLOAD HANDLER
   * -----------------------------------------------------*/
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'CQD_DOWNLOAD') return false;

    const rawUrl = message.url as string | undefined;
    const fileMeta = message.fileMeta as FileMetaMsg | undefined;
    const requestId = message.requestId || `req-${Date.now()}`;

    if (!rawUrl) {
      sendResponse?.({ started: false, userMessage: 'No valid link found.' });
      return true;
    }

    const { baseUrl, isDrive } = normalizeUrl(rawUrl);
    const initialAuthUser = isDrive ? extractAuthUserFromUrl(rawUrl) : undefined;

    const pending: PendingDownload = {
      requestId,
      startTime: Date.now(),
      originalUrl: rawUrl,
      baseUrl,
      isDrive,
      fileMeta,
      tabId: sender.tab?.id,
      attemptedAuthUsers: [],
      fallbackStarted: false,
    };

    if (typeof initialAuthUser === 'number') {
      pending.initialAuthUser = initialAuthUser;
      pending.attemptedAuthUsers.push(initialAuthUser);
      pending.currentAuthUser = initialAuthUser;
    }

    pendingByRequestId.set(requestId, pending);
    pendingByUrl.set(baseUrl, pending);

    let responseSent = false;
    const respondOnce = (payload: any) => {
      if (responseSent) return;
      responseSent = true;
      sendResponse?.(payload);
    };

    // ====== FIREFOX: Always use bypass tab for Drive ======
    if (IS_FIREFOX && isDrive) {
      // Use authuser from Classroom URL if available (important for uni/work accounts)
      const bypassUrl = typeof pending.currentAuthUser === 'number'
        ? buildUrlWithAuthUser(pending.baseUrl, pending.currentAuthUser)
        : pending.baseUrl;
      console.log('[CQD-FF] Using bypass tab for Drive download, authuser:', pending.currentAuthUser);
      pending.fallbackStarted = true;
      openDriveBypassTab(pending, bypassUrl);
      respondOnce({ started: true, requestId, userMessage: 'Opening Drive tab…' });
      return true;
    }

    // ====== CHROME/EDGE: Try native download first ======
    if (isDrive) {
      const firstUrl = typeof pending.currentAuthUser === 'number'
        ? buildUrlWithAuthUser(pending.baseUrl, pending.currentAuthUser)
        : pending.baseUrl;

      chrome.downloads.download({ url: firstUrl, saveAs: false, conflictAction: 'uniquify' }, (id) => {
        if (chrome.runtime.lastError || !id) {
          recordDownloadEvent({ type: pending.fileMeta?.ext || 'unknown', status: 'fail', duration_ms: Date.now() - pending.startTime, bypass_used: true, error_type: 'BROWSER_START_FAIL' });
          if (!pending.fallbackStarted) {
            pending.fallbackStarted = true;
            openDriveBypassTab(pending, pending.baseUrl);
            respondOnce({ started: true, requestId, userMessage: 'Browser blocked. Trying Drive tab…' });
          } else {
            respondOnce({ started: false, userMessage: 'Browser blocked download.' });
          }
          return;
        }
        pending.currentDownloadId = id;
        pendingByDownloadId.set(id, pending);
        respondOnce({ started: true, requestId, downloadId: id });
      });
    } else {
      startSingleAttempt(pending, respondOnce);
    }

    return true;
  });
});

/* -------------------------------------------------------
 * Helpers
 * -----------------------------------------------------*/

function startSingleAttempt(pending: PendingDownload, respondOnce?: (payload: any) => void) {
  chrome.downloads.download({ url: pending.baseUrl, saveAs: false, conflictAction: 'uniquify' }, (downloadId) => {
    if (chrome.runtime.lastError || !downloadId) {
      recordDownloadEvent({ type: pending.fileMeta?.ext || 'unknown', status: 'fail', duration_ms: Date.now() - pending.startTime, bypass_used: false, error_type: 'BROWSER_START_FAIL_DIRECT' });
      cleanup(pending);
      respondOnce?.({ started: false, userMessage: 'Browser blocked download.' });
      return;
    }
    pending.currentDownloadId = downloadId;
    pendingByDownloadId.set(downloadId, pending);
    respondOnce?.({ started: true, requestId: pending.requestId, downloadId });
  });
}

function startNextDriveAttempt(pending: PendingDownload) {
  pending.htmlSeen = false;
  pending.fallbackStarted = false;
  pending.confirmed403 = false;

  const nextAuth = AUTHUSER_CANDIDATES.find((n) => !pending.attemptedAuthUsers.includes(n));
  if (nextAuth == null) {
    sendStatusToTab(pending, 'error', 'Access denied for all accounts.', 'AUTH_ALL_FAILED');
    recordDownloadEvent({ type: pending.fileMeta?.ext || 'unknown', status: 'fail', duration_ms: Date.now() - pending.startTime, bypass_used: true, error_type: 'AUTH_ALL_FAILED' });
    cleanup(pending);
    return;
  }

  pending.attemptedAuthUsers.push(nextAuth);
  pending.currentAuthUser = nextAuth;

  if (IS_FIREFOX) {
    // Firefox: Open bypass tab with next auth
    const attemptUrl = buildUrlWithAuthUser(pending.baseUrl, nextAuth);
    openDriveBypassTab(pending, attemptUrl);
  } else {
    // Chrome: Try native download
    const attemptUrl = buildUrlWithAuthUser(pending.baseUrl, nextAuth);
    chrome.downloads.download({ url: attemptUrl, saveAs: false, conflictAction: 'uniquify' }, (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        startNextDriveAttempt(pending);
        return;
      }
      pending.currentDownloadId = downloadId;
      pendingByDownloadId.set(downloadId, pending);
    });
  }
}

function openDriveBypassTab(pending: PendingDownload, url: string) {
  chrome.tabs.create({ url, active: false }, (tab) => {
    if (tab?.id != null) pendingByBypassTabId.set(tab.id, pending);
  });
}

function normalizeUrl(rawUrl: string): { baseUrl: string; isDrive: boolean } {
  try {
    const url = new URL(rawUrl);
    const isDrive = url.hostname.includes('drive');
    if (!isDrive) return { baseUrl: rawUrl, isDrive: false };
    url.searchParams.delete('authuser');
    if (url.pathname.includes('/open')) url.pathname = '/uc';
    if (!url.searchParams.has('export')) url.searchParams.set('export', 'download');
    return { baseUrl: url.toString(), isDrive: true };
  } catch { return { baseUrl: rawUrl, isDrive: false }; }
}

function buildUrlWithAuthUser(baseUrl: string, authuser: number): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('authuser', String(authuser));
    return url.toString();
  } catch { return baseUrl; }
}

function cleanup(pending: PendingDownload, downloadId?: number) {
  pendingByRequestId.delete(pending.requestId);
  if (downloadId != null) {
    pendingByDownloadId.delete(downloadId);
    cancelledByUs.delete(downloadId);
  }
  for (const [url, p] of pendingByUrl.entries()) {
    if (p.requestId === pending.requestId) pendingByUrl.delete(url);
  }
  for (const [tabId, p] of pendingByBypassTabId.entries()) {
    if (p.requestId === pending.requestId) {
      pendingByBypassTabId.delete(tabId);
      try { chrome.tabs.remove(tabId); } catch {}
    }
  }
}

function getFilenameExt(filename?: string): string | undefined {
  if (!filename) return undefined;
  const m = filename.match(/\.([a-zA-Z0-9]{1,10})$/);
  return m ? m[1].toLowerCase() : undefined;
}

function sendStatusToTab(pending: PendingDownload, status: DownloadStatus, userMessage?: string, errorCode?: string): void {
  if (pending.finalized && status === 'success') return;
  if (status === 'success') pending.finalized = true;
  if (pending.tabId == null) return;
  try {
    chrome.tabs.sendMessage(pending.tabId, { type: 'CQD_DOWNLOAD_STATUS', requestId: pending.requestId, status, errorCode, userMessage });
  } catch {}
}