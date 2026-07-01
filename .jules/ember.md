## 2026-01-24 — Pulse effect respects prefers-reduced-motion
**Finding:** Pulse effect in `triggerPulseEffect` was ignoring user's system accessibility setting for `prefers-reduced-motion`.
**Action:** Added a `matchMedia('(prefers-reduced-motion: reduce)')` check in `triggerPulseEffect` to return early and skip the pulse animation, conforming to WCAG 2.1 AA 2.3.3.
**Learning:** Always check `typeof window.matchMedia === 'function'` before checking media queries to ensure tests and unsupported environments don't crash.
