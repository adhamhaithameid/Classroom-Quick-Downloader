## 2026-06-08 — Missing Job Timeouts
**Issue Filed:** Watch: `ci.yml` and `oracle-backend-ci.yml` lack job timeouts — hung jobs can block runners for 6 hours
**Workflow Audited:** All workflows (`.github/workflows/*.yml`), focusing on `.github/workflows/ci.yml` and `.github/workflows/oracle-backend-ci.yml`
**Finding:** Almost all jobs across workflows do not specify `timeout-minutes`, relying on the GitHub Actions default of 6 hours. This can lead to wasted runner minutes and blocked CI if tests deadlock.
**Learning:** This repository has a very comprehensive CI suite but defaults to unbounded job durations. Future audits should consider performance optimizations and resource limits.
**Next Priority:** Check for redundant CI triggers (e.g., scoping `ci.yml` to only relevant path changes).
