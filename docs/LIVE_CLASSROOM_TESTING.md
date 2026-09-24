# Live Real-Classroom Testing Runbook

Last updated: 2026-09-19

## Goal

Run CQD's browser tests against the **real** https://classroom.google.com with a
**real** signed-in Google account — in both the **student** and the **teacher**
position — and verify real downloads of real attachments land on disk.

This is the layer the simulator-based QA suite (`tests/e2e/qa/`, local MITM
proxy) cannot cover: production DOM drift, real Drive download URLs, real
Google session behavior, real multi-account routing (`/u/0`, `/u/1`).

Everything is automated except what only a human can do (one manual Google
sign-in per account, and one-time sandbox seeding). Research with primary
sources: [live-classroom-e2e-testing.md](research/live-classroom-e2e-testing.md).

## How it works (one paragraph)

A dedicated Chrome profile lives at `tests/e2e/.live-profile` (gitignored).
You sign into your Google account(s) there **once**, by hand, in a window the
login tool opens — Google blocks scripted logins, and that is the only step
that needs you. Every later test run launches the built extension on that
profile headlessly and reuses the session cookies. The specs discover your
real classes, detect which role your account has in each (teacher-only DOM
signals), then exercise CQD on real attachment cards and verify downloads
through the extension's service worker (`chrome.downloads.search` → real file
path + byte size on disk).

## Safety and scope (read this once)

1. **Own account, own data only.** The suites navigate, inspect the DOM, and
   download files the signed-in account can already see. They never post,
   submit, grade, return, or delete anything.
2. **Never in CI.** The browser suites are gated by `LIVE_CLASSROOM=1` and
   only ever run on your machine. CI keeps the offline parser unit tests.
3. **Never commit the profile or artifacts.** `tests/e2e/.live-profile/` and
   `qa-artifacts/` are gitignored — they contain a live Google session and
   your real class names, respectively.
4. **Keep runs low-frequency** (a few times a day at most) — it is your real
   account driving a real product; do not look like an scraper.
5. The dedicated profile is **not** your daily browser profile. Never point
   `--profile`/`LIVE_PROFILE` at the daily one (Chrome 136+ also refuses
   remote debugging on default profiles by design).

## One-time setup — the steps only you can do

### 1. Accounts and roles

Pick one of these layouts; both work with one browser profile (Google
multi-login):

- **Two accounts (recommended):** account A owns a class as teacher; account B
  joins it as a student. Teacher tests run as `u/0`, student tests as `u/1`
  (order configurable).
- **One account, both roles:** your account is the **teacher** of one class
  and a **student** in another (any class you joined via code). Then only
  `u/0` exists and both suites pick different classes from discovery.

Personal `@gmail.com` accounts can create classes, invite, and join — no
Workspace needed (there are per-account class-count limits; one sandbox class
is fine).

### 2. Seed the sandbox classroom (~5 minutes)

In a normal browser, signed in as the **teacher** account:

1. classroom.google.com → **+** (top right) → **Create class** → name it
   e.g. `CQD Live Sandbox` → Create.
2. **Classwork** → **+ Create** → **Assignment** → title `CQD Download Test`
   → attach **2 files from Drive** (a small PDF and a second file — PDFs give
   the cleanest direct-download URLs) → **Assign**.
3. Post one **announcement** on the stream with **one Drive attachment**
   (stream injection test).
4. Copy the **class code** (stream header, or People → invite code) — share
   it to the student account.

Signed in as the **student** account:

5. classroom.google.com → **+** → **Join class** → enter the code.
6. *(Optional, enables the teacher student-work test)*: open `CQD Download
   Test` → **+ Add or create** under "Your work" → attach any small file →
   **Mark as done** / Turn in.

### 3. One-time login (the manual step)

```bash
pnpm test:live:login
```

A real Chromium window opens on the dedicated profile with the extension
loaded. For each account (default `u/0` then `u/1`; single account: pass
`--authusers 0`), sign in inside that window — password and 2FA included.
The tool watches the URL and confirms each session automatically, then writes
`tests/e2e/.live-profile/state.json` and exits.

```bash
node tools/live-classroom-login.mjs --authusers 0,1 --timeout 600
```

### 4. Discover your real classes and roles

```bash
pnpm test:live:discovery
```

Walks the real Classroom home, visits each class, classifies the role
(teacher-only signals: the announce compose box, the classwork Create button;
English + Arabic locales; anything else degrades to `unknown`), screenshots
each page, and writes `qa-artifacts/live/classes.json`:

```
[live-discovery] CQD Live Sandbox: role=teacher (teacher: stream compose box ...)
[live-discovery] Physics 101: role=student (valid class shell, no teacher-only signals)
```

### 5. Run the live suites

```bash
pnpm test:live            # everything: auth → discovery → student → teacher
pnpm test:live:headed     # same, in a visible window (first run recommended)
pnpm test:live:student    # student role only
pnpm test:live:teacher    # teacher role only
pnpm test:live:auth       # profile/session check only
pnpm test:live:unit       # offline parser tests (no Google, no gate) — CI-safe
```

## What each suite proves

| Suite | Real-world proof |
| --- | --- |
| `live-auth` | The profile holds a live Google session per authuser; records which account is which. |
| `live-discovery` | Real class cards parse; role detection classifies every class as teacher/student (no `unknown` allowed). |
| `live-student` | On a real student-enrolled assignment: exactly one CQD button per real attachment card; a click produces a **real file on disk** (bytes > 0); download-all fetches all of them. |
| `live-teacher` | The class really shows teacher-only UI; CQD injects on teacher views; teacher downloads work; the student-work view injects and downloads a **real submitted file** (needs the optional seed step 6). |
| `parse.spec.ts` | Offline proof of every parser/counter/role signal, en + ar — the CI-safe drift net. |
| `language-reconcile.spec.ts` | Engine keyword lists audited against real Classroom strings (en + ar from committed fixtures on every run; every captured language after `test:live:langs`). |

## Language corpus capture — real words for the detection engine

The keyword engine (`extension/entrypoints/content/detection-keywords.ts`)
matches Classroom's localized strings ("class comments", "Edited", …) per
page language. Its per-language lists were written without ground truth for
most languages. The language pipeline fixes that with real renderings:

```bash
pnpm test:live:langs          # capture corpus (signed in; resumable; read-only)
pnpm test:live:langs:audit    # audit engine lists vs captured strings
```

- `test:live:langs` first probes whether Classroom honors the `?hl=` URL
  parameter (the rendered `<html lang>` is the judge). When it does — the
  common case on Google surfaces — capture never touches account settings and
  is reversible by construction. Each language renders home → stream →
  classwork → first assignment details and records every visible text +
  aria-label into `qa-artifacts/live-languages/corpus/<lang>.json`; codes
  Google refuses are recorded as rejected in `index.json`. If the `?hl=`
  probe fails, the tool exits with code 2 — account-language automation
  (myaccount.google.com/language) writes to account settings and stays a
  deliberate follow-up, not a silent fallback.
- `test:live:langs:audit` audits the engine's comment/edited keyword lists
  for every captured language and writes `qa-artifacts/live-languages/
  audit.json` + `AUDIT.md` (verified / not-rendered per language). The audit
  also runs WITHOUT any capture for English and Arabic, against the committed
  real Classroom fixtures — those assertions run in CI. Audit lines look
  like:

  ```
  [lang-audit] en comment verified: comments, class comment, class comments
  [lang-audit] en edited not-rendered-in-fixtures: (edited), modified, last modified, modification, last edit
  [lang-audit] ar comment verified: تعليق, تعليقات, تعليقًا, تعليقات صفية
  ```

  "not-rendered" is not a failure — it means the corpus pages didn't show
  that phrase (the engine may legitimately keep it as superset). The
  language-stack doc [TWO_LANGUAGE_SIGNALS.md](TWO_LANGUAGE_SIGNALS.md)
  records the current verified inventory.
- For a complete comment-string corpus, seed the sandbox class with one post
  that has comments and one edited post (setup steps 2 and 6 help).

Verified so far (real data, committed fixtures): English `class comments`,
`no class comments`, `class comment`, `Edited <date>`; Arabic
`٥ تعليقات صفية`, `تم التعديل في ١٠ مارس`. A documented gap: the engine never
lists the empty state "No class comments" explicitly (it still matches via
the token "comments").

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `LIVE_CLASSROOM` | unset | Gate — must be `1` to run any browser live suite. |
| `LIVE_AUTHUSERS` | `0,1` | Authuser indexes probed by the auth suite. |
| `LIVE_DISCOVERY_AUTHUSER` | `0` | Which account discovery runs as. |
| `LIVE_STUDENT_CLASS_ID` / `LIVE_TEACHER_CLASS_ID` | from discovery | Pin a class by its `/c/<id>` segment. |
| `LIVE_STUDENT_AUTHUSER` / `LIVE_TEACHER_AUTHUSER` | `0` | Which account holds that role. |
| `LIVE_MAX_CLASSES` | `10` | Discovery cap. |
| `LIVE_MAX_ASSIGNMENTS` | `4` | Classwork walk cap per class. |
| `LIVE_CHANNEL` | `chromium` | Browser build. Keep `chromium` — branded Chrome 137+ refuses `--load-extension`. |
| `LIVE_CAPTURE_AUTHUSER` | `0` | Which account the language capture runs as. |
| `E2E_HEADED` | unset | `1` = visible window (also used by the rest of the repo). |

## Evidence artifacts

Everything lands under `qa-artifacts/live/<run-id>/` (gitignored):
screenshots per step, `accounts.json`, `discovery.json`,
`download-outcome.json` (downloaded filename, byte size, mime, on-disk
verification), `student-work-download.json`, and the fetched files under
`downloads/`. Stable cross-run copies used between suites:
`qa-artifacts/live/classes.json` and `qa-artifacts/live/accounts.json`.

## Troubleshooting

- **`no live profile at ...`** — run `pnpm test:live:login` once.
- **Auth reports `edu.google.com/...`** — that account is signed out (an
  unauthenticated Classroom visit lands on the marketing page now, not the
  sign-in form). Re-run the login tool; valid accounts confirm instantly.
- **Google interstitials / "unusual traffic"** — run headed
  (`pnpm test:live:headed`), complete any captcha by hand once, keep runs
  low-frequency.
- **Role `unknown` in discovery** — the class page didn't render as a class
  (slow load or DOM drift). Check `qa-artifacts/live/*/discovery/class-*.png`,
  re-run, and if it persists update the shell/role signals in
  `tests/e2e/live/parse.ts` (they are unit-tested in `parse.spec.ts`).
- **`no assignment with Drive attachments`** — seed the sandbox assignment
  (setup step 2), or raise `LIVE_MAX_ASSIGNMENTS`.
- **Student-work test skips** — the student account hasn't submitted a file;
  do setup step 6 once.
- **Wrong account picked for a role** — set `LIVE_STUDENT_AUTHUSER` /
  `LIVE_TEACHER_AUTHUSER`, or reorder logins in the login tool.
- **Downloads verified where?** `chrome.downloads.search` reports the real
  absolute path in the artifact; the harness re-checks existence and size from
  the test process before counting it as verified.

## Relationship to the rest of the test stack

1. `tests/e2e/qa/` — full functional QA against the local simulator
   (deterministic, CI, no account).
2. `tests/e2e/live/` — this runbook: real site, real session, real downloads
   (gated, local machine only).
3. `tests/e2e/qa/qa-07-live-canary.spec.ts` — the older read-only production
   drift canary (note: its storageState option is silently ignored by
   `launchPersistentContext` — tracked in beads; the live harness's dedicated
   profile is the supported way to run signed-in).
4. `extension/tests/` — golden/regression suites on captured fixtures
   (see [EXTENSION_TESTING_RUNBOOK.md](EXTENSION_TESTING_RUNBOOK.md) and
   [CLASSROOM_FIXTURE_CAPTURE_GUIDE.md](CLASSROOM_FIXTURE_CAPTURE_GUIDE.md)).
