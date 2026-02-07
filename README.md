<div align="center">

# 🎓 Classroom Quick Downloader

<!-- Client Stack -->

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Powered-646CFF?logo=vite&logoColor=white)
![WXT](https://img.shields.io/badge/WXT-Framework-7C3AED)

<!-- Browsers Versions -->

[![Chrome](https://img.shields.io/badge/Chrome-Available-green?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid)
[![Firefox](https://img.shields.io/badge/Firefox-Available-green?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/)
[![Edge](https://img.shields.io/badge/Edge-Available-green?logo=microsoft-edge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn)

<!-- Edge Stack -->

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-Edge-F38020?logo=cloudflare&logoColor=white)
![Durable Objects](https://img.shields.io/badge/Durable_Objects-Stateful-7C3AED)

<!-- Backend Stack -->

![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ARM64-2496ED?logo=docker&logoColor=white)
![Oracle Cloud](https://img.shields.io/badge/Oracle_Cloud-Ampere_A1-F80000?logo=oracle&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets-API-34A853?logo=googlesheets&logoColor=white)

<!-- Status -->

![Build](https://img.shields.io/badge/Build-Passing-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen)
![Current Version](https://img.shields.io/github/v/release/adhamhaithameid/Classroom-Quick-Downloader?label=Version&color=blue)

<!-- Uptime Kuma Live Status -->

[![Oracle Backend](http://129.151.233.229:3001/api/badge/1/status?style=flat&label=Oracle+Backend)](http://129.151.233.229:3001/status/cqd)
[![SQLite Database](http://129.151.233.229:3001/api/badge/2/status?style=flat&label=SQLite+Database)](http://129.151.233.229:3001/status/cqd)
[![Cloudflare Worker](http://129.151.233.229:3001/api/badge/4/status?style=flat&label=Cloudflare+Worker+DO)](http://129.151.233.229:3001/status/cqd)
[![Daily Archiver](http://129.151.233.229:3001/api/badge/3/status?style=flat&label=Daily+Archiver)](http://129.151.233.229:3001/status/cqd)

---

**Downloading files from Google Classroom shouldn't feel like a chore.** CQD transforms bulk file downloads into a single click while powering an enterprise-grade analytics pipeline that tracks millions of download events at the edge.

[📦 Get the Extension](#-installation) · [📖 Documentation](#-documentation) · [🏗️ Architecture](ARCHITECTURE.md) · [🔒 Privacy](PRIVACY.md)

</div>

---

## 📖 The Backstory: From a Bored Student to a Distributed System

As a software engineer, I found myself trapped in a loop of repetitive, manual labor every time I needed course materials. Downloading files one-by-one wasn't just slow—it felt like a technical debt I was paying every day. Eventually, the "misery" of clicking through dozens of links became too much to ignore.

### 📝 The Paper Manifesto

The plan for CQD didn't start in an IDE; it started on a piece of paper during a particularly boring university lecture. Out of pure frustration, I began sketching a solution. What started as a student's bored scribbles quickly evolved into a rigorous system architecture, complete with data flow diagrams and a security-first mindset.

### 📈 The Evolution

I moved the plan from paper to Notion, created this repository, and began tracking the technical journey through GitHub issues.

* **V1:** A raw prototype built with native JavaScript.
* **Modern Stack:** After several iterations, I migrated to the **WXT** framework to build a robust, production-grade extension.

### 🧪 Validating the Pain

To ensure I wasn't alone in this frustration, I conducted a local survey among my colleagues. The results were unanimous: everyone was struggling. This "misery" reaches its peak during final exams, when we all rush to download massive amounts of study material, and every second wasted on manual clicks counts.

### 🛡️ The Misery Cure (Mostly Universal)
I've spent countless hours testing this extension across multiple browsers and operating systems to ensure every student has access to the "cure." Whether you are on Windows, Mac, or Linux, or using Chrome, Edge, or Firefox—I've got you covered. 

*(Wait, What about Safari? We don't talk about Safari. You're on your own there, buddy.)*

**CQD is built by a student, for students.** It's a tool rooted in human connection and shared academic trauma, designed to make your student life just a little bit more bearable.

---

## 📦 Installation

Getting CQD is quick and easy! Just install it from your browser's extension store.

### Choose Your Browser

| Browser | Install Link | How to Install |
|---------|--------------|----------------|
| **Chrome** | [Chrome Web Store](https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid) | Click → **Add to Chrome** → **Add Extension** |
| **Firefox** | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/) | Click → **Add to Firefox** → **Add** |
| **Edge** | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn) | Click → **Get** → **Add Extension** |

### After Installing

1. You'll see the CQD icon appear in your browser toolbar 🎉
2. Go to [Google Classroom](https://classroom.google.com)
3. Open any assignment with attachments
4. Click the download button and watch the magic happen!

> **👨‍💻 Want to run it locally for development?** Check out the [Developer Guide](DEVELOPMENT.md).

---

## 📂 Project Modules & Documentation

> **This is a complex distributed system.** Each module has its own comprehensive README with implementation details, API references, and configuration guides. Start here for the big picture, then dive into the module you're working on.


| Module           | Description                                                                                    | Documentation                                        |
| ---------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **🧩 Extension** | Browser extension for bulk downloading from Google Classroom. Built with WXT + React.          | [Read Extension Docs →](./extension/README.md)      |
| **⚡ Worker**    | Edge ingestion layer on Cloudflare. Buffers events in Durable Objects and pre-aggregates data. | [Read Worker Docs →](./cloudflare-worker/README.md) |
| **🏛️ Backend** | Go server with SQLite storage, analytics API, and Google Sheets archiver.                      | [Read Backend Docs →](./oracle-backend/README.md)   |
| **🛠️ Tools**   | DevOps scripts for validation, pipeline testing, and deployment automation.                    | [View Scripts →](./tools/)                          |

---

## 🌍 System Architecture

CQD is not just a browser extension—it's a **distributed analytics system** designed for scale, resilience, and cost-efficiency.

```mermaid
graph TD
    User((👤 Student)) -->|Clicks Download| Ext[🧩 Chrome Extension]
  
    subgraph Client Side
      Ext -->|Batch Logic| DL[Download Queue]
      Ext -->|Anon Stats| Reporter[Analytics Reporter]
    end

    subgraph Edge Layer
      Reporter -->|POST /track| CF[⚡ Cloudflare Worker]
      CF -->|Buffer & Aggregation| DO[📦 Durable Object]
    end

    subgraph "Oracle Cloud Backend"
      DO -->|Flush Batch| GoServer[🚀 Go Backend]
      GoServer -->|Write| DB[(🗄️ SQLite DB)]
      Cron[⏱️ Daily Cron] -->|Trigger| Archiver[📜 Archiver Tool]
    end

    subgraph External
      Archiver -->|Append Row| Sheet[📊 Google Sheets]
    end
```

### Detailed Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER'S BROWSER                                       │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                     CQD Browser Extension (Client)                              │   │
│   │   • Bulk file downloads from Google Classroom                                   │   │
│   │   • Automatic Drive confirmation bypass                                         │   │
│   │   • Anonymous event tracking (file type, duration, success/fail)                │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          │  POST /track (batched events)                │
│                                          │                                              │
└──────────────────────────────────────────┼──────────────────────────────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE EDGE (Global)                                    │
│                                                                                          │
│   ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│   │                           Worker + Durable Object                                  │ │
│   │   • Low-latency ingestion at 300+ edge locations                                   │ │
│   │   • Event buffering with Durable Object state persistence                          │ │
│   │   • Pre-aggregation: calculates Top Browser, Top Country, etc.                     │ │
│   │   • Smart batching with exponential backoff retry                                  │ │
│   └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                          │                                               │
│                                          │  POST /ingest-batch (aggregated JSON)         │
│                                          │                                               │
└──────────────────────────────────────────┼───────────────────────────────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                           ORACLE CLOUD (ARM64 Ampere)                                    │
│                                                                                          │
│   ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│   │                       Go Backend + SQLite (WAL Mode)                               │ │
│   │   • Persistent storage with zero external dependencies                             │ │
│   │   • Real-time analytics dashboard                                                  │ │
│   │   • Time-series data with hourly/daily granularity                                 │ │
│   └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                          │                                               │
│                                          │  Daily Cron Job                               │
│                                          ▼                                               │
│   ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│   │                         Google Sheets (Archive)                                    │ │
│   │   • Long-term historical data                                                      │ │
│   │   • Easy sharing and reporting                                                     │ │
│   └────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 📍 The Journey of an Analytics Event

Every download attempt in the [Extension](./extension/) triggers an analytics event. Here's its complete journey through the system:

1. **📥 Capture (Client)** — The [Extension](./extension/) records: file type, browser, OS, duration, and success/fail status. Events are queued locally in `chrome.storage`.
2. **📤 Batch & Send (Client → Edge)** — When the queue reaches 50 events (or after a time threshold), the extension POSTs the batch to the [Cloudflare Worker](./cloudflare-worker/).
3. **🔄 Buffer & Aggregate (Edge)** — The [Worker](./cloudflare-worker/) forwards events to its [Durable Object](./cloudflare-worker/README.md#why-durable-objects), which:

* Persists events in memory (survives Worker restarts).
* Aggregates counters: by browser, by OS, by country, by file type.
* Calculates "Top" stats: most common browser, most active country, etc.
* Manages security state: IP allowlists and login rate limits.

4. **🚀 Flush (Edge → Backend)** — When the buffer exceeds `MAX_BATCH_EVENTS` or an alarm fires, the DO sends a pre-aggregated JSON payload to the [Oracle Backend](./oracle-backend/).
5. **💾 Store (Backend)** — The [Backend](./oracle-backend/) receives the batch, deduplicates by `batchId`, and stores:

* Raw batch metadata in `batches` table.
* Hourly aggregates in `downloads_hourly` table.
* Lifetime totals in `downloads_totals` key-value table.

6. **📊 Archive (Backend → Sheets)** — At midnight UTC, a cron job runs the [Archiver](./oracle-backend/README.md%23-google-sheets-archiver), which:

* Fetches the current summary from the local API.
* Appends a row to Google Sheets with all dimension breakdowns.


---

## 🛡️ Security Architecture

CQD employs a defense-in-depth strategy to protect analytics integrity and admin interfaces.

### 🔐 Session-Based Authentication
* **HttpOnly Cookies**: Session tokens are stored in `HttpOnly`, `Secure`, `SameSite=Strict` cookies, preventing XSS access.
* **HMAC-SHA256 Signatures**: Tokens are signed with a high-entropy secret, preventing tampering.
* **Short-Lived Sessions**: Sessions expire automatically to minimize exposure.

### 🏰 Edge-Side Verification
* **IP Allowlisting**: Critical administrative actions are restricted to a dynamic list of allowed IPs, managed via the Durable Object state.
* **Rate Limiting**: Login attempts are rate-limited at the edge to prevent brute-force attacks.
* **Admin Proxy Pattern**: The browser *never* sees the `DO_SHARED_SECRET`. The Cloudflare Worker validates the user's session and "injects" the secret into requests before forwarding them to the Durable Object.

---

## 🧠 Why This Stack?

### Why Durable Objects?

> **Problem:** If every extension sends events directly to our database, we'd have thousands of concurrent writes—overwhelming SQLite and spiking costs.

**Solution:** [Durable Objects](./cloudflare-worker/README.md) act as a **global buffer**. All events for a given namespace (e.g., "downloads") are routed to the *same* instance, regardless of which edge location receives the request. This provides:

* **Strong consistency** — No split-brain, no race conditions.
* **Persistence** — State survives Worker restarts.
* **Rate limiting** — We control how often we flush to the backend.
* **Pre-aggregation** — Compute "Top Browser" before sending, saving backend CPU.

### Why Go + SQLite?

> **Problem:** We need maximum performance on Oracle Cloud's Free Tier (4 ARM cores, 24GB RAM) without paying for managed databases.

**Solution:** [Go with pure-Go SQLite](./oracle-backend/README.md) (no CGO) gives us:

* **Single binary deployment** — No runtime dependencies.
* **Zero external services** — No Postgres, no Redis, no connection pooling.
* **WAL mode** — Concurrent reads while writing.
* **ARM64 optimized** — Native compilation for Ampere A1.

### Why WXT?

> **Problem:** Building Manifest v3 extensions with React is painful—bundling, HMR, multi-target builds.

**Solution:** [WXT](./extension/README.md) provides:

* **File-system routing** — `popup/index.html`, `background.ts`, `*.content.ts` just work.
* **Hot Module Replacement** — See changes instantly during development.
* **Cross-browser builds** — Chrome and Firefox from the same codebase.
* **TypeScript-first** — Auto-imports, type safety, and modern DX.

---

## 🛠️ Tech Stack Matrix


| Layer            | Language   | Key Technologies                                            | Data Flow                                            |
| ---------------- | ---------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| **🧩 Client**    | TypeScript | [WXT](./extension/), React 19, Chrome APIs                  | Captures events → Queues locally → Batches to Edge |
| **⚡ Edge**      | TypeScript | [Cloudflare Workers](./cloudflare-worker/), Durable Objects | Buffers events → Aggregates → Flushes to Backend   |
| **🏛️ Backend** | Go         | [net/http](./oracle-backend/), SQLite (pure Go), Docker     | Stores batches → Serves API → Archives to Sheets   |

---

## ✨ Features

### For Users

* **📦 Bulk Downloads** — Download all files from a Classroom assignment with one click.
* **🔓 Drive Bypass** — Automatically handles Google Drive's "Download anyway" confirmation pages.
* **🔄 Multi-Account Support** — Cycles through your Google accounts to find the one with access.
* **📊 Local Stats** — See your download history right in the [Extension](./extension/) popup.

### For Developers

* **📈 Real-time Dashboard** — Monitor download events, success rates, and breakdowns by browser/OS/country.
* **⏱️ Time-Series Analytics** — Hourly and daily granularity for trend analysis.
* **📋 Google Sheets Archive** — Automated daily exports for long-term reporting.
* **🔒 Privacy-First** — No PII collected. Only file types, durations, and success/fail status.

---

## 🔒 Privacy

We collect **anonymous usage metrics** only—never your files, passwords, or personal information.

| ✅ We Collect | ❌ We Never Collect |
|--------------|---------------------|
| File types (pdf, docx) | File contents |
| Browser & OS | Usernames or emails |
| Success/fail status | Google credentials |
| Country (from IP) | Browsing history |

> **📘 Full details in [PRIVACY.md](PRIVACY.md)**

---

## 🤝 Feedback

Found a bug? Have a suggestion? We'd love to hear from you.

- **GitHub Issues:** [Open an Issue](https://github.com/adhamhaithameid/Classroom-Quick-Downloader/issues)
- **Feedback Form:** [Submit Feedback](https://docs.google.com/forms/d/1nB95r35O_h98odg8Y6_OrfYdjKGBqhrUCb_wFHA-RA8/edit)

### ⚠️ Licensing & Usage

This software is **Proprietary & Source Available**. Copyright © 2025 Adham Haitham. All Rights Reserved.

* ✅ **You can:** View, read, and use the extension for personal, non-commercial purposes.
* ❌ **You cannot:** Modify, edit, or build upon the source code.
* ❌ **You cannot:** Distribute modified versions or forks.
* ❌ **You cannot:** Use this code for commercial purposes.

For commercial inquiries or modification requests, please contact me directly.

---

<div align="center">

**Built with ☕ by [Adham Haitham](https://github.com/adhamhaithameid)**

*A distributed analytics pipeline masquerading as a simple productivity tool.*

</div>
