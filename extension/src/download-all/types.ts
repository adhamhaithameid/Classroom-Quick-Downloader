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
