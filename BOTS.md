# Bots & Agents Documentation

This repository is maintained in part by an ecosystem of automated agents. These agents run on a scheduled basis to audit code, identify gaps, fix bugs, optimize performance, and maintain documentation.

## Agent Roster

There are currently agents managing various parts of the repository. They are scheduled to run at specific times throughout the week.

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

## PR vs. Issue-Creating Agents

Agents have different interaction models depending on their scope:
- **PR-Creating Agents:** These agents (e.g., Vex, Shell, Bolt, Ink) are authorized to write code or documentation and submit Pull Requests directly. They will test their changes and verify code before creating a PR.
- **Issue-Creating Agents:** These agents (Sage, Muse, Oracle, Horizon, Refine) operate strictly in an advisory capacity. They are NOT authorized to create PRs or edit source code. Instead, they write detailed GitHub Issues as Markdown files in the repository root to propose architectural changes, feature suggestions, or tech debt improvements.

## Journal System (`.jules/` Directory)

The agents share context and memory through a journal system located in the `.jules/` directory at the repository root.

- Every agent maintains its own journal (e.g., `.jules/ink.md`, `.jules/vex.md`).
- Agents read their own journal at the beginning of their run to understand what they have previously done, preventing duplicate work.
- Agents read the journals of other agents to gain context (e.g., Ink reads the journals of Vex, Relay, and others to see if recent changes require documentation updates).
- At the end of every run, agents append a new entry summarizing their findings, actions taken, and learnings for future runs.
