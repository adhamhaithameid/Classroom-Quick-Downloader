// filepath: extension/src/download-all/state.ts
/**
 * Download All module global state.
 */

import type { GroupState, FileEntry } from './types';

// --- Constants ---
export const DOWNLOAD_BTN_SELECTOR = '.cqd-download-all-btn';
export const SINGLE_BTN_SELECTOR = '.cqd-download-btn';
export const GROUP_SELECTOR = 'div[data-stream-item-id]';
export const INJECTED_ATTR = 'data-cqd-injected';
export const GROUP_FEEDBACK_SUCCESS_MS = 3000;
export const MIN_FILES_FOR_DOWNLOAD_ALL = 2;

// --- WeakMaps for Group/Button/File Relationships ---
export const groupStates = new WeakMap<HTMLElement, GroupState>();
export const buttonToGroup = new WeakMap<HTMLButtonElement, GroupState>();
export const buttonToFile = new WeakMap<HTMLButtonElement, FileEntry>();
export const dirtyGroups = new Set<GroupState>();

// --- Runtime State ---
export let refreshScheduled = false;
export let running = false;
export let globalObserver: MutationObserver | null = null;
export let globalInterval: number | null = null;
export let cancelHoldDelayMs = 1000;

// --- State Setters ---
export function setRefreshScheduled(value: boolean): void {
  refreshScheduled = value;
}

export function setRunning(value: boolean): void {
  running = value;
}

export function setGlobalObserver(observer: MutationObserver | null): void {
  globalObserver = observer;
}

export function setGlobalInterval(interval: number | null): void {
  globalInterval = interval;
}

export function setCancelHoldDelayMs(ms: number): void {
  cancelHoldDelayMs = ms;
}
