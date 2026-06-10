export function formatWebsiteSyncSubtitle(source: string, generatedAtUtc?: number | null): string {
  const stamp = typeof generatedAtUtc === "number" && Number.isFinite(generatedAtUtc)
    ? new Date(generatedAtUtc).toISOString()
    : "unknown";
  return `Source: ${source || "oracle"} · Generated: ${stamp}`;
}
