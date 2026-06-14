# 🤖 Automated Agents (Bots)

This repository is maintained with the help of automated AI agents that run on a strict schedule.
These agents perform specific tasks, ranging from code cleanup and security audits to documentation updates.
This document serves as the map of all automated activity in this repository.

## 📓 The Journal System

All agents maintain a journal of their activities in the `.jules/` directory at the repository root.
Each agent has its own markdown file (e.g., `.jules/ink.md`).

- **Reading Context**: Agents always read their own journal, and often the journals of other agents, before beginning work to ensure they have the full context of what has happened recently.
- **Recording Activity**: At the end of every run, each agent appends a new entry to its journal. This entry includes the date, what was found, the action taken, and any learnings for the future.

## 📝 PR-Creating vs. Issue-Creating Agents

- **PR-Creating Agents**: The majority of agents are authorized to automatically implement changes and open Pull Requests against the repository. They are expected to ensure tests pass and changes are verified before doing so.
- **Issue-Creating Agents**: Some agents (like Sage, Muse, Oracle, Horizon, and Refine) are **never** permitted to edit source code directly. Their purpose is to identify larger architectural, tech debt, or cross-cutting problems and write detailed GitHub Issues proposing solutions. They are marked with "(Issues only)" in their scope.

## 📅 Agent Roster & Schedule

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
