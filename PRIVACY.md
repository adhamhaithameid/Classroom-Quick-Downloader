# 🔒 Privacy Policy

> Update (2026-02-15): Latest changes include CI coverage-gate hardening for extension analytics storage migration fallback, popup stats race-condition guards, structured step-up auth error handling in Oracle dashboard, and backend/worker auth-security hardening. See /CHANGELOG.md for details.

**Classroom Quick Downloader** — Privacy Policy

> *Last Updated: February 2026*

---

## 🎯 Our Privacy Commitment

Your privacy is our **top priority**. We built Classroom Quick Downloader to help students save time—not to collect personal data.

Here's the honest truth:

- ✅ The extension runs **entirely on your machine**
- ✅ We only collect **anonymous usage metrics** (like "100 downloads today")
- ❌ We **never** see your files, passwords, or personal information
- ❌ We **cannot** identify you as an individual

---

## 📊 Data We Collect (The "Yes" List)

We collect **anonymous telemetry** to monitor system health and improve the extension. Here's the complete list of data points we track:

| Data Point | Example | Purpose |
|---|---|---|
| **Status** | `"success"`, `"fail"`, or `"cancelled"` | Track completion outcomes and cancellation behavior |
| **File Type** | `"pdf"`, `"docx"`, `"pptx"` | Understand which file types are most common |
| **Browser** | `"chrome"`, `"edge"`, `"firefox"` | Ensure compatibility across browsers |
| **Operating System** | `"win"`, `"mac"`, `"linux"` | Ensure compatibility across platforms |
| **Extension Version** | `"1.3.6"` | Track adoption of new versions |
| **Download Duration** | `1500` (milliseconds) | Monitor download speeds |
| **Bypass Used** | `true` or `false` | Track usage of the Drive bypass feature |
| **Error Type** | `"NETWORK_ERROR"` | Diagnose and fix bugs |
| **Language** | `"en-US"`, `"ar-EG"` | Understand our global user base |
| **Country** | `"US"`, `"EG"`, `"IN"` | Geographic distribution (see below) |
| **Timestamp** | Unix timestamp | Aggregate data into hourly buckets |

### Accuracy Notes (Transparency)

- Download analytics are designed to be highly accurate, but cancellation metrics are **best effort** at very small time windows.
- If a user clicks **Cancel immediately after clicking Download** (roughly the first ~1 second), that cancellation can be undercounted due to browser/event timing races.
- Cancellations triggered after this brief startup window are tracked normally.
- We keep this behavior documented on purpose so analytics expectations stay honest while we continue improving instrumentation.

### How We Determine Your Location

We use your **IP address** to determine your **country** only—never your city, neighborhood, or precise GPS location.

Here's how it works:

1. When you download a file, the extension sends a small telemetry packet to our secure Cloudflare Worker.
2. Cloudflare automatically provides the **country code** based on your IP (e.g., `"EG"` for Egypt).
3. We store **only the country code**—we never see or store your IP address.

This means we know "50 users are from Egypt," but we have **no way of knowing** if *you* are one of them.

---

## 🚫 Data We Do NOT Collect (The "No" List)

We want to be crystal clear about what we **never** touch:

| ❌ We Do NOT Collect | Explanation |
|---|---|
| **Google Account Credentials** | We never see your email, password, or OAuth tokens. The extension uses your browser's native session. |
| **Personal Identifiable Information (PII)** | We do not collect your name, email, student ID, or any other identifying information. |
| **Contents of Your Files** | We never read, analyze, or transmit the actual files you download. We only see the file *type* (e.g., "pdf"), not its contents. |
| **Course Names or Classroom Content** | We do not scrape page content, assignment names, course titles, or teacher comments. |
| **Your IP Address** | While Cloudflare uses your IP to determine your country, we never see or store the IP itself. |
| **Browsing History** | We do not track which pages you visit, which courses you're enrolled in, or your activity on Google Classroom. |
| **Device Fingerprints** | We do not generate or store unique device identifiers. |

---

## 🔬 How We Use This Data

All collected data serves **one purpose**: making the extension better for everyone.

### Specific Use Cases

| Use Case | Example |
|---|---|
| **System Health Monitoring** | "Are downloads failing today? Is there a bug in the latest version?" |
| **Bug Diagnosis** | "PDF downloads from Firefox are failing with error `NETWORK_ERROR`. We need to investigate." |
| **Feature Usage** | "The Drive bypass feature is used by 30% of downloads. It's worth keeping." |
| **Product Improvement Prioritization** | "Near-cancel timing is undercounted in a small window; prioritize client instrumentation improvements in extension/worker/backend." |
| **Geographic Distribution** | "We have a large user base in Egypt. Should we add Arabic support?" |

### Aggregation, Not Individual Tracking

Our backend stores data as **aggregate counters**, not individual user profiles. This means:

- We see: `"PDF downloads today: 500, Failures: 12"`
- We **don't** see: `"John Doe downloaded 3 PDFs at 3:45 PM"`

There is no user ID, session ID, or any mechanism to link data points back to a specific person.

---

## 🏛️ Data Storage & Security

### Infrastructure Overview

Your anonymous telemetry flows through a **secure, privacy-respecting pipeline**:

```
Your Browser → Cloudflare Worker (Edge) → Oracle Cloud Backend → Archived to Google Sheets
                      ↓
             (Country derived here,
              IP address DISCARDED)
```

### Security Measures

| Layer | Security Measure |
|---|---|
| **Transmission** | All data is sent over **HTTPS** (TLS 1.3). |
| **Edge Processing** | Data is processed by a **Cloudflare Worker**, benefiting from Cloudflare's enterprise-grade security. |
| **Storage** | Aggregated data is stored in a **private SQLite database** on Oracle Cloud Infrastructure. |
| **Access Control** | The backend server requires authentication for all sensitive endpoints. |
| **Archival** | Daily summaries are archived to a **restricted Google Sheet** accessible only to the developer. |

### Data Retention

- **Raw event buffers** are processed and flushed within minutes.
- **Aggregated hourly data** is retained indefinitely for trend analysis.
- There are no individual-level records to delete, as they were never created.

---

## 🤝 Third-Party Services

We use the following infrastructure providers to operate the analytics pipeline:

| Provider | Role | Data Exposure |
|---|---|---|
| **Cloudflare** | Edge processing, geo-IP lookup | Cloudflare processes requests to derive country codes but does not retain user data per our Worker configuration. |
| **Oracle Cloud** | Backend server hosting | Oracle hosts our aggregation database. No user-facing PII is stored. |
| **Google Sheets API** | Daily summary archival | We use the Sheets API to append daily aggregate reports. No individual user data is involved. |

We do **not** use any third-party analytics services (Google Analytics, Mixpanel, etc.). All telemetry is processed by our own infrastructure.

---

## 🧒 Children's Privacy

Classroom Quick Downloader is designed for use in educational settings, which may include users under 13 years of age. We are committed to complying with the **Children's Online Privacy Protection Act (COPPA)** and similar regulations.

Because we:
- Do **not** collect names, emails, or any PII
- Do **not** create user accounts or profiles
- Collect only **anonymous, aggregate data**

We believe our data practices are inherently safe for all ages.

---

## 🔄 Changes to This Policy

If we make material changes to this privacy policy, we will:

1. Update the "Last Updated" date at the top of this document.
2. Include a notice in the extension's update notes (where applicable).

We encourage you to review this policy periodically.

---

## 📬 Contact Us

If you have any questions or concerns about your privacy, please reach out:

- **Email:** `your-email@example.com` *(Replace with your actual contact)*
- **GitHub Issues:** [Open an Issue](https://github.com/AhmedHaitamSaid/Classroom-Quick-Downloader/issues)

We take every privacy concern seriously and will respond promptly.

---

## 📜 Summary

| Question | Answer |
|---|---|
| **Do you collect personal data?** | No. We collect only anonymous usage metrics. |
| **Can you see my files?** | No. We only see the file *type* (e.g., "pdf"), never the contents. |
| **Do you know who I am?** | No. There is no user ID, login, or tracking mechanism. |
| **Where is my data stored?** | On secure servers operated by Cloudflare and Oracle Cloud. |
| **Can I opt out?** | Analytics is minimal and anonymous, but you can disable the extension if preferred. |
| **Are cancellation metrics always 100% exact?** | Almost. Very fast "near-cancel" actions right after clicking download can be undercounted; this is a known, documented limitation. |

---

<p align="center">
  <strong>Classroom Quick Downloader</strong><br/>
  Built with ❤️ for students, by students.
</p>
