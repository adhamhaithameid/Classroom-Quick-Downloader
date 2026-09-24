# E2E Browser Matrix & Local Test Gate

Last updated: 2026-09-19

Everything about running the real-browser test suites (Playwright + the Zen
WebDriver harness): which browsers are covered and why, headless-by-default
behavior, the local full-suite gate, and the two browsers that provably cannot
be automated for extensions.

---

## TL;DR

```bash
pnpm run test:e2e          # Chromium (Chrome engine via Chrome for Testing) — main suite
pnpm run test:e2e:edge     # Edge stable — FULL main suite
pnpm run test:e2e:firefox  # Firefox journeys (qa-firefox; extension legs need the AMO-signed xpi)
pnpm run test:e2e:zen      # Zen Browser via geckodriver/WebDriver harness
pnpm run test:e2e:arc      # probe: re-check whether Arc has become automatable
pnpm run test:e2e:chrome   # probe: re-check whether branded Chrome loads extensions again
pnpm run test:e2e:matrix   # the whole cycle: chromium + edge + firefox + zen

# Headed (visible windows) — works on every Playwright leg:
E2E_HEADED=1 pnpm run test:e2e
pnpm run test:e2e:edge:headed
```

All suites run **headless by default** — no windows open, no focus stealing on
macOS. `E2E_HEADED=1` is the single switch back to visible windows.

Before any push, a husky **pre-push hook runs `pnpm run test:gate`** (the full
strict pyramid + Chromium + Edge E2E) so the complete suite has passed
on-device before anything reaches the remote. Skip one push with
`git push --no-verify`.

---

## Coverage matrix (verified 2026-09-19)

| Browser | Projects | What runs | Verified result |
|---|---|---|---|
| Chromium (bundled, channel `chromium` = Chrome for Testing) | `extension-chromium`, `qa-chromium` | Main suite (4 specs, 20 tests) + journeys | 20/20 in ~33s headless |
| Microsoft Edge (`channel: 'msedge'`) | `extension-edge`, `qa-edge` | FULL main suite + journeys | 20/20 in ~59s; journeys 16 pass + 1 skip |
| Firefox (Playwright bundled) | `qa-firefox` | Journeys; extension legs **skip by design** unsigned (see below) | green: sanity passes, skips carry `ENVIRONMENT:` reasons |
| Firefox (AMO-signed, CI) | `qa-firefox-signed` | Journeys on the Mozilla-signed xpi | live in CI when `AMO_JWT_*` secrets exist |
| Zen Browser | standalone WebDriver harness | Launch, unsigned-xpi install, **content-script injection** on a classroom fixture, screenshot evidence | 4/4 checks pass |
| Google Chrome (branded) | — none, deliberately — | — | **impossible**: Chrome 137+ ignores `--load-extension` (probe-verified on Chrome 150) |
| Arc | — none, deliberately — | — | **impossible**: Arc strips `--remote-debugging-port` / `--user-data-dir` |

Main suite = `tests/e2e/core-flow.spec.ts`, `extension-smoke.spec.ts`,
`student-work.spec.ts`, `student-work-by-status.spec.ts`.
Journeys = `tests/e2e/qa/qa-01…qa-08` (see
[EXTENSION_TESTING_RUNBOOK.md](EXTENSION_TESTING_RUNBOOK.md) for the manual-check map).

Headed vs headless parity was verified A/B on the full Chromium suite:
**identical 20/20 pass set** (headless 39s, headed 48s). Headless exercises
everything headed does — extension load, MV3 service workers, content-script
injection, real downloads, popup, RTL/i18n. There is no coverage trade-off.

---

## Headless: how it works and how to opt out

Since Chrome 113-ish, Chromium's **new headless** mode supports extension
APIs; the bundled old headless does not. Every launcher in the repo therefore
pins `channel: 'chromium'` (or the branded `'msedge'`) together with
`headless: true`:

- `playwright.config.ts` projects set it in `launchOptions`.
- The four main specs launch their own `launchPersistentContext` (extensions
  need it); each reads the env switch and takes the project channel:

```ts
channel: channel ?? 'chromium',            // project channel passthrough
headless: process.env.E2E_HEADED !== '1',  // headless unless E2E_HEADED=1
```

- The qa harness (`tests/e2e/qa/harness.ts`) resolves the channel from the
  Playwright project name (`projectChannel`) so `qa-edge` drives real Edge.

`test:e2e:headed` used to pass Playwright's `--headed` flag, which silently
did nothing for these specs (they never use the config-driven fixture). The
scripts now set `E2E_HEADED=1`, which the specs actually read.

Edge spot-check: `E2E_HEADED=1 pnpm run test:e2e:edge -- --grep "content script activates"`.

---

## Per-browser notes

### Chromium is the Chrome engine leg (there is no branded-Chrome project)

Since **Chrome 137**, branded Google Chrome builds ignore
`--load-extension` and `--disable-extensions-except` (anti-abuse policy —
[Chrome extensions blog, June 2025](https://developer.chrome.com/blog/extensions/whats-happening-june-25/),
[Playwright Chrome extensions docs](https://playwright.dev/docs/chrome-extensions)).
Verified on Chrome 150 (2026-09-19): the extension never loads — no service
worker, no content-script injection.

Chrome for Testing (what Playwright's `channel: 'chromium'` provides) still
honors the flags — it is Google's own build for exactly this purpose. So the
`extension-chromium` project **is** the Chrome-engine coverage.

An `extension-chrome` project existed briefly and was removed after its whole
run failed on the missing service worker. If you want to re-check branded
Chrome after a Chrome update:

```bash
pnpm run test:e2e:chrome    # tools/check-chrome-support.mjs — prints a verdict + guidance
```

If it ever reports the extension loading, re-add an `extension-chrome` project
(mirror `extension-edge` with `channel: 'chrome'`), a matching `qa-chrome`
project, and add both back to `test:e2e:matrix`.

### Edge

Edge (separately branded) **still honors the extension flags today** — the
full suite passes with real service workers, injections and downloads. Two
Edge-specific facts baked into the code:

- The qa harness adds Edge-only
  `--disable-features=msDownloadsHub,msDownloadsHubV2`: branded Edge
  auto-opens `edge://downloads-hub/` on the first download, which broke
  qa-08's "zero dead ends" page-count assertion
  (`tests/e2e/qa/harness.ts`).
- If a future Edge update drops the extension flags, the suite fails loudly
  (the smoke spec's service-worker check catches it) — at that point Edge
  coverage falls back to the chromium project.

### Firefox

`qa-firefox` uses Playwright's bundled Firefox, whose custom build **deletes
unsigned sideloaded xpis at startup** (it ignores
`xpinstall.signatures.required = false`). Journeys therefore skip with a
recorded `ENVIRONMENT:` reason instead of faking a pass; `simulator-sanity`
still runs. The full Firefox cycle runs on the **AMO-signed leg**
(`qa-firefox-signed`, `QA_SIGNED_XPI=…`), which CI activates automatically now
that the `AMO_JWT_ISSUER` / `AMO_JWT_SECRET` repo secrets exist — history and
details in [EXTENSION_TESTING_RUNBOOK.md](EXTENSION_TESTING_RUNBOOK.md).

Note the asymmetry: **Zen accepts the unsigned zip locally** (unbranded fork
honors the signing pref), so Zen actually exercises more extension surface
locally than Firefox does.

### Zen (WebDriver harness — Playwright cannot drive it)

Zen is a Firefox fork, and Playwright's Firefox support speaks **Juggler**, a
protocol compiled only into Playwright's own Firefox build. A stock Gecko
binary cannot be driven by Playwright at all (verified: `firefox.launch` with
`executablePath: zen` times out on the handshake). The supported route is
WebDriver/geckodriver (Marionette is built into every Firefox build).

`tests/e2e/zen/zen-extension.mjs` is a dependency-free Node harness (plain
`fetch` + one WebSocket) that:

1. locates or auto-downloads geckodriver (no brew needed; respects
   `GECKODRIVER` / `GECKODRIVER_VERSION`),
2. builds `firefox-mv2` if missing,
3. launches Zen headless (E2E_HEADED=1 for a window) via geckodriver,
4. installs the unsigned MV2 zip as a temporary add-on (Zen honors the
   signing pref, unlike Mozilla-branded builds),
5. **verifies real content-script injection**: a PAC pref routes
   `classroom.google.com` to a local CONNECT proxy serving the fixture over
   self-signed TLS; `acceptInsecureCerts` lets the navigation through, so the
   content script sees the genuine classroom origin and
   `button.cqd-download-btn` must appear,
6. writes screenshot evidence to `qa-artifacts/zen-<runid>/`.

Platform limits discovered while building it (do not re-litigate without new
evidence):

- WebDriver **classic and BiDi both refuse navigation to `moz-extension://`
  and `about:` pages** — the popup UI cannot be driven on Firefox-family
  browsers.
- `moz:profile` breaks session create on Zen + geckodriver 0.36
  (`Invalid byte 45, offset 52`). geckodriver's own temp profile is used
  instead; the seeded `extensions.webextensions.uuids` pref keeps any
  `moz-extension://<uuid>` URL deterministic.
- Firefox has no `--host-resolver-rules` / `--ignore-certificate-errors`
  (those are Chromium switches) — hence the PAC + CONNECT proxy approach.

`brew` users can alternatively `brew install geckodriver` (requires the Xcode
license accepted: `sudo xcodebuild -license accept`); the harness works
without it.

### Arc (not automatable)

Arc strips the Chromium switches CDP automation requires:
`--remote-debugging-port` never opens (no `DevToolsActivePort`), and even
`--user-data-dir` is ignored (probe: the directory is never created). The
engine lives in `ArcCore.framework/ArcCore`, a dylib — there is no separate
binary to exec directly. Without a debugging endpoint there is no automation
path for Playwright/Puppeteer, headed or headless.

`pnpm run test:e2e:arc` (`tools/check-arc-support.mjs`) re-probes all of
this and prints a verdict; run it after major Arc updates and, if it ever
goes green, add an `extension-arc` project mirroring `extension-chrome` with
`executablePath`.

---

## Local full-suite gate (pre-push)

`.husky/pre-push` runs `pnpm run test:gate` on every `git push`:

```bash
test:gate = test:strict            # the full vitest/Go pyramid (smoke → … → extension tests)
         + test:e2e                # Chromium main suite
         + test:e2e:edge           # Edge main suite
```

So the complete suite has passed **on your device** before anything reaches
the remote, and no browser window ever opens while it runs. Escape hatch for
a deliberate WIP push: `git push --no-verify`.

The full browser matrix is deliberately **not** part of the pre-push gate
(it adds minutes); run `pnpm run test:e2e:matrix` when you want the whole
cycle.

### Merge enforcement (CI + branch protection)

`.github/workflows/ci.yml` runs ten jobs on every PR and aggregates them into
a **`CI ✅`** summary job; the `Extension — Real Browser E2E` job runs the
Chromium + Edge suites on every PR.

Required status checks on `main` (as of 2026-09-19): only four of the jobs
are required — `Extension — Tests & Coverage`, `Website — Check, Tests,
Build`, `Cloudflare Worker — Tests & Lint`, `Go — Oracle Backend Tests`.
**The E2E job and the `CI ✅` gate are not yet required** (the gh token used
cannot write repo settings). To finish the enforcement, add
`Extension — Real Browser E2E` and `CI ✅` in
*Settings → Branches → main → required status checks*, or:

```bash
gh api -X PATCH repos/:owner/:repo/branches/main/protection --input - <<'EOF'
{
  "required_status_checks": {
    "strict": false,
    "checks": [
      {"context": "Extension — Tests & Coverage"},
      {"context": "Website — Check, Tests, Build"},
      {"context": "Cloudflare Worker — Tests & Lint"},
      {"context": "Go — Oracle Backend Tests"},
      {"context": "Extension — Real Browser E2E"},
      {"context": "CI ✅"}
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF
```

(`enforce_admins: false` keeps the owner bypass as an escape hatch.)

CI note: the E2E job runs genuinely headless — the old `xvfb-run` wrappers
were removed after the headless flip (new headless supports extensions;
parity evidence above).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Executable doesn't exist … chromium-XXXX` after a Playwright upgrade | `pnpm exec playwright install chromium` |
| Chrome leg fails with no service worker | Expected on branded Chrome 137+ — see above; engine is covered by `extension-chromium` |
| `geckodriver did not start` / download failed | Set `GECKODRIVER=/path/to/geckodriver` or `GECKODRIVER_VERSION=<other>` |
| Zen harness: `Invalid byte 45` | Don't pass `moz:profile` (harness already avoids it) |
| qa-08 "zero dead ends" fails on Edge | Confirm the harness's msedge `--disable-features=msDownloadsHub,msDownloadsHubV2` args are intact |
| Windows opening during tests | Something passed `E2E_HEADED=1`, or you're on a pre-2026-09-19 checkout |

Related docs: [EXTENSION_TESTING_RUNBOOK.md](EXTENSION_TESTING_RUNBOOK.md) ·
[LIVE_CLASSROOM_TESTING.md](LIVE_CLASSROOM_TESTING.md) ·
[TESTING.md](TESTING.md)
