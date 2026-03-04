import { runtimeBridge } from "../state";

export function registerOracleDashboardRuntimeBridge(): void {
  if (typeof window === "undefined") return;
  const current = (window as unknown as { __CQD_ORACLE_DASHBOARD__?: unknown }).__CQD_ORACLE_DASHBOARD__;
  if (current && typeof current === "object") {
    return;
  }
  (window as unknown as { __CQD_ORACLE_DASHBOARD__?: unknown }).__CQD_ORACLE_DASHBOARD__ = runtimeBridge;
}
