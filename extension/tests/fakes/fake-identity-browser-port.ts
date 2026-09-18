// filepath: extension/tests/fakes/fake-identity-browser-port.ts
/**
 * BrowserPort fake with the S13 identity seam scripted.
 *
 * Built on the plain fake-browser-port (which stays method-less — the seam is
 * optional) and adds getIdentityToken. Tests script an outcome QUEUE: each
 * call pops one entry, so granted / denied / granted sequences are expressible
 * in order. An empty queue denies — consistent with the port's "null means no,
 * never throw" rule, so roles can be tested against the denial default.
 */
import { createFakeBrowserPort, type FakeBrowserPort } from './fake-browser-port';
import type { IdentityTokenRequest } from '../../src/contracts/ports';

export interface FakeIdentityBrowserPort extends FakeBrowserPort {
  /** Scripted outcomes, popped per call. Empty queue denies. */
  readonly identityTokenQueue: Array<string | null>;
  /** Recorded getIdentityToken calls, in order. */
  readonly identityTokenCalls: Array<{ scopes: string[] }>;
}

export function createFakeIdentityBrowserPort(): FakeIdentityBrowserPort {
  const queue: Array<string | null> = [];
  const calls: Array<{ scopes: string[] }> = [];

  // Spread keeps the base fake's `this`-bound methods working: they resolve
  // against the decorated object, which carries the same recorded-call arrays.
  const fake = {
    ...createFakeBrowserPort(),
    identityTokenQueue: queue,
    identityTokenCalls: calls,
    getIdentityToken: async (request: IdentityTokenRequest): Promise<string | null> => {
      calls.push({ scopes: [...request.scopes] });
      return queue.shift() ?? null;
    },
  } as FakeIdentityBrowserPort;

  return fake;
}
