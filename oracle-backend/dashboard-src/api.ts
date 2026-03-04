import type { OracleDashboardApiResponse } from "./types";

export async function fetchOracleDashboardJSON<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<OracleDashboardApiResponse<T>> {
  const headers = new Headers(init?.headers || {});
  headers.set("X-Requested-With", "XMLHttpRequest");

  const res = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const fallback: OracleDashboardApiResponse = {
      ok: false,
      code: "http_error",
      message: parsed && typeof parsed.message === "string" ? parsed.message : `HTTP ${res.status}`,
      generatedAtUtc: Date.now(),
      details: parsed || { raw: text },
    };
    throw Object.assign(new Error(fallback.message), { payload: fallback });
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      ok: true,
      code: "ok",
      message: "empty_response",
      generatedAtUtc: Date.now(),
      data: undefined,
    };
  }

  return {
    ok: parsed.ok === true,
    code: typeof parsed.code === "string" ? parsed.code : "ok",
    message: typeof parsed.message === "string" ? parsed.message : "ok",
    generatedAtUtc: typeof parsed.generatedAtUtc === "number" ? parsed.generatedAtUtc : Date.now(),
    details: parsed.details && typeof parsed.details === "object" ? (parsed.details as Record<string, unknown>) : undefined,
    data: (parsed.data as T | undefined) ?? (parsed as unknown as T),
  };
}
