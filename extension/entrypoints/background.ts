// filepath: entrypoints/background.ts
import { Analytics } from './utils/analytics';

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

const pendingByRequestId = new Map<string, PendingDownload>();
const pendingByDownloadId = new Map<number, PendingDownload>();
const pendingByUrl = new Map<string, PendingDownload>();
const pendingByBypassTabId = new Map<number, PendingDownload>();

const cancelledByUs = new Set<number>();
const AUTHUSER_CANDIDATES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;

/* ---------------------------------------------
 * Icon / tab context helpers
 * -------------------------------------------*/

function isClassroomUrl(url?: string | null): boolean {
  if (!url) return false;
  return CLASSROOM_URL_PATTERN.test(url);
}

const COLOR_ICON_PATHS: Record<number, string> = {
  16: 'icon/16.png',
  32: 'icon/32.png',
  48: 'icon/48.png',
  96: 'icon/96.png',
  128: 'icon/128.png',
};

const GRAY_ICON_PATHS: Record<number, string> = {
  16: 'icon/16-gray.png',
  32: 'icon/32-gray.png',
  48: 'icon/48-gray.png',
  96: 'icon/96-gray.png',
  128: 'icon/128-gray.png',
};

function setActionIcon(tabId: number, classroom: boolean) {
  if (typeof chrome === 'undefined' || !chrome.action?.setIcon) return;
  const path = classroom ? COLOR_ICON_PATHS : GRAY_ICON_PATHS;
  try {
    chrome.action.setIcon({ tabId, path });
  } catch {
    /* ignore */
  }
}

function updateIconForTab(tabId: number, url?: string | null) {
  const classroom = isClassroomUrl(url);
  setActionIcon(tabId, classroom);
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
    if (Number.isNaN(parsed)) return undefined;
    if (!AUTHUSER_CANDIDATES.includes(parsed)) return undefined;

    return parsed;
  } catch {
    return undefined;
  }
}

/* ---------------------------------------------
 * Analytics alarm setup (MV3-friendly flushing)
 * -------------------------------------------*/

const ANALYTICS_FLUSH_ALARM = 'CQD_ANALYTICS_FLUSH';
let analyticsAlarmInitialized = false;

function ensureAnalyticsAlarm() {
  if (analyticsAlarmInitialized) return;
  if (typeof chrome === 'undefined' || !chrome.alarms) return;

  analyticsAlarmInitialized = true;

  try {
    // Create or update a periodic alarm that fires every 1 minute.
    chrome.alarms.create(ANALYTICS_FLUSH_ALARM, {
      periodInMinutes: 1,
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ANALYTICS_FLUSH_ALARM) {
        // Fire-and-forget; Analytics has its own opChain.
        Analytics.flush();
      }
    });
  } catch {
    // ignore
  }
}

export default defineBackground(() => {
  console.log('[CQD] Background ready - RACE CONDITION FIXED');

  // Ensure MV3-safe periodic flushing of analytics data.
  ensureAnalyticsAlarm();

  // --- Icon Logic ---
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.action) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id != null) updateIconForTab(tabs[0].id, tabs[0].url);
      });

      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'loading' || changeInfo.url) {
          updateIconForTab(tabId, changeInfo.url ?? tab.url);
        }
      });

      chrome.tabs.onActivated.addListener((activeInfo) => {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
          if (!chrome.runtime.lastError) {
            updateIconForTab(activeInfo.tabId, tab.url);
          }
        });
      });

      chrome.windows.onFocusChanged.addListener((windowId) => {
        if (windowId === chrome.windows.WINDOW_ID_NONE) return;
        chrome.tabs.query({ active: true, windowId }, (tabs) => {
          if (tabs[0]?.id != null) updateIconForTab(tabs[0].id, tabs[0].url);
        });
      });
    } catch {
      /* ignore */
    }
  }

  /* -------------------------------------------------------
   * 1) Messages from drive_bypass.content.ts (Drive tab)
   * -----------------------------------------------------*/
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message || !sender.tab || sender.tab.id == null) return;

    const tabId = sender.tab.id;
    const pending = pendingByBypassTabId.get(tabId);

    // Not related to any bypass tab we're tracking
    if (!pending && typeof message.type === 'string' && message.type.startsWith('CQD_')) {
      return;
    }

    // A) SUCCESS: Drive tab clicked Download / Download anyway
    if (message.type === 'CQD_BYPASS_SUCCESS') {
      if (pending) {
        pending.fallbackStarted = true;
        sendStatusToTab(pending, 'success');
        pending.finalized = true;
      }

      pendingByBypassTabId.delete(tabId);
      setTimeout(() => {
        try {
          chrome.tabs.remove(tabId);
        } catch {
          /* ignore */
        }
      }, 5000);
      return;
    }

    // B) 403 SEEN
    if (message.type === 'CQD_403_SEEN' && pending) {
      pending.confirmed403 = true;
      pending.fallbackStarted = true;

      pendingByBypassTabId.delete(tabId);
      try {
        chrome.tabs.remove(tabId);
      } catch {
        /* ignore */
      }

      if (!pending.htmlSeen) {
        pending.htmlSeen = true;
        sendStatusToTab(
          pending,
          'trying',
          'Trying your other Google accounts…',
          'AUTH_LOOP',
        );
      }

      startNextDriveAttempt(pending);
      return;
    }

    // C) LEGACY: URL Registration
    if (
      message.type === 'CQD_REGISTER_BYPASS_URL' &&
      pending &&
      typeof message.url === 'string'
    ) {
      pendingByUrl.set(message.url, pending);
      return;
    }
  });

  /* -------------------------------------------------------
   * 2) onDeterminingFilename - SELF HEALING LOGIC ADDED
   * -----------------------------------------------------*/
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    // 1. Try finding by ID first
    let pending = pendingByDownloadId.get(item.id);

    // 2. Race Condition Fix: If ID missing, aggressively look up by URL
    if (!pending) {
      pending =
        pendingByUrl.get(item.url) ??
        pendingByUrl.get(item.finalUrl || item.url);

      // ✅ SELF-HEAL: If we found it by URL, register the ID *immediately*.
      // This ensures that when the download finishes (onChanged), the ID map exists.
      if (pending) {
        console.log(`[CQD] Self-healing ID map for ${item.id} via URL match`);
        pending.currentDownloadId = item.id;
        pendingByDownloadId.set(item.id, pending);
      }
    }

    if (!pending) {
      suggest();
      return;
    }

    const actualMime = (item.mime || '').toLowerCase();
    const actualExt = getFilenameExt(item.filename);
    if (actualExt) {
      pending.finalExtension = actualExt;
    }

    const expectedKind = pending.fileMeta?.kind;
    const expectedExt = pending.fileMeta?.ext?.toLowerCase();

    const looksLikeHtml =
      actualMime.includes('html') ||
      actualExt === 'html' ||
      actualExt === 'htm';

    const userWantedHtml =
      expectedKind === 'html' ||
      expectedExt === 'html' ||
      expectedExt === 'htm';

    // DRIVE: HTML INTERCEPTION
    if (looksLikeHtml && !userWantedHtml && pending.isDrive) {
      cancelledByUs.add(item.id);
      chrome.downloads.cancel(item.id, () => {
        pendingByDownloadId.delete(item.id);

        if (!pending.htmlSeen) {
          pending.htmlSeen = true;
          sendStatusToTab(
            pending,
            'trying',
            'Google Drive needs an extra confirmation…',
            'HTML_INTERCEPT',
          );
        }

        if (pending.confirmed403) {
          startNextDriveAttempt(pending);
          return;
        }

        if (!pending.fallbackStarted) {
          pending.fallbackStarted = true;
          const driveUrl = item.finalUrl || item.url || pending.baseUrl;
          openDriveBypassTab(pending, driveUrl);
        }
      });
      return;
    }

    // SUCCESS: Real file
    sendStatusToTab(pending, 'success');
    if (pending.fileMeta?.name) {
      suggest({ filename: pending.fileMeta.name, conflictAction: 'uniquify' });
    } else {
      suggest({ conflictAction: 'uniquify' });
    }
  });

  /* -------------------------------------------------------
   * 3) onChanged: ANALYTICS TRIGGER
   * -----------------------------------------------------*/
  chrome.downloads.onChanged.addListener((delta) => {
    const pending = pendingByDownloadId.get(delta.id);
    if (!pending) return;

    // --- ANALYTICS: SUCCESS ---
    if (delta.state && delta.state.current === 'complete') {
      const duration = Date.now() - pending.startTime;
      const ext = pending.finalExtension || pending.fileMeta?.ext || 'unknown';

      Analytics.track({
        status: 'success',
        file_type: ext,
        duration_ms: duration,
        bypass_used: !!pending.fallbackStarted,
      });

      cleanup(pending, delta.id);
      return;
    }

    // --- ANALYTICS: FAILURE ---
    if (delta.state && delta.state.current === 'interrupted') {
      if (cancelledByUs.has(delta.id)) {
        cancelledByUs.delete(delta.id);
        pendingByDownloadId.delete(delta.id);
        return;
      }

      const duration = Date.now() - pending.startTime;
      const errorType = delta.error?.current || 'UNKNOWN_INTERRUPT';
      const ext = pending.finalExtension || pending.fileMeta?.ext || 'unknown';

      Analytics.track({
        status: 'fail',
        file_type: ext,
        duration_ms: duration,
        bypass_used: !!pending.fallbackStarted,
        error_type: errorType,
      });

      sendStatusToTab(pending, 'error', 'Download interrupted.');
      cleanup(pending, delta.id);
    }
  });

  /* -------------------------------------------------------
   * 4) CQD_DOWNLOAD HANDLER
   * -----------------------------------------------------*/
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'CQD_DOWNLOAD') return;

    const rawUrl = message.url as string | undefined;
    const fileMeta = message.fileMeta as FileMetaMsg | undefined;
    const requestId = message.requestId || `req-${Date.now()}`;

    if (!rawUrl) {
      sendResponse?.({
        started: false,
        userMessage: 'No valid link found.',
      });
      return;
    }

    const { baseUrl, isDrive } = normalizeUrl(rawUrl);
    const initialAuthUser = isDrive
      ? extractAuthUserFromUrl(rawUrl)
      : undefined;

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

    // Also register by URL immediately for the race condition fix
    pendingByUrl.set(baseUrl, pending);

    let responseSent = false;
    const respondOnce = (payload: any) => {
      if (responseSent) return;
      responseSent = true;
      sendResponse?.(payload);
    };

    if (isDrive) {
      const firstUrl =
        typeof pending.currentAuthUser === 'number'
          ? buildUrlWithAuthUser(pending.baseUrl, pending.currentAuthUser)
          : pending.baseUrl;

      chrome.downloads.download(
        {
          url: firstUrl,
          saveAs: false,
          conflictAction: 'uniquify',
        },
        (id) => {
          if (chrome.runtime.lastError || !id) {
            Analytics.track({
              status: 'fail',
              file_type: pending.fileMeta?.ext || 'unknown',
              duration_ms: Date.now() - pending.startTime,
              bypass_used: true,
              error_type: 'BROWSER_START_FAIL',
            });

            if (!pending.fallbackStarted) {
              pending.fallbackStarted = true;
              openDriveBypassTab(pending, pending.baseUrl);
              respondOnce({
                started: true,
                requestId,
                userMessage: 'Browser blocked. Trying Drive tab…',
              });
            } else {
              respondOnce({
                started: false,
                userMessage: 'Browser blocked download.',
              });
            }
            return;
          }

          pending.currentDownloadId = id;
          pendingByDownloadId.set(id, pending);
          respondOnce({ started: true, requestId, downloadId: id });
        },
      );
    } else {
      startSingleAttempt(pending, respondOnce);
    }

    return true;
  });
});

/* -------------------------------------------------------
 * Helpers
 * -----------------------------------------------------*/

function startSingleAttempt(
  pending: PendingDownload,
  respondOnce?: (payload: any) => void,
) {
  chrome.downloads.download(
    {
      url: pending.baseUrl,
      saveAs: false,
      conflictAction: 'uniquify',
    },
    (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        Analytics.track({
          status: 'fail',
          file_type: pending.fileMeta?.ext || 'unknown',
          duration_ms: Date.now() - pending.startTime,
          bypass_used: false,
          error_type: 'BROWSER_START_FAIL_DIRECT',
        });

        cleanup(pending);
        respondOnce?.({
          started: false,
          userMessage: 'Browser blocked download.',
        });
        return;
      }

      pending.currentDownloadId = downloadId;
      pendingByDownloadId.set(downloadId, pending);
      respondOnce?.({
        started: true,
        requestId: pending.requestId,
        downloadId,
      });
    },
  );
}

function startNextDriveAttempt(pending: PendingDownload) {
  pending.htmlSeen = false;
  pending.fallbackStarted = false;
  pending.confirmed403 = false;

  const nextAuth = AUTHUSER_CANDIDATES.find(
    (n) => !pending.attemptedAuthUsers.includes(n),
  );

  if (nextAuth == null) {
    sendStatusToTab(
      pending,
      'error',
      'Access denied for all accounts.',
      'AUTH_ALL_FAILED',
    );

    Analytics.track({
      status: 'fail',
      file_type: pending.fileMeta?.ext || 'unknown',
      duration_ms: Date.now() - pending.startTime,
      bypass_used: true,
      error_type: 'AUTH_ALL_FAILED',
    });

    cleanup(pending);
    return;
  }

  pending.attemptedAuthUsers.push(nextAuth);
  pending.currentAuthUser = nextAuth;
  const attemptUrl = buildUrlWithAuthUser(pending.baseUrl, nextAuth);

  chrome.downloads.download(
    {
      url: attemptUrl,
      saveAs: false,
      conflictAction: 'uniquify',
    },
    (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        startNextDriveAttempt(pending);
        return;
      }
      pending.currentDownloadId = downloadId;
      pendingByDownloadId.set(downloadId, pending);
    },
  );
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

    if (url.pathname.includes('/open')) {
      url.pathname = '/uc';
    }
    if (!url.searchParams.has('export')) {
      url.searchParams.set('export', 'download');
    }

    return { baseUrl: url.toString(), isDrive: true };
  } catch {
    return { baseUrl: rawUrl, isDrive: false };
  }
}

function buildUrlWithAuthUser(baseUrl: string, authuser: number): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('authuser', String(authuser));
    return url.toString();
  } catch {
    return baseUrl;
  }
}

function cleanup(pending: PendingDownload, downloadId?: number) {
  pendingByRequestId.delete(pending.requestId);

  if (downloadId != null) {
    pendingByDownloadId.delete(downloadId);
    cancelledByUs.delete(downloadId);
  }

  for (const [url, p] of pendingByUrl.entries()) {
    if (p.requestId === pending.requestId) {
      pendingByUrl.delete(url);
    }
  }

  for (const [tabId, p] of pendingByBypassTabId.entries()) {
    if (p.requestId === pending.requestId) {
      pendingByBypassTabId.delete(tabId);
      try {
        chrome.tabs.remove(tabId);
      } catch {
        /* ignore */
      }
    }
  }
}

function getFilenameExt(filename?: string): string | undefined {
  if (!filename) return undefined;
  // Allows 1–10 chars to capture things like .mht, .html, .json, .classroom
  const m = filename.match(/\.([a-zA-Z0-9]{1,10})$/);
  return m ? m[1].toLowerCase() : undefined;
}

function sendStatusToTab(
  pending: PendingDownload,
  status: DownloadStatus,
  userMessage?: string,
  errorCode?: string,
): void {
  if (pending.finalized && status === 'success') return;
  if (status === 'success') pending.finalized = true;
  if (pending.tabId == null) return;

  try {
    chrome.tabs.sendMessage(pending.tabId, {
      type: 'CQD_DOWNLOAD_STATUS',
      requestId: pending.requestId,
      status,
      errorCode,
      userMessage,
    });
  } catch {
    /* ignore */
  }
}