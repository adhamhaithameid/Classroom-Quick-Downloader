# Student Work Tab — Download Strategy Plan

## Problem

The Student Work tab on Google Classroom uses `classroom.google.com/g/tg/...` URLs for file links, **not** direct Google Drive URLs (`drive.google.com/file/d/...`). The current download engine (both V1 and V2) relies on recognizing Drive URLs to extract file IDs and build download links. This means files on the Student Work tab are invisible to the extension.

## Identified URL Patterns

### Direct Drive URLs (Currently Supported ✅)
- `https://drive.google.com/file/d/{FILE_ID}/view`
- `https://drive.google.com/open?id={FILE_ID}`
- `https://drive.google.com/uc?id={FILE_ID}&export=download`
- `https://docs.google.com/document/d/{FILE_ID}/edit`
- `https://docs.google.com/spreadsheets/d/{FILE_ID}/edit`

### Classroom Viewer URLs (Not Supported ❌)
- `https://classroom.google.com/g/tg/{COURSE_ID}/{ASSIGNMENT_ID}/{SUBMISSION_ID}`
- These are opaque — the file ID is not in the URL.

---

## Options

### Option A: Use Google Classroom API

Resolve the submission → file mapping via the official Google Classroom REST API.

**Endpoint chain:**
1. `courses.courseWork.studentSubmissions.list` → Get submissions
2. Each submission `.assignmentSubmission.attachments[].driveFile.id` → Get file ID
3. Build `https://drive.google.com/uc?id={FILE_ID}&export=download`

| Pros | Cons |
|------|------|
| Clean, reliable file mapping | Requires OAuth consent flow |
| Official API — won't break | Classroom API quota: 10 QPS per user |
| Returns metadata (file name, size, mime type) | Adds significant permission requests to manifest |
| Works for all assignment types | Users may be alarmed by scope requests |

**Complexity**: High — requires OAuth2 setup, token refresh, API client, error handling.

---

### Option B: Intercept Network Requests

Capture the real Drive URLs from network traffic when the Student Work page loads.

**How it works:**
1. Register a `webRequest.onBeforeRequest` listener for `classroom.google.com/g/tg/*`
2. Google Classroom's internal XHR loads the submission data (including Drive file IDs)
3. Parse the XHR response to extract `driveFile.id` from the submission object
4. Map the extracted IDs to download URLs

| Pros | Cons |
|------|------|
| No OAuth needed — uses existing session | Depends on undocumented internal XHR format |
| Zero user interaction required | Could break with any Classroom update |
| Fast — data arrives with page load | Requires `webRequest` permission (visible in store) |
| No quota limits | Response format is obfuscated (protobuf-like) |

**Complexity**: Medium — requires request interception, protobuf/JSON parsing, careful error handling.

---

### Option C: Navigate to Classroom Viewer URL and Scrape

Navigate to the `classroom.google.com/g/tg/...` URL and scrape the Drive link from the rendered page.

**How it works:**
1. User clicks download on a Student Work attachment
2. Extension opens the Classroom viewer URL in a hidden iframe/tab
3. Wait for the page to render, then query for the Drive link
4. Extract the file ID and initiate the download
5. Close the hidden tab

| Pros | Cons |
|------|------|
| Works with existing session/cookies | Very slow (full page load per file) |
| No extra permissions needed | Fragile — depends on viewer page DOM |
| Simple concept | Terrible UX for batch downloads |
| No API keys or OAuth | Could trigger bot detection |

**Complexity**: Low-Medium — but poor user experience and scalability.

---

## Recommendation

**Phase 1 (Short-term):** Implement **Option B** (Network Interception)  
Best bang-for-buck. It's fast, invisible to the user, and doesn't require OAuth. The main risk is format changes, but we can detect failures gracefully and fall back.

**Phase 2 (Long-term):** Implement **Option A** (Classroom API)  
For maximum reliability. The OAuth consent is a one-time cost, and the API is stable. This can be offered as an opt-in feature for users who want full Student Work support.

**Option C** is a last resort — it's too slow and brittle for production use.

---

## Current State

- [x] URL patterns identified and documented
- [x] DOM selectors for Student Work page expanded in `state.ts`
- [x] `toDownloadUrl()` enhanced to handle Docs viewer URLs
- [x] `findGroupRoot()` updated for Student Work submission cards
- [ ] Option B: Network interception not yet implemented
- [ ] Option A: OAuth/API integration not yet implemented
