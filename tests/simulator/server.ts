// filepath: tests/simulator/server.ts
/**
 * ============================================================================
 * SIMULATOR SERVER — install scenario routes into a Playwright context
 * ============================================================================
 *
 * Serves the SPA shell under the real https://classroom.google.com origin
 * (so CQD's hostname gate is satisfied without a Google account) and the
 * deterministic Drive/Docs endpoints. A catch-all 204 route registered first
 * guarantees zero uncontrolled external traffic.
 */

import type { BrowserContext, Route } from "@playwright/test";
import type { Scenario } from "./scenario";
import { buildRouteTemplates } from "./pages/builder";
import { ROUTER_SOURCE } from "./router";
import { collectDriveFiles, handleDriveRoute, handleDocsRoute } from "./drive";

/** Build the full SPA document for a scenario. */
export function buildAppDocument(scenario: Scenario): string {
  const routesJson = JSON.stringify(scenario.routes.map((r) => ({ path: r.path })));
  const router = ROUTER_SOURCE.replace("/** ROUTES_JSON **/", routesJson);
  const themeClass = scenario.theme === "dark" ? "gm3-dark-theme" : "";
  const nav = scenario.routes
    .map((r) => `<a data-cqd-nav="${r.path}" href="${r.path}">${r.path}</a>`)
    .join("\n    ");

  return `<!doctype html>
<html dir="${scenario.dir}" lang="${scenario.locale}" class="${themeClass}">
<head>
  <meta charset="utf-8">
  <title>${scenario.courseName ?? "Classroom"} - Classroom</title>
  <style>
    body { margin: 0; padding: 24px; font-family: Roboto, Arial, sans-serif; }
    article, li.n4xnA { display: block; margin: 0 0 16px; padding: 12px; border: 1px solid #dadce0; border-radius: 8px; }
    .attachments { margin: 8px 0; }
    .luto0c, .KlRXdf, .WkZsyc { display: inline-block; padding: 6px; border: 1px solid #e8eaed; border-radius: 6px; margin: 2px; }
    .cqd-sim-nav { margin-bottom: 12px; font-size: 12px; }
    .cqd-sim-nav a { margin-right: 8px; color: #1a73e8; }
    #cqd-load-more-sentinel { height: 10px; }
  </style>
</head>
<body>
  <nav class="cqd-sim-nav">
    ${nav}
  </nav>
  <div id="page"></div>
${buildRouteTemplates(scenario)}
  <script>
${router}
  </script>
</body>
</html>`;
}

async function classroomHandler(route: Route, appDocument: string): Promise<void> {
  const url = new URL(route.request().url());
  if (route.request().resourceType() === "document" && url.hostname === "classroom.google.com") {
    await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: appDocument });
    return;
  }
  await route.fulfill({ status: 204, body: "" });
}

/**
 * Install the simulator into a browser context. The catch-all route is
 * registered FIRST (Playwright resolves routes newest-first), so specific
 * handlers win and everything else dies silently as 204 — the simulator can
 * never leak a request to the real internet.
 */
export async function installSimulator(context: BrowserContext, scenario: Scenario): Promise<void> {
  const appDocument = buildAppDocument(scenario);
  const files = collectDriveFiles(scenario);

  await context.route("**/*", (route) => route.fulfill({ status: 204, body: "" }));
  await context.route("https://classroom.google.com/**", (route) => classroomHandler(route, appDocument));
  await context.route("https://drive.google.com/**", (route) => handleDriveRoute(route, files));
  await context.route("https://docs.google.com/**", (route) => handleDocsRoute(route, files));
}
