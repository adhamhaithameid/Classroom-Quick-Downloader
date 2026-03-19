// filepath: extension/src/student_work/channel.ts

import {
  STUDENT_WORK_CHANNEL_NAME,
  STUDENT_WORK_RESOLVE_PUBLISH_TYPE,
  STUDENT_WORK_RESOLVE_RELAY_TYPE,
} from './constants';

export interface StudentWorkResolveResultMessage {
  type: 'CQD_SW_RESOLVE_RESULT';
  requestId: string;
  ok: boolean;
  resolvedUrl?: string;
  reason?: string;
  source?: string;
}

export interface StudentWorkResolvePublishMessage {
  type: typeof STUDENT_WORK_RESOLVE_PUBLISH_TYPE;
  payload: StudentWorkResolveResultMessage;
}

export interface StudentWorkResolveRelayMessage {
  type: typeof STUDENT_WORK_RESOLVE_RELAY_TYPE;
  payload: StudentWorkResolveResultMessage;
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

function isResolveRelayMessage(value: unknown): value is StudentWorkResolveRelayMessage {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Record<string, unknown>;
  if (msg.type !== STUDENT_WORK_RESOLVE_RELAY_TYPE) return false;
  return isResolveResultMessage(msg.payload);
}

function getRuntime():
  | (typeof chrome.runtime)
  | null {
  if (typeof chrome === 'undefined' || !chrome.runtime) return null;
  return chrome.runtime;
}

export function createResolverRequestId(): string {
  return `sw-${Date.now()}-${crypto.randomUUID()}`;
}

export function publishResolveResult(message: StudentWorkResolveResultMessage): void {
  const runtime = getRuntime();
  if (runtime?.sendMessage) {
    try {
      const payload: StudentWorkResolvePublishMessage = {
        type: STUDENT_WORK_RESOLVE_PUBLISH_TYPE,
        payload: message,
      };
      runtime.sendMessage(payload);
    } catch {
      // Ignore runtime relay failures; resolver will timeout safely.
    }
    return;
  }

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
    const runtime = getRuntime();
    const hasRuntimeRelayApi =
      !!runtime &&
      typeof (runtime as any).onMessage?.addListener === 'function' &&
      typeof (runtime as any).onMessage?.removeListener === 'function';
    let runtimeListener:
      | ((message: unknown, sender?: chrome.runtime.MessageSender) => void)
      | null = null;
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

      if (runtimeListener && hasRuntimeRelayApi) {
        try {
          runtime!.onMessage.removeListener(runtimeListener);
        } catch {
          // Ignore runtime listener cleanup errors.
        }
        runtimeListener = null;
      }

      if (abortHandler && signal) {
        signal.removeEventListener('abort', abortHandler);
        abortHandler = null;
      }

      resolve(value);
    };

    if (hasRuntimeRelayApi) {
      runtimeListener = (message: unknown, sender?: chrome.runtime.MessageSender) => {
        if (!isResolveRelayMessage(message)) return;
        const payload = message.payload;
        if (payload.requestId !== requestId) return;

        const runtimeId = runtime.id;
        if (
          runtimeId &&
          sender &&
          typeof sender.id === 'string' &&
          sender.id !== runtimeId
        ) {
          return;
        }
        finish(payload);
      };

      try {
        runtime!.onMessage.addListener(runtimeListener);
      } catch {
        finish(null);
        return;
      }
    } else {
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
