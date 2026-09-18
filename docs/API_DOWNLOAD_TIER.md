# API download tier — the reserved third acquisition strategy (no-dead-ends)

**Status: DESIGNED, NOT ACTIVE.** The tier is scaffolded in
`extension/src/strategies/acquire/strategy-chain.ts` with `enabled: () => false`.
It activates only when ALL of the following land (the #398 consent model):

1. Google OAuth **client id** for the extension (owner-side, Cloud console).
2. The `identity` **permission** in `wxt.config.ts` + the `oauth2` manifest block
   with scope `https://www.googleapis.com/auth/drive.readonly`.
3. The consent UX: first use of the tier asks explicitly; a refusal disables
   the tier for the install (recorded decision to be filed under #398).

## What it does

For a Drive file whose cookie-based tiers failed with `forbidden`, fetch:

```
GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
Authorization: Bearer <chrome.identity.getAuthToken token>
```

and hand the bytes to the download manager (blob URL or service-worker fetch →
`chrome.downloads.download`). The API sees the file through the *extension's*
granted access rather than whichever account's cookies the browser ambiently
holds — the redundancy tier for the "no signed-in account has access" dead end.

## Why it is flag-gated

- It cannot work at all until (1)+(2) exist; shipping the slot early would be
  dead code (master plan R7's exact warning for S13).
- It changes the privacy story (tokens, API access) — that is #398's consent
  design, which must be locked BEFORE code activates.

## Relation to S13

S13's ApiDetector is the DETECTION half (Classroom API for post/file
discovery). This tier is the ACQUISITION half (Drive API for byte serving).
They share the OAuth foundation and the consent gate but are separate
strategies on separate chains.
