/**
 * ============================================================================
 * DIAGNOSTICS REPORT — one copyable, schema-versioned, PII-free report
 * (bead 0h4d.1.7, plan docs/superpowers/plans/2026-09-28-diagnostics-page.md)
 * ============================================================================
 *
 * Pure: inputs in, JSON-safe report out. The scrubber is defense-in-depth at
 * the boundary — strings are redacted when they carry email/bearer-token/
 * URL-query shapes even if an upstream allowlist slips — and fast-check
 * pins the invariant (tests/diagnostics-build.test.ts). Nothing here is
 * transmitted: the user copies the report into support themselves.
 */

export const DIAGNOSTICS_SCHEMA = 'cqd-diagnostics/1' as const;

export interface DiagnosticsInput {
  extensionVersion: string;
  userAgent: string;
  locale: string;
  engineMode: string;
  flags: Record<string, boolean>;
  queue: { active: number; queued: number; paused: boolean };
  historyTotal: number;
  /** Top failure codes with counts, pre-aggregated by the caller. */
  failureDigest: Array<{ code: string; count: number }>;
  now?: number;
}

export interface DiagnosticsReport {
  schema: typeof DIAGNOSTICS_SCHEMA;
  generatedAt: string;
  extension: { version: string; locale: string; userAgent: string };
  engineMode: string;
  flags: Record<string, boolean>;
  queue: { active: number; queued: number; paused: boolean };
  history: {
    total: number;
    failureDigest: Array<{ code: string; count: number }>;
  };
}

const REDACTED = '[redacted]';

/**
 * Deny-by-default string scrubber: emails, bearer tokens, and URL query
 * strings are redacted; everything else passes through. Applied to every
 * string field of the report.
 */
export function scrubText(value: string): string {
  let out = value;
  // Any non-space blob @ blob . blob — deliberately broad (deny-by-default);
  // over-redaction in a diagnostics report is acceptable, leakage is not.
  out = out.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, REDACTED);
  out = out.replace(/Bearer\s+\S+/gi, `Bearer ${REDACTED}`); // bearer tokens
  out = out.replace(/([?&])[^\s&=]+=[^\s&]+/g, `$1${REDACTED}`); // query params
  return out;
}

function scrubDeep<T>(value: T): T {
  if (typeof value === 'string') return scrubText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}

const MAX_DIGEST_ENTRIES = 10;

/** Build the report. Every string passes the scrubber before inclusion. */
export function buildDiagnostics(input: DiagnosticsInput): DiagnosticsReport {
  const raw: DiagnosticsReport = {
    schema: DIAGNOSTICS_SCHEMA,
    generatedAt: new Date(input.now ?? Date.now()).toISOString(),
    extension: {
      version: input.extensionVersion,
      locale: input.locale,
      userAgent: input.userAgent,
    },
    engineMode: input.engineMode,
    flags: { ...input.flags },
    queue: { ...input.queue },
    history: {
      total: input.historyTotal,
      failureDigest: [...input.failureDigest]
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_DIGEST_ENTRIES),
    },
  };
  return scrubDeep(raw);
}
