## 2026-06-09 - Debounced MutationObserver in V2 Orchestrator
**Finding:** Undebounced MutationObserver callback running constantly on DOM changes.
**Action:** Batched mutations with a 50ms debounce timer.
**Learning:** MutationObserver callbacks can be a hot path and should be debounced where possible.
