// oracle-backend/internal/model/counters.go
package model

// BucketTotals represents aggregated totals for a single time bucket
// (e.g. one hour).
type BucketTotals struct {
	TotalEvents    int64 `json:"totalEvents"`
	TotalDownloads int64 `json:"totalDownloads"`
	TotalSuccess   int64 `json:"totalSuccess"`
	TotalFail      int64 `json:"totalFail"`
}

// BucketCounters holds per-dimension counters for a time bucket.
type BucketCounters struct {
	ByStatus    map[string]int64 `json:"byStatus"`
	ByType      map[string]int64 `json:"byType"`
	ByBrowser   map[string]int64 `json:"byBrowser"`
	ByOs        map[string]int64 `json:"byOs"`
	ByExtVer    map[string]int64 `json:"byExtVersion"`
	ByLanguage  map[string]int64 `json:"byLanguage"`
	ByCountry   map[string]int64 `json:"byCountry"`
	ByErrorType map[string]int64 `json:"byErrorType"`
}

// BatchSummary matches the new detailed summary sent by Cloudflare.
// This is the "1 big JSON" aggregation of the whole batch.
type BatchSummary struct {
	Totals       BucketTotals     `json:"totals"`
	Browsers     map[string]int64 `json:"browsers"`
	Os           map[string]int64 `json:"os"`
	Countries    map[string]int64 `json:"countries"`
	Languages    map[string]int64 `json:"languages"`
	Versions     map[string]int64 `json:"versions"`
	Types        map[string]int64 `json:"types"`
	ErrorReasons map[string]int64 `json:"errorReasons"`
	TopBrowser   string           `json:"topBrowser"`
	TopOs        string           `json:"topOs"`
	TopCountry   string           `json:"topCountry"`
	TopType      string           `json:"topType"`
}

// TimeBucket represents one aggregated time bucket (typically one hour).
// bucketStart/bucketEnd should be RFC3339 (UTC) strings like
// "2025-12-11T03:00:00Z".
type TimeBucket struct {
	BucketStart string         `json:"bucketStart"`
	BucketEnd   string         `json:"bucketEnd"`
	Totals      BucketTotals   `json:"totals"`
	Counters    BucketCounters `json:"counters"`
}

// DOStateRetry mirrors the retryState block from the DO /stats JSON.
type DOStateRetry struct {
	ConsecutiveFailures int    `json:"consecutiveFailures"`
	LastError           string `json:"lastError"`
	LastFlushAttemptAt  *int64 `json:"lastFlushAttemptAt"`
	NextRetryAt         *int64 `json:"nextRetryAt"`
}

// DOStateQuota mirrors the quota block from the DO /stats JSON.
type DOStateQuota struct {
	RequestsToday       int64  `json:"requestsToday"`
	QuotaLevel          string `json:"quotaLevel"`
	ModeLabel           string `json:"modeLabel"`
	RemoteEnabled       bool   `json:"remoteEnabled"`
	BatchSizeSuggestion int64  `json:"batchSizeSuggestion"`
}

// DOStateEnvSnapshot mirrors the envSnapshot block from the DO /stats JSON.
type DOStateEnvSnapshot struct {
	MaxBatchEvents string `json:"maxBatchEvents"`
	OracleEndpoint string `json:"oracleEndpoint"`
}

// DOStateCounters mirrors the counters block from the DO /stats JSON.
// (We don't strictly need this for ingestion, but it's here for completeness.)
type DOStateCounters struct {
	ByStatus    map[string]int64 `json:"byStatus"`
	ByType      map[string]int64 `json:"byType"`
	ByBrowser   map[string]int64 `json:"byBrowser"`
	ByOs        map[string]int64 `json:"byOs"`
	ByExtVer    map[string]int64 `json:"byExtVersion"`
	ByLanguage  map[string]int64 `json:"byLanguage"`
	ByCountry   map[string]int64 `json:"byCountry"`
	ByErrorType map[string]int64 `json:"byErrorType"`
}

// DOState is a compact representation of the DO's current /stats state,
// included once per batch in OracleBatch.DOState.
type DOState struct {
	OK             bool                `json:"ok"`
	TotalEvents    int64               `json:"totalEvents"`
	TotalDownloads int64               `json:"totalDownloads"`
	TotalSuccess   int64               `json:"totalSuccess"`
	TotalFail      int64               `json:"totalFail"`
	PendingEvents  int64               `json:"pendingEvents"`
	LastEventAt    *int64              `json:"lastEventAt"`
	LastFlushAt    *int64              `json:"lastFlushAt"`
	Counters       *DOStateCounters    `json:"counters,omitempty"`
	RetryState     *DOStateRetry       `json:"retryState,omitempty"`
	Quota          *DOStateQuota       `json:"quota,omitempty"`
	EnvSnapshot    *DOStateEnvSnapshot `json:"envSnapshot,omitempty"`
}

// OracleBatch is the payload that the Durable Object sends to the Oracle
// backend.
// It is *aggregated* (no raw events), idempotent by batchId, and may contain
// multiple time buckets (e.g. per hour).
type OracleBatch struct {
	BatchID     string       `json:"batchId"`
	GeneratedAt int64        `json:"generatedAt"` // unix ms from DO
	TimeZone    string       `json:"timeZone"`    // e.g. "UTC"
	Summary     BatchSummary `json:"summary"`     // <--- NEW FIELD
	TimeBuckets []TimeBucket `json:"timeBuckets"`
	DOState     DOState      `json:"doState"`
}