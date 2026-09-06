# Compare Mode Runbook

How to run the two detection engines side by side and read the evidence.

> Compare mode exists to answer one question: **can the structural engine be
> trusted instead of the keyword engine?** It is built to produce data, not to
> ship. Nothing here reaches users.

---

## 1. Build it

```bash
pnpm -C extension build:compare
```

Output lands in **`extension/.output/chrome-mv3-compare/`** — a separate
directory from the normal `chrome-mv3/` build, so a compare build can never be
mistaken for or zipped as a store artifact.

Load it unpacked: `chrome://extensions` → Developer mode → Load unpacked →
select `extension/.output/chrome-mv3-compare/`.

## 2. What you will see

Every scanned post gets a second badge, prefixed `S:`, rendered **over** the
production badge in the structural palette (purple primary, nile green
secondary). Both badges sit in the same position at 50% opacity.

- **Blended colour** — both engines agree.
- **Pure single hue** — only one engine found the post.

That is the whole visual design: overlap, not offset, so disagreement is
obvious without reading anything.

## 3. Read the numbers

In DevTools console on a Classroom page:

```js
window.__cqd.report()
```

Prints:

- posts scanned
- per-signal tallies: agree / disagree / **unavailable**, and an agreement rate
- per-engine mean and median latency
- a table of disagreements with post ids

Also available:

```js
window.__cqd.records()  // raw ComparisonRecord[] — plain JSON
window.__cqd.reset()    // clear the collector
```

Live output appears as one collapsed group per post, tagged `[CQD-COMPARE]`.
Filter the console by that string.

## 4. How to read it honestly

### `unavailable` is not agreement

The structural engine **cannot detect "edited" at all**. There is no structural
signal for it in any DOM we hold — `Edited Mar 10`, `تم التعديل في ١٠ مارس` and
`Posted Nov 6, 2025` all sit in an identical `.meta-row`. Only the words differ.

So every edited signal reports `unavailable`, and the agreement rate for edited
is `null` — not 100%, not 0%. Agreement rate is computed over signals **both**
engines could evaluate. If that bucket is empty there is no rate to report.

Expect `edited.unavailable` to equal the post count. That is the correct
result, not a bug, and it quantifies exactly what #396/#673 real captures need
to resolve.

### Timings are relative only

Both engines contend for the same main thread, so absolute milliseconds are
inflated. Compare keyword-vs-structural to each other; do not quote the
absolute numbers as production latency. The report prints this caveat itself.

### The fixtures cannot decide promotion

The 9 committed fixtures cover 8 ViewKinds, English and Arabic. Promotion needs
compare-mode runs on **real Classroom pages in several languages**. Anything
else is measuring our own synthetic DOM back at us.

## 5. Pages worth visiting

| Route | Why |
|---|---|
| `/c/{classId}` (stream) | The main case: posts with and without comments |
| `/c/{classId}/p/{postId}` | Announcement detail — has a comment shell with *no* comments, the false-positive trap |
| `/w/{classId}/t/all` | Classwork list — different card structure |
| `/c/{classId}/a/{itemId}/details` | Assignment detail — no post cards at all |
| Any of the above with Classroom UI language set to a non-Latin script | The structural engine should be unaffected; the keyword engine is the one at risk |

Switch the Classroom interface language between runs and call `reset()` in
between so each language gets its own report.

## 6. Promotion thresholds

Starting reference, from `PRD_ENGINE_REFACTOR.md` §7:

- ≥ 99.5% coverage
- ≥ 98% precision

These are a **starting reference, not a decision rule**. The point of compare
mode is to set real thresholds from real data. Do not promote on the fixture
numbers, and do not promote a signal whose bucket is entirely `unavailable`.

## 7. What compare mode is not

- Not reachable from the popup, storage, or any runtime setting. It is a build
  flag (`import.meta.env.MODE === 'compare'`), checked at the call site so Vite
  folds it to `if (false)` in normal builds.
- Not shipped. Verified per build: the production bundle contains no `__cqd`
  global, no `[CQD-COMPARE]` logging and none of the compare CSS. A couple of
  compare class-name string literals survive in a module that is registered but
  never invoked — inert, and worth knowing about rather than claiming a
  byte-perfect strip.
- Not a replacement for the golden suite. It measures agreement between
  engines, not correctness of either.

---

Design: `docs/superpowers/specs/2026-08-16-detection-engine-seam-design.md`
Plan: `docs/superpowers/plans/2026-08-20-detection-engine-seam-plan-b.md`
