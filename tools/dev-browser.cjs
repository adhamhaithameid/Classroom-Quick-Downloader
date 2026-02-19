#!/usr/bin/env node
/* eslint-disable no-console */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const SUPPORTED = ['chrome', 'brave', 'firefox'];
const repoRoot = path.resolve(__dirname, '..');
const extensionDir = path.join(repoRoot, 'extension');

function findBraveBinary() {
  if (process.env.VITE_DEV_BRAVE_PATH && fs.existsSync(process.env.VITE_DEV_BRAVE_PATH)) {
    return process.env.VITE_DEV_BRAVE_PATH;
  }

  const candidates = process.platform === 'darwin'
    ? [
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      ]
    : process.platform === 'win32'
      ? [
          'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
          'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        ]
      : [
          '/usr/bin/brave-browser',
          '/usr/bin/brave',
          '/snap/bin/brave',
        ];

  for (const item of candidates) {
    if (fs.existsSync(item)) return item;
  }
  return null;
}

function printUsage() {
  console.log('Usage:');
  console.log('  pnpm run dev');
  console.log('  pnpm run dev chrome');
  console.log('  pnpm run dev brave');
  console.log('  pnpm run dev firefox');
}

function chooseBrowserInteractive() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve('chrome');
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('Choose browser:');
    console.log('1) chrome');
    console.log('2) brave');
    console.log('3) firefox');

    rl.question('Enter choice [1-3] (default: 1): ', (answer) => {
      rl.close();
      const normalized = String(answer || '').trim().toLowerCase();
      if (normalized === '2' || normalized === 'brave') return resolve('brave');
      if (normalized === '3' || normalized === 'firefox') return resolve('firefox');
      return resolve('chrome');
    });
  });
}

function runWxt(browser) {
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const env = { ...process.env };
  const args = ['exec', 'wxt'];

  if (browser === 'firefox') {
    args.push('-b', 'firefox');
    delete env.VITE_DEV_BROWSER_PATH;
  } else if (browser === 'brave') {
    const bravePath = findBraveBinary();
    if (!bravePath) {
      console.error('Brave binary not found. Set VITE_DEV_BRAVE_PATH to your Brave executable path.');
      process.exit(1);
    }
    env.VITE_DEV_BROWSER_PATH = bravePath;
  } else {
    delete env.VITE_DEV_BROWSER_PATH;
  }

  const child = spawn(cmd, args, {
    cwd: extensionDir,
    stdio: 'inherit',
    env,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

async function main() {
  const arg = String(process.argv[2] || '').trim().toLowerCase();
  const browser = arg || await chooseBrowserInteractive();

  if (!SUPPORTED.includes(browser)) {
    console.error(`Unsupported browser: ${browser}`);
    printUsage();
    process.exit(1);
  }

  runWxt(browser);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
