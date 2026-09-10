// filepath: extension/tests/fakes/fake-network-port.ts
/**
 * NetworkPort fake: scripted responses served in order; every requested URL
 * is recorded for assertions (and later SSRF-policy checks in adapters).
 */
import type { NetworkPort } from '../../src/contracts/ports';

export interface ScriptedResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

export interface FakeNetworkPort extends NetworkPort {
  /** URLs passed to fetch, in order. */
  readonly requestedUrls: string[];
  /** Queue more responses; the fake serves them before failing. */
  enqueue(responses: ScriptedResponse[]): void;
}

export function createFakeNetworkPort(script: ScriptedResponse[] = []): FakeNetworkPort {
  const queue = [...script];
  const requestedUrls: string[] = [];

  return {
    requestedUrls,
    enqueue(responses) {
      queue.push(...responses);
    },

    async fetch(url, init) {
      requestedUrls.push(url);
      const next = queue.shift();
      if (!next) {
        throw new Error(`FakeNetworkPort: no scripted response for ${url}`);
      }
      const headers = new Headers(next.headers);
      const body = next.status === 204 ? null : next.body;
      void init;
      return new Response(body, { status: next.status, headers });
    },
  };
}
