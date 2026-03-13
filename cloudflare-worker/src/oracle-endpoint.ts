const EXTENSION_INGEST_BATCH_PATH = "/ingest-batch";
const WEBSITE_INTERNAL_BATCH_PATH = "/api/internal/website/events/batch";

export type OracleEndpointResolveError =
  | "oracle_endpoint_missing"
  | "oracle_endpoint_invalid"
  | "oracle_endpoint_invalid_scheme"
  | "oracle_endpoint_insecure";

export type OracleEndpointResolution =
  | {
      ok: true;
      baseUrl: string;
      ingestBatchUrl: string;
      websiteEventsBatchUrl: string;
      protocol: "https:" | "http:";
      insecureHttp: boolean;
    }
  | {
      ok: false;
      error: OracleEndpointResolveError;
      message: string;
    };

type ResolveOracleEndpointOptions = {
  allowInsecureHttp?: boolean;
};

const warnedInsecureOracleContexts = new Set<string>();

/**
 * Parse the legacy insecure-endpoint override in a strict way.
 *
 * Intentionally only the literal "true" enables the override so accidental
 * values cannot silently weaken transport security.
 */
export function isAllowInsecureOracleEndpointEnabled(rawValue: string | undefined): boolean {
  return (rawValue || "").trim().toLowerCase() === "true";
}

/**
 * Returns true only once per context/baseUrl pair when the resolved endpoint is
 * a non-loopback HTTP origin. Callers can use this to log a deprecation warning
 * without spamming logs on every request/flush.
 */
export function shouldWarnOnInsecureOracleEndpoint(
  context: string,
  resolution: OracleEndpointResolution,
): boolean {
  if (!resolution.ok || !resolution.insecureHttp) return false;

  try {
    const hostname = new URL(resolution.baseUrl).hostname;
    if (isLoopbackHostname(hostname)) return false;
  } catch {
    // If URL parsing unexpectedly fails, keep warning enabled to stay fail-loud.
  }

  const normalizedContext = context.trim() || "unknown";
  const key = `${normalizedContext}|${resolution.baseUrl}`;
  if (warnedInsecureOracleContexts.has(key)) return false;
  warnedInsecureOracleContexts.add(key);
  return true;
}

function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return true;
  if (h === "::1" || h === "[::1]") return true;
  return h.startsWith("127.");
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeBasePath(pathname: string): string {
  if (!pathname || pathname === "/") return "";
  let normalized = trimTrailingSlashes(pathname);
  if (!normalized || normalized === "/") return "";
  const normalizedLower = normalized.toLowerCase();
  for (const suffix of [WEBSITE_INTERNAL_BATCH_PATH, EXTENSION_INGEST_BATCH_PATH]) {
    if (normalizedLower.endsWith(suffix)) {
      normalized = trimTrailingSlashes(normalized.slice(0, normalized.length - suffix.length));
      break;
    }
  }
  if (!normalized || normalized === "/") return "";
  return normalized;
}

export function resolveOracleEndpoint(
  rawEndpoint: string | undefined,
  options: ResolveOracleEndpointOptions = {},
): OracleEndpointResolution {
  const raw = (rawEndpoint || "").trim();
  if (!raw) {
    return {
      ok: false,
      error: "oracle_endpoint_missing",
      message: "ORACLE_ENDPOINT is not configured.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return {
      ok: false,
      error: "oracle_endpoint_invalid",
      message: "ORACLE_ENDPOINT is not a valid absolute URL.",
    };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    return {
      ok: false,
      error: "oracle_endpoint_invalid_scheme",
      message: "ORACLE_ENDPOINT must use http:// or https://",
    };
  }

  // Compatibility bridge:
  // Keep the explicit insecure override path while environments finish HTTPS
  // migration. This preserves current behavior for controlled rollouts.
  const allowInsecureHttp = options.allowInsecureHttp === true;
  const insecureHttp = protocol === "http:";
  if (insecureHttp && !allowInsecureHttp && !isLoopbackHostname(parsed.hostname)) {
    return {
      ok: false,
      error: "oracle_endpoint_insecure",
      message:
        "ORACLE_ENDPOINT must use HTTPS for non-loopback hosts. Set ALLOW_INSECURE_ORACLE_ENDPOINT=true only for temporary/local migration.",
    };
  }

  const basePath = normalizeBasePath(parsed.pathname);
  const baseUrl = `${parsed.origin}${basePath}`;

  return {
    ok: true,
    baseUrl,
    ingestBatchUrl: `${baseUrl}${EXTENSION_INGEST_BATCH_PATH}`,
    websiteEventsBatchUrl: `${baseUrl}${WEBSITE_INTERNAL_BATCH_PATH}`,
    protocol: insecureHttp ? "http:" : "https:",
    insecureHttp,
  };
}
