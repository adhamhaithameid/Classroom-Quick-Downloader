# Classroom API v1 — read surface for enumerating an entire course's files

Researched 2026-09-21 against primary sources: the Google Classroom API REST reference
(developers.google.com, now canonically under `/workspace/classroom/...`; the older
`/classroom/...` paths 301-redirect to it), Google's live discovery documents for
Classroom v1 (revision 20260915) and Drive v3 (revision 20260913), the Google Workspace
Drive API guides, and Google's Cloud API design docs. Every factual claim below carries
a citation. Quotes are verbatim from the cited page.

## Answers (summary)

1. **courseWork.list** — yes, every returned `CourseWork` embeds `materials[]` (max 20
   items). The Material union is `driveFile` (type `SharedDriveFile`, so the Drive id
   nests at `driveFile.driveFile.id`), `youtubeVideo`, `link`, `form`, plus read-only
   `gem` and `notebook`. `pageSize` has **no documented numeric maximum** — the docs only
   say the server "may assign a maximum" and may return fewer results; pagination is via
   opaque `nextPageToken` and the follow-up request "must be otherwise identical" to the
   original. The Classroom reference documents a standard `fields` query parameter
   (field-mask partial responses) usable to trim payloads.
2. **courseWorkMaterials.list** — same Material union, same 20-item cap, same pagination
   wording. It differs from courseWork materials in that `CourseWorkMaterial` is a
   standalone "material-only" post type (no submissions, no `workType`), and its list
   method uniquely supports `materialLink` (partial URL match) and `materialDriveId`
   (exact Drive-id match) filters.
3. **announcements.list** — yes; `Announcement.materials[]` exists with the same Material
   union and the same 20-item cap. Students see only PUBLISHED; teachers and domain
   administrators see all states.
4. **Quotas** — documented on the Classroom "Usage Limits" page: **4,000,000 queries per
   day per client (avg 46 QPS), 3,000 queries per minute per client (50 QPS), 1,200
   queries per minute per user (20 QPS)**, checked on a 60-second moving average. Quota
   is enforced both per client (project) and per user. Exceeding limits returns
   `RESOURCE_EXHAUSTED`; Google's guidance is to retry "preferably using exponential
   backoff", or to use push notifications instead of polling.
5. **Drive downloads without the Drive API** — the repo builds
   `https://drive.google.com/uc?export=download&id={fileId}&authuser={n}`. Google's own
   docs confirm that cookie-based browser downloads of Drive blob content with no Drive
   API token are possible (documented mechanism: `files.webContentLink`), but the `/uc`
   endpoint itself is **not documented anywhere in the Drive API docs**, and Google-hosted
   issue-tracker/support threads report it breaking (403s, Jan 2024). Caveats:
   Google-Docs-native files are not binary blobs and need export flows; large files hit
   an (undocumented) virus-scan interstitial requiring `confirm=t`; shared-drive items
   work only if the user has download access.
6. **API vs UI** — the docs guarantee completeness relative to permissions only: each
   list method returns "a list of … that the requester is permitted to view", with all
   materials embedded inline per item, so one paginated sweep per collection covers the
   whole course without per-item fetches. Google does **not** document how the Classroom
   web UI lazy-loads or collapses anything, so "the API sees more than the UI renders"
   cannot be proven from primary sources (see Gaps).

---

## 1. courses.courseWork.list

**Endpoint.** `GET https://classroom.googleapis.com/v1/courses/{courseId}/courseWork`
(gRPC transcoding syntax; `courseId` may be a Classroom-assigned ID or an alias).
Source: [courses.courseWork/list reference](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/list)
and the [discovery document](https://classroom.googleapis.com/$discovery/rest?version=v1).

**Description (verbatim).** "Returns a list of course work that the requester is
permitted to view. Course students may only view PUBLISHED course work. Course teachers
and domain administrators may view all course work." Documented error codes:
`PERMISSION_DENIED` ("if the requesting user is not permitted to access the requested
course or for access errors"), `INVALID_ARGUMENT`, `NOT_FOUND`.
Source: [courses.courseWork/list](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/list).

**Query parameters.**
- `courseWorkStates[]` — "Restriction on the work status to return… If unspecified,
  items with a work status of `PUBLISHED` is returned." States: `PUBLISHED`, `DRAFT`,
  `DELETED`; DRAFT/DELETED "is visible only to course teachers and domain
  administrators" ([CourseWork resource](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork), [list reference](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/list)).
- `orderBy` — "Supported fields are `updateTime` and `dueDate`" with `asc`/`desc`;
  default `updateTime desc` (same two sources).
- `pageSize` — verbatim: "Maximum number of items to return. Zero or unspecified
  indicates that the server may assign a maximum. The server may return fewer than the
  specified number of results." **No numeric cap is published for this method.**
- `pageToken` — "nextPageToken value returned from a previous list call… The list
  request must be otherwise identical to the one that resulted in this token."
- `previewVersion` — for preview-program features.

**Pagination.** Response is `{ courseWork: CourseWork[], nextPageToken }`;
`nextPageToken` is "Token identifying the next page of results to return. If empty, no
further results are available." (sources above).

**Does each courseWork embed materials[]?** Yes. `CourseWork.materials` — verbatim:
"Additional materials. CourseWork must have no more than 20 material items."
Source: [CourseWork resource](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork)
and discovery schema `CourseWork`.

**Material union (exact shape).** From the
[Material reference](https://developers.google.com/workspace/classroom/reference/rest/v1/Material)
and discovery schema `Material` — union field `material`, exactly one of:

| Field | Type (documented) | Description (verbatim) |
|---|---|---|
| `driveFile` | `SharedDriveFile` | "Google Drive file material." |
| `youtubeVideo` | `YouTubeVideo` | "YouTube video material." |
| `link` | `Link` | "Link material. On creation, this is upgraded to a more appropriate type if possible, and this is reflected in the response." |
| `form` | `Form` | "Google Forms material. Read-only." |
| `gem` | `GeminiGem` | "Gemini Gem material. Read-only." |
| `notebook` | `NotebookLmNotebook` | "NotebookLM Notebook material. Read-only." |

Note the wrapper: `Material.driveFile` is a **`SharedDriveFile`**, i.e.
`{ driveFile: DriveFile, shareMode }` where `ShareMode` enum is `UNKNOWN_SHARE_MODE`,
`VIEW`, `EDIT`, `STUDENT_COPY` ("Mechanism by which students access the Drive item").
So on the wire a courseWork Drive material's id is at
`materials[].driveFile.driveFile.id` — one level deeper than the flat
`Attachment.driveFile.id` used by studentSubmissions. (Compare
[Material/SharedDriveFile](https://developers.google.com/workspace/classroom/reference/rest/v1/Material#SharedDriveFile)
with the discovery `Attachment` schema; the extension's current
`GoogleClassroomAttachment` interface in `extension/src/engines/v3/api/classroom-api-client.ts`
models the flat submission shape, which is correct for attachments but would be wrong
for materials.)

**Sub-resource fields** (all verbatim from the reference / discovery):
- `DriveFile`: `id` ("Drive API resource ID"), `title` (ro, "Title of the Drive item"),
  `alternateLink` (ro, "URL that can be used to access the Drive item"),
  `thumbnailUrl` (ro). Source: [DriveFile](https://developers.google.com/workspace/classroom/reference/rest/v1/DriveFile).
- `Link`: `url` ("must be a valid UTF-8 string containing between 1 and 2024
  characters"), `title` (ro), `thumbnailUrl` (ro). Source: [Link](https://developers.google.com/workspace/classroom/reference/rest/v1/Link).
- `Form`: `formUrl` ("URL of the form"), `responseUrl` ("Only set if responses have been
  recorded and only when the requesting user is an editor of the form. Read-only."),
  `title` (ro), `thumbnailUrl` (ro). Source: [Form](https://developers.google.com/workspace/classroom/reference/rest/v1/Form).
- `YouTubeVideo`: `id` ("YouTube API resource ID"), `title`, `alternateLink`,
  `thumbnailUrl` (all three read-only). Source: [YouTubeVideo](https://developers.google.com/workspace/classroom/reference/rest/v1/YouTubeVideo).

**Scopes.** courseWork.list requires one of `classroom.coursework.me`,
`classroom.coursework.me.readonly`, `classroom.coursework.students`,
`classroom.coursework.students.readonly` (discovery `scopes`; also shown in the
reference page's Authorization section). **`classroom.readonly` is not among them** —
see the scope note below.

**Field masks.** The Classroom reference documents standard query parameters
([Standard Query Parameters](https://developers.google.com/workspace/classroom/reference/query-params)),
and Google's Cloud API docs define the `fields` system parameter ("Selects a subset of
fields…") available "across all Google REST APIs"
([System parameters](https://cloud.google.com/apis/docs/system-parameters)). So
`?fields=courseWork(id,title,materials,nextPageToken),nextPageToken` is a
documented, supported way to shrink list responses. Sensible pickable fields per the
schemas above: `id`, `title`, `state`, `topicId`, `assigneeMode`,
`individualStudentsOptions`, `materials`, `dueDate`, `dueTime`, `alternateLink`,
`updateTime`.

## 2. courses.courseWorkMaterials.list

**Endpoint.** `GET https://classroom.googleapis.com/v1/courses/{courseId}/courseWorkMaterials`.
Source: [courses.courseWorkMaterials/list reference](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWorkMaterials/list).

**Description.** The page states the method returns the list of course work materials
the requester is permitted to view; students see only PUBLISHED, "teachers and domain
administrators can view all" course work materials. Errors: `PERMISSION_DENIED`,
`INVALID_ARGUMENT`, `NOT_FOUND`. (Same page.)

**Query parameters.** `courseWorkMaterialStates[]` (defaults to PUBLISHED), `orderBy`
("Supported field is `updateTime`"; default `updateTime desc`), `pageSize` — same
verbatim wording as courseWork.list, again **no numeric cap** — `pageToken` (same
"must be identical" rule), and two filters unique to this method: `materialLink`
("Optional filtering for course work material with at least one link material whose URL
partially matches the provided string") and `materialDriveId` ("Optional filtering for
course work material with at least one Drive material whose ID matches the provided
string"). Sources: list reference and
[discovery document](https://classroom.googleapis.com/$discovery/rest?version=v1).

**How it differs from courseWork materials.** `CourseWorkMaterial` is a separate
resource: a material-only post attached to the course (optionally to a `topicId`), with
`state` (`PUBLISHED`/`DRAFT`/`DELETED`), `assigneeMode`/`individualStudentsOptions`, and
`materials` — "Additional materials. A course work material must have no more than 20
material items." It has no `workType`, no due date, and no student submissions — it is
"stuff posted under Classwork" without being an assignment. Same Material union shape
and same nested `driveFile.driveFile.id` wire form as courseWork materials.
Source: discovery schema `CourseWorkMaterial` and
[courses.courseWorkMaterials resource](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWorkMaterials).

**Scopes.** Requires `classroom.courseworkmaterials` or
`classroom.courseworkmaterials.readonly` ("See all classwork materials for your Google
Classroom classes") — discovery `scopes`; scope description from the
[Classroom auth guide](https://developers.google.com/workspace/classroom/guides/auth).

## 3. courses.announcements.list

**Endpoint.** `GET https://classroom.googleapis.com/v1/courses/{courseId}/announcements`.
Source: [courses.announcements/list reference](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.announcements/list).

**Description (verbatim).** "Returns a list of announcements that the requester is
permitted to view. Course students may only view PUBLISHED announcements. Course
teachers and domain administrators may view all announcements." Errors:
`PERMISSION_DENIED`, `INVALID_ARGUMENT`, `NOT_FOUND`. (Same page.)

**Query parameters.** `announcementStates[]` ("If this argument is left unspecified,
the default value is PUBLISHED"), `orderBy` (supported field `updateTime`; default
`updateTime desc`), `pageSize` — same wording, **no numeric cap** — and `pageToken`
(same "must be otherwise identical" rule). Response:
`{ announcements: Announcement[], nextPageToken }`. (Same page.)

**Do announcements carry materials[]?** Yes — `Announcement.materials`: "Additional
materials. Announcements must have no more than 20 material items." Same Material union
(i.e. driveFile/youtubeVideo/link/form/gem/notebook) as sections 1–2. There is also
`alternateLink`, "only populated if `state` is PUBLISHED", and `scheduledTime` for
unpublished scheduled posts. Source: discovery schema `Announcement`;
[Announcement resource](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.announcements).

**Scopes.** Requires `classroom.announcements` or
`classroom.announcements.readonly` ("View announcements in Google Classroom") —
discovery `scopes`; [announcements list reference](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.announcements/list).

## 4. Quotas, error semantics, backoff

**Documented quota table** — Classroom "Usage Limits" page, verbatim numbers:
"By default, the Classroom API is subject to the limits in the following table:
Queries per day per client — 4,000,000 (Avg. 46 QPS). Queries per minute per client —
3,000 (50 QPS). Queries per minute per user — 1,200 (20 QPS)." Also: "Quota is checked
on a 60-second moving average, which allows for spikes in usage." And: "The permitted
QPS may be increased or decreased depending on a number of operational factors."
Source: [Usage Limits](https://developers.google.com/workspace/classroom/reference/limits).

**Per-project or per-user?** Both: the table has a per-client (i.e. per OAuth client /
Cloud project) column set **and** a per-user limit. The page's increase instructions
talk about "usage limits for your project" and raising quota via the Cloud Console
("Enabled APIs page… select Quotas"), confirming the client dimension is the project.
(Same page.)

**Error semantics.** The Usage Limits page says verbatim: "ensure that you respond to
retryable errors (such as the RESOURCE_EXHAUSTED error that is returned when a request
exceeds your limits) by retrying the request, preferably using exponential backoff."
Google's Cloud API error model maps `RESOURCE_EXHAUSTED` to HTTP 429 (its example error
JSON shows `"code": 429 … "status": "RESOURCE_EXHAUSTED"`) and states "If the user does
not have permission to access the resource or parent… the service must error with
PERMISSION_DENIED (HTTP 403)."
Sources: [Usage Limits](https://developers.google.com/workspace/classroom/reference/limits),
[Errors / AIP-193](https://cloud.google.com/apis/design/errors). The per-method
reference pages document the symbolic codes (`PERMISSION_DENIED`, `INVALID_ARGUMENT`,
`NOT_FOUND`) rather than numeric statuses (section 1–3 above).

**Recommended mitigation.** Same page: besides exponential-backoff retries, "If you are
polling for changes on an endpoint where this is offered, consider using push
notifications instead" — Classroom supports push-notification registrations
([push notifications guide](https://developers.google.com/workspace/classroom/guides/push-notifications);
the discovery document's top-level `registrations` resource confirms the endpoint).

**Not documented:** any statement that list methods cost quota differently, or minimum
retry intervals (no numbers are published — only "exponential backoff"). See Gaps.

## 5. Drive downloads without the Drive API

**What the repo builds today.** `buildDriveDownloadUrl` in
`extension/src/student_work/url-classifier.ts` (lines 76–84) constructs
`https://drive.google.com/uc?export=download&id={fileId}` plus `authuser={n}` when the
Classroom path supplied one — i.e. the legacy `drive.google.com/uc` pattern, **not**
`drive.usercontent.google.com`.

**What Google documents.** The Drive API guide "Download and export files" confirms the
cookie-based, no-API-token download path exists as a *documented* mechanism only via
`files.webContentLink`: "To download the content of blob files stored on Drive within a
browser, instead of through the API, use the `webContentLink` field of the files
resource. If the user has download access to the file, a link for downloading the file
and its contents is returned. You can either redirect a user to this URL, or offer it
as a clickable link." The Drive v3 discovery `File.webContentLink` description (verbatim):
"A link for downloading the content of the file in a browser. This is only available
for files with binary content in Google Drive."
Sources: [manage-downloads guide](https://developers.google.com/drive/api/guides/manage-downloads),
[Drive v3 discovery](https://www.googleapis.com/discovery/v1/apis/drive/v3/rest) (same
wording on the [files reference](https://developers.google.com/drive/reference/rest/v3/files)).
So: browser-cookie downloads of Drive content with no Drive API token are a
Google-sanctioned pattern, gated on "the user has download access".

**Is the repo's exact URL pattern documented? No.** `drive.google.com/uc?export=download`
appears nowhere in the Drive API documentation; it is the Drive web app's download
endpoint. Google-hosted community/issue-tracker sources document both its behavior and
its fragility: Google Issue Tracker report "403 Forbidden for
https://drive.google.com/uc?export=download" ([issuetracker 319531488](https://issuetracker.google.com/issues/319531488),
Jan 2024) and a Google Sites support thread reporting the same endpoint "stopped
working" for embedded downloads ([support thread 253075501](https://support.google.com/sites/thread/253075501/)).
Community tooling docs additionally document that large downloads are now served via a
redirect to `drive.usercontent.google.com/download?id=…&export=download&confirm=t…`
(the `confirm=t` token substitutes for the virus-scan "Download anyway" interstitial).
Verdict: a `driveFile.id` from the Classroom API *generally* resolves to a direct
download in a signed-in browser session via the `uc` pattern because cookies carry the
auth, but it is undocumented surface with a recorded outage history.

**Caveats to flag:**
- **Google-native files** (Docs/Sheets/Slides): the docs' own split is "blob file" vs
  "Google Workspace document"; the latter's browser-download path is `exportLinks` and
  its API path is `files.export` (manage-downloads guide, table at top). `webContentLink`
  is "only available for files with binary content", and the `uc` endpoint does not
  produce a converted export — a Docs-native material will not download as a file via
  the repo's URL. Classroom's `DriveFile` gives no mime type, so the extension cannot
  detect this case without the Drive API.
- **Large-file virus-scan interstitial**: not documented in the API docs; Google support
  threads document the "can't scan this file for viruses… file is larger than our
  scanning limit" prompt on browser downloads, and community docs the `confirm=t`
  bypass ([support.google.com/drive thread 71620284](https://support.google.com/drive/thread/71620284/can-t-download-files-from-google-drive)).
  Extension downloads that follow redirects and render in a user session see the
  interstitial rather than bytes.
- **Shared drives**: the documented gate is access, not container: "If the user has
  download access to the file, a link for downloading the file and its contents is
  returned" (manage-downloads guide). Drive exposes `capabilities.canDownload` to check
  this, but that requires the Drive API; Classroom materials carry only id/title.
- **Permissions**: anything shared "restricted" to non-class members will fail on
  cookie auth; the Classroom API does not expose the Drive share mode beyond the
  material's `shareMode` (VIEW/EDIT/STUDENT_COPY), which describes how students *open*
  the item, not who can download it.

## 6. What the API enumerates that the UI hides or lazy-loads

**What the docs actually guarantee** is permission-relative completeness with materials
inlined: all three list methods "return a list of … that the requester is permitted to
view" ([courseWork.list](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/list),
[announcements.list](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.announcements/list),
[courseWorkMaterials.list](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWorkMaterials/list)),
each item carrying its full `materials[]` (≤20) inline, and topics are separately
enumerable via `courses.topics.list` (present in the
[discovery document](https://classroom.googleapis.com/$discovery/rest?version=v1)).
For a teacher/admin account, passing the DRAFT/DELETED states to the state filters
returns unpublished and deleted items ("Course teachers and domain administrators may
view all…" on all three pages) — content that the student-facing UI never renders.
For a student account, the API set is exactly the PUBLISHED set.

**What the docs do NOT say** is anything about the web UI's lazy-loading, collapsed
topics, or attachment rendering. Google publishes no statement comparing API list
responses to UI rendering, so any claim like "the API sees materials the UI hides until
you expand a topic" cannot be sourced to primary documentation. The defensible
doc-backed statement is narrower: the API exposes every permitted item of each
collection in one paginated sweep with attachments embedded, including item states
(DRAFT, DELETED, scheduled) and per-item `topicId` grouping, with no rendering-dependent
behavior. See Gaps.

---

## Repo-specific cross-check

- `extension/src/student_work/url-classifier.ts` — `buildDriveDownloadUrl` uses
  `https://drive.google.com/uc?export=download&id=…(&authuser=…)` (section 5).
- `extension/src/engines/v3/api/classroom-api-client.ts` — sends `pageSize=200` to
  `studentSubmissions.list` and walks up to 10 `nextPageToken` pages. Docs for that
  method's `pageSize` use the same wording ("server may assign a maximum"; no published
  numeric cap), so 200 is tolerated but not documented. The hardcoded 10-page guard
  will silently truncate courses with more pages; `nextPageToken` empty = done is per
  spec.
- `extension/wxt.config.ts` declares the OAuth2 scope
  `https://www.googleapis.com/auth/classroom.readonly` — see the scope finding below.

## Gaps (what the docs do not settle)

1. **No numeric pageSize maximum** is published for `courseWork.list`,
   `courseWorkMaterials.list`, `announcements.list`, or `studentSubmissions.list` — only
   "the server may assign a maximum. The server may return fewer than the specified
   number of results." Optimal page size must be found empirically.
2. **`classroom.readonly` is absent from all current primary scope documentation**: it
   does not appear in the Classroom auth guide's scope table
   ([auth guide](https://developers.google.com/workspace/classroom/guides/auth)), nor in
   Google's OAuth scopes reference Classroom section
   ([scopes reference](https://developers.google.com/identity/protocols/oauth2/scopes)),
   nor in any method's `scopes` array in the Classroom discovery document (which instead
   requires the fine-grained `coursework.students/me.readonly`,
   `courseworkmaterials.readonly`, and `announcements.readonly` scopes for the three
   list methods). The repo reports `studentSubmissions.list` working with
   `classroom.readonly` in practice, so Google evidently still honors the legacy scope
   for that call — but this cannot be confirmed from documentation, and enumerating
   courseWork + courseWorkMaterials + announcements may 403 with only
   `classroom.readonly`. Empirical testing (or adding the three fine-grained readonly
   scopes to the manifest's oauth2 scopes and re-consenting) is required before building
   a course-wide inventory on top of it.
3. **The `drive.google.com/uc?export=download` endpoint is undocumented**, with a
   documented-in-community history of breaking (2024 403 report). No Google doc commits
   to its stability, its exact interstitial behavior for large files, or its treatment
   of shared-drive items.
4. **No mime-type or export info** is exposed on Classroom `DriveFile`, so Google-native
   documents cannot be distinguished from binary blobs without the Drive API; the docs
   only define blob vs Workspace-document export flows on the Drive side.
5. **Quota numbers have no minimum backoff timing** attached — "preferably using
   exponential backoff" is the entire published guidance; the permitted QPS is also
   explicitly subject to change "depending on a number of operational factors".
6. **UI parity is undocumented** — nothing in the reference states how Classroom's web
   UI lazy-loads or collapses content, so "the API enumerates more than the UI renders"
   remains anecdotal (section 6).
