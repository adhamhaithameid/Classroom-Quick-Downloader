# Popup Verification

This folder contains browser-based verification scripts for the extension popup.

## Run the popup load verification

1. Build the extension bundle:

```bash
pnpm --dir extension build
```

2. Run the verification script:

```bash
bash verification/run_verification.sh
```

The script serves `extension/.output/chrome-mv3/popup.html`, validates that
the popup title renders, and writes screenshots to this directory.
