# Classroom Quick Downloader — Advertising Email

## Overview

This folder contains the HTML email campaign for promoting Classroom Quick Downloader to university students, TAs, and professors.

---

## Files

| File | Description |
|------|-------------|
| `email-advertisement.html` | Main advertising email (HTML with inline CSS) |
| `README.md` | This documentation |

---

## How to Send

### 1. Deploy the Website First

The email references images hosted on your website. Deploy using:

```bash
cd website
npm run build
npx wrangler pages deploy build
```

### 2. Test the Email

1. Open `email-advertisement.html` in your browser
2. Select All (`Cmd+A` or `Ctrl+A`)
3. Copy (`Cmd+C` or `Ctrl+C`)
4. Open Gmail → Compose new email
5. Paste (`Cmd+V` or `Ctrl+V`)
6. **Test to yourself first** before sending to recipients

### 3. Send

- **Subject:** `Stop Clicking. Start Studying. Introducing: Classroom Quick Downloader Web Extension`
- **Recipients:** Students, TAs, and Professors across all majors (CS, Business, Pharmacy, Engineering, etc.)

---

## Image URLs Used

All images are hosted on your website:

```
https://classroom-quick-downloader.adhamhaithameid.is-a.dev/images/email-logo.png
https://classroom-quick-downloader.adhamhaithameid.is-a.dev/images/email-problem.png
https://classroom-quick-downloader.adhamhaithameid.is-a.dev/images/email-solution.png
https://classroom-quick-downloader.adhamhaithameid.is-a.dev/images/email-buttons.png
https://classroom-quick-downloader.adhamhaithameid.is-a.dev/images/email-edits-flag.png
https://classroom-quick-downloader.adhamhaithameid.is-a.dev/images/email-comment-flag.png
```

---

## Email Content Summary

### Subject Line
```
Stop Clicking. Start Studying. Introducing: Classroom Quick Downloader Web Extension
```

### Key Sections
1. **Header** — Logo + tagline
2. **Hero** — Pain point hook
3. **Stats** — 95 Countries, 181+ Hours Saved, 251K+ Clicks Saved, 50K+ Files Downloaded, 912 Installs
4. **Problem → Solution** — Before/after screenshots
5. **Features** — Batch Download, Visual Flags, Free Forever, Privacy First
6. **Install Buttons** — Firefox, Chrome, Edge
7. **Browser Compatibility** — Brave, Opera, Vivaldi, Arc + Chromium
8. **Screenshots** — Download button close-up, Edited/Comment flags
9. **Audience** — "Built for Every Major"
10. **Footer** — Version, Links, GitHub

---

## Extension Store Links

| Browser | Link |
|---------|------|
| Firefox | https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/ |
| Chrome | https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid |
| Edge | https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn |

---

## Website Links

| Page | URL |
|------|-----|
| Main | https://classroom-quick-downloader.adhamhaithameid.is-a.dev/ |
| FAQ | https://classroom-quick-downloader.adhamhaithameid.is-a.dev/faq |
| Privacy | https://classroom-quick-downloader.adhamhaithameid.is-a.dev/privacy |
| Changelog | https://classroom-quick-downloader.adhamhaithameid.is-a.dev/changelog |

---

## GitHub

https://github.com/adhamhaithameid/Classroom-Quick-Downloader

---

## Notes

- Email uses inline CSS (compatible with Gmail/Apple Mail when copy-pasted)
- Images must be hosted publicly for email clients to display them
- Version: 1.5.5 | Released: December 17, 2025
- Not affiliated with Google or Google Classroom