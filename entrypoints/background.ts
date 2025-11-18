// filepath: entrypoints/background.ts
type FileMetaMsg = {
  name?: string;
  ext?: string;
  kind?: string;
};

type PendingDownload = {
  requestId: string;
  url: string;
  fileMeta?: FileMetaMsg;
  tabId?: number;
};

type DownloadStatus = 'complete' | 'interrupted' | 'blocked_html';

const pendingByRequestId = new Map<string, PendingDownload>();
const pendingByDownloadId = new Map<number, PendingDownload>();

export default defineBackground(() => {
  console.log('[CQD] Background ready');

  /* ---------------------------------------------
   * downloads.onDeterminingFilename
   *  -> block unexpected HTML and optionally
   *     try to auto-resolve Drive "Download anyway"
   * -------------------------------------------*/
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    const pending = pendingByDownloadId.get(item.id);
    if (!pending) {
      suggest();
      return;
    }

    const mime = (item.mime || '').toLowerCase();
    const expectedExt = pending.fileMeta?.ext?.toLowerCase();
    const expectedKind = pending.fileMeta?.kind;
    const actualExt = getFilenameExt(item.filename);
    const host = safeHostname(item.url);

    const isGoogleHost =
      host === 'drive.google.com' || host === 'classroom.google.com';

    const weExpectHtml =
      expectedKind === 'html' ||
      expectedExt === 'html' ||
      expectedExt === 'htm';

    const looksLikeHtml =
      mime.startsWith('text/html') ||
      actualExt === 'html' ||
      actualExt === 'htm';

    // Only block if we have some expectation (ext or kind)
    if (
      isGoogleHost &&
      looksLikeHtml &&
      !weExpectHtml &&
      (expectedExt || expectedKind)
    ) {
      // Cancel this HTML download; try to resolve a real file URL.
      chrome.downloads.cancel(item.id, () => {
        void (async () => {
          const resolved = await tryResolveDriveVirusInterstitial(item.url);

          if (resolved?.ok) {
            chrome.downloads.download(
              {
                url: resolved.finalUrl,
                saveAs: false,
                conflictAction: 'uniquify',
              },
              (newId) => {
                const err = chrome.runtime.lastError;
                if (err || newId == null) {
                  const msg =
                    'Google returned a web page instead of the file, and Quick Downloader could not bypass it.';
                  sendStatusToTab(
                    pending,
                    'blocked_html',
                    msg,
                    'BLOCKED_HTML',
                  );
                  pendingByRequestId.delete(pending.requestId);
                  pendingByDownloadId.delete(item.id);
                  return;
                }

                // Re-bind this pending download to the new id
                pendingByDownloadId.delete(item.id);
                pendingByDownloadId.set(newId, pending);
              },
            );
          } else {
            const msg =
              'Google returned a web page instead of the file. Open the attachment once in a normal tab (to login, grant access, or click "Download anyway"), then try again.';
            sendStatusToTab(pending, 'blocked_html', msg, 'BLOCKED_HTML');
            pendingByRequestId.delete(pending.requestId);
            pendingByDownloadId.delete(item.id);
          }
        })();
      });

      suggest({ filename: item.filename });
      return;
    }

    // Normal path – just accept Chrome’s filename choice
    suggest({ filename: item.filename });
  });

  /* ---------------------------------------------
   * downloads.onChanged
   *  -> completion / network / auth errors
   * -------------------------------------------*/
  chrome.downloads.onChanged.addListener((delta) => {
    const pending = pendingByDownloadId.get(delta.id);
    if (!pending) return;

    if (delta.state && delta.state.current === 'complete') {
      sendStatusToTab(pending, 'complete');
      pendingByDownloadId.delete(delta.id);
      pendingByRequestId.delete(pending.requestId);
      return;
    }

    if (delta.state && delta.state.current === 'interrupted') {
      const errCode = delta.error?.current || 'UNKNOWN';
      const userMessage = userMessageForDownloadError(errCode, pending);
      sendStatusToTab(pending, 'interrupted', userMessage, errCode);
      pendingByDownloadId.delete(delta.id);
      pendingByRequestId.delete(pending.requestId);
    }
  });

  /* ---------------------------------------------
   * runtime.onMessage: CQD_DOWNLOAD
   *  -> preflight check, then start download
   * -------------------------------------------*/
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'CQD_DOWNLOAD') {
      return;
    }

    const rawUrl = typeof message.url === 'string' ? message.url : null;
    const requestId =
      typeof message.requestId === 'string'
        ? message.requestId
        : `req-${Date.now()}`;
    const fileMeta: FileMetaMsg | undefined = message.fileMeta;

    // Wrap the whole flow in an async IIFE so we can use await.
    (async () => {
      if (!rawUrl) {
        sendResponse?.({
          started: false,
          requestId,
          userMessage: 'This attachment does not have a valid download link.',
        });
        return;
      }

      if (!chrome.downloads || typeof chrome.downloads.download !== 'function') {
        sendResponse?.({
          started: false,
          requestId,
          userMessage:
            'Your browser does not allow background downloads for this extension.',
        });
        return;
      }

      const tabId = sender.tab?.id;
      const url = rawUrl;

      // 🔍 NEW: preflight check for auth / HTML "access" pages
      const preflight = await preflightUrl(url, fileMeta);

      if (!preflight.ok) {
        // Fail fast: don't even start the download, just show a clear message.
        sendResponse?.({
          started: false,
          requestId,
          userMessage: preflight.userMessage,
        });
        return;
      }

      const finalUrl = preflight.url;

      chrome.downloads.download(
        {
          url: finalUrl,
          saveAs: false,
          conflictAction: 'uniquify',
        },
        (downloadId) => {
          const err = chrome.runtime.lastError;
          if (err || downloadId === undefined || downloadId === null) {
            console.warn('[CQD] downloads.download error:', err?.message);
            sendResponse?.({
              started: false,
              requestId,
              userMessage:
                'The browser could not start the download. Try again or open the attachment normally.',
            });
            return;
          }

          const pending: PendingDownload = {
            requestId,
            url: finalUrl,
            fileMeta,
            tabId,
          };

          pendingByRequestId.set(requestId, pending);
          pendingByDownloadId.set(downloadId, pending);

          // Simple watchdog: if still pending after 5 minutes, report timeout
          setTimeout(() => {
            const stillPending = pendingByRequestId.get(requestId);
            if (!stillPending) return;
            sendStatusToTab(
              stillPending,
              'interrupted',
              'The download is taking unusually long. Check your Downloads list or try again.',
              'TIMEOUT_WATCHDOG',
            );
            pendingByRequestId.delete(requestId);
            for (const [id, p] of pendingByDownloadId.entries()) {
              if (p.requestId === requestId) {
                pendingByDownloadId.delete(id);
              }
            }
          }, 5 * 60 * 1000);

          sendResponse?.({
            started: true,
            requestId,
            downloadId,
          });
        },
      );
    })();

    // Tell Chrome we'll respond asynchronously
    return true;
  });
});

/* -----------------------------------------------------
 * Helpers
 * ---------------------------------------------------*/

function safeHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * 🔍 Preflight auth / access check.
 *
 * Only runs for Google hosts (Drive / Classroom).
 * - 401 / 403 → clear login / permission messages.
 * - text/html from accounts.google.com or "You need access" page → clear access message.
 * - Otherwise → let the normal download + onDeterminingFilename/onChanged
 *   logic handle everything.
 */
async function preflightUrl(
  url: string,
  fileMeta?: FileMetaMsg,
): Promise<{ ok: true; url: string } | { ok: false; userMessage: string }> {
  const host = safeHostname(url);
  if (!host) {
    // If we can't even parse the host, fall through to normal download.
    return { ok: true, url };
  }

  const isGoogleHost =
    host === 'drive.google.com' || host === 'classroom.google.com';

  // Only preflight Google Classroom / Drive. Everything else uses the old path.
  if (!isGoogleHost) {
    return { ok: true, url };
  }

  const displayName = fileMeta?.name ? `"${fileMeta.name}"` : 'this file';

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'include',
      headers: {
        // Ask only for the first ~1KB so we don't pull full files.
        Range: 'bytes=0-1023',
      },
    });

    const status = res.status;
    const finalUrl = res.url || url;
    const finalHost = safeHostname(finalUrl) ?? host;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    // Hard auth failures
    if (status === 401) {
      return {
        ok: false,
        userMessage: `You need to log in to your Google account before downloading ${displayName}. Open it normally in a tab, sign in, then try again.`,
      };
    }

    if (status === 403) {
      return {
        ok: false,
        userMessage: `Google says you don't have permission to download ${displayName}. Open it normally to request access or switch to an account with access, then try again.`,
      };
    }

    // If Google is giving us an HTML page instead of bytes, try to classify it.
    if (contentType.startsWith('text/html')) {
      const text = await res.text();
      const snippet = text.slice(0, 4000); // enough to scan for key phrases

      // Login / consent page
      if (finalHost === 'accounts.google.com') {
        return {
          ok: false,
          userMessage:
            'Google needs you to complete a sign-in or permission screen before this file can be downloaded. Open it normally in a tab, finish the login/permission flow, then try again.',
        };
      }

      // Access-denied style pages
      if (/you need access|request access|ask for access/i.test(snippet)) {
        return {
          ok: false,
          userMessage: `Google shows a "You need access" page for ${displayName}. Open it normally, request access, wait for approval, then try again.`,
        };
      }
    }

    // Everything looks fine (or at least not clearly bad): proceed with normal download.
    return { ok: true, url: finalUrl };
  } catch (e) {
    console.warn('[CQD] preflightUrl failed:', e);
    // If preflight itself fails (network, CORS, etc.), don't regress:
    // fall back to the normal download path and let onChanged handle errors.
    return { ok: true, url };
  }
}

async function tryResolveDriveVirusInterstitial(
  url: string,
): Promise<{ ok: true; finalUrl: string } | { ok: false } | null> {
  const host = safeHostname(url);
  if (host !== 'drive.google.com') return null;

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'include',
    });

    const finalHost = safeHostname(res.url || url);
    if (finalHost !== 'drive.google.com') {
      return { ok: false };
    }

    const text = await res.text();

    // Look for the "Download anyway" confirm link
    const match =
      text.match(/href="(\/uc\?[^"]*?export=download[^"]*?confirm=[^"]*?id=[^"]+?)"/) ||
      text.match(
        /href="(https:\/\/drive\.google\.com\/uc\?[^"]*?export=download[^"]*?confirm=[^"]*?id=[^"]+?)"/,
      );

    if (!match) {
      return { ok: false };
    }

    const confirmUrl = new URL(
      match[1],
      'https://drive.google.com',
    ).toString();

    return { ok: true, finalUrl: confirmUrl };
  } catch (e) {
    console.warn('[CQD] tryResolveDriveVirusInterstitial failed:', e);
    return { ok: false };
  }
}

function userMessageForDownloadError(
  errorCode: string,
  pending: PendingDownload,
): string {
  const displayName = pending.fileMeta?.name
    ? `"${pending.fileMeta.name}"`
    : 'this file';

  switch (errorCode) {
    // -------- FILE SYSTEM / DISK PROBLEMS --------
    case 'FILE_NO_SPACE':
      return 'Your device does not have enough space to finish this download. Free up some space, then try again.';
    case 'FILE_ACCESS_DENIED':
      return 'The browser was not allowed to save this file. Check your Downloads folder permissions or try another folder.';
    case 'FILE_FAILED':
      return `The browser ran into a problem while saving ${displayName}. Try again or restart the browser.`;
    case 'FILE_NAME_TOO_LONG':
      return 'The file name is too long for your operating system. Try renaming the attachment in Google Drive and then download again.';
    case 'FILE_TOO_LARGE':
      return `${displayName} is too large for the browser or file system to handle. Try downloading it directly from Google Drive.`;
    case 'FILE_VIRUS_INFECTED':
    case 'FILE_BLOCKED':
    case 'FILE_SECURITY_CHECK_FAILED':
      return `${displayName} was blocked as potentially unsafe. Check your browser’s Downloads list for more details.`;

    // -------- NETWORK PROBLEMS --------
    case 'NETWORK_FAILED':
    case 'NETWORK_TIMEOUT':
    case 'NETWORK_DISCONNECTED':
      return `Your internet connection dropped or became unstable while downloading ${displayName}. Check your connection, then try again.`;
    case 'NETWORK_SERVER_DOWN':
      return 'Google’s servers could not be reached while downloading this file. Try again in a few minutes.';

    // -------- SERVER / HTTP PROBLEMS --------
    case 'SERVER_FAILED':
    case 'SERVER_BAD_CONTENT':
      return `Google had a problem sending ${displayName}. Try again later.`;
    case 'SERVER_NO_RANGE':
      return `The server does not support resuming or partial downloads for ${displayName}. Try downloading it directly from Google Drive.`;
    case 'SERVER_UNAUTHORIZED':
    case 'SERVER_FORBIDDEN':
      return `Google says you do not have permission to download ${displayName}. Open it once normally (to login or request access), then try again.`;

    // -------- USER / BROWSER ACTIONS --------
    case 'USER_CANCELED':
      return 'You cancelled this download from the browser.';
    case 'CRASH':
      return 'The browser process handling the download crashed. Reopen the browser and try again.';

    default:
      return 'The download was interrupted by the browser. Try again or open the attachment normally in a tab.';
  }
}

function sendStatusToTab(
  pending: PendingDownload,
  status: DownloadStatus,
  userMessage?: string,
  errorCode?: string,
): void {
  if (pending.tabId == null) return;

  try {
    chrome.tabs.sendMessage(pending.tabId, {
      type: 'CQD_DOWNLOAD_STATUS',
      requestId: pending.requestId,
      status,
      errorCode,
      userMessage,
    });
  } catch (e) {
    console.warn('[CQD] sendStatusToTab failed:', e);
  }
}

function getFilenameExt(filename?: string): string | undefined {
  if (!filename) return undefined;
  const m = filename.match(/\.([a-zA-Z0-9]{1,6})$/);
  return m ? m[1].toLowerCase() : undefined;
}
