import { dashboardBuildMeta } from "./state";
import { registerOracleDashboardRuntimeBridge } from "./renderers/bootstrap";

// @ts-ignore -- legacy script remains source of runtime behavior during migration.
import "../static/oracle-dashboard.legacy.js";

registerOracleDashboardRuntimeBridge();

if (typeof window !== "undefined") {
  (window as unknown as { __CQD_ORACLE_TS_BUILD__?: unknown }).__CQD_ORACLE_TS_BUILD__ = {
    version: dashboardBuildMeta.version,
    generatedAtUtc: dashboardBuildMeta.generatedAtUtc,
  };
}
