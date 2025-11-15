// export default defineBackground(() => {
//   console.log('Hello background!', { id: browser.runtime.id });
// });

// filepath: entrypoints/background.ts
// Classroom Quick Downloader - background service worker
// Handles actual downloads using chrome.downloads so they happen in the background.

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'CQD_DOWNLOAD') {
      return; // Not our message
    }

    const url: string | undefined = message.url;
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      sendResponse({ ok: false, error: 'Invalid URL' });
      return;
    }

    if (!chrome.downloads || typeof chrome.downloads.download !== 'function') {
      sendResponse({ ok: false, error: 'chrome.downloads API not available' });
      return;
    }

    chrome.downloads.download({ url }, (downloadId) => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.warn('[CQD] chrome.downloads.download error:', err.message);
        sendResponse({ ok: false, error: err.message });
        return;
      }

      sendResponse({ ok: true, id: downloadId });
    });

    // Keep the message channel open for async sendResponse
    return true;
  });
});
