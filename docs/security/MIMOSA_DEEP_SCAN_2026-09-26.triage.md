# Mimosa Deep Scan 2026-09-26 — Triage Record

**Scan:** `scan-2026-09-26T04-45-57.128Z-5c571064231b` (deep, sealed)
**Seal:** `sha256:5b1d520f44e0984caddc76ea3fbddfb9e2ea25acd68173678b037732f8aaf383`
**Coverage:** 46 packages, dependency advisory scan clean (0 matches) · 43 findings
**Raw report:** [MIMOSA_DEEP_SCAN_2026-09-26.md](./MIMOSA_DEEP_SCAN_2026-09-26.md) · [findings.json](./MIMOSA_DEEP_SCAN_2026-09-26.findings.json)

All 43 findings resolve into five families. No new exploitable defect found.

## Family 1 — DO stub.fetch / markdown-fetch SSRF sinks (high, ~30 findings)

`cloudflare-worker/src/index.ts` + `downloads_do.ts` (`eeaba26e…` ×14,
`proxyToDO`, `forwardArchivedBatchToOracle`, `onOptionalBindingMismatch`,
`fetchMarkdownFromUrl`, `parseMarkdownToEntries`, `applyAutoGithubSync`, …).

**Verdict: structural advisory, mitigations landed.** The analyzer marks the
`fetch` sink regardless of in-tree guards. Real fixes are on main: the
GitHub-host allowlist (`CHANGELOG_ALLOWED_MARKDOWN_HOSTS`,
`downloads_do.ts:508`) and DO-RPC origin pinning (`doRpcUrl()`,
`index.ts`) with `tests/do-rpc-origin.test.ts`. The residual
scanner-policy question (sink-level stub.fetch advisories vs full DO
RPC-methods migration) remains tracked as bead `e4v.2` — owner decision.

## Family 2 — oracle-backend env→exec command injection (high/medium, 5 findings)

`main.go:1066/1121`, `deploy_status.go`, `sheets_flush_manual.go:152`
(`runArchiver`, `1052954a`, `b7087d0`, `e61c1f`, `dee93efe`, `ef3c72ea`).

**Verdict: false positive.** The archiver runs a fixed binary with fixed
args; the "untrusted input" is environment variables, which on a server
are operator-controlled (writing them already implies host compromise).
`resolveArchiverPath` validation + `#nosec` annotations already in tree;
originally triaged 2026-09-17 (see bead `e4v.1` notes).

## Family 3 — engine-v3.ts taint (medium, 1 finding)

`358331b79759535dc571ea24` — path terminates in
`extension/tests/v2-docs-anchor-discovery.test.ts:20` (jsdom test
scaffolding), not shipped code. Triaged in bead `0h4d.12.1` (closed) and
audit row S6.

## Family 4 — "mongo-sort-injection" in release notes (medium, 2 findings)

`d2e66bb6…`, `f31c9ee4…` at `index.ts:2215` → `release-notes.ts:42`.

**Verdict: false positive (scanner pattern-match).** The flagged sink is
JavaScript `Array.prototype.sort` with a hardcoded date comparator over
`sanitizeReleaseEntries()` output — type-coerced, trimmed, sliced
entries. There is no database sort and no dynamic sort field anywhere in
the path; the "Mongo" rule matched the `.sort(` call shape.

## Family 5 — local dev-tool path traversal (high/medium, 4 findings)

`tools/capture-classroom-snapshot.ts:188/208` (`eaf2e402`, `7067c9f`,
`f9bbaca`) — CLI arguments flowing into screenshot output paths of a
developer-only capture tool. Arguments are supplied by the same operator
running the tool on their own machine; there is no remote attacker surface.
**Verdict: not reachable.**

## Conclusion

Zero exploitable defects in shipped code. One genuine hardening item
remains tracked: the e4v.2 scanner-policy / DO-RPC-migration decision.
