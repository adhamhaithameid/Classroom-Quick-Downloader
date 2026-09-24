# Live classroom.google.com E2E Testing — Research Notes

*Research date: 2026-09-19. Investigates running automated browser tests of the CQD Chrome
extension against the **real** https://classroom.google.com, logged in with a real Google
account, covering both STUDENT and TEACHER roles.*

---

## TL;DR

1. **Load the extension with `chromium.launchPersistentContext(userDataDir, { channel: 'chromium', args: ['--disable-extensions-except=...', '--load-extension=...'] })`.** A persistent context is mandatory for extensions; `channel: 'chromium'` (new headless) is the only headless build that runs them. Cite: https://playwright.dev/docs/chrome-extensions
2. **Auth strategy: never automate the Google login.** Log in manually **once** into a dedicated `userDataDir` profile, and every subsequent run reuses the cookies/session from disk. `storageState` exports cookies/localStorage but Google's login flow itself actively blocks automated browsers ("This browser or app may not be secure").
3. **BUG FOUND IN THIS REPO:** `chromium.launchPersistentContext` **silently ignores** the `storageState` option (verified empirically on Playwright 1.63.0: option accepted, cookies not applied — while `browser.newContext({ storageState })` works). Our `tests/e2e/qa/qa-07-live-canary.spec.ts` passes `storageState` to `launchPersistentContext` — that state is doing nothing; the canary runs signed-out. Fix: pass a dedicated `userDataDir` instead.
4. **Chrome 136+ refuses `--remote-debugging-port` on the default profile**; attaching to a user's real logged-in Chrome via `connectOverCDP` requires a custom `--user-data-dir` anyway — so a dedicated persistent profile is the correct pattern regardless. Cite: https://developer.chrome.com/blog/remote-debugging-port
5. **`navigator.webdriver` is `true` by default in Playwright** (verified) and `--disable-blink-features=AutomationControlled` flips it to `false` (verified) — the flag the repo already passes is correct and load-bearing.
6. **One Google account can be a teacher in one class and a student in another** (roles are per-course). Two personal Gmail accounts (one teacher, one student) can interact with each other; a personal-account student can only join a class whose primary teacher is also a personal account (or a Workspace org that allows it).
7. **Seeding:** the Classroom API can create coursework (`courses.courseWork.create`, scope `classroom.coursework.students`) but `courses.create` returns `PERMISSION_DENIED` for users "not permitted to create courses" — consumer `@gmail.com` accounts generally can't create courses via API, though they *can* create/teach classes in the Classroom UI. Seed assignments via UI (manual or recorded once) or with a Workspace for Education account.
8. **WXT output:** `wxt build` → `.output/chrome-mv3` (this repo: `pnpm -C extension build` → `extension/.output/chrome-mv3`). WXT's official E2E guide says Playwright is "the only good option for writing Chrome Extension end-to-end tests" and points at its `.output/chrome-mv3` dir. There is no `@wxt-dev/playwright` package — WXT defers to Playwright's chrome-extensions doc.
9. **Gate live tests behind env vars** (`QA_LIVE_CLASSROOM=1` pattern already in repo), use web-first assertions, `test.skip(condition, reason)` for missing auth, and keep live checks **read-only** — Playwright's own best-practice doc says "Only test what you control."

---

## Recommended architecture for CQD

```
tests/e2e/
  global-setup.ts            # builds extension → extension/.output/chrome-mv3 (exists)
  qa/harness.ts              # context launching + evidence (exists)
  live/
    live-profiles/           # .gitignore'd dedicated userDataDirs
      teacher-profile/       # manual login ONCE; session persists on disk
      student-profile/       # manual login ONCE (second Google account)
    live-auth.setup.ts       # verifies each profile still signed in (goto /u/0/h, expect not redirected to accounts.google.com)
    live-student.spec.ts     # student-role checks: open assignment with attachments, CQD injects, download buttons exist
    live-teacher.spec.ts     # teacher-role checks: class stream renders, attachments visible as teacher
```

Key decisions:

- **Two dedicated `userDataDir` profiles** (teacher / student), NOT `storageState` files, because persistent contexts ignore `storageState` (see Q2.3). Login happens once per profile, manually, headed:
  ```ts
  // scripts/live-login.ts — run once per role, headed, human types the password
  import { chromium } from '@playwright/test';
  const role = process.argv[2]; // "teacher" | "student"
  const ctx = await chromium.launchPersistentContext(`tests/e2e/live/live-profiles/${role}-profile`, {
    channel: 'chromium',
    headless: false,                       // headed: bot-detection-safe login
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-blink-features=AutomationControlled',
    ],
  });
  const page = await ctx.newPage();
  await page.goto('https://accounts.google.com/signin');
  console.log(`Log in as the ${role} account, then press Ctrl+C.`);
  await new Promise(() => {});            // keep open until human finishes + kills it
  ```
- **Test projects** stay as in the root `playwright.config.ts`; live specs live under `tests/e2e/live/` and are excluded from the default projects via `testIgnore`, or get their own `live-chromium` project that is only selected explicitly:
  ```bash
  pnpm -C extension build
  QA_LIVE_CLASSROOM=1 npx playwright test --project=extension-chromium tests/e2e/live
  ```
- **Skip when not authenticated** instead of failing:
  ```ts
  test.skip(!process.env.QA_LIVE_CLASSROOM || !fs.existsSync(profileDir), 'live tests are gated; see docs/research/live-classroom-e2e-testing.md');
  ```
- **Read-only discipline** (matches the existing qa-07 canary design): navigate, observe DOM, screenshot; no clicks on submit/delete controls; downloads go to a temp dir via `acceptDownloads`.

---

## Q1. Loading an unpacked Chrome extension in Playwright

**Source: https://playwright.dev/docs/chrome-extensions** (fetched 2026-09-19)

- The documented API is **`chromium.launchPersistentContext(userDataDir, {...})`**. The docs state extensions only work in Chromium **with a persistent context**, and warn: "Use custom browser args at your own risk, as some of them may break Playwright functionality."
- The two required flags (verbatim from the docs):
  ```
  --disable-extensions-except=${pathToExtension}
  --load-extension=${pathToExtension}
  ```
- Official example (verbatim, current docs):
  ```js
  const { chromium } = require('playwright');

  (async () => {
    const pathToExtension = require('path').join(__dirname, 'my-extension');
    const userDataDir = '/tmp/test-user-data-dir';
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    });
    let [serviceWorker] = browserContext.serviceWorkers();
    if (!serviceWorker)
      serviceWorker = await browserContext.waitForEvent('serviceworker');
    await browserContext.close();
  })();
  ```
- **Headless support:** the docs repeatedly note "the use of the chromium channel that allows to run extensions in headless mode." `channel: 'chromium'` selects Playwright's bundled new-headless Chromium. Per https://developer.chrome.com/docs/chromium/new-headless, Chrome 112 unified headless/headful ("Chrome now has unified Headless and headful modes"; the old headless "is only available as a standalone binary named chrome-headless-shell"), which is why extensions run under new headless but not `chrome-headless-shell`.
- **Branded Chrome/Edge can't side-load anymore:** the docs warn to use the bundled Chromium because Chrome/Edge removed the side-loading flags — starting Chrome 137, "Chrome-branded builds now deprecate the ability to load extensions via the --load-extension command-line flag" (Google: https://developer.chrome.com/blog/extensions-update-june-2025; Chromium 139 also removed `--disable-extensions-except`). **Chrome for Testing** and Chromium builds still honor the flags.
- **MV3 service workers:** `context.serviceWorkers()` + `context.waitForEvent('serviceworker')`; extension ID comes from `serviceWorker.url().split('/')[2]`. The docs also document MV3 worker idle suspension: workers suspend after ~30s idle and restart on demand; Playwright keeps the same `Worker` object across restarts, in-flight `evaluate()` calls resume, calls in flight at suspension throw "Service worker restarted".
- **MV2 background pages** are accessed via `context.backgroundPages()` (the MV2 counterpart of `serviceWorkers()`); CQD is MV3, so service workers are the relevant API.
- **`serviceWorkers` context option:** values `'allow' | 'block'`, **default `'allow'`** — "Whether to allow sites to register Service workers." With `'block'`, "Playwright will block all registration of Service Workers" (recommended only when using `context.route()` request interception, since routed requests bypass SWs). Keep the default `'allow'` for extension tests — the extension's own MV3 worker must register.
- **Playwright source note** (`packages/playwright-core/src/server/chromium/chromiumSwitches.ts`, fetched from GitHub main): Playwright's default Chromium switches include **`--disable-extensions`** plus a big `--disable-features=...` list, and do **not** include `--enable-automation`. The `--disable-extensions-except=` flag you pass is what re-enables your one extension despite the default. Nothing in the default switches touches `AutomationControlled` — see Q3.
- This repo already does all of this correctly in `playwright.config.ts` (projects `extension-chromium` / `extension-edge`, `EXTENSION_PATH = extension/.output/chrome-mv3`) and in `tests/e2e/extension-smoke.spec.ts` (`launchWithExtension()` helper).

## Q2. Reusing a real Google login across test runs

### 2.1 `launchPersistentContext` with a dedicated `userDataDir` — the recommended way

**Source: https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context** (fetched)

- The docs: `userDataDir` is a User Data Directory that "stores browser session data like cookies and local storage." Passing `''` yields a throwaway temp dir.
- **Session persistence: confirmed.** Because cookies/localStorage live in `userDataDir`, pointing every run at the same directory reuses the session. Caveats from the docs:
  - "browsers do not allow launching multiple instances with the same User Data Directory" — one run at a time per profile (the repo already sets `workers: 1` for the same reason).
  - Do **not** point at Chrome's default profile: automating Chrome's default user data dir isn't supported and "may cause pages to fail to load or the browser to exit." Use a separate, empty directory — which is exactly the dedicated-profile pattern.
- Practical flow: run a small headed script once (see "Recommended architecture" above), human logs in, session survives on disk; every later `launchPersistentContext(sameDir, { headless: true, ... })` is already signed in to classroom.google.com. Google session cookies (SID/HSID/SSID/SAPISID…) persist for weeks; re-login is needed only when Google expires the session or the profile is wiped.

### 2.2 `storageState` — works for contexts, **not** for persistent contexts (verified)

**Source: https://playwright.dev/docs/auth** (fetched)

- What it saves: "Reusing authenticated state covers **cookies, local storage, IndexedDB and passkey (WebAuthn) based authentication**." Session storage is not covered (domain-scoped, not persisted).
- Standard flow: a setup project logs in once, `await page.context().storageState({ path: authFile })`, then `browser.newContext({ storageState: 'playwright/.auth/user.json' })` per test. The docs warn auth files "may contain sensitive cookies" and must not be committed (`.gitignore` the `playwright/.auth` dir).
- **Does it work for Google login?** Only partially. The `storageState` *file itself* is fine — a signed-in session captured manually into `storageState` will carry Google's cookies. The blocker is **producing** it: automating the accounts.google.com login form is what Google blocks (2.4). You can capture `storageState` from a manual session, but you cannot reliably replay the *login flow* itself.
- **Critical empirical finding for this repo (Playwright 1.63.0, 2026-09-19):** `chromium.launchPersistentContext('', { ..., storageState: { cookies: [...], origins: [...] } })` **does not error and does not apply the state** — cookies are absent from `context.cookies()` afterwards, while the identical state passed to `browser.newContext()` works. The option is absent from the `launchPersistentContext` TypeScript options type (`playwright-core/types/types.d.ts`), and at runtime it is silently dropped.
  - **Consequence:** `tests/e2e/qa/qa-07-live-canary.spec.ts` launches `chromium.launchPersistentContext("", { storageState: STORAGE_STATE, ... })` — the storage state is ignored and the canary is not signed in. Fix by giving `launchPersistentContext` a **dedicated pre-authenticated `userDataDir`** instead (or, if a state file must be the source of truth, pre-seed it into the profile dir with a one-time script before launching).

### 2.3 Attaching to a running Chrome via CDP

**Source: https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp** (fetched)

- API (verbatim shape): `const browser = await playwright.chromium.connectOverCDP('http://localhost:9222');` — accepts "a CDP websocket endpoint or http url to connect to". The default context is `browser.contexts()[0]`; existing pages via `context.pages()`.
- Limitations (docs): CDP connection "is significantly lower fidelity than the Playwright protocol connection"; if you launched the browser yourself, "some of the Playwright functionality may be broken" unless you use Playwright's curated args. Options worth knowing: `slowMo`, `timeout`, `noDefaults` (v1.60: skips Playwright's default overrides on the existing default context — "useful when attaching to someone's daily-driver browser").
- **Chrome 136+ restriction (the key operational fact):** https://developer.chrome.com/blog/remote-debugging-port ("Changes to remote debugging switches to improve security", Will Harris, 2025-03-17): `--remote-debugging-port` / `--remote-debugging-pipe` "will no longer be respected if attempting to debug the default Chrome data directory" and "must now be accompanied by the --user-data-dir switch to point to a non-standard directory." Chrome prints an error of the form *"DevTools remote debugging requires a non-default data directory. Specify this using --user-data-dir."* (reported in Chromium issue tracker threads, May 2025). Motivation: infostealers abusing remote debugging to extract App-Bound-Encrypted cookies. The blog recommends browser automation use **Chrome for Testing**, "which will continue to respect the existing behavior."
- Practical launch command for a debuggable, logged-in profile (this is the only sanctioned CDP target):
  ```bash
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --user-data-dir="$PWD/.tmp/chrome-debug-profile" \
    --remote-debugging-port=9222
  # human logs in once in that window, then:
  #   const browser = await chromium.connectOverCDP('http://localhost:9222');
  ```
  Since Chrome 136 forces a custom `--user-data-dir` for debugging anyway, the "attach to my daily-driver profile" shortcut is dead — which removes the main reason to prefer CDP-attach over the dedicated-persistent-profile pattern.

### 2.4 Does Google block automated logins, and the sanctioned workaround

- Yes. Google's sign-in refuses browsers it classifies as automated with **"This browser or app may not be secure"** (long-standing Google Accounts support thread: https://support.google.com/accounts/thread/22873505). Detection keys on `navigator.webdriver`, automation flags/user-agent signatures, and headless shells; headless is detected more aggressively.
- Mirrored in Playwright's own tracker: https://github.com/microsoft/playwright/issues/32081 ("[Regression]: v1.45.1: Google login not working" — "The browser looks tagged as unsafe"), https://github.com/microsoft/playwright/issues/17622 ("Verify it's you" challenges on Google auth), https://github.com/microsoft/playwright/issues/18866.
- **Recommended workaround (durable): do not automate the login at all.** Log in manually once into a persistent profile (or capture `storageState` from that manual session) and reuse the session. Playwright's own docs steer this way via the setup-project auth pattern. Stealth tricks (`playwright-stealth`, patched UAs) break continuously as Google updates detection and are not worth building on.
- The repo's `E2E_HEADED=1` escape hatch (visible window) is the right debugging tool "if Google's bot heuristics ever object" — signed-in *use* of an already-authenticated session is far less suspicious than the *login flow*.

## Q3. Bot detection: what fires, what's legitimate

- **`navigator.webdriver`:** defined by the W3C WebDriver spec — "The webdriver-active flag is set to true when the user agent is under remote control" (https://www.w3.org/TR/webdriver/#dfn-webdriver-active-flag). **Verified empirically with this repo's Playwright 1.63.0 + `channel: 'chromium'`: `navigator.webdriver === true` on a stock launch, and passing `--disable-blink-features=AutomationControlled` makes it `false`.** The root `playwright.config.ts` and `extension-smoke.spec.ts` already pass this flag — keep it. (Playwright's default switch list contains no `--enable-automation`; the bundled Chromium enables the blink feature by default.)
- Other signals Google weighs: headless shell UAs, missing font/plugin entropy, CDP artifacts, IP reputation, and login-flow heuristics. `--disable-blink-features=AutomationControlled` removes the loudest one but is not a guarantee — another reason the pre-authenticated-profile strategy (never touching the login flow) is primary.
- **What's legitimate:** driving **your own Google account(s) with your own test data** (classes you create yourself, a second account you own as the "student"), at human-ish rates, with read-only or clearly-your-own-data mutations, is ordinary QA of your own integration — analogous to testing any site while logged in as yourself. Keep volumes low (a few page loads per run) so the account doesn't trip abuse heuristics; `test.setTimeout`/retries should not turn one run into hundreds of navigations.
- **What's against Google's ToS:** scraping other people's Classroom content, mass/parallel automation across accounts, automated downloads at scale from accounts you don't own, and evading detection to create accounts. Google's Terms ("Don't misuse our services", https://policies.google.com/terms) and the Classroom API terms prohibit circumventing rate limits and accessing data you're not entitled to. The existing repo discipline — dedicated non-primary account, `QA_LIVE_CLASSROOM=1` gate, "STRICTLY READ-ONLY" canary — is exactly the right posture; extend it to the student/teacher specs.
- Suggested policy line for the doc/code: *live tests run only against accounts we own, classes we created for testing, read-only unless the fixture was seeded by us, single worker, env-gated.*

## Q4. Student and teacher test fixtures on a real Google account

### 4.1 One account, two roles — yes

**Source: https://developers.google.com/workspace/classroom/guides/key-concepts/user-types** (fetched)

- Classroom defines four roles (Teacher, Student, Guardian, Administrator), and roles attach **per course**, not per account: "There is no guarantee that if a user is a teacher or student within an institution, they will have the same role set within a given [course]" — i.e., a single Google account can be the **teacher/owner of one class and a student in another**. This alone covers testing the extension's teacher-view vs student-view rendering with one account in two classes.
- Per the same page: "Teachers can create and manage Courses, CourseWork, CourseWorkMaterials, Announcements, attachments and grades"; "there can only be a single Course owner" and ownership transfers via `courses.patch()`. Only **administrators** may use `courses.teachers.create()` / `courses.students.create()` to add members directly — everyone else uses invites.

### 4.2 A second account as the student

- Personal `@gmail.com` accounts can use Classroom — Google's help page (https://support.google.com/edu/classroom/answer/7582372, "About Classroom user accounts") says a personal account is typical "outside of a school setting, such as a tutoring center or homeschool," with feature limits: "Students can't email classmates," "Teachers can't invite guardians to sign up for email summaries," "Children who have an account managed by a parent can't create or teach classes."
- **Cross-account joining constraint (same page, FAQ table):** when a personal-account user tries to join a class whose primary teacher uses Google Workspace for Education, the answer is "No" unless "the Google Workspace organization allows it." So for fixtures: **teacher account and student account should be the same type** — simplest is two personal Gmail accounts (or two accounts in the same test domain if you have one).
- Joining works via class code or invite: teacher reads the 6–7 character code from the class header; student goes to classroom.google.com → **+ → Join class** → enters code (https://support.google.com/edu/classroom/answer/15605102). The invite-link alternative arrives by email; the student must click **Accept**.

### 4.3 Seeding assignments with attachments

- As teacher (UI): Create → Assignment → attach files. Attachments can be **uploaded files** (stored in the class's Drive folder) or **Drive items** (Docs/Slides/PDF shared to the class). For downloader testing, seed a mix: a directly-uploaded PDF (Drive file), a Google Docs attachment (needs export), and a link-only item (no download) to exercise the extension's filtering.
- As teacher (API): `POST https://classroom.googleapis.com/v1/courses/{courseId}/courseWork` — `courses.courseWork.create` (https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/create, fetched). Scope: `https://www.googleapis.com/auth/classroom.coursework.students`. Error table includes `PERMISSION_DENIED` ("the user lacks access to the course, permission to create coursework, or permission to share Drive attachments") and `FAILED_PRECONDITION` with `AttachmentNotVisible`. Material types on coursework (https://developers.google.com/workspace/classroom/reference/rest/v1/Material): `driveFile`, `youtubeVideo`, `link`, `form` — i.e., API-seeded attachments are Drive-backed, which matches what the downloader sees.
- Note from the same doc: created coursework is linked to the OAuth client project that made it, and later modifications must use the same client — keep one seeding script/project if you go the API route.

### 4.4 What the API can and cannot do for seeding with personal accounts

- `courses.create` (`POST https://classroom.googleapis.com/v1/courses`, https://developers.google.com/workspace/classroom/reference/rest/v1/courses/create, fetched): scope `https://www.googleapis.com/auth/classroom.courses`; `PERMISSION_DENIED` if "the requesting user is not permitted to create courses"; `FAILED_PRECONDITION` with `UserCannotOwnCourse`, etc. In practice, **consumer `@gmail.com` accounts are generally refused by `courses.create`** (course creation via API is tied to Workspace for Education eligibility; community reports of PERMISSION_DENIED for consumer accounts: https://stackoverflow.com/questions/57676601/google-classroom-api-permission-denied) — even though the *same* account can create a class through the Classroom UI. So: **seed courses through the UI (manually, once — it's a fixture, not a per-run step), then use the API or UI for per-run coursework if needed.**
- Summarized eligibility for the doc: Classroom API *reads* work fine with consumer accounts you own; course *creation* via API is the restricted edge; `courses.list`/`courseWork.list` against UI-created courses is the reliable automation surface.

## Q5. Stability practices for live-site e2e tests

- **Web-first assertions** (https://playwright.dev/docs/best-practices, fetched): "By using web first assertions Playwright will wait until the expected condition is met" — `await expect(locator).toBeVisible()` retries; pulling `isVisible()` out of `expect` "will just check the locator is there and return immediately." Locators "come with auto waiting and retry-ability"; prefer role/text locators over brittle CSS ("Your DOM can easily change so having your tests depend on your DOM structure can lead to failing tests") — note our own `qa/harness.ts` `SELECTORS` intentionally pins a few obfuscated Classroom classes as the *product contract*; for live specs, assert on CQD's own stable classes (`button.cqd-download-btn`, `[data-cqd-injected="true"]`) plus loose structural probes, never on transient Google class names.
- **Don't test what you don't control** (same page): "Only test what you control. Don't try to test links to external sites or third party servers that you do not control." Live Classroom specs are a deliberate, gated exception (production-drift canary + integration smoke), not the main suite — keep them few, slow-tolerant (generous timeouts), and read-only.
- **Conditional skip for preconditions** (https://playwright.dev/docs/test-annotations, fetched): `test.skip(condition, description)` — e.g. `test.skip(!fs.existsSync(profileDir), 'no authenticated profile; run scripts/live-login.ts first')`; also usable as a fixture-aware callback form for describe blocks. The repo's canary already uses this idiom (env-gated + storage-state-present check — the check should become a profile-dir check per Q2.2).
- **Setup project + dependencies** (https://playwright.dev/docs/auth, fetched): a `setup` project (`testMatch: /.*\.setup\.ts/`) that verifies/refreshes auth, with `dependencies: ['setup']` on the dependent project — "This project will always run and authenticate before all the tests." For live tests the setup step should be a *verification* (session still valid?) that fails fast with a human-actionable message, since the actual login is manual.
- **Isolation & CI shape:** live specs on `workers: 1` (already set — also required because "browsers do not allow launching multiple instances with the same User Data Directory"), `retries: 0` or low, trace/screenshot on failure (already set), and a separate npm script (`test:live`) so `pnpm test:e2e` stays hermetic.
- **Browser-use / MCP-driven GUI testing as a complement:** for interactive one-off validation (e.g., "does the new button placement look right in the real teacher view?"), an agent-driven browser session (Playwright MCP / browser-use tooling) against the same persistent profile is the right tool — it's exactly the manual-QA step, scripted ad hoc. It complements, not replaces, the committed Playwright specs: use MCP for exploration and one-offs, use the gated specs for regression. (This mirrors the repo's existing split between committed `qa-XX` journeys and manual GUI checks.)

## Q6. WXT framework specifics

- **Build output:** `wxt build` writes the Chrome MV3 bundle to **`.output/chrome-mv3`**. WXT's E2E testing guide says, verbatim: when Playwright asks for the extension path, "use the WXT build output directory: `/path/to/project/.output/chrome-mv3`" (https://wxt.dev/guide/essentials/e2e-testing.html, fetched). In this repo: `pnpm -C extension build` → `extension/.output/chrome-mv3` (already wired as `EXTENSION_PATH` in the root `playwright.config.ts` and `CHROMIUM_EXTENSION_PATH` in `tests/e2e/qa/harness.ts`). Other targets: `-b firefox` → `.output/firefox-mv2`, `-b edge` → `.output/chrome-mv3` under the edge build (repo scripts `edge`/`firefox`/`chrome` wrap `wxt build -b ... && wxt zip -b ...`). `wxt dev` runs the dev server + auto-reloading extension.
- **Testing docs:** WXT has a **Unit Testing** guide (`wxt/testing/vitest-plugin`, the `WxtVitest()` plugin, `wxt prepare` for type stubs) and the **E2E Testing** guide. There is **no `@wxt-dev/playwright` package** — the E2E guide's entire recommendation is: Playwright is "the only good option for writing Chrome Extension end-to-end tests," follow https://playwright.dev/docs/chrome-extensions, and reference the `wxt-dev/examples` repo, `examples/playwright-e2e-testing`.
- Net: the repo's existing setup already *is* the canonical WXT-recommended Playwright integration; nothing needs to change on the WXT side to go live.

---

## Only the human can do this

Automation cannot perform these steps; a human must do each once:

- [ ] **Type the Google password** for the teacher account (and the student account) — automated logins are blocked by Google ("This browser or app may not be secure") and must never be scripted.
- [ ] **Complete 2FA / device prompts** (phone push, TOTP, "Verify it's you" challenges) during the one-time manual login into each persistent profile.
- [ ] **Create the second (student) Google account**, including recovery email/phone setup and any age/consent gates — account creation itself is gated by CAPTCHA/phone verification by design.
- [ ] **Accept the class invite / enter the class code** in the student account the first time (Classroom join flow is interactive and account-bound).
- [ ] **Optionally seed the first teacher class** (create class, post one assignment with a PDF + a Google Docs attachment) if not scripted via the UI/API — and decide the classroom "test data" conventions (naming like `CQD-E2E ...`).
- [ ] **Run the two one-time login scripts headed** (`node scripts/live-login.ts teacher` / `student`) and press Ctrl+C when signed in.
- [ ] **Re-login occasionally** when Google expires the sessions (signs of it: specs skip or land on `accounts.google.com`) — check "Verify it's you" security emails if Google challenges the test account.
- [ ] **Keep the test accounts safe**: mark them as test accounts (no real student data), and keep profile dirs and any captured `storageState` files out of git (`tests/e2e/live/live-profiles/`, `playwright/.auth/` in `.gitignore`).

## Source index

- Playwright — Chrome extensions: https://playwright.dev/docs/chrome-extensions
- Playwright — `browserType.launchPersistentContext`: https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context
- Playwright — `browserType.connectOverCDP`: https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp
- Playwright — Authentication / storageState / setup projects: https://playwright.dev/docs/auth
- Playwright — Best practices: https://playwright.dev/docs/best-practices
- Playwright — Annotations (`test.skip`): https://playwright.dev/docs/test-annotations
- Playwright source — default Chromium switches (`--disable-extensions`, no `--enable-automation`): https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/chromium/chromiumSwitches.ts
- Playwright issues — Google sign-in: https://github.com/microsoft/playwright/issues/32081, https://github.com/microsoft/playwright/issues/17622, https://github.com/microsoft/playwright/issues/18866
- Chrome blog — remote debugging switches (Chrome 136): https://developer.chrome.com/blog/remote-debugging-port
- Chrome blog — `--load-extension` removal (Chrome 137): https://developer.chrome.com/blog/extensions-update-june-2025
- Chrome docs — unified/new headless: https://developer.chrome.com/docs/chromium/new-headless
- W3C WebDriver spec — `webdriver-active` flag: https://www.w3.org/TR/webdriver/#dfn-webdriver-active-flag
- Google support — "This browser or app may not be secure": https://support.google.com/accounts/thread/22873505
- Google Classroom developer docs — user types/roles: https://developers.google.com/workspace/classroom/guides/key-concepts/user-types
- Google Classroom API — `courses.create`: https://developers.google.com/workspace/classroom/reference/rest/v1/courses/create
- Google Classroom API — `courses.courseWork.create`: https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/create
- Google Classroom API — `Material` types: https://developers.google.com/workspace/classroom/reference/rest/v1/Material
- Google support — About Classroom user accounts (personal account capabilities/joining matrix): https://support.google.com/edu/classroom/answer/7582372
- Google support — Join a class with a class code: https://support.google.com/edu/classroom/answer/15605102
- WXT — E2E testing guide (`.output/chrome-mv3`): https://wxt.dev/guide/essentials/e2e-testing.html
- WXT — docs index / unit testing: https://wxt.dev/ , https://wxt.dev/guide/essentials/unit-testing.html
- Community — Classroom API PERMISSION_DENIED with consumer accounts: https://stackoverflow.com/questions/57676601/google-classroom-api-permission-denied
