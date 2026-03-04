// filepath: cloudflare-worker/src/dashboard.ts
/**
 * Dashboard module - Re-exports from modularized structure.
 * This file maintains backward compatibility while delegating to
 * the new modular dashboard implementation.
 */

// Re-export dashboard rendering functions
export { renderLoginPage } from "./dashboard/main";
export { renderDashboard } from "./dashboard/main";
export { renderWebsiteConsole } from "./dashboard/websiteConsole";
