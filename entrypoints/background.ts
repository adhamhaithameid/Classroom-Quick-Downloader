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

    const mime = item.mime || '';
    const expectedExt = pending.fileMeta?.ext?.toLowerCase();
    const host = safeHostname(item.url);

    // We only care about Google Drive / Classroom HTML weirdness
    const isGoogleHost =
      host === 'drive.google.com' || host === 'classroom.google.com';

    if (
      isGoogleHost &&
      mime.toLowerCase().startsWith('text/html') &&
      expectedExt &&
      expectedExt !== 'html' &&
      expectedExt !== 'htm'
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
              'Google returned a web page instead of the file. Open the attachment once in a normal tab (to login or click "Download anyway"), then try again.';
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
   *  -> start download via chrome.downloads
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

    chrome.downloads.download(
      {
        url,
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
          url,
          fileMeta,
          tabId,
        };

        pendingByRequestId.set(requestId, pending);
        pendingByDownloadId.set(downloadId, pending);

        sendResponse?.({
          started: true,
          requestId,
          downloadId,
        });
      },
    );

    return true; // keep channel open for async sendResponse
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
    case 'NETWORK_FAILED':
    case 'NETWORK_TIMEOUT':
    case 'NETWORK_DISCONNECTED':
      return `Your internet connection dropped or Google could not be reached while downloading ${displayName}. Try again.`;
    case 'SERVER_FORBIDDEN':
    case 'SERVER_UNAUTHORIZED':
      return `Google says you do not have permission to download ${displayName}. Open it once normally or request access, then try again.`;
    case 'USER_CANCELED':
      return 'You cancelled this download from the browser.';
    case 'INSUFFICIENT_SPACE':
      return 'Your device does not have enough space to finish this download.';
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
