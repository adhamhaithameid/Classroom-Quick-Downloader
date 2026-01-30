# Browser Store Listing Package (ASO)

Proposed metadata for the three store listings, aligned with the website and
the extension manifest. Nothing here is deployed — copy/paste into each store
console at release time and re-verify every claim against the manifest of the
version being submitted.

## Fact base (do not deviate)

| Fact | Value | Source of truth |
| --- | --- | --- |
| Name | Classroom Quick Downloader | `extension/wxt.config.ts` |
| Version | 1.5.5 at time of writing | `extension/package.json` |
| Price | Free, no account, no ads | product behavior |
| Permissions | `downloads`, `storage`, `alarms` | manifest |
| Host access | classroom.google.com, drive.google.com, drive.usercontent.google.com, accounts.google.com, CQD worker | manifest |
| Manifest | V3 service worker on Chromium; Firefox build targets Gecko 109+ | wxt config |
| Data collection | Aggregate reliability counters only (outcomes, file type, browser/extension version, country) | `PRIVACY.md` |
| License | Source-available, PolyForm Noncommercial 1.0.0 — **never** "open source" or "MIT" | `LICENSE` |
| Google affiliation | None — say so explicitly | site footer |
| Developer | Adham Haitham | repo |

Proof points you MAY use (verify the numbers in the store console before
publishing): live download/user counters from the website's public snapshot
(~18.4k downloads, ~1k users, 67 countries at time of writing). Never cite
ratings or review counts without re-checking them at publish time.

## Keyword intent (use naturally, no stuffing)

Primary: **download all files from Google Classroom**
Secondary: google classroom attachments, bulk download google classroom,
classroom materials downloader, save classroom files, one click download
classroom, google drive classroom downloads.

## Chrome Web Store

- **Name (≤45 chars):** `Classroom Quick Downloader` (brand is the keyword;
  no room or need for stuffing)
- **Short description (≤132 chars):**
  `Download all Google Classroom attachments in one click. Free, private, and built for students and teachers.`
  (108 chars)
- **Detailed description** (first 3 lines carry the most weight — they render
  above the fold):
  ```
  Google Classroom has no "download all attachments" button. Classroom Quick
  Downloader (CQD) adds one: open any class or assignment and download every
  attached file in a single queued pass — no preview-hopping, no missed files.

  HOW IT WORKS
  • Install and open Google Classroom normally — buttons appear on posts with attachments.
  • Click "Download All" on one post, or sweep every post on the page.
  • Files save through your browser's normal download flow, with original names, into your Downloads folder.

  WHY IT'S DIFFERENT
  • No account, no sign-up, no ads — install and use.
  • Files go straight from Google's servers to your device. CQD never uploads or proxies your files.
  • Handles Google Drive's "Can't scan this file for viruses" interstitial during bulk downloads.
  • Works with Workspace for Education and school accounts where extensions are allowed.
  • Aggregate reliability metrics only — no file contents, file names, or personal data. Full policy: PRIVACY.md in the public repository.

  BROWSERS
  Chrome and all Chromium browsers (Edge, Brave, Opera, Vivaldi, Arc). A Firefox build is on Firefox Add-ons.

  NOT AFFILIATED WITH GOOGLE
  Classroom Quick Downloader is an independent project and is not affiliated with Google or Google Classroom.

  SOURCE
  The full source, issue tracker, and release notes are public on GitHub under a source-available (PolyForm Noncommercial) license — audit it before you trust it.
  ```
- **Permission justifications (required by CWS review):**
  - `downloads`: "Used to save assignment files to the user's device through the browser's standard download flow. This is the core function of the extension."
  - `storage`: "Stores extension preferences and download state locally on the device."
  - `alarms`: "Schedules periodic cleanup of stale internal download records."
  - Host permissions: "Content scripts must run on classroom.google.com to detect attachments and add download controls. drive.google.com and drive.usercontent.google.com are used only when a bulk download must fetch a file through Drive, including the virus-scan interstitial. accounts.google.com resolves which of the user's signed-in accounts can access a file."
  - Single purpose: "Bulk-download file attachments from Google Classroom."
- **Screenshots:** 1280×800. Lead with the Classroom page showing Download All
  buttons, then the one-click flow, then the privacy summary. Caption every
  screenshot. The 21s demo video (`/videos/solution.mp4` on the site) can be
  uploaded as the YouTube promo video.

## Firefox Add-ons (AMO)

- **Name (≤50 chars):** `Classroom Quick Downloader`
- **Summary (≤250 chars):**
  `Download all Google Classroom attachments in one click. Free and private: files go straight from Google to your device, with no account and no file uploads. Built for students and teachers.`
- **Description:** reuse the CWS body, adjusting "Browsers" to lead with
  Firefox; keep the store links relevant to Firefox.
- **Screenshots:** same set as CWS.

## Microsoft Edge Add-ons

- **Name:** `Classroom Quick Downloader`
- **Short description:** same as CWS short description.
- **Description:** reuse the CWS body, adjusting "Browsers" to lead with Edge.
- **Screenshots:** same set as CWS.

## Never claim

"Open source", "MIT", "zero permissions", "no access to Google", "guaranteed
compatibility", security guarantees, or any rating/user count not re-verified
in the store console at publish time.

## Rollout checklist

1. Update each store console at the next extension release (not before a
   meaningful release — bundle with v1.6.0).
2. Fill in CWS permission justifications exactly as above.
3. Refresh screenshots with current UI; keep captions consistent with copy.
4. Re-verify: version, privacy policy URL, support URL (site `/support`),
   homepage URL (canonical is-a.dev domain) in every console.
5. After publish, confirm the site's store links still resolve to the same
   listing IDs.
