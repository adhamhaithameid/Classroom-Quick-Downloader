// filepath: entrypoints/drive_bypass.content.ts

export default defineContentScript({
  matches: [
    'https://drive.google.com/*',
    'https://drive.usercontent.google.com/*',
  ],
  runAt: 'document_end',
  main() {
    const attemptBypass = () => {
      const bodyText = (document.body?.innerText || '').toLowerCase();

      const isVirusWarning =
        bodyText.includes("can't be scanned for viruses") ||
        bodyText.includes('cant be scanned for viruses') ||
        bodyText.includes("can't scan this file for viruses") ||
        bodyText.includes('download anyway');

      if (!isVirusWarning) return;

      console.log('[CQD] Virus warning detected. Trying to auto-click "Download anyway"...');

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

      // Strategy 3: text search fallback
      if (!clicked) {
        const candidates = document.querySelectorAll<HTMLElement>(
          'a, button, input[type="submit"]',
        );

        for (const el of candidates) {
          const text =
            (el.innerText || el.getAttribute('value') || '').toLowerCase();
          if (text.includes('download anyway')) {
            el.click();
            clicked = true;
            break;
          }
        }
      }

      if (clicked) {
        console.log('[CQD] "Download anyway" clicked. Notifying background for cleanup.');
        try {
          chrome.runtime.sendMessage({ type: 'CQD_BYPASS_SUCCESS' });
        } catch {
          // Ignore if not available
        }
      }
    };

    // Run once on load
    attemptBypass();
    // Run again after 1s in case DOM updates / slow render
    setTimeout(attemptBypass, 1000);
  },
});
