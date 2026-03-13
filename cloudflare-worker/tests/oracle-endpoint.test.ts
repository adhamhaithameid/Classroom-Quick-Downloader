import { describe, expect, it } from "vitest";
import {
  isAllowInsecureOracleEndpointEnabled,
  resolveOracleEndpoint,
  shouldWarnOnInsecureOracleEndpoint,
} from "../src/oracle-endpoint";

describe("resolveOracleEndpoint", () => {
  it("returns missing error when endpoint is empty", () => {
    const result = resolveOracleEndpoint("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("oracle_endpoint_missing");
    }
  });

  it("returns invalid error for malformed URL", () => {
    const result = resolveOracleEndpoint("not-a-url");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("oracle_endpoint_invalid");
    }
  });

  it("normalizes HTTPS endpoint and strips legacy ingest suffix from base", () => {
    const result = resolveOracleEndpoint("https://oracle.example.com/ingest-batch");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.baseUrl).toBe("https://oracle.example.com");
      expect(result.ingestBatchUrl).toBe("https://oracle.example.com/ingest-batch");
      expect(result.websiteEventsBatchUrl).toBe("https://oracle.example.com/api/internal/website/events/batch");
      expect(result.insecureHttp).toBe(false);
    }
  });

  it("allows loopback HTTP endpoint without override", () => {
    const result = resolveOracleEndpoint("http://127.0.0.1:8080");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.baseUrl).toBe("http://127.0.0.1:8080");
      expect(result.ingestBatchUrl).toBe("http://127.0.0.1:8080/ingest-batch");
      expect(result.websiteEventsBatchUrl).toBe("http://127.0.0.1:8080/api/internal/website/events/batch");
      expect(result.insecureHttp).toBe(true);
    }
  });

  it("normalizes canonical internal ingest endpoint when full path is provided", () => {
    const result = resolveOracleEndpoint(
      "https://oracle.example.com/api/internal/website/events/batch",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.baseUrl).toBe("https://oracle.example.com");
      expect(result.ingestBatchUrl).toBe("https://oracle.example.com/ingest-batch");
      expect(result.websiteEventsBatchUrl).toBe("https://oracle.example.com/api/internal/website/events/batch");
    }
  });

  it("rejects non-loopback HTTP endpoint without override", () => {
    const result = resolveOracleEndpoint("http://oracle.example.com:8080");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("oracle_endpoint_insecure");
    }
  });

  it("allows non-loopback HTTP endpoint when explicit override is enabled", () => {
    const result = resolveOracleEndpoint("http://oracle.example.com:8080", {
      allowInsecureHttp: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.baseUrl).toBe("http://oracle.example.com:8080");
      expect(result.insecureHttp).toBe(true);
    }
  });

  it("parses insecure override flag in strict compatibility mode", () => {
    expect(isAllowInsecureOracleEndpointEnabled(undefined)).toBe(false);
    expect(isAllowInsecureOracleEndpointEnabled("")).toBe(false);
    expect(isAllowInsecureOracleEndpointEnabled("false")).toBe(false);
    expect(isAllowInsecureOracleEndpointEnabled("1")).toBe(false);
    expect(isAllowInsecureOracleEndpointEnabled("true")).toBe(true);
    expect(isAllowInsecureOracleEndpointEnabled(" TRUE ")).toBe(true);
  });

  it("emits insecure-endpoint warning gate once for non-loopback HTTP endpoints", () => {
    const result = resolveOracleEndpoint("http://oracle.example.com:8080", {
      allowInsecureHttp: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(shouldWarnOnInsecureOracleEndpoint("vitest.oracle.warning.once", result)).toBe(true);
      expect(shouldWarnOnInsecureOracleEndpoint("vitest.oracle.warning.once", result)).toBe(false);
    }
  });

  it("does not emit insecure-endpoint warning gate for loopback HTTP endpoints", () => {
    const result = resolveOracleEndpoint("http://127.0.0.1:8080");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(shouldWarnOnInsecureOracleEndpoint("vitest.oracle.warning.loopback", result)).toBe(false);
    }
  });
});
