// filepath: extension/src/adapters/browser/chrome-downloads-port.ts
/**
 * ============================================================================
 * CHROME DOWNLOADS PORT — BrowserPort over the real chrome.downloads API
 * ============================================================================
 *
 * The port stops being tests-only: production code can depend on BrowserPort
 * and stay testable against tests/fakes/fake-browser-port.ts (ADR-0007:
 * impure shell). The zero-tab flow never calls createTab/removeTab — they
 * exist to satisfy the port and are kept for future, user-initiated needs.
 */
import type {
  BrowserPort,
  DownloadChangedEvent,
  DownloadOptions,
} from '../../contracts/ports';
import type { Unsubscribe } from '../../bus/event-bus';

export function createChromeDownloadsPort(): BrowserPort {
  return {
    browserName:
      typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent)
        ? 'firefox'
        : 'chrome',

    download(options: DownloadOptions): Promise<number> {
      return new Promise((resolve, reject) => {
        try {
          chrome.downloads.download(
            {
              url: options.url,
              filename: options.filename,
              saveAs: options.saveAs ?? false,
              conflictAction: options.conflictAction ?? 'uniquify',
            },
            (id) => {
              if (chrome.runtime.lastError || !id) {
                reject(new Error(chrome.runtime.lastError?.message ?? 'download refused'));
                return;
              }
              resolve(id);
            },
          );
        } catch (error) {
          reject(error instanceof Error ? error : new Error('download threw'));
        }
      });
    },

    cancelDownload(downloadId: number): Promise<void> {
      return new Promise((resolve) => {
        try {
          chrome.downloads.cancel(downloadId, () => {
            void chrome.runtime.lastError; // unknown id is fine
            resolve();
          });
        } catch {
          resolve();
        }
      });
    },

    onDownloadChanged(listener: (event: DownloadChangedEvent) => void): Unsubscribe {
      type OnChangedDelta = {
        id: number;
        state?: { current?: string; previous?: string };
        error?: { current?: string };
      };
      const wrapped = (delta: OnChangedDelta) => {
        listener({
          id: delta.id,
          state: delta.state
            ? { current: delta.state.current, previous: delta.state.previous }
            : undefined,
          error: delta.error ? { current: delta.error.current } : undefined,
        });
      };
      try {
        chrome.downloads.onChanged.addListener(wrapped as never);
      } catch {
        // Channel unavailable (detached test env) — unsubscribe is a no-op.
      }
      return () => {
        try {
          chrome.downloads.onChanged.removeListener(wrapped as never);
        } catch {
          // Already torn down.
        }
      };
    },

    createTab(options: { url: string; active: boolean }): Promise<{ id?: number }> {
      return new Promise((resolve) => {
        try {
          chrome.tabs.create(options, (tab) => resolve({ id: tab?.id }));
        } catch {
          resolve({});
        }
      });
    },

    removeTab(tabId: number): Promise<void> {
      return new Promise((resolve) => {
        try {
          chrome.tabs.remove(tabId, () => {
            void chrome.runtime.lastError;
            resolve();
          });
        } catch {
          resolve();
        }
      });
    },
  };
}
