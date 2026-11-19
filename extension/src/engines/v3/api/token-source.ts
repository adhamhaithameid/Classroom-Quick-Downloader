// filepath: extension/src/engines/v3/api/token-source.ts
/**
 * ============================================================================
 * TOKEN SOURCE SEAM + WebAuthFlowTokenSource (ADR-0010)
 * ============================================================================
 *
 * ADR-0010 (docs/adr/0010-cross-browser-oauth-web-auth-flow.md) adds a
 * launchWebAuthFlow token path for browsers where getAuthToken never answers
 * (Edge documents it unsupported; Firefox never had it; Brave/Opera are
 * Chromium brands without Google sign-in).
 *
 * Contract pinned by tests/v3-webauthflow-token-source.test.ts:
 *   - Authorization Code + PKCE S256 (RFC 7636; Appendix B vectors tested),
 *   - `state` random per flow and compared on return — a mismatch REJECTS,
 *   - user cancel / denial / exchange failure resolve null (never throw),
 *   - a missing web client id resolves null and logs exactly one line,
 *   - concurrent callers share ONE in-flight flow (one auth window),
 *   - an expired cached token triggers exactly ONE silent re-auth per
 *     cooldown window (never a prompt — interactive acquisition stays the
 *     caller's, via a user click); a failed silent attempt is not retried
 *     until the cooldown passes,
 *   - the returned redirect must start with getRedirectUrl(); a malformed or
 *     foreign redirect resolves null, a state mismatch still rejects,
 *   - the code exchange aborts after a fixed timeout and resolves null,
 *   - tokens stay in MEMORY: storage.local and storage.session never receive
 *     one, no refresh token is requested, and no client secret exists.
 *
 * The web client id comes from config (getWebAuthClientId in api/config.ts,
 * manifest oauth2.web_client_id — NEEDS-OWNER: manifest key). Nothing here
 * ships real values; flag OFF keeps every browser on today's paths.
 */
import type { ClassroomApiTokenProvider } from './types';

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * The manifest's read-only classroom scopes (wxt.config.ts oauth2.scopes)
 * plus openid — least scope, nothing else, ever.
 */
export const WEB_AUTH_SCOPES = [
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'openid',
] as const;

/** The token seam both implementations (relay and web flow) satisfy. */
export interface TokenSource {
  getToken(interactive: boolean): Promise<string | null>;
}

/** Chrome path: delegates to the existing getAuthToken relay provider. */
export class ChromeRelayTokenSource implements TokenSource {
  private readonly provider: ClassroomApiTokenProvider;

  constructor(provider: ClassroomApiTokenProvider) {
    this.provider = provider;
  }

  getToken(interactive: boolean): Promise<string | null> {
    return this.provider.getAccessToken(interactive);
  }
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return new Uint8Array(digest);
}

/** BASE64URL-ENCODE(SHA256(ASCII(code_verifier))) — RFC 7636, S256 method. */
export async function computePkceChallenge(verifier: string): Promise<string> {
  return base64url(await sha256(verifier));
}

function defaultRandomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** A PKCE pair: 43-char base64url verifier + its S256 challenge. */
export async function createPkcePair(
  randomBytes: (n: number) => Uint8Array = defaultRandomBytes,
): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(randomBytes(32));
  return { verifier, challenge: await computePkceChallenge(verifier) };
}

export interface WebAuthFlowFetchResult {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface WebAuthFlowDeps {
  /** The web client id from config; null/absent disables the source. */
  getClientId: () => string | null;
  /** browser.identity.getRedirectURL() output — the allowlisted redirect. */
  getRedirectUrl: () => string;
  /** browser.identity.launchWebAuthFlow — windowed auth flow. */
  launchWebAuthFlow(details: { url: string; interactive: boolean }): Promise<string | undefined>;
  /** Injected fetch: the code exchange goes through this seam. */
  fetchImpl(
    url: string,
    init?: { method?: string; body?: URLSearchParams; signal?: AbortSignal },
  ): Promise<WebAuthFlowFetchResult>;
  /** Token-exchange timeout in ms (default 15s; injectable for tests). */
  fetchTimeoutMs?: number;
  /** Cooldown after a failed silent re-auth in ms (default 60s). */
  silentRetryCooldownMs?: number;
  randomBytes?: (n: number) => Uint8Array;
  now?: () => number;
  log?: (message: string) => void;
}

/** Refresh the cached token 60s before Google's expiry. */
const EXPIRY_SKEW_MS = 60_000;
const DEFAULT_LIFETIME_MS = 3600_000;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_SILENT_RETRY_COOLDOWN_MS = 60_000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

export class WebAuthFlowTokenSource implements TokenSource {
  private cached: CachedToken | null = null;
  private inflight: Promise<string | null> | null = null;
  private lastSilentFailureAt: number | null = null;
  private readonly deps: WebAuthFlowDeps;

  constructor(deps: WebAuthFlowDeps) {
    this.deps = deps;
  }

  async getToken(interactive: boolean): Promise<string | null> {
    const clientId = this.deps.getClientId();
    if (!clientId) {
      this.log('[CQD Classroom] WebAuthFlow token source: no web client id configured — API assist stays off');
      return null;
    }

    const now = this.deps.now ?? (() => Date.now());
    if (this.cached && this.cached.expiresAt > now()) return this.cached.token;
    // One window at a time: concurrent callers share the pending flow.
    if (this.inflight) return this.inflight;

    if (!this.cached) return this.track(this.runFlow(clientId, interactive));

    // Expired: ONE silent re-auth per cooldown window. Never an interactive
    // prompt from a token request — consent escalation is a user click's job.
    const cooldown = this.deps.silentRetryCooldownMs ?? DEFAULT_SILENT_RETRY_COOLDOWN_MS;
    if (this.lastSilentFailureAt !== null && now() - this.lastSilentFailureAt < cooldown) {
      return null;
    }
    const silent = this.runFlow(clientId, false).then(
      (token) => {
        if (token === null) this.lastSilentFailureAt = now();
        return token;
      },
      (error) => {
        this.lastSilentFailureAt = now();
        throw error;
      },
    );
    return this.track(silent);
  }

  /** Remember the pending flow until it settles (success, null or throw). */
  private track(flow: Promise<string | null>): Promise<string | null> {
    const pending = flow.finally(() => {
      if (this.inflight === pending) this.inflight = null;
    });
    this.inflight = pending;
    return pending;
  }

  private log(message: string): void {
    (this.deps.log ?? console.warn)(message);
  }

  private async runFlow(clientId: string, interactive: boolean): Promise<string | null> {
    const randomBytes = this.deps.randomBytes ?? defaultRandomBytes;
    const { verifier, challenge } = await createPkcePair(randomBytes);
    const state = base64url(randomBytes(16));
    const redirectUri = this.deps.getRedirectUrl();

    const authUrl = new URL(GOOGLE_AUTH_ENDPOINT);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', WEB_AUTH_SCOPES.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    let redirect: string | undefined;
    try {
      redirect = await this.deps.launchWebAuthFlow({ url: authUrl.toString(), interactive });
    } catch {
      return null; // flow aborted (Firefox cancel path)
    }
    if (!redirect) return null; // user closed the auth window

    // The redirect must be the allowlisted redirect URI; anything else (or
    // anything unparsable) is a failed flow, never an exception.
    let returned: URL;
    try {
      if (!redirect.startsWith(redirectUri)) return null;
      returned = new URL(redirect);
    } catch {
      return null;
    }
    if (returned.searchParams.get('state') !== state) {
      throw new Error('[CQD Classroom] WebAuthFlow state mismatch — flow rejected as possible CSRF');
    }
    const code = returned.searchParams.get('code');
    if (returned.searchParams.get('error') || !code) return null;

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.deps.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
    );
    try {
      const response = await this.deps.fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
        signal: controller.signal,
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        }),
      });
      if (!response.ok) return null;
      const json = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
      const accessToken = json?.access_token;
      if (typeof accessToken !== 'string' || accessToken.length === 0) return null;
      const lifetime = typeof json.expires_in === 'number' && json.expires_in > 0
        ? json.expires_in * 1000
        : DEFAULT_LIFETIME_MS;
      const now = this.deps.now ?? (() => Date.now());
      this.cached = { token: accessToken, expiresAt: now() + lifetime - EXPIRY_SKEW_MS };
      return accessToken;
    } catch {
      return null; // network failure or timeout — the fallback matrix covers it
    } finally {
      clearTimeout(timer);
    }
  }
}
