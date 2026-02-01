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
    initContentScript();
  },
});