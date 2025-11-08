# Classroom Quick Downloader

Adds a **Download** button next to Google Classroom attachments so you can save files instantly without opening Drive previews.

## Features
- One-click direct download for Drive-backed attachments (PDF, Docs, Sheets, Slides, images, audio, video, Office files, etc.)
- Works across Classroom’s SPA pages using a `MutationObserver`
- Material-style elevated button (icon + label), no duplicates, no extra permissions

## How It Works
- Detects attachment anchors linking to `drive.google.com`
- Extracts the Drive **file ID** via RegExp (`/\/d\/([a-zA-Z0-9_-]+)/` or `?id=...`)
- Builds a direct URL: `https://drive.google.com/uc?export=download&id=FILE_ID`
- Injects a lightweight button that triggers immediate download

## Installation (Developer Mode)
1. Download/clone this folder: `classroom-quick-downloader/`
2. Visit `chrome://extensions` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** and select the folder
5. Open `https://classroom.google.com/` and look for the **Download** button near attachments

## Folder Structure
classroom-quick-downloader/
├── manifest.json
├── content.js
└── icons/
└── icon128.png

## Notes
- No additional permissions required for basic direct-download behavior.
- If some files require authenticated fetch, you can later add host permissions for Drive and switch to a `fetch → blob` flow.

## License
This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 License.
Commercial use is not allowed without my explicit written permission.
