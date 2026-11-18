// filepath: extension/tests/v3-api-token-relay.test.ts
/**
 * API token relay — content script → background (CQD_API_TOKEN).
 *
 * chrome.identity does not exist in content scripts, and the whole v3 stack
 * runs in one. Without the relay every token request resolved null in a real
 * browser. These tests pin both halves:
 *   1. the provider relays when chrome.identity is absent,
 *   2. the background answers only a Classroom-page sender.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_TOKEN_MESSAGE_TYPE,
  ChromeIdentityTokenProvider,
} from '../src/engines/v3/api/token-provider';
import { handleApiTokenRequest } from '../entrypoints/background/api-token';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChromeIdentityTokenProvider in a content script (no chrome.identity)', () => {
  function stubContentScript(reply: unknown, lastError?: { message: string }) {
    const runtime: { lastError?: { message: string }; sendMessage: ReturnType<typeof vi.fn> } = {
      sendMessage: vi.fn((_message: unknown, callback: (reply: unknown) => void) => {
        runtime.lastError = lastError;
        callback(reply);
      }),
    };
    vi.stubGlobal('chrome', { runtime });
    return runtime.sendMessage;
  }

  it('relays the request to the background and resolves the token', async () => {
    const sendMessage = stubContentScript({ token: 'tok-1' });
    await expect(new ChromeIdentityTokenProvider().getAccessToken(true)).resolves.toBe('tok-1');
    expect(sendMessage).toHaveBeenCalledWith(
      { type: API_TOKEN_MESSAGE_TYPE, interactive: true },
      expect.any(Function),
    );
  });

  it('defaults to a non-interactive request', async () => {
    const sendMessage = stubContentScript({ token: 'tok-2' });
    await new ChromeIdentityTokenProvider().getAccessToken();
    expect(sendMessage.mock.calls[0][0]).toEqual({ type: API_TOKEN_MESSAGE_TYPE, interactive: false });
  });

  it('resolves null when the background has no token or does not answer', async () => {
    stubContentScript({ token: null });
    await expect(new ChromeIdentityTokenProvider().getAccessToken()).resolves.toBeNull();
    stubContentScript(undefined, { message: 'The message port closed before a response was received.' });
    await expect(new ChromeIdentityTokenProvider().getAccessToken()).resolves.toBeNull();
  });

  it('resolves null when sendMessage throws (extension context invalidated)', async () => {
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: () => {
          throw new Error('Extension context invalidated.');
        },
      },
    });
    await expect(new ChromeIdentityTokenProvider().getAccessToken()).resolves.toBeNull();
  });
});

describe('handleApiTokenRequest (background)', () => {
  const CLASSROOM_SENDER = { url: 'https://classroom.google.com/w/COURSE/t/all' };

  function stubIdentity(token: string | undefined) {
    const getAuthToken = vi.fn((_details: unknown, callback: (result?: { token?: string }) => void) =>
      callback(token ? { token } : undefined),
    );
    vi.stubGlobal('chrome', { identity: { getAuthToken }, runtime: {} });
    return getAuthToken;
  }

  it('ignores other message types', () => {
    const getAuthToken = stubIdentity('tok');
    expect(handleApiTokenRequest({ type: 'CQD_DOWNLOAD' }, CLASSROOM_SENDER, vi.fn())).toBe(false);
    expect(getAuthToken).not.toHaveBeenCalled();
  });

  it('refuses a sender that is not a Classroom page', () => {
    const getAuthToken = stubIdentity('tok');
    const sendResponse = vi.fn();
    for (const sender of [
      { url: 'https://drive.google.com/file/d/abc/view' },
      { url: 'https://classroom.google.com.evil.example/' },
      // A foreign frame inside a Classroom tab: the frame URL decides.
      { url: 'https://evil.example/', tab: { url: 'https://classroom.google.com/' } },
      {},
    ]) {
      expect(handleApiTokenRequest({ type: API_TOKEN_MESSAGE_TYPE }, sender, sendResponse)).toBe(false);
    }
    expect(getAuthToken).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('answers a Classroom sender with the identity token, non-interactive by default', async () => {
    const getAuthToken = stubIdentity('tok-bg');
    const sendResponse = vi.fn();
    expect(handleApiTokenRequest({ type: API_TOKEN_MESSAGE_TYPE }, CLASSROOM_SENDER, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ token: 'tok-bg' }));
    expect(getAuthToken.mock.calls[0][0]).toEqual({ interactive: false });
  });

  it('goes interactive only on a strict boolean true', async () => {
    const getAuthToken = stubIdentity('tok-bg');
    const sendResponse = vi.fn();
    handleApiTokenRequest({ type: API_TOKEN_MESSAGE_TYPE, interactive: 'yes' }, CLASSROOM_SENDER, sendResponse);
    handleApiTokenRequest({ type: API_TOKEN_MESSAGE_TYPE, interactive: true }, CLASSROOM_SENDER, sendResponse);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(2));
    expect(getAuthToken.mock.calls.map((call) => call[0])).toEqual([
      { interactive: false },
      { interactive: true },
    ]);
  });

  it('answers null when the browser has no getAuthToken (Firefox)', async () => {
    vi.stubGlobal('chrome', { identity: {}, runtime: {} });
    const sendResponse = vi.fn();
    expect(handleApiTokenRequest({ type: API_TOKEN_MESSAGE_TYPE }, CLASSROOM_SENDER, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ token: null }));
  });
});
