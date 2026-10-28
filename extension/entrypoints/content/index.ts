// filepath: extension/entrypoints/content/index.ts
/**
 * Main content script entry point.
 * Injects download buttons into Google Classroom attachments.
 */

import { initContentScript } from './message-handler';

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    // w5r6 probe: V1 content-script footprint marker (same contract as the
    // bootstrap marker on <html>).
    try {
      document.documentElement.dataset.cqdV1 = "entered";
    } catch { /* pre-document edge */ }
    initContentScript();
  },
});