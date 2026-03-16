import { subscribeToGlobalState } from './content/flags';

const REGISTER_INTERVAL_MS = 1000;

let running = false;
let intervalId: number | null = null;
let lastUrl = '';

function isDriveUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'drive.google.com' || hostname === 'drive.usercontent.google.com';
  } catch {
    return false;
  }
}

function registerBypassUrl(): void {
  if (!running) return;
  const url = window.location.href;
  if (!isDriveUrl(url)) return;
  if (url === lastUrl) return;
  lastUrl = url;
  try {
    chrome.runtime.sendMessage({ type: 'CQD_REGISTER_BYPASS_URL', url });
  } catch {
    // ignore
  }
}

function startRegistering(): void {
  if (running) return;
  running = true;
  registerBypassUrl();
  if (intervalId != null) {
    window.clearInterval(intervalId);
  }
  intervalId = window.setInterval(registerBypassUrl, REGISTER_INTERVAL_MS);
  window.addEventListener('popstate', registerBypassUrl);
  window.addEventListener('hashchange', registerBypassUrl);
}

function stopRegistering(): void {
  running = false;
  if (intervalId != null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
  window.removeEventListener('popstate', registerBypassUrl);
  window.removeEventListener('hashchange', registerBypassUrl);
}

export default defineContentScript({
  matches: [
    'https://drive.google.com/*',
    'https://drive.usercontent.google.com/*',
  ],
  runAt: 'document_start',
  main() {
    subscribeToGlobalState(
      () => startRegistering(),
      () => stopRegistering(),
    );
  },
});
