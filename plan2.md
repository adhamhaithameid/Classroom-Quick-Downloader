# Extension Plan 2 — Practical To-Do Checklist

Last updated: 2026-03-11

## What This File Is

This is the practical, human-readable extension plan.
It is written as a to-do list instead of a pure architecture document.

The goal is to answer three questions clearly:

1. what still needs to be done,
2. why that work matters,
3. what effect it will have if we do it.

## Release Naming Decision

Use this version mapping going forward:

- `1.5.0` = the big DOM-first engine milestone and current "strong stable" line.
- `1.6.0` = any true API-assisted engine milestone.

This means:

- there is **no** `4.0.0` target anymore,
- there is **no** `4.2.1` target anymore,
- API work is not just a rename or internal tweak; it is a real release step and should earn a full version move to `1.6.0`.

## Important Current-State Note

The extension is currently in a very good state.

You already said the current behavior feels right:

- button placements feel correct,
- flag placements feel correct,
- flag detection feels correct,
- the extension feels like it "just works".

Because of that, not every item below is urgent.
A lot of this plan is now about **protecting what works**, **documenting why it works**, and **making future changes safer**.

## Operating Rule For The Current Release Line

For the current `1.5.0` line, use this rule:

1. treat the current runtime behavior as the product baseline,
2. protect that baseline with fixtures and regression tests,
3. add new fixtures only when Classroom changes or a real bug reveals a missing shape,
4. avoid touching the runtime just to "improve" code that is already behaving correctly.

This keeps us from turning a strong release line into an unnecessary rewrite.

## Progress Snapshot — Test/Documentation Hardening

Completed in the current hardening pass:

1. a real non-Arc Classroom baseline was captured and recorded under `verification/baseline/2026-03-10/`,
2. committed sanitized fixtures now lock current good button and flag behavior,
3. extension-only regression, fuzz, stress, and visual suites were added,
4. CI now runs the extension golden suites explicitly,
5. dedicated testing and fixture-capture docs were added,
6. the current `1.5.0` behavior is now the documented product baseline,
7. the rule is now explicit: add new fixtures only when Classroom changes or a real bug reveals a missing shape.

What still remains from the larger engine plan:

1. Student Work support,
2. runtime consolidation under V2,
3. attachment classification / canonical identity,
4. any future API-assisted `1.6.0` work.

---

## Priority 1 — Protect The Current Good State

These are the safest and highest-value tasks.
If you only do a few things from this file, do these first.

### [x] 1. Capture a real Classroom baseline fixture set

What this means:
- Save sanitized HTML snapshots and screenshots from real Google Classroom pages that currently work well.
- Cover the exact surfaces that matter most: stream, classwork list, material details, assignment details, and at least one page with flags.

Why do it:
- Right now the extension works well, but that good state is still mostly "live behavior" instead of a frozen baseline.
- Without fixtures, future fixes can accidentally break a perfect setup and we only notice later.

Effect if completed:
- You get a permanent safety net.
- Every future selector or detection change can be tested against real pages that are known-good.
- Regressions become cheaper to catch.

Can this be skipped for now:
- Not recommended.
- This is the best "insurance policy" task in the whole plan.

### [x] 2. Turn current good behavior into regression tests

What this means:
- Convert the known-good button placements, flag placements, and false-positive exclusions into test fixtures and assertions.
- Examples:
  - a real PDF/material card should get a button,
  - a Google Form link should not get a button,
  - a Google Sheet link should not get a button,
  - a correctly flagged post should render exactly one outer flag treatment.

Why do it:
- The extension is finally behaving the way you want.
- The next job is to lock that behavior in.

Effect if completed:
- Future work becomes much safer.
- "It used to work better before" stops becoming a mystery.

Can this be skipped for now:
- Only if no more core engine work is planned.
- If the engine will keep evolving, this should be done.

Maintenance rule from now on:

1. do not keep adding fixtures just because we can,
2. add them only when Classroom changes or when a real bug uncovers a gap,
3. prefer expanding the golden matrix only when there is a concrete new shape to protect.

### [ ] 3. Build a small decision trace for each post/file

What this means:
- When the extension chooses to inject or not inject something, record the reason in a debug-friendly format.
- Examples of useful trace output:
  - why a file was treated as downloadable,
  - why a link was rejected,
  - why a comment flag was shown,
  - what exclusion rule blocked a false positive.

Why do it:
- The current system works well now, but future issues will be much easier to debug if every decision is explainable.

Effect if completed:
- Faster debugging.
- Less trial-and-error selector work.
- Safer future refactors.

Can this be skipped for now:
- Yes, if the extension remains in maintenance mode.
- No, if deeper engine work is still planned.

---

## Priority 2 — Make The Current Runtime Cleaner Under The Hood

These tasks are valuable, but they matter more for maintainability than for immediate user-visible gains.

### [ ] 4. Finish the V2 migration under the hood

What this means:
- Move remaining runtime responsibility toward one shared V2-style lifecycle instead of several independent legacy scripts.
- The extension can still look the same to users while the internals become cleaner.

Why do it:
- Right now, a lot of the architecture exists, but the old and new systems still overlap.
- That overlap makes future changes riskier and harder to reason about.

Effect if completed:
- Simpler mental model.
- Lower long-term maintenance cost.
- Fewer race conditions and fewer "which script owns this?" moments.

Can this be skipped for now:
- Yes, if the extension is mostly feature-frozen.
- No, if more core behavior changes are still expected.

### [ ] 5. Unify mutation observation and lifecycle ownership

What this means:
- Move toward one shared observer/lifecycle owner instead of several independent observers and heartbeats.

Why do it:
- Multiple independent scanners cost CPU and make timing problems harder to understand.

Effect if completed:
- Better performance on large Classroom pages.
- Lower DOM observation cost.
- Cleaner start/stop behavior across navigation.

Can this be skipped for now:
- Yes, if performance already feels fine and development is slowing down.
- Still worth doing eventually.

### [ ] 6. Keep legacy behavior as rollback only

What this means:
- The old path stays available as a safety fallback, but it stops being the main architecture to build new work on.

Why do it:
- A fallback is useful.
- Building on two different systems forever is not.

Effect if completed:
- Clearer ownership of behavior.
- Less duplicated logic.
- Safer future releases.

Can this be skipped for now:
- Temporarily yes.
- Long term no.

---

## Priority 3 — Smarter Download Detection

These tasks matter if you want to make the engine more intelligent rather than just "good enough".

### [ ] 7. Add first-class attachment classification

What this means:
- Every discovered target should be classified as one of:
  - downloadable file,
  - open-only resource,
  - unsupported resource,
  - unknown.

Why do it:
- This is the cleanest way to stop random buttons from appearing on the wrong link types.
- It also gives the engine a clearer model for future APIs and future page types.

Effect if completed:
- Fewer false positives.
- Cleaner logic.
- Easier future support for things like "Open" actions on Forms/YouTube.
- The extension stops asking "does this URL look maybe okay?" and starts saying
  "this is definitely a downloadable file" or "this is definitely not."

Can this be skipped for now:
- Only if the current false-positive rate stays near zero.
- This is still the next smartest engine improvement.

### [ ] 8. Enforce canonical file identity everywhere

What this means:
- Every attachment should resolve to one stable internal identity, preferably from:
  1. `data-drive-id`,
  2. parsed Drive/docs file ID,
  3. normalized viewer-derived ID,
  4. URL hash fallback.

Why do it:
- Canonical IDs are what make dedupe, grouping, and stable behavior possible.

Effect if completed:
- Better Download All grouping.
- Fewer duplicates.
- Better confidence in future API reconciliation.

Can this be skipped for now:
- Partially, because some of this already exists.
- Still worth hardening if more engine work continues.

### [ ] 9. Close the Student Work gap

What this means:
- Support the pages and flows where Classroom hides the real file behind student-work / viewer / indirect routing.

Why do it:
- This is one of the biggest real functional gaps left if broader coverage is the goal.

Effect if completed:
- More files become downloadable.
- Fewer "why didn’t CQD catch this file?" cases.

Can this be skipped for now:
- Yes, if your daily use does not depend on Student Work pages.
- No, if completeness matters.

### [ ] 10. Expand page coverage only where it actually matters

What this means:
- Instead of chasing every possible Classroom page immediately, prioritize the pages users actually use and report issues on.

Why do it:
- The extension already feels strong in its main flow.
- This keeps expansion practical instead of theoretical.

Effect if completed:
- Better ROI on engine work.
- Less wasted effort on rare page types.

Can this be skipped for now:
- Yes, if current usage coverage already satisfies you.

---

## Priority 4 — Smarter Flag Detection

These tasks matter if you want flag logic to become more explainable and future-proof, not just visually correct right now.

### [ ] 11. Unify comment + edited + both into one decision model

What this means:
- One scoring/exclusion system should own the full verdict instead of separate paths trying to coordinate after the fact.

Why do it:
- It reduces weird interaction bugs.
- It makes "both" logic cleaner.

Effect if completed:
- Cleaner behavior.
- Easier debugging.
- Fewer edge-case race conditions.

Can this be skipped for now:
- Yes, if current flags feel perfect and you do not want to touch a stable area.

### [ ] 12. Keep flag exclusions explicit and test-backed

What this means:
- Keep a clear, shared set of rules for what should *not* count as a comment/edit signal.

Why do it:
- Most flag bugs come from the engine detecting user text, action labels, menus, or nearby UI noise.

Effect if completed:
- Lower false-positive rate.
- Better trust in the badges.

Can this be skipped for now:
- Only if no new flag regressions appear.

### [ ] 13. Make dark mode / RTL / long posts first-class validation cases

What this means:
- Treat them as required regression cases, not bonus compatibility work.

Why do it:
- These are the kinds of environments where visually correct logic often breaks quietly.

Effect if completed:
- Better global reliability.
- Fewer UI edge-case regressions.

Can this be skipped for now:
- Only if those environments are not important to your users.

---

## Priority 5 — Security Hardening

These are the "stay safe while changing things" tasks.

### [ ] 14. Keep strict download URL validation

What this means:
- Continue validating hosts, URL shape, redirects, and allowed file targets before creating or using a download URL.

Why do it:
- Download features are sensitive by nature.
- A loose validator is a long-term risk.

Effect if completed:
- Lower security risk.
- Fewer malformed-target bugs.

Can this be skipped for now:
- No. This should remain part of the baseline.

### [ ] 15. Treat DOM evidence as untrusted

What this means:
- Do not trust random page text or random attributes unless they match known safe patterns.

Why do it:
- Google Classroom pages contain lots of user-generated content and shifting UI text.

Effect if completed:
- Fewer logic mistakes.
- Safer future engine changes.

Can this be skipped for now:
- No. This should stay as a design rule.

### [ ] 16. Keep fixture sanitization strict

What this means:
- Any captured Classroom HTML must be scrubbed before living in the repo.

Why do it:
- Real Classroom pages can contain names, emails, file IDs, image URLs, and account details.

Effect if completed:
- Safer repo hygiene.
- Lower accidental privacy leakage.

Can this be skipped for now:
- No, if fixtures are going to be used.

---

## Priority 6 — API-Enhanced Engine (`1.6.0`)

This is intentionally later.
Do not start it just because it sounds smarter.
Start it only if the DOM-first line reaches a real ceiling.

### [ ] 17. Decide whether API work is actually needed

What this means:
- Ask a simple question: is the DOM-first engine still missing important real-world files or not?

Why do it:
- API work adds complexity, consent, permissions, and store-review risk.

Effect if completed:
- Better decision making.
- Less risk of building unnecessary complexity.

Can this be skipped for now:
- Yes. If the current extension already feels perfect, this can stay deferred.

### [ ] 18. Design the OAuth consent flow before writing API logic

What this means:
- If `identity` is ever added, the user-facing consent flow, denial behavior, and fallback path must be designed first.

Why do it:
- Permission changes are product changes, not just code changes.

Effect if completed:
- Cleaner rollout.
- Safer browser-store review.
- Better user trust.

Can this be skipped for now:
- Yes, until API work is truly needed.

### [ ] 19. Use API as inventory truth, not as placement truth

What this means:
- Even in `1.6.0`, the API should help discover what exists, while the DOM still decides where UI goes.

Why do it:
- APIs are great at inventory.
- DOM is still better at matching what the user is actually looking at.

Effect if completed:
- Best hybrid architecture.
- Fewer placement mistakes.
- Stronger future resilience.

Can this be skipped for now:
- Yes, until API work begins.

---

## Suggested Practical Order From Here

If you want the most practical order, do this:

1. preserve the current `1.5.0` baseline,
2. add first-class attachment classification,
3. close Student Work only if it matters to your usage,
4. finish under-the-hood V2 consolidation only if more core work is still planned,
5. defer API work until the DOM-first line proves insufficient.

## Short Recommendation

Because the extension currently feels excellent, the best next move is **not** a huge rewrite.

The best next move is:

1. protect the current behavior,
2. document why it works,
3. only then decide whether deeper engine work is worth the risk.
