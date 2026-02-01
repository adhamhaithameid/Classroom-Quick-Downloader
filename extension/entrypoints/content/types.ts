// filepath: extension/entrypoints/content/types.ts
/**
 * Type definitions for the content script.
 */

/**
 * Document or element that can be queried.
 */
export type QueryRoot = Document | HTMLElement | DocumentFragment;

/**
 * Possible button states with priority ordering.
 * Higher priority states block lower priority transitions.
 */
export type ButtonState = 'idle' | 'loading' | 'success' | 'error' | 'trying' | 'cancel' | 'cancelled';

/**
 * File metadata extracted from attachments.
 */
export type FileMeta = {
  name?: string;
  ext?: string;
  kind?: string;
};

/**
 * Pending download button entry.
 */
export type PendingButton = {
  button: HTMLButtonElement;
  requestId: string;
  fileMeta?: FileMeta;
  startedAt: number;
};
