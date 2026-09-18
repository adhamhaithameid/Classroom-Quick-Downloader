# AI / Search Visibility Log

Baseline and monthly spot-checks for the query set from the AEO audit
(`LAUNCH_PACKAGE.md` §9). Method: web-search retrieval checks (Google-flavored)
run by the agent; ChatGPT / Perplexity spot-checks are manual runs by the
human. Per the ai-seo methodology, single runs are anecdotes — track presence
over time, not one result. Three of four planned queries completed this
baseline (two runs timed out); note the n per entry.

## Baseline — 2026-09-13

### Query: "Google Classroom bulk downloader extension" — n=1

- **CQD: retrieved FIRST and recommended.** Chrome Web Store listing + official site both surfaced.
- ⚠️ **Indexed description is the stale pre-correction copy** ("Free, open-source extension…"). The corrected source-available wording is merged in the working tree but NOT deployed — deploy makes the indexed copy truthful.
- ⚠️ The surfaced store URL in the answer (`…/detail/bulk-file-downloader/oehppfijdgkgmfjnecnliihfdepegejk`) does not match the known listing ID (`…/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid`). Could be a search-index synthesis artifact or a stale/second listing — **verify in the Chrome Web Store console** (also check no old listing lingers).
- Competitors present: [ClassMate](https://classmateextension.dev/), [ClassFetch](https://github.com/DeeptejD/ClassFetch), StudEaz (GitHub), a bookmarklet, and Google Takeout (official method).
- Reddit threads (r/DataHoarder, r/GoogleClassroom) appear for the intent — community-answer targets per the launch plan.

### Query: "Classroom Quick Downloader safe permissions" — n=1

- **CQD: entity present across all three store listings + official site.**
- ⚠️ Answer leans on the stale "open-source" claim for trust.
- ⚠️ **AMO listing copy overpromises** ("Automatically handles Google Drive permissions", "bypasses virus scan warnings"). Suggested tightening in `STORE_LISTINGS.md`: "Handles Drive's 'can't scan for viruses' interstitial during your downloads — only for files you already have access to." Refresh at the v1.6.0 listing update (bd cuo).
- Positive: answer correctly advises verifying permissions on the store page and installing only from official listings.

### Query: "how to download all attachments from Google Classroom assignment" — n=1

- **CQD flagship guide: retrieved FIRST, with the page's numbered steps extracted verbatim into the answer** (open Classroom → Download All → browser queues). This is the AEO target outcome.
- Also present: ClassMate tutorial, a JS-console gist (GitHub), Google Support archive method, YouTube tutorials.

### Not completed this baseline

- "download all files from Google Classroom" and "Can I bulk download Google Classroom files?" — tool timeouts; re-run next month.
- ChatGPT / Perplexity manual runs — human task; record citation rate per platform in new dated sections below.

## Verdict

Entity retrieval is strong for category and safety queries (always top-3, often
first), and the flagship page is already answer-extracted. The two
highest-leverage fixes are both deployment-gated: push the corrected copy so
the indexed description stops claiming "open-source", and refresh store-listing
wording at v1.6.0.

---

## 2026-10 (next scheduled)

- Re-run the four queries + the two that timed out; note whether the
  corrected description is indexed; fill in ChatGPT/Perplexity manual results.
