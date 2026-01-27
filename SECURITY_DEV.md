# Security Architecture (Developer Reference)

This document describes the analytics security system for developers.

## Overview

The system is designed to **protect the free Cloudflare plan** while ensuring **zero data loss** and **never affecting user downloads**.

```
User Downloads (unlimited) → Extension Batching (50→1) → Rate Limit (50/day) → Cloudflare
```

---

## Extension Responsibilities

### 1. Batching (50 downloads → 1 request)
```typescript
const BATCH_SIZE = 50;
// After 50 download events, send ONE request to Cloudflare
```

### 2. Daily Request Limit (50 requests/day)
```typescript
const MAX_DAILY_REQUESTS = 50;
// Max 50 requests/day = 2500 downloads tracked per day
// Remaining events saved locally for tomorrow
```

### 3. Next-Day Consolidation
```typescript
if (rateLimit.isNewDay && queue.length > 0) {
  // Send ALL pending events in ONE request
  batch = queue; // Could be 500, 1000, 5000 events!
}
```

### 4. Crypto Event IDs
```typescript
// Format: ext-<timestamp>-<random12chars>
// Uses Web Crypto API for strong randomness
function generateEventId(): string {
  const ts = Date.now();
  const rand = crypto.getRandomValues(new Uint8Array(8));
  return `ext-${ts}-${Array.from(rand, b => b.toString(36)).join('')}`;
}
```

### 5. Storage Integrity
```typescript
// Checksum-based tamper detection
const checksum = computeChecksum(JSON.stringify(queue));
// Warns if data modified outside extension
```

---

## Worker Responsibilities

### 1. Payload Validation
- JSON parsing
- Required fields (id, status, timestamp)
- Event ID format validation
- Timestamp within 24h past to 5min future

### 2. Idempotency (O(1) deduplication)
```typescript
const processedSet = new Set(this.d.processedIds);
if (processedSet.has(ev.id)) {
  duplicateCount++;
  continue; // Skip duplicate
}
```

### 3. Buffer Limits
```typescript
const MAX_EVENTS_PER_REQUEST = 5000; // Support next-day consolidation
const MAX_BUFFER_SIZE = 50_000;      // Global buffer limit
```

### 4. Remote Kill Switch
```typescript
// Set hardRemoteOff: true via admin endpoint
// All extensions switch to local-only mode
```

---

## What Was Removed

- ❌ Per-IP rate limiting (extension handles this)
- ❌ Burst protection (unnecessary with batching)
- ❌ Per-request event limit of 10 (increased to 5000)

---

## Configuration

| Setting | Default | Controlled By |
|---------|---------|---------------|
| `remoteEnabled` | true | Worker /config |
| `hardRemoteOff` | false | Worker admin |
| `batchSize` | 50 | Worker /config |
| `MAX_DAILY_REQUESTS` | 50 | Extension code |

---

## Testing

To verify next-day consolidation:
```javascript
// In browser console (extension context)
await chrome.storage.local.set({
  'cqd_rate_limit_v1': { date: '2020-01-01', count: 50 }
});
// This makes extension think it's a new day on next flush
```

To simulate emergency shutdown:
```bash
curl -X POST https://your-worker.workers.dev/admin/force-hard-off \
  -H "Authorization: Bearer YOUR_SECRET"
```
