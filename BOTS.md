# Repository Bots & Agents (BOTS.md)

This file documents the automated agents running on this repository. It is critical for understanding what happens automatically and why. Every agent, its purpose, scope, and schedule is documented here.

## Agent Roster

| Agent | Day | Time | Scope |
|-------|-----|------|-------|
| Vex 🔍 | Sunday | 09:00 | extension manifest & permissions |
| Relay ⚙️ | Sunday | 09:30 | extension background service worker |
| Weave 🕸️ | Sunday | 10:00 | extension content scripts |
| Shell 🐚 | Sunday | 10:30 | extension popup UI |
| Vault 🔒 | Sunday | 11:00 | extension storage & analytics |
| Fetch 📡 | Sunday | 11:30 | extension API engines |
| Ink 📝 | Sunday | 12:00 | all-repo documentation |
| Cipher 🔐 | Monday | 09:00 | extension security |
| Flare 🌩️ | Monday | 09:30 | Cloudflare Worker security & performance |
| Gate 🚧 | Monday | 10:00 | Cloudflare routing, DO logic, config |
| Mirror 🪞 | Monday | 10:30 | extension ↔ Cloudflare communication |
| Specter 👻 | Tuesday | 09:00 | extension performance |
| Titan ⚔️ | Tuesday | 09:30 | Oracle backend security |
| Pillar 🏛️ | Tuesday | 10:00 | Oracle reliability & performance |
| Sync 🔄 | Tuesday | 10:30 | extension ↔ Oracle data contracts |
| Lumen 💡 | Wednesday | 09:00 | website performance |
| Aria ♿ | Wednesday | 09:30 | website accessibility |
| Signal 📶 | Wednesday | 10:00 | website SEO |
| Ember 🔥 | Wednesday | 10:30 | extension UX micro-improvements |
| Slate 🧹 | Wednesday | 11:00 | extension code cleanup |
| Sage 🌿 | Thursday | 09:00 | extension feature suggestions (Issues only) |
| Muse 🎭 | Thursday | 09:30 | website suggestions (Issues only) |
| Oracle 🔮 | Thursday | 10:00 | Oracle backend suggestions (Issues only) |
| Horizon 🌅 | Thursday | 10:30 | cross-cutting architecture suggestions (Issues only) |
| Refine ✨ | Thursday | 11:00 | tech debt suggestions (Issues only) |
| Sentinel 🛡️ | Friday | 09:00 | security (default) |
| Palette 🎨 | Friday | 09:30 | UX (default) |
| Bolt ⚡ | Friday | 10:00 | performance (default) |
| Quill 🪶 | Saturday | 09:00 | extension unit test gaps |
| Forge 🔨 | Saturday | 09:30 | extension integration & e2e test gaps |
| Compass 🧭 | Saturday | 10:00 | website test gaps |
| Bastion 🏰 | Saturday | 10:30 | Cloudflare & Oracle test gaps |

## PR-Creating vs. Issue-Creating Agents

Automated agents operate in two distinct modes depending on their persona and scope:

1. **PR-Creating Agents:** Most agents are responsible for making bounded, safe fixes directly to the codebase. They will open Pull Requests with titles prefixed by their name (e.g., `Ink: ...`). These agents follow strict rules to limit their changes.
2. **Issue-Creating Agents:** Certain advisory agents are restricted from modifying source code. They analyze the repository and generate detailed GitHub Issues to propose larger architectural changes, tech debt reduction, or feature ideas. Agents in this category include **Sage**, **Muse**, **Oracle**, **Horizon**, and **Refine**.

## The Journal System (`.jules/`)

Agents communicate and maintain state using a journal system located in the `.jules/` directory at the repository root.

- Each agent maintains its own markdown file (e.g., `.jules/ink.md`).
- **Read First:** Agents read their own journal to remember past actions and check other agents' journals to discover recent findings or changes that might require attention.
- **Append at End:** At the conclusion of their run, agents append a structured entry describing what they did, any gaps found, and learnings for future runs.
- **Git Tracking:** The `.jules/` directory is in `.gitignore` by default. Agents must explicitly stage updates to their journals using `git add -f` before committing, ensuring a permanent record of their autonomous activity.
