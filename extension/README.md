# 🕵️ For Mozilla Reviewers: Build Instructions

## System Requirements
- **OS:** Windows, macOS, or Linux (Tested on macOS/Linux)
- **Node.js:** v22.14.0 (Required, see `.nvmrc`)
- **Package Manager:** pnpm (Required, see `pnpm-lock.yaml`)

## Setup
1. Unzip the source code archive.
2. Open a terminal in the root directory (where `package.json` is located).
3. Install dependencies:
   ```bash
   pnpm install
   ```

## Build
To generate the production build for Firefox (identical to the submitted XPI):

```bash
pnpm run build:firefox
```

## Output
The built extension will be located in:
`./.output/firefox-mv2`

## Verification
You can compare the contents of the `.output/firefox-mv2` directory with the submitted extension package to verify they match.

---

**(Original README follows below)**

---

# 🎓 Classroom Quick Downloader (Extension)

![WXT](https://img.shields.io/badge/WXT-Framework-7C3AED?logo=data:image/svg+xml;base64,...)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Powered-646CFF?logo=vite&logoColor=white)
![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Ready-4285F4?logo=googlechrome&logoColor=white)

**One-click downloads for Google Classroom.** This browser extension streamlines file downloads from Google Classroom by injecting smart UI buttons, handling Google Drive authentication quirks, and managing download queues in the background.

---

## ✨ Features


| Feature                   | Description                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------- |
| **Batch Downloading**     | "Download All" button that grabs every file from an assignment at once.            |
| **Google Drive Bypass**   | Automatically handles Drive's confirmation pages and multi-account authentication. |
| **UI Injection**          | Adds download buttons directly into the Google Classroom interface.                |
| **Background Processing** | Downloads are managed by a service worker that survives tab closures.              |
| **Anonymous Analytics**   | Securely reports anonymized usage stats to improve the extension.                  |
| **Per-Tab Control**       | Enable/disable the extension on individual Classroom tabs via the popup.           |

---

## 🏗️ Technical Architecture

### WXT Framework

This extension is built with [WXT](https://wxt.dev/) — a modern framework for building browser extensions. WXT was chosen for:

- **Auto-imports**: No manual import statements for browser APIs.
- **Hot Module Replacement (HMR)**: See changes instantly during development.
- **Manifest v3 Ready**: Automatic manifest generation with proper service worker handling.
- **React Support**: First-class React integration via `@wxt-dev/module-react`.
- **Cross-Browser**: Build for Chrome and Firefox from the same codebase.

### Content Scripts

Content scripts inject directly into Google Classroom pages:


| Script                     | Matches                  | Purpose                                                               |
| -------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `download_all.content.ts`  | `classroom.google.com/*` | Injects "Download All" buttons and handles batch downloads.           |
| `drive_bypass.content.ts`  | `drive.google.com/*`     | Detects Drive confirmation pages and clicks "Download" automatically. |
| `comment_frame.content.ts` | `classroom.google.com/*` | Handles comment/attachment frames.                                    |
| `edited_frame.content.ts`  | `classroom.google.com/*` | Detects edited document states.                                       |

### Background Service Worker

The `background.ts` service worker:

1. **Manages Downloads**: Tracks pending downloads, handles race conditions, and registers files by URL/ID.
2. **Auth User Cycling**: If Drive returns 403, automatically tries other logged-in Google accounts.
3. **Drive Bypass Tabs**: Opens hidden tabs to click Drive's "Download anyway" buttons.
4. **Analytics Alarms**: Periodically flushes analytics events to the Cloudflare Worker.

### The Analytics Module

The `entrypoints/utils/analytics.ts` module provides secure, privacy-respecting analytics:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER EXTENSION                            │
│                                                                     │
│   ┌─────────────┐    ┌─────────────────────────────────────────┐   │
│   │  Download   │───▶│         Analytics.track()                │   │
│   │   Event     │    │   - Adds browser, OS, version, lang      │   │
│   └─────────────┘    │   - Stores in chrome.storage.local       │   │
│                      │   - Updates local stats (popup UI)       │   │
│                      └───────────────────┬─────────────────────┘   │
│                                          │                          │
│   ┌──────────────────────────────────────▼───────────────────────┐  │
│   │                   Pending Events Queue                       │  │
│   │   (Persisted in chrome.storage.local)                        │  │
│   └─────────────────────────────┬────────────────────────────────┘  │
│                                 │                                   │
│   ┌────────────────────────────▼────────────────────────────────┐  │
│   │                     Flush Triggers                           │  │
│   │   1. Queue >= batchSize (default: 50)                        │  │
│   │   2. Time-based: 30min (high), 60min (mid), 120min (low)     │  │
│   │   3. chrome.alarms every 5 minutes                           │  │
│   └─────────────────────────────┬────────────────────────────────┘  │
│                                 │                                   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                                  │ POST /track { events: [...] }
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE WORKER (Edge)                         │
│   cqd-analytics.adhamhaithameid.workers.dev                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Features:**

- **Batching**: Events are queued and sent in batches to reduce network requests.
- **Exponential Backoff**: Failed flushes retry with increasing delays (1m → 5m → 15m → ... → 24h).
- **Poison Pill Protection**: Events that fail 5+ times are dropped to prevent infinite retries.
- **Dynamic Config**: Batch size and flush intervals are fetched from the Worker's `/config` endpoint.
- **Privacy**: No personally identifiable information is collected.

---

## 📁 Project Structure

WXT uses a **file-system based routing** convention. Files in `entrypoints/` are automatically recognized:

```
extension/
├── entrypoints/
│   ├── background.ts                  # Service worker (always running)
│   ├── popup/
│   │   ├── index.html                 # Popup entry HTML
│   │   ├── main.tsx                   # React mount point
│   │   ├── App.tsx                    # Main popup component
│   │   └── App.css                    # Popup styles
│   ├── download_all.content.ts        # Content script: Download All button
│   ├── drive_bypass.content.ts        # Content script: Drive confirmation
│   ├── comment_frame.content.ts       # Content script: Comment handling
│   ├── edited_frame.content.ts        # Content script: Edited docs
│   └── utils/
│       └── analytics.ts               # Analytics module
├── assets/
│   ├── CQD.png                        # Color logo
│   └── CQD-gray.png                   # Grayscale logo (non-Classroom)
├── public/
│   ├── icon/                          # Extension icons (16, 32, 48, 96, 128)
│   ├── logo.svg                       # SVG logo
│   └── bmc-logo.svg                   # Buy Me a Coffee logo
├── wxt.config.ts                      # WXT configuration + manifest
├── package.json                       # Dependencies and scripts
└── tsconfig.json                      # TypeScript configuration
```

### WXT File Conventions


| File Pattern         | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `popup/index.html`   | Browser action popup (click on extension icon)  |
| `background.ts`      | Service worker (MV3) or background script (MV2) |
| `*.content.ts`       | Content scripts (injected into web pages)       |
| `*.content/index.ts` | Content scripts with multiple files             |

---

## 🛠️ Development Guide

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **npm** or **pnpm**

### Setup

```bash
cd extension
npm install
```

### Development Server

```bash
npm run dev
```

This command:

1. Starts Vite in watch mode with HMR.
2. Builds the extension to `.output/chrome-mv3-dev/`.
3. **Automatically opens a new Chrome instance** with the extension pre-loaded.
4. Changes to source files are hot-reloaded.

> **Tip:** Keep the Dev Tools console open in the popup or background page to see logs.

### Build for Production

```bash
npm run build
```

This creates an optimized production build in `.output/chrome-mv3/`.

### Create ZIP for Web Store

```bash
npm run zip
```

Generates a `.zip` file in `.output/` ready for Chrome Web Store submission.

### Firefox Support

```bash
npm run dev:firefox     # Development
npm run build:firefox   # Production build
npm run zip:firefox     # Web Store ZIP
```

---

## ⚙️ Configuration

### Analytics Endpoint

The analytics module sends data to the Cloudflare Worker. The endpoint is configured in `entrypoints/utils/analytics.ts`:

```typescript
// For LOCAL TESTING:
const WORKER_URL = 'http://localhost:8787/track';
```

The remote can be disabled entirely by setting `WORKER_URL` to an empty string.

### Dynamic Configuration

The extension fetches configuration from the Worker's `/config` endpoint:

- **Batch Size**: How many events to send per request.
- **Flush Intervals**: Time-based flush thresholds.
- **Remote Enabled**: Emergency kill switch for analytics.

Configuration is refreshed:

- Once on extension startup.
- Every 3 hours via `chrome.alarms`.

---

## 🔒 Permissions & Privacy

The extension requires these permissions (defined in `wxt.config.ts`):


| Permission  | Why It's Needed                                                            |
| ----------- | -------------------------------------------------------------------------- |
| `downloads` | Trigger file downloads and track their completion status.                  |
| `tabs`      | Communicate with content scripts and update extension icon per tab.        |
| `storage`   | Persist pending analytics events and local download stats.                 |
| `alarms`    | Schedule periodic analytics flushes (MV3-safe alternative to setInterval). |

### Host Permissions


| Host                                     | Why It's Needed                              |
| ---------------------------------------- | -------------------------------------------- |
| `https://classroom.google.com/*`         | Inject content scripts into Classroom pages. |
| `https://drive.google.com/*`             | Handle Drive download confirmations.         |
| `https://drive.usercontent.google.com/*` | Download files from Drive CDN.               |
| `https://accounts.google.com/*`          | Handle multi-account authentication.         |

### What Data Is Collected?

- **File type** (e.g., "pdf", "docx") — not the filename.
- **Browser and OS** (e.g., "chrome", "windows").
- **Extension version**.
- **Download duration** (fast/medium/slow).
- **Success or failure** (with error type if failed).
- **Language** (browser locale).

**What Is NOT Collected:**

- Usernames or emails.
- File names or content.
- Google account details.
- Browsing history outside of download events.

---

## 🧪 Testing

### Type Checking

```bash
npm run compile
```

### Loading Unpacked Extension

1. Build the extension: `npm run build`
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select `.output/chrome-mv3/`

---

## 📄 License

This project is part of the Classroom Quick Downloader suite. See the main repository for licensing details.
