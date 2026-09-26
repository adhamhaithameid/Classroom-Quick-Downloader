// filepath: extension/entrypoints/background/types.ts
/**
 * Type definitions for the background script download management.
 * Separated for cleaner imports and maintenance.
 */

/**
 * File metadata received from content script.
 */
export type FileMetaMsg = {
  name?: string;
  ext?: string;
  kind?: string;
};

/**
 * Download status codes sent to content script.
 */
export type DownloadStatus =
  | 'complete'
  | 'interrupted'
  | 'blocked_html'
  | 'error'
  | 'success'
  | 'trying'
  | 'cancelled';

/**
 * Represents a download in progress with all tracking state.
 */
export type PendingDownload = {
  /** Unique ID for this download request */
  requestId: string;
  /** Timestamp when download was initiated */
  startTime: number;

  /** Original URL from content script */
  originalUrl: string;
  /** Normalized base URL (authuser stripped) */
  baseUrl: string;
  /** Whether this is a Google Drive file */
  isDrive: boolean;

  /** File metadata from content script */
  fileMeta?: FileMetaMsg;
  /** Final extension detected from actual download */
  finalExtension?: string;

  /** Tab ID that initiated the download */
  tabId?: number;

  /** List of authuser values already attempted */
  attemptedAuthUsers: number[];
  /** Current authuser being tried */
  currentAuthUser?: number;
  /** Initial authuser from original URL */
  initialAuthUser?: number;
  /** Browser download ID once started */
  currentDownloadId?: number;

  /** Whether an HTML (interstitial/error) response was intercepted */
  htmlSeen?: boolean;
  /** Transient interrupts already retried in place (bounded to one) */
  transientRetried?: boolean;
  /** Browser start failures already retried (bounded to one) */
  startRetried?: boolean;
  /** S2: the start callback never fired within DOWNLOAD_START_TIMEOUT_MS; the
   * flow settled without a download id and any late callback kills the stray */
  startTimedOut?: boolean;
  /** Whether success status was already sent */
  finalized?: boolean;
  /** Whether user cancelled this download */
  isCancelled?: boolean;
};
