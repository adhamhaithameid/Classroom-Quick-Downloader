// filepath: tests/simulator/app.ts
/**
 * ============================================================================
 * APP — the simulator SPA shell document (Manual-QA Replay)
 * ============================================================================
 *
 * Served by the local MITM proxy for every classroom.google.com document
 * request. Embeds one <template> per scenario route plus the router runtime.
 */

import type { Scenario } from "./scenario";
import { buildRouteTemplates } from "./pages/builder";
import { ROUTER_SOURCE } from "./router";

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
    article, li.n4xnA { display: block; margin: 0 0 16px; padding: 12px; border: 1px solid #dadce0; border-radius: 8px; position: relative; }
    .student-row { position: relative; }
    .attachments { margin: 8px 0; }
    .luto0c, .KlRXdf, .WkZsyc { display: inline-block; padding: 6px; border: 1px solid #e8eaed; border-radius: 6px; margin: 2px; }
    .cqd-sim-nav { margin-bottom: 12px; font-size: 12px; }
    .cqd-sim-nav a { margin-right: 8px; color: #1a73e8; }
    #cqd-load-more-sentinel { height: 10px; }
  </style>
</head>
<body class="${scenario.theme === "dark" ? "cqd-theme-dark" : ""}">
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
