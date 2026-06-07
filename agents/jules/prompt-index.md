# Jules Prompt Index

Each prompt file is committed as public-safe documentation of the Jules task configuration. `oracle-agent.md` is used for the Oracle backend suggestions agent to avoid confusion with the Oracle backend product name.

| Agent | Prompt | Output | Primary Scope |
|-------|--------|--------|---------------|
| Vex | [vex.md](prompts/vex.md) | PR | Extension manifest, permissions, CSP |
| Relay | [relay.md](prompts/relay.md) | PR | Extension background service worker |
| Weave | [weave.md](prompts/weave.md) | PR | Extension content scripts |
| Shell | [shell.md](prompts/shell.md) | PR | Extension popup UI |
| Vault | [vault.md](prompts/vault.md) | PR | Extension storage and analytics |
| Fetch | [fetch.md](prompts/fetch.md) | PR | Extension API engines |
| Ink | [ink.md](prompts/ink.md) | PR | Repository documentation |
| Axle | [axle.md](prompts/axle.md) | PR | Extension v1/v2 engines |
| Cipher | [cipher.md](prompts/cipher.md) | PR | Extension security |
| Flare | [flare.md](prompts/flare.md) | PR | Cloudflare Worker security |
| Gate | [gate.md](prompts/gate.md) | PR | Cloudflare routing and config |
| Mirror | [mirror.md](prompts/mirror.md) | PR | Extension to Worker communication |
| Watch | [watch.md](prompts/watch.md) | Issue | GitHub Actions and dependency automation |
| Specter | [specter.md](prompts/specter.md) | PR | Extension performance |
| Titan | [titan.md](prompts/titan.md) | PR | Oracle backend security |
| Pillar | [pillar.md](prompts/pillar.md) | PR | Oracle backend reliability |
| Sync | [sync.md](prompts/sync.md) | PR | Extension to Oracle data contracts |
| Lexicon | [lexicon.md](prompts/lexicon.md) | PR/Issue | Extension translations |
| Lumen | [lumen.md](prompts/lumen.md) | PR | Website performance |
| Aria | [aria.md](prompts/aria.md) | PR | Website accessibility |
| Signal | [signal.md](prompts/signal.md) | PR | Website SEO |
| Ember | [ember.md](prompts/ember.md) | PR | Extension UX |
| Slate | [slate.md](prompts/slate.md) | PR | Extension code cleanup |
| Stamp | [stamp.md](prompts/stamp.md) | PR/Issue | Version consistency |
| Sage | [sage.md](prompts/sage.md) | Issue | Extension suggestions |
| Muse | [muse.md](prompts/muse.md) | Issue | Website suggestions |
| Oracle | [oracle-agent.md](prompts/oracle-agent.md) | Issue | Oracle backend suggestions |
| Horizon | [horizon.md](prompts/horizon.md) | Issue | Cross-component architecture |
| Refine | [refine.md](prompts/refine.md) | Issue | Technical debt |
| Apex | [apex.md](prompts/apex.md) | Issue | v3 engine planning |
| Atlas | [atlas.md](prompts/atlas.md) | PR/Issue | PLAN.md and archived plans |
| Reach | [reach.md](prompts/reach.md) | Issue | Growth and distribution |
| Quill | [quill.md](prompts/quill.md) | PR | Extension unit tests |
| Forge | [forge.md](prompts/forge.md) | PR | Extension integration and E2E tests |
| Compass | [compass.md](prompts/compass.md) | PR | Website tests |
| Bastion | [bastion.md](prompts/bastion.md) | PR | Cloudflare Worker and Oracle tests |

## Output Expectations

- PR agents should make one focused change per run.
- Issue agents should file one concrete, actionable Issue per run.
- PR/Issue agents should choose based on whether the fix is bounded and safe.
- Any agent may produce no output when no useful work is found.
