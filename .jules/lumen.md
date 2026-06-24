## 2026-06-24 — Parallelized data fetching in publicSite.ts
**Finding:** [TTFB latency] fetchCompositeSnapshotFromPublicEndpoints was fetching overview and map in parallel, but waiting for them to resolve before fetching the changelog.
**Action:** Moved fetchUserChangelog() into the initial Promise.all array to fetch all three resources concurrently.
**Learning:** For SvelteKit data fetching, ensure all independent backend requests are fired in parallel rather than sequentially, which delays Time to First Byte.
