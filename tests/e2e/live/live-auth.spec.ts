// filepath: tests/e2e/live/live-auth.spec.ts
/**
 * ============================================================================
 * LIVE AUTH — verify the dedicated profile is really signed into Classroom
 * ============================================================================
 *
 * The gateway suite: everything else in live/ depends on a signed-in profile.
 * Probes each configured authuser (LIVE_AUTHUSERS, default "0,1") — a
 * signed-in session stays on classroom.google.com, a missing one bounces to
 * accounts.google.com. Google's login itself is NEVER automated; the human
 * does it once via `pnpm test:live:login`.
 *
 * Artifacts: qa-artifacts/live/<run-id>/auth/accounts.json and the stable
 * qa-artifacts/live/accounts.json (consumed by discovery for the primary
 * signed-in authuser).
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  launchLiveContext,
  liveArtifact,
  liveGateReason,
  liveAuthusers,
  liveRunId,
  probeSignedIn,
  type LiveAccountProbe,
} from "./live-harness";

const gate = liveGateReason();
test.skip(gate !== null, gate ?? "");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const STABLE_ACCOUNTS_JSON = path.join(REPO_ROOT, "qa-artifacts/live/accounts.json");

test.describe("live auth (dedicated profile signed in)", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    if (gate) return;
    context = await launchLiveContext(liveRunId());
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close().catch(() => undefined);
  });

  test("profile holds a signed-in Google Classroom session", async () => {
    test.setTimeout(240_000);
    const authusers = liveAuthusers();
    const probes: LiveAccountProbe[] = [];
    for (const authuser of authusers) {
      const probe = await probeSignedIn(page, authuser);
      probes.push(probe);
      console.log(
        `[live-auth] u/${probe.authuser}: signedIn=${probe.signedIn} email=${probe.email ?? "?"} url=${probe.finalUrl.slice(0, 90)}`,
      );
    }

    await liveArtifact("auth", "accounts.json", {
      checkedAt: new Date().toISOString(),
      accounts: probes,
    });
    // Stable path consumed by live-discovery to pick the primary authuser.
    const signedIn = probes.filter((p) => p.signedIn);
    fs.mkdirSync(path.dirname(STABLE_ACCOUNTS_JSON), { recursive: true });
    fs.writeFileSync(
      STABLE_ACCOUNTS_JSON,
      `${JSON.stringify(signedIn.map((p) => ({ authuser: p.authuser, email: p.email })), null, 2)}\n`,
    );

    if (signedIn.length === 0) {
      const detail = probes
        .map((p) => `u/${p.authuser} → ${p.finalUrl.replace(/^https:\/\//, "").slice(0, 80)}`)
        .join("; ");
      throw new Error(
        `no signed-in account on this profile (${detail}). Run \`pnpm test:live:login\` once and sign in with your Google account(s) in the window that opens.`,
      );
    }
    expect(signedIn.length).toBeGreaterThan(0);
  });
});
