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

type DriveHtmlReason =
  | 'login_required'
  | 'permission_required'
  | 'virus_interstitial'
  | 'other_html';

type DriveInterstitialResult =
  | { ok: true; finalUrl: string }
  | { ok: false; reason?: DriveHtmlReason; userMessage?: string }
  | null;

const pendingByRequestId = new Map<string, PendingDownload>();
const pendingByDownloadId = new Map<number, PendingDownload>();
const pendingByUrl = new Map<string, PendingDownload>();

export default defineBackground(() => {
  console.log('[CQD] Background ready');

  /* ---------------------------------------------
   * downloads.onDeterminingFilename
   *  -> block unexpected HTML and optionally
   *     try to auto-resolve Drive "Download anyway"
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

    const mime = (item.mime || '').toLowerCase();
    const expectedExt = pending.fileMeta?.ext?.toLowerCase();
    const expectedKind = pending.fileMeta?.kind;
    const actualExt = getFilenameExt(item.filename);
    const host = safeHostname(item.url);

    const isGoogleHost =
      host === 'drive.google.com' ||
      host === 'classroom.google.com' ||
      host === 'drive.usercontent.google.com';

    const weExpectHtml =
      expectedKind === 'html' ||
      expectedExt === 'html' ||
      expectedExt === 'htm';

    const looksLikeHtml =
      mime.startsWith('text/html') ||
      actualExt === 'html' ||
      actualExt === 'htm';

    if (isGoogleHost && looksLikeHtml && !weExpectHtml) {
      chrome.downloads.cancel(item.id, () => {
        void (async () => {
          const resolved = await tryResolveDriveVirusInterstitial(
            item.finalUrl || item.url,
          );

          if (resolved && resolved.ok) {
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
                    'Google returned a web page instead of the file. Quick Downloader could not bypass it.';
                  const errorCode = 'BLOCKED_HTML';

                  sendStatusToTab(
                    pending as PendingDownload,
                    'blocked_html',
                    msg,
                    errorCode,
                  );
                  pendingByRequestId.delete(pending!.requestId);
                  pendingByDownloadId.delete(item.id);
                  return;
                }

                pendingByDownloadId.delete(item.id);
                pendingByDownloadId.set(newId, pending as PendingDownload);
                pendingByUrl.set(resolved.finalUrl, pending as PendingDownload);
              },
            );
          } else {
            const fallbackMsg =
              'Google returned a web page instead of the file. Open it in a tab (login / access / “Download anyway”), then try again.';

            const msg =
              resolved && !resolved.ok && resolved.userMessage
                ? resolved.userMessage
                : fallbackMsg;

            const reason = resolved && !resolved.ok && resolved.reason;
            const errorCode =
              reason === 'login_required'
                ? 'LOGIN_REQUIRED'
                : reason === 'permission_required'
                ? 'PERMISSION_REQUIRED'
                : reason === 'virus_interstitial'
                ? 'VIRUS_INTERSTITIAL'
                : 'BLOCKED_HTML';

            sendStatusToTab(
              pending as PendingDownload,
              'blocked_html',
              msg,
              errorCode,
            );
            pendingByRequestId.delete(pending!.requestId);
            pendingByDownloadId.delete(item.id);
          }
        })();
      });

      suggest({ filename: item.filename });
      return;
    }

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
        userMessage: 'No valid download link for this attachment.',
      });
      return;
    }

    if (!chrome.downloads || typeof chrome.downloads.download !== 'function') {
      sendResponse?.({
        started: false,
        requestId,
        userMessage:
          'Browser does not allow background downloads for this extension.',
      });
      return;
    }

    const tabId = sender.tab?.id;
    const url = rawUrl;

    const pending: PendingDownload = {
      requestId,
      url,
      fileMeta,
      tabId,
    };

    pendingByRequestId.set(requestId, pending);
    pendingByUrl.set(url, pending);

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

          pendingByRequestId.delete(requestId);
          pendingByUrl.delete(url);

          sendResponse?.({
            started: false,
            requestId,
            userMessage:
              'Browser could not start the download. Try again or open it normally.',
          });
          return;
        }

        pendingByDownloadId.set(downloadId, pending);

        setTimeout(() => {
          const stillPending = pendingByRequestId.get(requestId);
          if (!stillPending) return;

          sendStatusToTab(
            stillPending,
            'interrupted',
            'Download is taking too long. Check Downloads or try again.',
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

// HTML resolver for "webpage instead of file" cases from Drive.
async function tryResolveDriveVirusInterstitial(
  url: string,
): Promise<DriveInterstitialResult> {
  const host = safeHostname(url);
  if (
    host !== 'drive.google.com' &&
    host !== 'classroom.google.com' &&
    host !== 'drive.usercontent.google.com'
  ) {
    return null;
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'include',
    });

    const finalHost = safeHostname(res.url || url);

    // Redirect to accounts.google.com etc. -> login issue
    if (finalHost && finalHost !== 'drive.google.com') {
      const lowerUrl = (res.url || url).toLowerCase();
      if (lowerUrl.includes('accounts.google.com')) {
        return {
          ok: false,
          reason: 'login_required',
          userMessage:
            'Sign in to the right Google account in a normal tab, then try again.',
        };
      }
      // Could be usercontent here, but if it's already the file, there is no HTML to parse.
      // We still continue below with HTML parsing.
    }

    if (res.status === 401) {
      return {
        ok: false,
        reason: 'login_required',
        userMessage:
          'Sign in to the right Google account in a normal tab, then try again.',
      };
    }

    if (res.status === 403) {
      return {
        ok: false,
        reason: 'permission_required',
        userMessage:
          'You need permission for this file. Open it in a tab and click “Request access”.',
      };
    }

    const text = await res.text();
    const lower = text.toLowerCase();

    // 1) Try to find any confirm= URL (anchor, data-href, or form action)
    const hrefMatch =
      text.match(/href=["']([^"']*?confirm=[^"']+?)["']/i) ||
      text.match(/data-href=["']([^"']*?confirm=[^"']+?)["']/i);
    const actionMatch =
      text.match(/action=["']([^"']*?confirm=[^"']+?)["']/i);

    const explicitConfirm = hrefMatch || actionMatch;
    if (explicitConfirm) {
      const raw = explicitConfirm[1];
      try {
        const confirmUrl = new URL(raw, res.url || url).toString();
        return { ok: true, finalUrl: confirmUrl };
      } catch (e) {
        console.warn('[CQD] could not build confirm URL from match', e);
      }
    }

    // 2) Try to simulate pressing the "Download anyway" button by
    //    parsing <form ... action="https://drive.usercontent.google.com/download">.
    const formUrl = extractDownloadFormUrl(text, res.url || url);
    if (formUrl) {
      return { ok: true, finalUrl: formUrl };
    }

    // 3) No explicit confirm link/form found – classify page by content

    // "You need access" / permission page
    if (lower.includes('you need access') || lower.includes('request access')) {
      return {
        ok: false,
        reason: 'permission_required',
        userMessage:
          'You need permission for this file. Open it in a tab and click “Request access”.',
      };
    }

    // Login / sign-in
    if (
      lower.includes('sign in') &&
      (lower.includes('to continue to google drive') ||
        lower.includes('to continue to drive') ||
        lower.includes('to continue to google'))
    ) {
      return {
        ok: false,
        reason: 'login_required',
        userMessage:
          'Sign in to the right Google account in a normal tab, then try again.',
      };
    }

    // 4) Virus scan interstitial (various phrasings)
    const looksLikeVirusPage =
      lower.includes("can't be scanned for viruses") ||
      lower.includes('cant be scanned for viruses') ||
      lower.includes("can't scan this file for viruses") ||
      lower.includes('cant scan this file for viruses') ||
      lower.includes('too large for google to scan') ||
      lower.includes('too large to be scanned for viruses') ||
      lower.includes('download anyway');

    if (looksLikeVirusPage) {
      // Try a synthetic "confirm" URL based on the Drive /uc endpoint
      const confirmUrl = buildConfirmUrlFromVirusPage(url, res.url);
      if (confirmUrl) {
        return { ok: true, finalUrl: confirmUrl };
      }

      // As an extra fallback, guess a direct drive.usercontent.google.com URL
      const userContentGuess = buildUserContentDownloadGuess(url, res.url);
      if (userContentGuess) {
        return { ok: true, finalUrl: userContentGuess };
      }

      return {
        ok: false,
        reason: 'virus_interstitial',
        userMessage:
          'Google can’t scan this file. Open it and click “Download anyway”, then try again.',
      };
    }

    // Default: some other Drive HTML page
    return { ok: false, reason: 'other_html' };
  } catch (e) {
    console.warn('[CQD] tryResolveDriveVirusInterstitial failed:', e);
    return { ok: false, reason: 'other_html' };
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
      return 'Not enough disk space. Free some space and try again.';
    case 'FILE_ACCESS_DENIED':
      return 'Browser could not write to Downloads. Check folder permissions.';
    case 'FILE_FAILED':
      return `Problem saving ${displayName}. Try again.`;
    case 'FILE_NAME_TOO_LONG':
      return 'File name is too long. Rename it in Drive and try again.';
    case 'FILE_TOO_LARGE':
      return `${displayName} is too large. Try downloading it directly from Google Drive.`;
    case 'FILE_VIRUS_INFECTED':
    case 'FILE_BLOCKED':
    case 'FILE_SECURITY_CHECK_FAILED':
      return `${displayName} was blocked as unsafe. Check the browser’s Downloads list.`;

    // -------- NETWORK PROBLEMS --------
    case 'NETWORK_FAILED':
    case 'NETWORK_TIMEOUT':
    case 'NETWORK_DISCONNECTED':
      return `Network error while downloading ${displayName}. Check your connection and try again.`;
    case 'NETWORK_SERVER_DOWN':
      return 'Google’s servers could not be reached. Try again later.';

    // -------- SERVER / HTTP PROBLEMS --------
    case 'SERVER_FAILED':
    case 'SERVER_BAD_CONTENT':
      return `Google had a problem sending ${displayName}. Try again later.`;
    case 'SERVER_NO_RANGE':
      return 'Server does not support partial downloads. Try downloading directly from Drive.';
    case 'SERVER_UNAUTHORIZED':
    case 'SERVER_FORBIDDEN':
      return `You don’t have permission for ${displayName}. Open it in a tab (login / request access) and try again.`;

    // -------- USER / BROWSER ACTIONS --------
    case 'USER_CANCELED':
      return 'You cancelled this download.';
    case 'CRASH':
      return 'The browser process crashed. Reopen the browser and try again.';

    default:
      return 'The download was interrupted. Try again or open the file normally in a tab.';
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

/**
 * Try to reconstruct the URL that the "Download anyway" button submits:
 * <form ... action="https://drive.usercontent.google.com/download">
 *   <input type="hidden" name="id" value="...">
 *   ...
 * </form>
 */
function extractDownloadFormUrl(html: string, baseUrl: string): string | null {
  // First, prefer an explicit id="download-form" if present
  let formMatch =
    html.match(
      /<form[^>]*id=["']download-form["'][^>]*action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/i,
    ) ||
    // Fallback: any form that posts to drive.usercontent.google.com/download
    html.match(
      /<form[^>]*action=["']([^"']*drive\.usercontent\.google\.com\/download[^"']*)["'][^>]*>([\s\S]*?)<\/form>/i,
    );

  if (!formMatch) return null;

  const action = formMatch[1];
  const inner = formMatch[2];

  const params = new URLSearchParams();
  const inputRegex =
    /<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi;

  let m: RegExpExecArray | null;
  while ((m = inputRegex.exec(inner))) {
    const name = m[1];
    const value = m[2];
    params.set(name, value);
  }

  try {
    const actionUrl = new URL(action, baseUrl);
    const sp = actionUrl.searchParams;

    params.forEach((value, key) => {
      sp.set(key, value);
    });

    return actionUrl.toString();
  } catch (e) {
    console.warn('[CQD] extractDownloadFormUrl: failed to build URL', e);
    return null;
  }
}

/**
 * Older style: build a /uc?export=download&confirm=... URL from a Drive page.
 */
function buildConfirmUrlFromVirusPage(
  originalUrl: string,
  responseUrl?: string,
): string | null {
  const candidate = responseUrl || originalUrl;

  try {
    const u = new URL(candidate);

    if (u.hostname !== 'drive.google.com') return null;

    // Try to get the file id from query
    let id = u.searchParams.get('id') || undefined;

    // Fallback: /file/d/<id>/ style URLs
    if (!id) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (m) id = m[1];
    }

    if (!id) return null;

    const confirmUrl = new URL('https://drive.google.com/uc');
    confirmUrl.searchParams.set('export', 'download');
    confirmUrl.searchParams.set('id', id);
    // "t" is what Drive uses in the hidden input in your snippet.
    confirmUrl.searchParams.set('confirm', 't');

    return confirmUrl.toString();
  } catch {
    return null;
  }
}

/**
 * Extra fallback: try to directly hit drive.usercontent.google.com/download
 * using only the file id + authuser, with confirm=t.
 * This mirrors the URL you pasted:
 *   https://drive.usercontent.google.com/download?id=...&export=download&authuser=0&confirm=t
 */
function buildUserContentDownloadGuess(
  originalUrl: string,
  responseUrl?: string,
): string | null {
  const candidate = responseUrl || originalUrl;

  try {
    const u = new URL(candidate);

    // Extract Drive file id from query or /file/d/<id>/ path
    let id = u.searchParams.get('id') || undefined;
    if (!id) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (m) id = m[1];
    }
    if (!id) return null;

    const authuser = u.searchParams.get('authuser') || '0';

    const out = new URL('https://drive.usercontent.google.com/download');
    out.searchParams.set('id', id);
    out.searchParams.set('export', 'download');
    out.searchParams.set('authuser', authuser);
    out.searchParams.set('confirm', 't'); // matches your form's hidden value

    return out.toString();
  } catch {
    return null;
  }
}
