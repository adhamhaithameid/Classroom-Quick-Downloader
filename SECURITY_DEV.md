# Security & Remote Configuration

## Overview

All analytics behavior is now **remotely controllable** from the Cloudflare dashboard.

---

## Remote Config (Controllable from Dashboard)

| Setting | Default | Description |
|---------|---------|-------------|
| `batchSize` | 50 | Downloads per request |
| `maxDailyRequests` | 50 | Max requests/day |
| `maxRetry` | 5 | Retries before drop |
| `flushMode` | `next_day` | When to send |
| `timeFlushMinutes` | {low:1440, mid:1440, high:1440} | Time-based intervals |

### Flush Modes
- **`next_day`** (default): Events sent at 1:00 AM local time
- **`time_based`**: Events sent based on timeFlushMinutes intervals

---

## Admin Endpoints

### Update Config
```bash
curl -X POST https://your-worker.workers.dev/admin/update-config \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 50,
    "maxDailyRequests": 25,
    "flushMode": "next_day"
  }'
```

### Emergency Kill Switch
```bash
# Disable all remote analytics
curl -X POST https://your-worker.workers.dev/admin/cut-power \
  -H "X-Admin-Secret: YOUR_SECRET"

# Re-enable
curl -X POST https://your-worker.workers.dev/admin/restore-power \
  -H "X-Admin-Secret: YOUR_SECRET"
```

---

## Timing

| Event | When |
|-------|------|
| Extension day reset | 1:00 AM local time |
| Extension consolidation | First request after 1:00 AM |

---

## Data Flow

```
User Downloads → Local Queue → 1:00 AM → Consolidate ALL → ONE Request → Cloudflare
```

With default `flushMode: 'next_day'`, users can download unlimited files all day. At 1:00 AM local time, ALL pending events are sent in ONE request.

---

## Scenarios

### Normal Day (100 downloads)
1. User downloads 100 files throughout the day
2. At 1:00 AM: Extension sends ALL 100 events in 1-2 requests
3. **Cloudflare requests: 2**

### Heavy Day (5000 downloads)
1. User downloads 5000 files
2. At 1:00 AM: Extension sends all in batches of 50
3. Max 50 requests = 2500 events. Rest saved for next day.
4. **Cloudflare requests: 50**

### Emergency
1. You notice Cloudflare quota spiking
2. Run: `curl .../admin/cut-power`
3. ALL extensions go local-only immediately
4. Crisis passes → `curl .../admin/restore-power`
5. **Zero data lost**
