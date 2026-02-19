#!/usr/bin/env node

const userAgent = process.env.npm_config_user_agent || "";

if (!userAgent.includes("pnpm")) {
  console.error("This repository is pnpm-only. Run: corepack enable && pnpm install");
  process.exit(1);
}
