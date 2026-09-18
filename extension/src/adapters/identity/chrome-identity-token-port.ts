// filepath: extension/src/adapters/identity/chrome-identity-token-port.ts
/**
 * ============================================================================
 * CHROME IDENTITY TOKEN PORT — the S13 identity seam over chrome.identity
 * ============================================================================
 *
 * Decorates any BrowserPort with `getIdentityToken`, wrapping
 * chrome.identity.getAuthToken({ interactive: false }). The semantics MIRROR
 * src/engines/v3/api/token-provider.ts (the proven wrapper) but do not import
 * it: the v3 stack is outside the adapter layer's dependency rules, and the
 * port's contract is the authority here anyway.
 *
 * The contract (contracts/ports.ts): denial, absent API, and errors all
 * resolve null. The promise NEVER rejects, so callers cannot be forced into
 * try/catch consent probing. Interactive acquisition is deliberately
 * unreachable — consent is the orchestrator's decision, not this port's.
 *
 * Fitness (ADR-0007): adapters import only contracts (+ bus). This module
 * imports nothing but the port types and touches only chrome.identity.
 */
import type { BrowserPort, IdentityTokenRequest } from '../../contracts/ports';

export function withIdentityToken(port: BrowserPort): BrowserPort {
  return {
    ...port,

    getIdentityToken(request: IdentityTokenRequest): Promise<string | null> {
      if (typeof chrome === 'undefined' || !chrome.identity?.getAuthToken) {
        return Promise.resolve(null);
      }

      // Empty/blank scopes mean "the manifest-declared scopes"; passing an
      // empty array explicitly would override them with nothing.
      const scopes = request.scopes.map((scope) => scope.trim()).filter((s) => s.length > 0);
      const details: { interactive: boolean; scopes?: string[] } = { interactive: false };
      if (scopes.length > 0) details.scopes = scopes;

      return new Promise((resolve) => {
        try {
          chrome.identity.getAuthToken(details, (result) => {
            // Older chrome builds answer with a bare string; current ones
            // with a TokenDetails object. Handle both, trust neither.
            const token = typeof result === 'string'
              ? result
              : (typeof result === 'object' && result && 'token' in result
                ? String((result as { token?: string }).token || '')
                : '');

            if (chrome.runtime.lastError || !token) {
              resolve(null);
              return;
            }
            resolve(token);
          });
        } catch {
          resolve(null);
        }
      });
    },
  };
}
