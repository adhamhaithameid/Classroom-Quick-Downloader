// filepath: entrypoints/drive_bypass.content.ts
import { whenExtensionEnabled } from './content/flags';

type PageState =
  | 'STATE_LOADING'
  | 'STATE_VIRUS_WARNING'
  | 'STATE_DRIVE_PREVIEW'
  | 'STATE_ACCESS_DENIED';

export default defineContentScript({
  matches: [
    'https://drive.google.com/*',
    'https://drive.usercontent.google.com/*',
  ],
  // Start early so we can react quickly to 403 / virus / preview pages
  runAt: 'document_start',
  main() {
    // ⬇️ Only run this helper when the extension is enabled
    whenExtensionEnabled(() => {
      let virusHandled = false;
      let previewClicked = false;
      let auth403Reported = false;

      const tick = () => {
        const url = window.location.href;
        const body = document.body;
        const bodyText = (body?.innerText || '').toLowerCase();

        /* --------------------------------------------------
         * 1) Virus / large file warning → auto "Download anyway"
         * -------------------------------------------------- */
        if (!virusHandled && isVirusWarningPage(bodyText)) {
          console.log(
            '[CQD] Virus / large-file warning detected. Auto-clicking "Download anyway"...',
          );
          if (handleVirusBypassClick()) {
            virusHandled = true;

            // Tell background "bypass triggered, flip UI to success"
            notifySuccessFlood();
            return;
          }
        }

        /* --------------------------------------------------
         * 2) Drive Preview UI → click toolbar Download
         *    (NORMAL SMALL / MEDIUM files path)
         * -------------------------------------------------- */
        if (!previewClicked && isDrivePreviewUI()) {
          const clicked = clickDriveToolbarDownload();
          if (clicked) {
            previewClicked = true;
            console.log(
              '[CQD] Drive preview toolbar Download clicked. Notifying background success…',
            );

            // Same success path: preview UI triggered the real file download
            notifySuccessFlood();
          }
        }

        /* --------------------------------------------------
         * 3) Hard 403 on Drive (google.com or usercontent) → report to background
         *    (when authuser loop in background should take over)
         * -------------------------------------------------- */
        if (
          !auth403Reported &&
          (url.includes('drive.google.com') ||
            url.includes('drive.usercontent.google.com')) &&
          isAccessDeniedPage(bodyText)
        ) {
          auth403Reported = true;
          console.log(
            '[CQD] Hard 403 in Drive tab. Reporting CQD_403_SEEN to background…',
          );
          try {
            chrome.runtime.sendMessage({ type: 'CQD_403_SEEN' });
          } catch {
            /* ignore */
          }
        }
      };

      // Run immediately & keep watching – Drive updates DOM dynamically
      tick();

      // Slightly faster than before: every 300 ms (was 500 ms)
      const intervalId = window.setInterval(tick, 300);

      // Safety: stop after ~45s if nothing interesting happens
      window.setTimeout(() => {
        window.clearInterval(intervalId);
      }, 45000);
    });
  },
});

/* --------------------------------------------------------------------------
 * Detection helpers
 * ------------------------------------------------------------------------*/

function isVirusWarningPage(bodyText: string): boolean {
  return (
    bodyText.includes("can't be scanned for viruses") ||
    bodyText.includes('cant be scanned for viruses') ||
    bodyText.includes("can't scan this file for viruses") ||
    bodyText.includes('download anyway') ||
    bodyText.includes('تنزيل على أي حال') ||
    !!document.getElementById('uc-download-link')
  );
}

function isDrivePreviewUI(): boolean {
  return (
    document.querySelector('div[aria-label="Download"]') !== null ||
    document.querySelector('div[data-tooltip="Download"]') !== null ||
    document.querySelector('div[role="button"][aria-label="Download"]') !==
      null ||
    window.location.href.includes('/view')
  );
}

function isAccessDeniedPage(bodyText: string): boolean {
  return (
    bodyText.includes('forbidden') ||
    bodyText.includes('you do not have access') ||
    bodyText.includes('access to this page is restricted') ||
    bodyText.includes('request access') ||
    bodyText.includes('switch accounts') ||
    bodyText.includes('403') || // generic 403 detection
    bodyText.includes("that’s an error") ||
    bodyText.includes("that's an error") ||
    bodyText.includes("we're sorry, but you do not have access")
  );
}

/* --------------------------------------------------------------------------
 * Virus / large-file bypass (original behavior)
 * ------------------------------------------------------------------------*/

function handleVirusBypassClick(): boolean {
  let clicked = false;

  // Strategy 1: direct ID (most common)
  const directBtn = document.getElementById('uc-download-link');
  if (directBtn instanceof HTMLElement) {
    directBtn.click();
    clicked = true;
  }

  // Strategy 2: form with confirm= in action
  if (!clicked) {
    const form = document.querySelector('form[action*="confirm="]');
    if (form instanceof HTMLFormElement) {
      form.submit();
      clicked = true;
    }
  }

  // Strategy 3: text search fallback ("Download anyway" English/Arabic)
  if (!clicked) {
    const candidates = document.querySelectorAll<HTMLElement>(
      'a, button, input[type="submit"]',
    );

    for (const el of candidates) {
      const text =
        (el.innerText || el.getAttribute('value') || '').toLowerCase();
      if (
        text.includes('download anyway') ||
        text.includes('تنزيل على أي حال')
      ) {
        el.click();
        clicked = true;
        break;
      }
    }
  }

  if (clicked) {
    console.log(
      '[CQD] "Download anyway" / virus-bypass action triggered successfully.',
    );
  }

  return clicked;
}

/**
 * Keep telling background "bypass triggered" so it:
 *  - flips the Classroom button to SUCCESS quickly
 *  - auto-closes the hidden Drive tab after a few seconds
 */
function notifySuccessFlood() {
  const send = () => {
    try {
      chrome.runtime.sendMessage({ type: 'CQD_BYPASS_SUCCESS' });
    } catch {
      /* ignore */
    }
  };

  // Fire once immediately
  send();

  // Then spam a bit for robustness (background might map tabId a bit later)
  let count = 0;
  const maxBursts = 8; // ~8 seconds total
  const id = window.setInterval(() => {
    count += 1;
    if (count > maxBursts) {
      window.clearInterval(id);
      return;
    }
    send();
  }, 1000);
}

/* --------------------------------------------------------------------------
 * Preview toolbar download click for normal/small files
 * ------------------------------------------------------------------------*/

function clickDriveToolbarDownload(): boolean {
  const btn =
    document.querySelector<HTMLElement>('div[aria-label="Download"]') ||
    document.querySelector<HTMLElement>('div[data-tooltip="Download"]') ||
    document.querySelector<HTMLElement>(
      'div[role="button"][aria-label="Download"]',
    );

  if (!btn) return false;

  simulateHumanClick(btn);
  return true;
}

/* --------------------------------------------------------------------------
 * Utility
 * ------------------------------------------------------------------------*/

function simulateHumanClick(element: HTMLElement) {
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
  };
  element.dispatchEvent(new MouseEvent('mousedown', opts));
  element.dispatchEvent(new MouseEvent('mouseup', opts));
  element.dispatchEvent(new MouseEvent('click', opts));
}