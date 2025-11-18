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
const pendingByUrl = new Map<string, PendingDownload>();

export default defineBackground(() => {
  console.log('[CQD] Background ready - Immediate Success Mode');

  /* ---------------------------------------------
   * 1. Handle bypass success (auto-close helper tab)
   * -------------------------------------------*/
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === 'CQD_BYPASS_SUCCESS' && sender.tab?.id != null) {
      const tabId = sender.tab.id;
      setTimeout(() => {
        // MV3 style callback (no .catch)
        chrome.tabs.remove(tabId, () => {
          void chrome.runtime.lastError;
        });
      }, 5000);
    }
  });

  /* ---------------------------------------------
   * 2. downloads.onDeterminingFilename
   *    -> HTML vs expected file type
   * -------------------------------------------*/
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

    const actualMime = (item.mime || '').toLowerCase();
    const actualExt = getFilenameExt(item.filename);
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

    // If Drive returned an HTML page but we expected a binary file
    if (looksLikeHtml && !userWantedHtml) {
      console.log('[CQD] HTML (virus / interstitial) detected. Opening background tab.');

      chrome.downloads.cancel(item.id, () => {
        chrome.tabs.create(
          {
            url: item.finalUrl || item.url,
            active: false, // <- user stays on Classroom
          },
          () => {
            // We don't touch the UI here; it already went "success"
            cleanup(pending!, item.id);
          },
        );
      });
      return;
    }

    // Normal filename handling
    if (pending.fileMeta?.name) {
      suggest({ filename: pending.fileMeta.name, conflictAction: 'uniquify' });
    } else {
      suggest({ conflictAction: 'uniquify' });
    }
  });

  /* ---------------------------------------------
   * 3. downloads.onChanged
   *    -> cleanup only, no UI changes
   * -------------------------------------------*/
  chrome.downloads.onChanged.addListener((delta) => {
    const pending = pendingByDownloadId.get(delta.id);
    if (!pending) return;

    if (
      (delta.state && delta.state.current === 'complete') ||
      (delta.state && delta.state.current === 'interrupted')
    ) {
      cleanup(pending, delta.id);
    }
  });

  /* ---------------------------------------------
   * 4. runtime.onMessage: CQD_DOWNLOAD
   *    -> IMMEDIATE success/error
   * -------------------------------------------*/
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'CQD_DOWNLOAD') return;

    const requestId =
      typeof message.requestId === 'string'
        ? message.requestId
        : `req-${Date.now()}`;
    const rawUrl = typeof message.url === 'string' ? message.url : null;
    const fileMeta: FileMetaMsg | undefined = message.fileMeta;

    if (!rawUrl) {
      // immediate error: no URL at all
      sendStatusToTab(
        {
          requestId,
          url: '',
          fileMeta,
          tabId: sender.tab?.id,
        },
        'interrupted',
        'No valid link found.',
        'NO_URL',
      );
      sendResponse?.({
        started: false,
        requestId,
        userMessage: 'No valid link found.',
      });
      return;
    }

    const pending: PendingDownload = {
      requestId,
      url: rawUrl,
      fileMeta,
      tabId: sender.tab?.id,
    };

    pendingByRequestId.set(requestId, pending);
    pendingByUrl.set(rawUrl, pending);

    chrome.downloads.download(
      {
        url: rawUrl,
        saveAs: false,
        conflictAction: 'uniquify',
      },
      (downloadId) => {
        const err = chrome.runtime.lastError;

        // ❌ Immediate error: browser refused to start download
        if (err || !downloadId) {
          console.warn('[CQD] downloads.download failed:', err?.message);

          sendStatusToTab(
            pending,
            'interrupted',
            'Browser could not start the download.',
            'START_FAILED',
          );

          cleanup(pending);

          sendResponse?.({
            started: false,
            requestId,
            userMessage: 'Browser blocked download start.',
          });
          return;
        }

        // ✅ Immediate success: browser accepted the download
        console.log('[CQD] Download started:', downloadId);
        pendingByDownloadId.set(downloadId, pending);

        // Tell the UI: "Success" RIGHT NOW
        sendStatusToTab(pending, 'complete');

        sendResponse?.({
          started: true,
          requestId,
          downloadId,
        });
      },
    );

    return true; // async response
  });
});

/* -----------------------------------------------------
 * Helpers
 * ---------------------------------------------------*/

function cleanup(pending: PendingDownload, downloadId?: number) {
  pendingByRequestId.delete(pending.requestId);
  pendingByUrl.delete(pending.url);
  if (downloadId != null) {
    pendingByDownloadId.delete(downloadId);
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
    // ignore
  }
}
