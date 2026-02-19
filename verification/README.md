# Popup Verification

> Last updated: 2026-02-19 (v1.3.5).

This folder contains browser-based verification scripts for the extension popup.

## Run the popup load verification

1. Build the extension bundle:

```bash
pnpm --dir extension build
```

2. Install Python Playwright dependencies:

```bash
pip install playwright
python3 -m playwright install chromium
```

3. Run the verification script:

```bash
bash verification/run_verification.sh
```

The script serves `extension/.output/chrome-mv3/popup.html`, validates that
the popup title renders, and writes screenshots to this directory.
