import { StoredEvent, BatchSummary, TimeBucket } from "./types";

/**
 * Helper to find the key with the highest count in a record
 */
export function getTopKey(record: Record<string, number>): string {
  let topKey = "unknown";
  let max = -1;
  for (const [key, val] of Object.entries(record)) {
    if (val > max) {
      max = val;
      topKey = key;
    }
  }
  return topKey;
}

export function aggregateEvents(events: StoredEvent[], now: number = Date.now()): { summary: BatchSummary; timeBuckets: TimeBucket[] } {
  const summary: BatchSummary = {
    totals: { totalEvents: 0, totalDownloads: 0, totalSuccess: 0, totalFail: 0 },
    browsers: {},
    os: {},
    countries: {},
    languages: {},
    versions: {},
    types: {},
    errorReasons: {},
    topBrowser: "unknown",
    topOs: "unknown",
    topCountry: "unknown",
    topType: "unknown"
  };

  // Initialize Buckets Map
  // Key: hourString, Value: TimeBucket (accumulated)
  const bucketMap = new Map<string, TimeBucket>();

  for (const ev of events) {
    // 1. Common Computations
    const browser = (ev.browser || "unknown").toLowerCase();
    const os = (ev.os || "unknown").toLowerCase();
    const country = (ev.country || "unknown").toLowerCase();
    const lang = (ev.language || "unknown").toLowerCase();
    const ver = ev.ext_version || "0.0.0";
    const type = (ev.file_type || "unknown").toLowerCase();
    const errorType = ev.status === "fail" ? (ev.error_type || "unknown").toLowerCase() : null;

    // 2. Update Summary
    summary.totals.totalEvents++;
    summary.totals.totalDownloads++;

    if (ev.status === "success") summary.totals.totalSuccess++;
    else summary.totals.totalFail++;

    summary.browsers[browser] = (summary.browsers[browser] || 0) + 1;
    summary.os[os] = (summary.os[os] || 0) + 1;
    summary.countries[country] = (summary.countries[country] || 0) + 1;
    summary.languages[lang] = (summary.languages[lang] || 0) + 1;
    summary.versions[ver] = (summary.versions[ver] || 0) + 1;
    summary.types[type] = (summary.types[type] || 0) + 1;

    if (errorType) {
      summary.errorReasons[errorType] = (summary.errorReasons[errorType] || 0) + 1;
    }

    // 3. Update Bucket
    const ts = ev.timestamp || now;
    const d = new Date(ts);
    // Truncate to hour: "2025-12-11T03:00:00Z"
    const hourKey = d.toISOString().slice(0, 13) + ":00:00Z";

    let bucket = bucketMap.get(hourKey);
    if (!bucket) {
      // Initialize bucket
      const startDate = new Date(hourKey);
      // Add 1 hour in ms
      const endDate = new Date(startDate.getTime() + 3600000);
      const bucketEnd = endDate.toISOString().slice(0, 19) + "Z";

      bucket = {
          bucketStart: hourKey,
          bucketEnd,
          totals: { totalEvents: 0, totalDownloads: 0, totalSuccess: 0, totalFail: 0 },
          counters: {
              byStatus: {},
              byType: {},
              byBrowser: {},
              byOs: {},
              byExtVersion: {},
              byLanguage: {},
              byCountry: {},
              byErrorType: {},
          }
      };
      bucketMap.set(hourKey, bucket);
    }

    // Update Bucket Totals
    bucket.totals.totalEvents++;
    bucket.totals.totalDownloads++;
    if (ev.status === "success") bucket.totals.totalSuccess++;
    else bucket.totals.totalFail++;

    // Update Bucket Counters
    const status = ev.status || "unknown";
    bucket.counters.byStatus[status] = (bucket.counters.byStatus[status] || 0) + 1;

    // Reuse computed strings!
    bucket.counters.byType[type] = (bucket.counters.byType[type] || 0) + 1;
    bucket.counters.byBrowser[browser] = (bucket.counters.byBrowser[browser] || 0) + 1;
    bucket.counters.byOs[os] = (bucket.counters.byOs[os] || 0) + 1;
    bucket.counters.byExtVersion[ver] = (bucket.counters.byExtVersion[ver] || 0) + 1;
    bucket.counters.byLanguage[lang] = (bucket.counters.byLanguage[lang] || 0) + 1;
    bucket.counters.byCountry[country] = (bucket.counters.byCountry[country] || 0) + 1;

    if (errorType) {
      bucket.counters.byErrorType[errorType] = (bucket.counters.byErrorType[errorType] || 0) + 1;
    }
  }

  // Sort buckets
  const timeBuckets = Array.from(bucketMap.values()).sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));

  // Calculate Top Keys for Summary
  summary.topBrowser = getTopKey(summary.browsers);
  summary.topOs = getTopKey(summary.os);
  summary.topCountry = getTopKey(summary.countries);
  summary.topType = getTopKey(summary.types);

  return { summary, timeBuckets };
}
