import { describe, expect, it } from "vitest";
import { resolveOracleEndpoint } from "../src/oracle-endpoint";

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
      expect(result.ingestUrl).toBe("https://oracle.example.com/ingest-batch");
      expect(result.insecureHttp).toBe(false);
    }
  });

  it("allows loopback HTTP endpoint without override", () => {
    const result = resolveOracleEndpoint("http://127.0.0.1:8080");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.baseUrl).toBe("http://127.0.0.1:8080");
      expect(result.ingestUrl).toBe("http://127.0.0.1:8080/ingest-batch");
      expect(result.insecureHttp).toBe(true);
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
});
