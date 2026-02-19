# 👨‍💻 Development Guide

> Last updated: 2026-02-19 (v1.3.5).

> Update (2026-02-15): Latest changes include CI coverage-gate hardening for extension analytics storage migration fallback, popup stats race-condition guards, structured step-up auth error handling in Oracle dashboard, and backend/worker auth-security hardening. See /CHANGELOG.md for details.

This guide is for developers who want to set up the Classroom Quick Downloader project locally for development, testing, or contributing.

---

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Running the Extension Locally](#-running-the-extension-locally)
- [Building for Production](#-building-for-production)
- [Additional Modules](#-additional-modules)
- [Useful Commands Reference](#-useful-commands-reference)

---

## 🛠 Prerequisites

Before you begin, ensure you have the following tools installed:

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Node.js** | v20+ | JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| **pnpm** | v8+ | Package manager | `npm install -g pnpm` |
| **Go** | v1.24+ | Backend development | [go.dev](https://go.dev/) |
| **Docker** | v20+ | Backend deployment | [docker.com](https://docker.com/) |
| **Wrangler** | Latest | Cloudflare Worker CLI | `npm install -g wrangler` |

> **Note:** For extension-only development, you only need **Node.js** and **pnpm**.

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/adhamhaithameid/Classroom-Quick-Downloader.git
cd Classroom-Quick-Downloader
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install dependencies for all modules (extension, worker, etc.).

---

## 📂 Project Structure

```
Classroom-Quick-Downloader/
├── extension/           # Browser extension (WXT + React)
├── cloudflare-worker/   # Edge analytics layer
├── oracle-backend/      # Go backend + SQLite
├── tools/               # DevOps & testing scripts
├── README.md            # User-facing documentation
└── DEVELOPMENT.md       # This file (developer guide)
```

---

## 🧩 Running the Extension Locally

The extension is built with **WXT** (Vite-based framework) and **React**.

### Start Development Server

From the project root:

```bash
pnpm dev:ext
```

Or navigate to the extension directory:

```bash
cd extension
pnpm dev
```

This will:
- Start a development server with hot reload
- Automatically open Chrome with the extension loaded
- Watch for file changes and rebuild automatically

### Load Extension Manually (if needed)

If the extension doesn't auto-load:

1. Open your browser and go to:
   - **Chrome:** `chrome://extensions/`
   - **Firefox:** `about:debugging#/runtime/this-firefox`
   - **Edge:** `edge://extensions/`

2. Enable **"Developer mode"**

3. Click **"Load unpacked"** (Chrome/Edge) or **"Load Temporary Add-on"** (Firefox)

4. Select the `extension/.output/chrome-mv3-dev` folder (or equivalent for your browser)

---

## 📦 Building for Production

### Build & Package for All Browsers

```bash
cd extension
pnpm zip:all
```

This creates production-ready `.zip` files for Chrome, Firefox, Edge, and Safari.

### Build for a Specific Browser

```bash
cd extension

# Chrome
pnpm zip -b chrome

# Firefox
pnpm zip -b firefox

# Edge
pnpm zip -b edge

# Safari
pnpm zip -b safari
```

### Check for TypeScript Errors

```bash
cd extension
pnpm compile
```

---

## ⚡ Additional Modules

### Cloudflare Worker

The edge ingestion layer that buffers analytics events.

```bash
cd cloudflare-worker

# Local development
pnpm dev

# Deploy to Cloudflare
pnpm deploy

# Run validation (lint, type-check, audit)
pnpm validate
```

### Oracle Backend

Go server with SQLite storage (requires Docker).

```bash
cd oracle-backend

# Start locally with Docker
docker compose up -d

# View logs
docker compose logs -f

# Deploy to production
./deploy.sh
```

---

## 📝 Useful Commands Reference

### Extension Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:ext` | Start dev server (from root) |
| `pnpm dev` | Start dev server (from extension dir) |
| `pnpm zip:all` | Build & zip for all browsers |
| `pnpm zip -b <browser>` | Build & zip for specific browser |
| `pnpm compile` | TypeScript check (no emit) |

### Worker Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run worker locally |
| `pnpm deploy` | Deploy to Cloudflare |
| `pnpm validate` | Lint + type-check + audit |

### Backend Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start backend locally |
| `docker compose logs -f` | View logs |
| `./deploy.sh` | Deploy to production |

### Testing Scripts

```bash
# Quick backend API check
./tools/validate.sh

# End-to-end pipeline test
./tools/test_pipeline.sh

# Load testing for aggregation
./tools/test_analytics.sh

# Verify Oracle Cloud environment
./tools/verify_oracle.sh
```

---

## 🔗 Additional Resources

- **Architecture Overview:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Privacy Policy:** [PRIVACY.md](PRIVACY.md)
- **Extension-specific docs:** [extension/README.md](extension/README.md)
- **Worker-specific docs:** [cloudflare-worker/README.md](cloudflare-worker/README.md)
- **Backend-specific docs:** [oracle-backend/README.md](oracle-backend/README.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

<div align="center">

**Happy coding! 🚀**

</div>
