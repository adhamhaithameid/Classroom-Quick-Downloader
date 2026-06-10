export type OracleDashboardPageId =
  | "overview"
  | "activity"
  | "creative"
  | "logs"
  | "dashboards"
  | "website-sync"
  | "website-analysis"
  | "content-changelog"
  | "ext-changelog"
  | "danger";

export interface OracleDashboardBuildMeta {
  version: string;
  generatedAtUtc: number;
  source: "typescript";
}

export interface OracleDashboardRuntimeBridge {
  version: string;
  enabled: boolean;
  pages: OracleDashboardPageId[];
}

export interface OracleDashboardApiResponse<T = unknown> {
  ok: boolean;
  code: string;
  message: string;
  generatedAtUtc: number;
  details?: Record<string, unknown>;
  data?: T;
}
