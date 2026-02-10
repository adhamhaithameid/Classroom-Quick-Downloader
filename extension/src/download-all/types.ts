// filepath: extension/src/download-all/types.ts
/**
 * Download All module type definitions.
 */

export type ButtonState = 'idle' | 'loading' | 'trying' | 'success' | 'error' | 'cancel' | 'cancelled';

export interface FileEntry {
  key: string;
  buttons: Set<HTMLButtonElement>;
  downloaded: boolean;
  failed: boolean;
  inProgress: boolean;
}

export interface GroupState {
  root: HTMLElement;
  files: Map<string, FileEntry>;
  downloadAllBtn: HTMLButtonElement | null;
  activated: boolean;
  isBusy: boolean;
  cancelPending: boolean;
  resetTimeoutId?: number;
  currentRunId?: number;
}

/**
 * Custom dataset properties used by CQD buttons.
 */
export interface CqdButtonDataset extends DOMStringMap {
  cqdUrl?: string;
  cqdName?: string;
  cqdExt?: string;
  cqdMouseOver?: string;
  cqdRequestId?: string;
  cqdAllDone?: string;
}
