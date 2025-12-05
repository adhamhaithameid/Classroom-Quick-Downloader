// filepath: entrypoints/background.ts

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

  originalUrl: string;
  baseUrl: string;
  isDrive: boolean;

  fileMeta?: FileMetaMsg;
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

/* ---------------------------------------------
 * Icon / tab context helpers
 * -------------------------------------------*/

const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;

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
    chrome.action.setIcon({
      tabId,
      path,
    });
  } catch {
    // ignore
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

    // Try query params first (?authuser=2, ?u=2)
    const qp = url.searchParams.get('authuser') ?? url.searchParams.get('u');

    // Then path format /u/2/...
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

export default defineBackground(() => {
  console.log("[CQD] Background ready - PRODUCTION ROBUST MODE (merged)");

  /* ---------------------------------------------
   * Icon behavior: gray vs color
   * -------------------------------------------*/
  if (typeof chrome !== "undefined" && chrome.tabs && chrome.action) {
    try {
      // Initial active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab && tab.id != null) {
          updateIconForTab(tab.id, tab.url);
        }
      });

      // URL / navigation changes
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === "loading" || changeInfo.url) {
          updateIconForTab(tabId, changeInfo.url ?? tab.url);
        }
      });

      // Active tab changes
      chrome.tabs.onActivated.addListener((activeInfo) => {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
          if (chrome.runtime.lastError) return;
          updateIconForTab(activeInfo.tabId, tab.url);
        });
      });

      // Window focus changes
      chrome.windows.onFocusChanged.addListener((windowId) => {
        if (windowId === chrome.windows.WINDOW_ID_NONE) return;
        chrome.tabs.query({ active: true, windowId }, (tabs) => {
          const tab = tabs[0];
          if (tab && tab.id != null) {
            updateIconForTab(tab.id, tab.url);
          }
        });
      });
    } catch {
      // ignore
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
    if (
      !pending &&
      typeof message.type === "string" &&
      message.type.startsWith("CQD_")
    ) {
      return;
    }

    // A) SUCCESS: Drive tab clicked Download / Download anyway
    if (message.type === "CQD_BYPASS_SUCCESS") {
      if (pending) {
        console.log("[CQD] Bypass SUCCESS reported from Drive tab.");
        // 1. Update UI immediately to Green/Success
        sendStatusToTab(pending, "success");
        pending.finalized = true;
      }

      // 2. Stop tracking this tab
      pendingByBypassTabId.delete(tabId);

      // 3. Close the tab after a safe delay (allows download to initiate)
      setTimeout(() => {
        try {
          chrome.tabs.remove(tabId);
        } catch {
          /* ignore */
        }
      }, 5000);
      return;
    }

    // B) 403 SEEN: Drive tab says "I see access denied"
    if (message.type === "CQD_403_SEEN" && pending) {
      console.log("[CQD] 403 page detected in Drive tab.");
      pending.confirmed403 = true;

      // Close this tab, we are done with this specific attempt
      pendingByBypassTabId.delete(tabId);
      try {
        chrome.tabs.remove(tabId);
      } catch {
        /* ignore */
      }

      // Notify UI we are looping
      if (!pending.htmlSeen) {
        pending.htmlSeen = true;
        sendStatusToTab(
          pending,
          "trying",
          "Trying your other Google accounts…",
          "AUTH_LOOP"
        );
      }

      startNextDriveAttempt(pending);
      return;
    }

    // C) AUTH CORRECTING: Drive tab says "I am fixing the URL, wait."
    if (message.type === "CQD_AUTH_CORRECTING" && pending) {
      console.log(
        "[CQD] Content script is correcting authuser. Waiting for reload..."
      );
      // Do NOT close the tab. Do NOT start next attempt. Just wait.
      return;
    }

    // D) LEGACY: URL Registration (kept for safety)
    if (
      message.type === "CQD_REGISTER_BYPASS_URL" &&
      pending &&
      typeof message.url === "string"
    ) {
      pendingByUrl.set(message.url, pending);
      return;
    }
  });

  /* -------------------------------------------------------
   * 2) downloads.onDeterminingFilename
   * Detect HTML vs real file
   * -----------------------------------------------------*/
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    let pending = pendingByDownloadId.get(item.id);
    if (!pending) {
      pending =
        pendingByUrl.get(item.url) ??
        pendingByUrl.get(item.finalUrl || item.url);
    }

    if (!pending) {
      suggest();
      return;
    }

    const actualMime = (item.mime || "").toLowerCase();
    const actualExt = getFilenameExt(item.filename);
    const expectedKind = pending.fileMeta?.kind;
    const expectedExt = pending.fileMeta?.ext?.toLowerCase();

    const looksLikeHtml =
      actualMime.includes("html") ||
      actualExt === "html" ||
      actualExt === "htm";

    const userWantedHtml =
      expectedKind === "html" ||
      expectedExt === "html" ||
      expectedExt === "htm";

    // DRIVE: HTML when we expected a file → either 403 or virus page.
    if (looksLikeHtml && !userWantedHtml && pending.isDrive) {
      console.log(
        "[CQD] Drive returned HTML (403 or virus). Intercepting. authuser=",
        pending.currentAuthUser
      );

      cancelledByUs.add(item.id);

      chrome.downloads.cancel(item.id, () => {
        pendingByDownloadId.delete(item.id);

        if (!pending.htmlSeen) {
          pending.htmlSeen = true;
          sendStatusToTab(
            pending,
            "trying",
            "Google Drive needs an extra confirmation in a new tab…",
            "HTML_INTERCEPT"
          );
        }

        // If we already confirmed a 403, keep looping authuser
        if (pending.confirmed403) {
          startNextDriveAttempt(pending);
          return;
        }

        // Otherwise, open a hidden Drive tab so the content script
        // can fix authuser / click "Download anyway" / classify 403.
        if (!pending.fallbackStarted) {
          pending.fallbackStarted = true;
          const driveUrl = item.finalUrl || item.url || pending.baseUrl;
          openDriveBypassTab(pending, driveUrl);
        }
      });

      return;
    }

    // SUCCESS: Real file (or user explicitly wanted HTML)
    sendStatusToTab(pending, "success");

    if (pending.fileMeta?.name) {
      suggest({ filename: pending.fileMeta.name, conflictAction: "uniquify" });
    } else {
      suggest({ conflictAction: "uniquify" });
    }
  });

  /* -------------------------------------------------------
   * 3) downloads.onChanged (completion / interruptions)
   * -----------------------------------------------------*/
  chrome.downloads.onChanged.addListener((delta) => {
    const pending = pendingByDownloadId.get(delta.id);
    if (!pending) return;

    if (delta.state && delta.state.current === "complete") {
      cleanup(pending, delta.id);
      return;
    }

    if (delta.state && delta.state.current === "interrupted") {
      if (cancelledByUs.has(delta.id)) {
        cancelledByUs.delete(delta.id);
        pendingByDownloadId.delete(delta.id);
        return;
      }
      sendStatusToTab(
        pending,
        "error",
        "Download interrupted."
      );
      cleanup(pending, delta.id);
    }
  });

  /* -------------------------------------------------------
   * 4) CQD_DOWNLOAD from Classroom content script
   * -----------------------------------------------------*/
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "CQD_DOWNLOAD") return;

    const rawUrl = message.url as string | undefined;
    const fileMeta = message.fileMeta as FileMetaMsg | undefined;
    const requestId = message.requestId || `req-${Date.now()}`;

    if (!rawUrl) {
      sendResponse?.({
        started: false,
        userMessage: "No valid link found.",
      });
      return;
    }

    const { baseUrl, isDrive } = normalizeUrl(rawUrl);
    const initialAuthUser = isDrive
      ? extractAuthUserFromUrl(rawUrl)
      : undefined;

    const pending: PendingDownload = {
      requestId,
      originalUrl: rawUrl,
      baseUrl,
      isDrive,
      fileMeta,
      tabId: sender.tab?.id,
      attemptedAuthUsers: [],
    };

    if (typeof initialAuthUser === "number") {
      pending.initialAuthUser = initialAuthUser;
      pending.attemptedAuthUsers.push(initialAuthUser);
      pending.currentAuthUser = initialAuthUser;
    }

    pendingByRequestId.set(requestId, pending);

    let responseSent = false;
    const respondOnce = (payload: any) => {
      if (responseSent) return;
      responseSent = true;
      sendResponse?.(payload);
    };

    if (isDrive) {
      // Try direct download first.
      // If Classroom/rawUrl had an explicit authuser, honor that for the first attempt.
      const firstUrl =
        typeof pending.currentAuthUser === "number"
          ? buildUrlWithAuthUser(pending.baseUrl, pending.currentAuthUser)
          : pending.baseUrl;

      chrome.downloads.download(
        {
          url: firstUrl,
          saveAs: false,
          conflictAction: "uniquify",
        },
        (id) => {
          if (chrome.runtime.lastError || !id) {
            console.warn(
              "[CQD] Initial Drive download start failed:",
              chrome.runtime.lastError?.message
            );

            if (!pending.fallbackStarted) {
              pending.fallbackStarted = true;
              openDriveBypassTab(pending, pending.baseUrl);
              respondOnce({
                started: true,
                requestId,
                userMessage: "Browser blocked. Trying Drive tab…",
              });
            } else {
              respondOnce({
                started: false,
                userMessage: "Browser blocked download.",
              });
            }
            return;
          }

          pending.currentDownloadId = id;
          pendingByDownloadId.set(id, pending);
          respondOnce({ started: true, requestId, downloadId: id });
        }
      );
    } else {
      // Non-Drive
      startSingleAttempt(pending, respondOnce);
    }

    return true;
  });
});

/* -------------------------------------------------------
 * Non-Drive single attempt
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
        cleanup(pending);
        respondOnce?.({
          started: false,
          userMessage: "Browser blocked download.",
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

/* -------------------------------------------------------
 * Drive authuser loop (0..9)
 * -----------------------------------------------------*/
function startNextDriveAttempt(pending: PendingDownload) {
  // Reset per-attempt HTML / fallback state.
  // Otherwise, a 403 seen on a previous authuser would cause us
  // to skip the Drive tab for future HTML responses (including
  // large-file virus warnings), breaking big downloads.
  pending.htmlSeen = false;
  pending.fallbackStarted = false;
  pending.confirmed403 = false;

  const nextAuth = AUTHUSER_CANDIDATES.find(
    (n) => !pending.attemptedAuthUsers.includes(n),
  );

  if (nextAuth == null) {
    console.log('[CQD] All authusers failed.');
    sendStatusToTab(
      pending,
      'error',
      'Access denied for all accounts.',
      'AUTH_ALL_FAILED',
    );
    cleanup(pending);
    return;
  }

  pending.attemptedAuthUsers.push(nextAuth);
  pending.currentAuthUser = nextAuth;

  const attemptUrl = buildUrlWithAuthUser(pending.baseUrl, nextAuth);
  console.log('[CQD] Looping authuser=', nextAuth);

  chrome.downloads.download(
    {
      url: attemptUrl,
      saveAs: false,
      conflictAction: 'uniquify',
    },
    (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        // Immediate fail -> try next authuser
        startNextDriveAttempt(pending);
        return;
      }
      pending.currentDownloadId = downloadId;
      pendingByDownloadId.set(downloadId, pending);
    },
  );
}

/* -------------------------------------------------------
 * Helpers
 * -----------------------------------------------------*/
function openDriveBypassTab(pending: PendingDownload, url: string) {
  console.log('[CQD] Opening Drive bypass tab:', url);
  chrome.tabs.create({ url, active: false }, (tab) => {
    if (tab?.id != null) {
      pendingByBypassTabId.set(tab.id, pending);
    }
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
  const m = filename.match(/\.([a-zA-Z0-9]{1,6})$/);
  return m ? m[1].toLowerCase() : undefined;
}

function sendStatusToTab(
  pending: PendingDownload,
  status: DownloadStatus,
  userMessage?: string,
  errorCode?: string,
): void {
  if (pending.finalized && status === "success") return;
  if (status === "success") pending.finalized = true;
  if (pending.tabId == null) return;

  try {
    chrome.tabs.sendMessage(pending.tabId, {
      type: "CQD_DOWNLOAD_STATUS",
      requestId: pending.requestId,
      status,
      errorCode,
      userMessage,
    });
  } catch {
    /* ignore */
  }
}