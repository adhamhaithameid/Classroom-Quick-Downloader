#!/usr/bin/env node
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const legacySource = path.join(root, "static", "oracle-dashboard.legacy.js");
const pkgPath = path.join(root, "package.json");
const outfile = path.join(root, "static", "oracle-dashboard.js");

const legacy = await fs.readFile(legacySource, "utf8");
const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
const version = typeof pkg.version === "string" ? pkg.version : "6.0.0";

const bridge = `\n\n/* CQD Oracle Dashboard bundle (TypeScript source-of-truth bridge) */\n(function(){\n  if (typeof window !== 'undefined') {\n    window.__CQD_ORACLE_TS_BUILD__ = {\n      version: ${JSON.stringify(version)},\n      generatedAtUtc: Date.now(),\n      source: 'typescript-bridge'\n    };\n  }\n})();\n`;

await fs.writeFile(outfile, `${legacy}${bridge}`, "utf8");

console.log(`[oracle-dashboard] built ${path.relative(root, outfile)}`);
