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
 *   - `state` random per flow and compared on return: a mismatch resolves null
 *     and logs one fixed line (no returned value in it),
 *   - user cancel / denial / exchange failure resolve null (never throw),
 *   - a missing web client id resolves null and logs exactly one line,
 *   - concurrent callers share ONE in-flight flow (one auth window),
 *   - EVERY failed silent attempt (the first one included) starts a cooldown:
 *     a non-interactive caller gets null until it passes, so one failure never
 *     relaunches a flow per call. An INTERACTIVE caller (a user click) bypasses
 *     the cooldown and always opens the auth window; if a silent flow is
 *     pending it runs after that flow settles,
 *   - the auth window itself is raced against a timeout (10 s silent, 5 min
 *     interactive): an idle window resolves null and frees the in-flight slot.
 *     The silent default is short because a click queued behind a silent flow
 *     waits for it (worst case 10 s launch + 15 s exchange before its window),
 *   - launchWebAuthFlow has no cancel: a LAUNCH GATE stays closed until the
 *     underlying launch promise settles (not the race), capped at a ceiling
 *     (launchGateCeilingMs: the launch's own timeout + 60 s, always above the window
 *     timeout) so a launch that never settles cannot kill
 *     sign-in; a click may pass once a SILENT launch timed out. So a timed-out window
 *     that may still be open never gets a second window next to it; a new flow
 *     meanwhile resolves null,
 *   - cooldown and cache expiry use now(): a backward clock step (now before the
 *     stamp) expires the cache and drops the cooldown,
 *   - setup (client id, PKCE, redirect URL) runs inside try: a throw is null plus
 *     one fixed log line, never a rejection,
 *   - exchangeUrl must be https, without userinfo, on Google's origin or an origin
 *     passed in allowedExchangeOrigins; otherwise getToken is null (one log line),
 *   - the code exchange URL is injectable (exchangeUrl): a Web client needs its
 *     secret at Google's endpoint, so a Worker exchange proxy plugs in there,
 *   - the returned redirect must match getRedirectUrl() by origin and path; a malformed or
 *     foreign redirect resolves null; an error redirect (denial) resolves null
 *     even without state; a state mismatch on a success redirect resolves null,
 *   - the code exchange is raced against a timer (abort + resolve null), so a
 *     fetch that ignores its signal cannot hang the flow; a late result is
 *     never cached,
 *   - the cached token is keyed by client id (a changed id drops the cache),
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
  /**
   * Auth-window timeout in ms. Default 10s for a silent flow, 5 min for an
   * interactive one (injectable for tests). Separate from fetchTimeoutMs.
   */
  launchTimeoutMs?: number;
  /**
   * Longest time the launch gate stays closed for a launch that never settles
   * (injectable for tests). Default: that launch's own window timeout plus 60 s
   * (70 s silent, 6 min interactive), so the gate never reopens while the
   * window may still be inside its timeout. After it the gate opens so a hung
   * launchWebAuthFlow cannot kill the sign-in button until the context reloads.
   */
  launchGateCeilingMs?: number;
  /**
   * Where the authorization code is exchanged. Default: Google's token
   * endpoint. A Web application client needs its client secret there, and a
   * secret must never ship in an extension, so a Worker-side exchange proxy
   * (ADR-0010) is injected here instead. The code, PKCE verifier, client id and
   * redirect URI are POSTed there, so the URL must be https, carry no userinfo
   * and have an origin in the allowlist (Google's token origin plus
   * allowedExchangeOrigins). Anything else disables the source (null).
   */
  exchangeUrl?: string;
  /** Extra https origins the exchange URL may use (a Worker proxy; explicit). */
  allowedExchangeOrigins?: readonly string[];
  randomBytes?: (n: number) => Uint8Array;
  now?: () => number;
  log?: (message: string) => void;
}

/** Refresh the cached token 60s before Google's expiry. */
const EXPIRY_SKEW_MS = 60_000;
const DEFAULT_LIFETIME_MS = 3600_000;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_SILENT_RETRY_COOLDOWN_MS = 60_000;
const DEFAULT_SILENT_LAUNCH_TIMEOUT_MS = 10_000;
const DEFAULT_INTERACTIVE_LAUNCH_TIMEOUT_MS = 300_000;
/** Added to a launch's own window timeout: the gate outlives the window. */
const LAUNCH_GATE_MARGIN_MS = 60_000;
const SETUP_FAILED_LINE = '[CQD Classroom] WebAuthFlow setup failed — sign-in skipped';
const BAD_EXCHANGE_URL_LINE =
  '[CQD Classroom] WebAuthFlow exchange URL rejected (https and allowlisted origin required) — API assist stays off';

/** True for an https URL without userinfo whose origin is Google's or allowlisted. */
function isAllowedExchangeUrl(url: unknown, extraOrigins: readonly string[] | undefined): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
    const allowed = new Set([new URL(GOOGLE_TOKEN_ENDPOINT).origin]);
    for (const extra of extraOrigins ?? []) {
      try {
        const origin = new URL(extra);
        if (origin.protocol === 'https:' && !origin.username && !origin.password) {
          allowed.add(origin.origin);
        }
      } catch {
        // an unparsable allowlist entry allows nothing
      }
    }
    return allowed.has(parsed.origin);
  } catch {
    return false;
  }
}

interface CachedToken {
  token: string;
  expiresAt: number;
  /** now() when the token was cached; now() < issuedAt means a backward clock jump. */
  issuedAt: number;
  /** The client id the token was issued for. */
  clientId: string;
}

export class WebAuthFlowTokenSource implements TokenSource {
  private cached: CachedToken | null = null;
  private inflight: Promise<string | null> | null = null;
  /** Whether the pending flow may show an auth window (user click). */
  private inflightInteractive = false;
  private lastSilentFailureAt: number | null = null;
  /** True while a launchWebAuthFlow call may still have its window open. */
  private launchOpen = false;
  private launchSeq = 0;
  /** True when the open launch was silent and its window timeout elapsed. */
  private silentLaunchTimedOut = false;
  private missingClientIdLogged = false;
  private setupFailureLogged = false;
  private readonly exchangeUrlAllowed: boolean;
  private readonly deps: WebAuthFlowDeps;

  constructor(deps: WebAuthFlowDeps) {
    this.deps = deps;
    // Validated once, here: a rejected URL never reaches fetch (it would carry
    // the code, verifier and client id to an arbitrary host).
    this.exchangeUrlAllowed = deps.exchangeUrl === undefined ||
      isAllowedExchangeUrl(deps.exchangeUrl, deps.allowedExchangeOrigins);
  }

  async getToken(interactive: boolean): Promise<string | null> {
    if (!this.exchangeUrlAllowed) {
      if (!this.setupFailureLogged) {
        this.setupFailureLogged = true;
        this.log(BAD_EXCHANGE_URL_LINE);
      }
      return null;
    }
    let clientId: string | null;
    try {
      clientId = this.deps.getClientId();
    } catch {
      this.logSetupFailure();
      return null;
    }
    if (!clientId) {
      // Exactly one line per source, however many callers ask.
      if (!this.missingClientIdLogged) {
        this.missingClientIdLogged = true;
        this.log('[CQD Classroom] WebAuthFlow token source: no web client id configured — API assist stays off');
      }
      return null;
    }

    const now = this.deps.now ?? (() => Date.now());
    if (this.cached) {
      // now() < issuedAt: the clock stepped back, so the stamp is unreliable.
      if (this.cached.clientId === clientId && now() >= this.cached.issuedAt &&
        this.cached.expiresAt > now()) {
        return this.cached.token;
      }
      // Expired, or issued for another client id: useless, drop it from memory.
      this.cached = null;
    }

    if (this.inflight) {
      // Concurrent callers share the pending flow, unless the pending flow is
      // silent and this caller is a user click: that click must still get a
      // window, so it runs after the silent attempt settles.
      if (!interactive || this.inflightInteractive) return this.inflight;
      const silent = this.inflight;
      return this.track(
        silent
          .catch(() => null)
          .then((token) => token ?? this.runFlow(clientId, true)),
        true,
      );
    }

    // A user click always gets its window: no cooldown, no silent downgrade.
    if (interactive) return this.track(this.runFlow(clientId, true), true);

    // ONE silent attempt per cooldown window, the first failure included. Never
    // an interactive prompt from a non-interactive request — consent escalation
    // is a click's job.
    const cooldown = this.deps.silentRetryCooldownMs ?? DEFAULT_SILENT_RETRY_COOLDOWN_MS;
    if (this.lastSilentFailureAt !== null) {
      const elapsed = now() - this.lastSilentFailureAt;
      // elapsed < 0: the clock stepped back; drop the stamp instead of blocking.
      if (elapsed < 0) this.lastSilentFailureAt = null;
      else if (elapsed < cooldown) return null;
    }
    const silent = this.runFlow(clientId, false).then(
      (token) => {
        this.lastSilentFailureAt = token === null ? now() : null;
        return token;
      },
      (error) => {
        this.lastSilentFailureAt = now();
        throw error;
      },
    );
    return this.track(silent, false);
  }

  /** Remember the pending flow until it settles (success, null or throw). */
  private track(flow: Promise<string | null>, interactive: boolean): Promise<string | null> {
    const pending = flow.finally(() => {
      if (this.inflight === pending) this.inflight = null;
    });
    this.inflight = pending;
    this.inflightInteractive = interactive;
    return pending;
  }

  private log(message: string): void {
    (this.deps.log ?? console.warn)(message);
  }

  /** One fixed line per source, never the error text. */
  private logSetupFailure(): void {
    if (this.setupFailureLogged) return;
    this.setupFailureLogged = true;
    this.log(SETUP_FAILED_LINE);
  }

  private async runFlow(clientId: string, interactive: boolean): Promise<string | null> {
    // Setup can throw (entropy, identity API): TokenSource never throws, so a
    // failure is null. A silent null starts the normal cooldown in getToken.
    let verifier: string;
    let state: string;
    let redirectUri: string;
    let authUrl: URL;
    try {
      const randomBytes = this.deps.randomBytes ?? defaultRandomBytes;
      const pkce = await createPkcePair(randomBytes);
      verifier = pkce.verifier;
      state = base64url(randomBytes(16));
      redirectUri = this.deps.getRedirectUrl();
      authUrl = new URL(GOOGLE_AUTH_ENDPOINT);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', WEB_AUTH_SCOPES.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', pkce.challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    } catch {
      this.logSetupFailure();
      return null;
    }

    // An idle auth window must not pin the in-flight slot forever: race the
    // launch against a timeout (a timed-out flow resolves null).
    const launchTimeoutMs = this.deps.launchTimeoutMs ??
      (interactive ? DEFAULT_INTERACTIVE_LAUNCH_TIMEOUT_MS : DEFAULT_SILENT_LAUNCH_TIMEOUT_MS);
    // launchWebAuthFlow has no cancel: while an earlier launch has not settled
    // its window may still be open, so no second window is opened next to it.
    // A click may pass once a SILENT launch (invisible by contract) timed out.
    if (this.launchOpen && !(interactive && this.silentLaunchTimedOut)) return null;
    let launched: Promise<string | undefined>;
    try {
      launched = Promise.resolve(
        this.deps.launchWebAuthFlow({ url: authUrl.toString(), interactive }),
      );
    } catch {
      return null;
    }
    this.launchOpen = true;
    this.silentLaunchTimedOut = false;
    // The gate follows the launch promise, capped at a ceiling so a launch
    // that never settles cannot close it for good.
    let gateTimer: ReturnType<typeof setTimeout> | undefined;
    const launchId = ++this.launchSeq;
    const release = () => {
      clearTimeout(gateTimer);
      // A late settle of an older launch must not reopen a newer launch's gate.
      if (launchId !== this.launchSeq) return;
      this.launchOpen = false;
      this.silentLaunchTimedOut = false;
    };
    gateTimer = setTimeout(
      release,
      this.deps.launchGateCeilingMs ?? launchTimeoutMs + LAUNCH_GATE_MARGIN_MS,
    );
    launched.then(release, release);
    let launchTimer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<undefined>((resolve) => {
      launchTimer = setTimeout(() => {
        if (!interactive && this.launchOpen) this.silentLaunchTimedOut = true;
        resolve(undefined);
      }, launchTimeoutMs);
    });
    let redirect: string | undefined;
    try {
      redirect = await Promise.race([launched, timedOut]);
    } catch {
      return null; // flow aborted (Firefox cancel path)
    } finally {
      clearTimeout(launchTimer);
    }
    if (!redirect) return null; // user closed the auth window

    // The redirect must be the allowlisted redirect URI; anything else (or
    // anything unparsable) is a failed flow, never an exception.
    let returned: URL;
    try {
      returned = new URL(redirect);
      const expected = new URL(redirectUri);
      if (returned.origin !== expected.origin || returned.pathname !== expected.pathname) {
        return null;
      }
    } catch {
      return null;
    }
    // A denial may carry no state: check the error first (it resolves null).
    if (returned.searchParams.get('error')) return null;
    if (returned.searchParams.get('state') !== state) {
      // Never throw (TokenSource contract) and never log the returned values.
      this.log('[CQD Classroom] WebAuthFlow state mismatch — flow rejected as possible CSRF');
      return null;
    }
    const code = returned.searchParams.get('code');
    if (!code) return null;

    // Race the exchange against a timer: a fetch that ignores its signal must
    // not pin the flow. A result that arrives after the timeout is dropped.
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const exchangeTimedOut = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, this.deps.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);
    });
    try {
      const exchanged = await Promise.race([
        this.exchangeCode(clientId, redirectUri, code, verifier, controller.signal),
        exchangeTimedOut,
      ]);
      if (!exchanged) return null;
      const now = this.deps.now ?? (() => Date.now());
      this.cached = {
        token: exchanged.token,
        expiresAt: now() + exchanged.lifetimeMs - EXPIRY_SKEW_MS,
        issuedAt: now(),
        clientId,
      };
      return exchanged.token;
    } finally {
      clearTimeout(timer);
    }
  }

  /** The code-for-token POST. Never throws: any failure is null. */
  private async exchangeCode(
    clientId: string,
    redirectUri: string,
    code: string,
    verifier: string,
    signal: AbortSignal,
  ): Promise<{ token: string; lifetimeMs: number } | null> {
    try {
      const response = await this.deps.fetchImpl(this.deps.exchangeUrl ?? GOOGLE_TOKEN_ENDPOINT, {
        signal,
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
      return { token: accessToken, lifetimeMs: lifetime };
    } catch {
      return null; // network failure or timeout — the fallback matrix covers it
    }
  }
}
