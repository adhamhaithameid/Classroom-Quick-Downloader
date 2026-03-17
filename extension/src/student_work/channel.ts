// filepath: extension/src/student_work/channel.ts

import { STUDENT_WORK_CHANNEL_NAME } from './constants';

export interface StudentWorkResolveResultMessage {
  type: 'CQD_SW_RESOLVE_RESULT';
  requestId: string;
  ok: boolean;
  resolvedUrl?: string;
  reason?: string;
  source?: string;
}

function isResolveResultMessage(value: unknown): value is StudentWorkResolveResultMessage {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Record<string, unknown>;
  if (msg.type !== 'CQD_SW_RESOLVE_RESULT') return false;
  if (typeof msg.requestId !== 'string') return false;
  if (typeof msg.ok !== 'boolean') return false;
  if (msg.resolvedUrl != null && typeof msg.resolvedUrl !== 'string') return false;
  if (msg.reason != null && typeof msg.reason !== 'string') return false;
  if (msg.source != null && typeof msg.source !== 'string') return false;
  return true;
}

// creating a random id because Math.random() is basically cryptography right?
export function createResolverRequestId(): string {
  return `sw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function publishResolveResult(message: StudentWorkResolveResultMessage): void {
  try {
    const channel = new BroadcastChannel(STUDENT_WORK_CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  } catch {
    // Ignore channel failures; caller can still use fallback signaling.
  }
}

// broadcast channels... so cool but kinda magic
export function waitForResolveResult(
  requestId: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<StudentWorkResolveResultMessage | null> {
  return new Promise((resolve) => {
    let done = false;
    let timer: number | null = null;
    let channel: BroadcastChannel | null = null;
    let abortHandler: (() => void) | null = null;

    const finish = (value: StudentWorkResolveResultMessage | null) => {
      if (done) return;
      done = true;

      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }

      if (channel) {
        try {
          channel.close();
        } catch {
          // Ignore close errors.
        }
        channel = null;
      }

      if (abortHandler && signal) {
        signal.removeEventListener('abort', abortHandler);
        abortHandler = null;
      }

      resolve(value);
    };

    try {
      channel = new BroadcastChannel(STUDENT_WORK_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent) => {
        const payload = event.data;
        if (!isResolveResultMessage(payload)) return;
        if (payload.requestId !== requestId) return;
        finish(payload);
      };
    } catch {
      finish(null);
      return;
    }

    timer = window.setTimeout(() => finish(null), timeoutMs);

    if (signal) {
      abortHandler = () => finish(null);
      signal.addEventListener('abort', abortHandler, { once: true });
      if (signal.aborted) {
        finish(null);
      }
    }
  });
}

