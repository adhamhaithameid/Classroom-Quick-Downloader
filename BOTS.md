# Automated Agents (BOTS.md)

This file documents the automated agents (bots) that run continuously on this repository. These agents are responsible for auditing, improving, and maintaining different aspects of the codebase, ranging from documentation to performance, security, and accessibility.

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

## PR-Creating vs Issue-Creating Agents

- **PR-Creating Agents:** The majority of agents create Pull Requests directly. They find an issue within their scope, implement a fix, and open a PR. Examples include Aria (accessibility), Signal (SEO), and Ink (documentation).
- **Issue-Creating Agents:** Some agents focus on higher-level suggestions, large architectural refactors, or feature ideas. Because these changes require human discussion and alignment, these agents **only create GitHub Issues** and never submit PRs or edit source code directly. Examples include Sage (feature suggestions), Muse (website suggestions), Oracle (backend suggestions), Horizon (architecture), and Refine (tech debt).

## The Journal System (`.jules/`)

All agents maintain state and communicate through the `.jules/` directory, a hidden folder at the repository root containing Markdown files for each agent (e.g., `.jules/ink.md`, `.jules/vex.md`).

- **Purpose:** The journals serve as an activity log, allowing agents to track what they have reviewed, the issues they have found, and the actions they have taken.
- **Communication:** Agents read other agents' journals before beginning their run to understand what has changed recently. For example, Ink reads all Sunday agents' journals to see if their changes require documentation updates.
- **Updates:** At the end of every run, an agent appends a new entry to its respective journal file detailing its findings, actions, and learnings.
