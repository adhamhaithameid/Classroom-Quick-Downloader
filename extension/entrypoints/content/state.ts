// filepath: extension/entrypoints/content/state.ts
/**
 * Global state management for the content script.
 */

import type { PendingButton } from './types';
import { getCancelHoldDelayMs } from '../utils/analytics';

// --- URL PATTERNS ---

/** Pattern to match Google Classroom URLs */
export const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;

/** Selector for Drive anchors */
export const DRIVE_ANCHOR_SELECTOR =
  'a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]';

/** Selector for attachment containers */
export const ATTACHMENT_CONTAINER_SELECTOR = [
  '.KlRXdf',
  '.z3vRcc',
  '.VfPpkd-aPP78e',
  '[data-drive-id]',
  '[data-id][data-item-id]',
].join(', ');

/** Patterns to identify Drive URLs */
export const DRIVE_URL_PATTERNS: RegExp[] = [
  /https:\/\/drive\.google\.com\/file\/d\//,
  /https:\/\/drive\.google\.com\/open\?/,
  /https:\/\/drive\.google\.com\/uc\?/,
  /https:\/\/classroom\.google\.com\/drive\//,
];

// --- DOM ATTRIBUTES ---

export const INJECTED_ATTR = 'data-cqd-injected';
export const PROCESSED_ATTR = 'data-cqd-processed';

// --- TIMING CONSTANTS ---

export const RESCAN_INTERVAL_MS = 2000;
export const RESCAN_DEBOUNCE_MS = 150;
export const LOADING_MIN_MS = 600;
export const FEEDBACK_SUCCESS_MS = 2000;
export const FEEDBACK_ERROR_MS = 3000;
export const FEEDBACK_CANCELLED_MS = 1500;
export const MAX_TERMINAL_STATE_MS = 5000;

// --- GLOBAL STATE ---

/** Timeout ID for scan debouncing */
export let scanTimeoutId: number | null = null;
export function setScanTimeoutId(id: number | null) { scanTimeoutId = id; }

/** MutationObserver instance */
export let observer: MutationObserver | null = null;
export function setObserver(obs: MutationObserver | null) { observer = obs; }

/** Rescan interval ID */
export let rescanIntervalId: number | null = null;
export function setRescanIntervalId(id: number | null) { rescanIntervalId = id; }

/** Map of pending buttons by request ID */
export const pendingButtons = new Map<string, PendingButton>();

/** Sequence for generating request IDs */
export let nextRequestSeq = 1;
export function getNextRequestId(): string {
  return `cqd-${Date.now()}-${nextRequestSeq++}`;
}

// --- EXTENSION STATE ---

/** Whether the user wants CQD enabled on this tab */
export let desiredEnabled = true;
export function setDesiredEnabled(enabled: boolean) { desiredEnabled = enabled; }

/** Whether CQD is actually active */
export let effectiveEnabled = false;
export function setEffectiveEnabled(enabled: boolean) { effectiveEnabled = enabled; }

/** Whether CQD has been initialized */
export let initialized = false;
export function setInitialized(init: boolean) { initialized = init; }

/** Global extension on/off state */
export let globalEnabled = true;
export function setGlobalEnabled(enabled: boolean) { globalEnabled = enabled; }

/** Cancel hold delay in ms */
export let cancelHoldDelayMs = 1000;
getCancelHoldDelayMs().then((ms) => {
  cancelHoldDelayMs = ms;
}).catch(() => { /* ignore */ });
