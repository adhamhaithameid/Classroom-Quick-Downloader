## 2025-03-01 — Missing job timeouts in deployment workflows
**Issue Filed:** Watch: deploy workflows have no job timeouts — hung steps block runners for hours
**Workflow Audited:** deploy-cloudflare-worker.yml, website-deploy.yml, oracle-dashboard-deploy.yml, github-pages.yml, release-drafter.yml
**Finding:** None of the deployment workflows or utility workflows like github-pages.yml have `timeout-minutes` set on their jobs, meaning a hung step could block a runner for the default 6 hours.
**Learning:** While the main `ci.yml` and `oracle-backend-ci.yml` have timeouts configured, deployment workflows were missed. It's a common pattern to forget timeouts on utility/deployment workflows.
**Next Priority:** Check for path filters (`paths:`/`paths-ignore:`) in mono-repo workflows like `ci.yml` to see if they are over-triggering on irrelevant changes.
