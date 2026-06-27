import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChromeIdentityTokenProvider } from '../src/engines/v3/api/token-provider';

describe('ChromeIdentityTokenProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (chrome.runtime as { lastError?: { message: string } }).lastError = undefined;
    chrome.identity = {
      getAuthToken: vi.fn(),
    } as never;
  });

  it('should return null if chrome.identity is unavailable', async () => {
    const originalIdentity = chrome.identity;
    // @ts-expect-error - testing missing API
    delete chrome.identity;

    const provider = new ChromeIdentityTokenProvider();
    const result = await provider.getAccessToken(false);
    expect(result).toBeNull();

    chrome.identity = originalIdentity;
  });

  it('should return the token when getAuthToken succeeds with string response', async () => {
    const mockToken = 'ya29.secret_oauth_token';
    (chrome.identity.getAuthToken as any).mockImplementation(
      ({ interactive }: any, callback: (token: any) => void) => {
        expect(interactive).toBe(false);
        callback(mockToken);
      }
    );

    const provider = new ChromeIdentityTokenProvider();
    const result = await provider.getAccessToken(false);
    expect(result).toBe(mockToken);
  });

  it('should return the token when getAuthToken succeeds with object response', async () => {
    const mockToken = 'ya29.secret_oauth_token_from_object';
    (chrome.identity.getAuthToken as any).mockImplementation(
      ({ interactive }: any, callback: (token: any) => void) => {
        callback({ token: mockToken });
      }
    );

    const provider = new ChromeIdentityTokenProvider();
    const result = await provider.getAccessToken(true);
    expect(result).toBe(mockToken);
  });

  it('should pass interactive flag correctly', async () => {
    (chrome.identity.getAuthToken as any).mockImplementation(
      ({ interactive }: any, callback: (token: any) => void) => {
        expect(interactive).toBe(true);
        callback('token');
      }
    );

    const provider = new ChromeIdentityTokenProvider();
    await provider.getAccessToken(true);
  });

  it('should return null and not leak token in error logs when lastError is set', async () => {
    const mockToken = 'ya29.should_not_leak_even_if_returned';
    (chrome.identity.getAuthToken as any).mockImplementation(
      ({ interactive }: any, callback: (token: any) => void) => {
        (chrome.runtime as { lastError?: { message: string } }).lastError = { message: 'OAuth failed' };
        callback(mockToken);
      }
    );

    const provider = new ChromeIdentityTokenProvider();
    const consoleSpy = vi.spyOn(console, 'error');

    const result = await provider.getAccessToken(false);

    expect(result).toBeNull();
    // Token must never appear in any log output
    if (consoleSpy.mock.calls.length > 0) {
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(mockToken)
      );
    }
  });

  it('should return null when getAuthToken returns empty/invalid values', async () => {
    const cases = [null, undefined, '', {}, { token: '' }, { other: 'stuff' }];

    for (const testCase of cases) {
      (chrome.identity.getAuthToken as any).mockImplementationOnce(
        ({ interactive }: any, callback: (token: any) => void) => {
          callback(testCase);
        }
      );

      const provider = new ChromeIdentityTokenProvider();
      const result = await provider.getAccessToken(false);
      expect(result).toBeNull();
    }
  });

  it('should handle exceptions thrown by chrome.identity.getAuthToken gracefully', async () => {
    (chrome.identity.getAuthToken as any).mockImplementation(() => {
      throw new Error('Unexpected sync error');
    });

    const provider = new ChromeIdentityTokenProvider();
    const result = await provider.getAccessToken(false);

    expect(result).toBeNull();
  });
});
