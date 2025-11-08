# Classroom Quick Downloader

## Features

* **One-click downloads** for Google Classroom attachments — skips Drive preview.
* **Material-style blue pill** (“Download”) with **inline SVG icon** (no broken images).
* **Smart de-duplication**: injects a single pill per file per post/card (even if multiple links exist).
* **Dynamic placement**: inserts after the filename; if the row is cramped (e.g., *Your work*), the pill automatically **moves to its own row below**, and moves back inline when space allows.
* **SPA-resilient**: survives route changes, lazy loads, and DOM re-renders (MutationObserver + route hooks + periodic light rescan).
* **No config, no extra permissions** — just works on `https://classroom.google.com/*`.

## File Tree

```
classroom-quick-downloader/
├── manifest.json
├── icons.js          # inline SVG icon helper (CSP-proof; exposes CQD_ICONS)
├── content.js        # main logic: detect, extract ID, inject pill, dynamic placement
└── icons/
    ├── icon48.png    # (optional) toolbar icon
    └── icon128.png   # toolbar icon referenced by manifest
```

## Installation

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `classroom-quick-downloader` folder.
4. Open or refresh `https://classroom.google.com/`.

## How It Works

* **Detect**: Scans Classroom posts/tiles for attachment elements (`a`, `[role="link"]`), skipping thumbnail-only links.
* **Extract File ID**: Parses Drive IDs from:

  * `/file/d/<FILE_ID>/…`
  * `?id=<FILE_ID>`
  * ID-like values found in attributes or embedded JSON blobs on the element.
* **Inject Pill**: Creates a Material-style **Download** pill (button + inline SVG icon) right after the filename link.
* **Direct Download**: Builds `https://drive.google.com/uc?export=download&id=<FILE_ID>` and triggers it immediately on click.
* **Stay Visible**: A layout watchdog (ResizeObserver) checks for overflow/no-wrap rows. If the pill is clipped, it **moves to a dedicated row below** the file; if space returns, it goes **back inline**.
* **Resilience**: MutationObserver + `history.pushState/replaceState` hooks + a light periodic rescan keep pills present across SPA navigation and DOM churn.

## Privacy

* Runs entirely **client-side** as a content script on `classroom.google.com`.
* **No data collection**, tracking, analytics, or external network calls.
* **No additional permissions** beyond the content script match.
* Downloads are initiated directly from Google Drive URLs; the extension does not proxy or inspect file contents.

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 License**.
Commercial use is **not** allowed without my explicit written permission.
