# Toolchain repair

- Installed hyperframes-core, hyperframes-animation, hyperframes-creative, hyperframes-keyframes and current hyperframes-cli from the official heygen-com/hyperframes repository into ~/.codex/skills using the skill-installer helper.
- GitHub archive download stalled; switched helper to sparse Git mode with LFS smudging disabled. Installation completed.
- Pinned video project to Hyperframes 0.8.58. Node 24 and FFmpeg 9.0.2 are available. The doctor FFmpeg probe initially failed, but direct execution and completed rendering verified the binary works.
- Scaffold's automatic skill installer also installed its core dependencies under ~/.agents/skills. It replaced the existing generic Figma skill with the Hyperframes importer. Preserved that importer under ~/.codex/skill-install-backups/cqd-launch-20260922/hyperframes-figma and restored the general Figma MCP skill from the pre-existing ~/.codex/skills/figma copy.
- Used a single render worker for the 8 GB machine. Final capture uses hardware GPU.
- Higgsfield returned USER_NOT_LOGGED_IN. No generation was submitted. Local Hyperframes completes this package without a Higgsfield connection.
- All project output is under brag-output/. Production application code was not edited. No commits, pushes, Dolt sync or publication were performed.
