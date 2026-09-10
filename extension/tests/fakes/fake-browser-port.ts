// filepath: extension/tests/fakes/fake-browser-port.ts
/**
 * BrowserPort fake: no chrome.* anywhere. Tests script download outcomes,
 * emit onChanged deltas by hand, and read the recorded calls.
 */
import type {
  BrowserPort,
  DownloadChangedEvent,
  DownloadOptions,
  DeterminingFilenameItem,
} from '../../src/contracts/ports';
import type { Unsubscribe } from '../../src/bus/event-bus';

export interface FakeBrowserPort extends BrowserPort {
  /** Id the next successful download() resolves with. */
  nextDownloadId: number;
  /** Make the next download() reject with this message. */
  failNextDownloadWith: string | null;
  /** Recorded download() options, in order. */
  readonly downloadCalls: DownloadOptions[];
  /** Recorded createTab() options, in order. */
  readonly createdTabs: Array<{ url: string; active: boolean }>;
  /** Test-side trigger for download change listeners. */
  emitDownloadChanged(event: DownloadChangedEvent): void;
  /** Test-side trigger for the determining-filename listener. */
  emitDeterminingFilename(item: DeterminingFilenameItem): string | undefined;
}

type DownloadListener = (event: DownloadChangedEvent) => void;
type FilenameListener = (item: DeterminingFilenameItem) => string | undefined;

export function createFakeBrowserPort(
  browserName: 'chrome' | 'firefox' = 'chrome',
): FakeBrowserPort {
  const downloadListeners = new Set<DownloadListener>();
  const filenameListeners = new Set<FilenameListener>();

  return {
    browserName,
    nextDownloadId: 1,
    failNextDownloadWith: null,
    downloadCalls: [],
    createdTabs: [],

    async download(options) {
      this.downloadCalls.push(options);
      if (this.failNextDownloadWith) {
        const message = this.failNextDownloadWith;
        this.failNextDownloadWith = null;
        throw new Error(message);
      }
      return this.nextDownloadId++;
    },

    async cancelDownload() {
      // Nothing to undo in the fake; recorded implicitly by the test.
    },

    onDownloadChanged(listener) {
      downloadListeners.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        downloadListeners.delete(listener);
      };
    },

    onDeterminingFilename(listener) {
      filenameListeners.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        filenameListeners.delete(listener);
      };
    },

    async createTab(options) {
      this.createdTabs.push({ url: options.url, active: options.active });
      return { id: this.createdTabs.length };
    },

    async removeTab() {
      // Same as cancelDownload: the fake keeps no tab registry.
    },

    emitDownloadChanged(event) {
      for (const listener of [...downloadListeners]) listener(event);
    },

    emitDeterminingFilename(item) {
      let result: string | undefined;
      for (const listener of [...filenameListeners]) {
        const override = listener(item);
        if (override !== undefined) result = override;
      }
      return result;
    },
  } as FakeBrowserPort;
}
