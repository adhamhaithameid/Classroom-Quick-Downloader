import type { OracleDashboardBuildMeta, OracleDashboardRuntimeBridge, OracleDashboardPageId } from "./types";

const pages: OracleDashboardPageId[] = [
  "overview",
  "activity",
  "creative",
  "logs",
  "dashboards",
  "website-sync",
  "website-analysis",
  "content-changelog",
  "ext-changelog",
  "danger",
];

export const dashboardBuildMeta: OracleDashboardBuildMeta = {
  version: "6.0.0",
  generatedAtUtc: Date.now(),
  source: "typescript",
};

export const runtimeBridge: OracleDashboardRuntimeBridge = {
  version: dashboardBuildMeta.version,
  enabled: true,
  pages,
};
