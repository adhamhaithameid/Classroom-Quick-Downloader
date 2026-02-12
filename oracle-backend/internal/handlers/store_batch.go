// oracle-backend/internal/handlers/store_batch.go
package handlers

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strconv"
	"time"

	model "oracle-backend/internal/model"
)

type ingestResponse struct {
	OK         bool   `json:"ok"`
	Message    string `json:"message,omitempty"`
	BatchID    string `json:"batchId,omitempty"`
	IngestedAt int64  `json:"ingestedAt,omitempty"`
}

const failureLogRetentionDays = 30
const maxFailureFieldLen = 64
const maxFailureDetailLen = 240

func sanitizeFailureField(input string, fallback string) string {
	v := input
	if v == "" {
		return fallback
	}
	if len(v) > maxFailureFieldLen {
		v = v[:maxFailureFieldLen]
	}
	return v
}

func sanitizeFailureDetail(input string) string {
	if input == "" {
		return "n/a"
	}
	v := input
	if len(v) > maxFailureDetailLen {
		v = v[:maxFailureDetailLen]
	}
	return v
}

func dayUTC(tsMs int64) string {
	return time.UnixMilli(tsMs).UTC().Format("2006-01-02")
}

// IngestBatchHandler handles POST /ingest-batch (and /storeBatch alias).
// It expects an aggregated OracleBatch from the DO, is idempotent by batchId,
// and writes:
//   - batches
//   - downloads_hourly
//   - downloads_totals
//   - do_state_snapshots
func IngestBatchHandler(db *sql.DB, sharedSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		if sharedSecret == "" {
			logEvent("error", "ingest_misconfigured", map[string]interface{}{
				"reason": "DO_SHARED_SECRET missing",
			})
			recordOracleFailure(db, "ingest", "misconfigured", "DO_SHARED_SECRET missing", 1, "", "")
			http.Error(w, "server misconfigured: DO_SHARED_SECRET not set", http.StatusInternalServerError)
			return
		}

		// Limit body size to 5MB to prevent abuse
		r.Body = http.MaxBytesReader(w, r.Body, 5<<20)

		// Constant-time comparison for secret to prevent timing attacks
		headerSecret := r.Header.Get("X-DO-SECRET")
		if headerSecret == "" || subtle.ConstantTimeCompare([]byte(headerSecret), []byte(sharedSecret)) != 1 {
			logEvent("warn", "ingest_unauthorized", map[string]interface{}{
				"reason": "missing_or_invalid_secret",
			})
			recordOracleFailure(db, "ingest_auth", "unauthorized", "missing_or_invalid_secret", 1, "", "")
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var batch model.OracleBatch
		if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
			logEvent("warn", "ingest_invalid_json", map[string]interface{}{
				"error": err.Error(),
			})
			recordOracleFailure(db, "ingest", "invalid_json", err.Error(), 1, "", "")
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if batch.BatchID == "" {
			logEvent("warn", "ingest_missing_batch_id", nil)
			recordOracleFailure(db, "ingest", "missing_batch_id", "batchId is required", 1, "", "")
			http.Error(w, "missing batchId", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		if err := ingestBatch(ctx, db, &batch); err != nil {
			logEvent("error", "ingest_failed", map[string]interface{}{
				"error":   err.Error(),
				"batchId": batch.BatchID,
			})
			recordOracleFailure(db, "ingest", "ingest_failed", err.Error(), 1, batch.BatchID, "")
			http.Error(w, "failed to ingest batch: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ingestResponse{
			OK:         true,
			Message:    "ingested",
			BatchID:    batch.BatchID,
			IngestedAt: time.Now().UnixMilli(),
		})
	}
}

func ingestBatch(ctx context.Context, db *sql.DB, batch *model.OracleBatch) error {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Idempotency: if batch_id exists, do nothing.
	var exists int
	err = tx.QueryRowContext(ctx, `SELECT 1 FROM batches WHERE batch_id = ?`, batch.BatchID).Scan(&exists)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if err == nil {
		// Already ingested.
		return tx.Commit()
	}

	// Aggregate totals across all time buckets.
	var totalEvents, totalDownloads, totalSuccess, totalFail int64
	for _, b := range batch.TimeBuckets {
		totalEvents += b.Totals.TotalEvents
		totalDownloads += b.Totals.TotalDownloads
		totalSuccess += b.Totals.TotalSuccess
		totalFail += b.Totals.TotalFail
	}

	nowMs := time.Now().UnixMilli()
	generatedAt := batch.GeneratedAt
	if generatedAt == 0 {
		generatedAt = nowMs
	}

	// Insert into batches.
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO batches (
			batch_id, generated_at, ingested_at, time_zone,
			events_count, downloads_count, success_count, fail_count
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		batch.BatchID,
		generatedAt,
		nowMs,
		batch.TimeZone,
		totalEvents,
		totalDownloads,
		totalSuccess,
		totalFail,
	); err != nil {
		return err
	}

	// Insert per-hour aggregated rows.
	if err := insertHourly(ctx, tx, batch); err != nil {
		return err
	}

	// Update lifetime totals table.
	if err := updateTotals(ctx, tx, batch); err != nil {
		return err
	}

	// Insert DO state snapshot for observability.
	if err := insertDOStateSnapshot(ctx, tx, batch); err != nil {
		return err
	}

	// Update delivery stage counters and per-delivery chain.
	if err := upsertDeliveryMetrics(ctx, tx, batch); err != nil {
		return err
	}

	// Insert structured failure logs from Cloudflare DO payload.
	if err := insertFailureLogsFromBatch(ctx, tx, batch); err != nil {
		return err
	}

	// Keep failure sink bounded (retention policy).
	if err := cleanupOldFailureLogs(ctx, tx, failureLogRetentionDays); err != nil {
		return err
	}

	// PRIVACY FIX: IP storage disabled per PRIVACY.md policy
	// The privacy policy states IPs are never stored. Geo Map feature is disabled.
	// To re-enable, update PRIVACY.md to disclose IP storage and uncomment the code below.
	// if err := insertBatchIPs(ctx, tx, batch); err != nil {
	// 	return err
	// }

	return tx.Commit()
}

// insertBatchIPs stores unique IPs for the Geo Map feature
// DEFENSIVE DEDUPLICATION: Don't trust edge - dedupe before DB writes
// CANONICALIZATION: Collapses equivalent IP representations (e.g., ::1 and 0:0:0:0:0:0:0:1)
// ROW-SIZE OPTIMIZATION: Summarize if >500 IPs to prevent SQLite bloat
func insertBatchIPs(ctx context.Context, tx *sql.Tx, batch *model.OracleBatch) error {
	// 1. Defensive deduplication with CANONICALIZATION
	// Uses net.ParseIP().String() to collapse equivalent representations
	ipSet := make(map[string]struct{})
	for _, ip := range batch.UniqueIps {
		if ip == "" || ip == "unknown" {
			continue
		}
		// CANONICALIZATION: Parse and re-serialize to canonical form
		// This ensures ::1 and 0:0:0:0:0:0:0:1 become the same key
		parsed := net.ParseIP(ip)
		if parsed == nil {
			continue // Invalid IP, skip
		}
		canonical := parsed.String()
		ipSet[canonical] = struct{}{}
	}

	if len(ipSet) == 0 {
		return nil
	}

	// 2. Convert to slice (already validated via net.ParseIP)
	validIps := make([]string, 0, len(ipSet))
	for ip := range ipSet {
		validIps = append(validIps, ip)
	}

	const maxIpsPerRow = 500

	if len(validIps) == 0 {
		return nil
	}

	// 4. CONSISTENT JSON SCHEMA: Always store as object with same keys
	// Eliminates Array vs Object divergence in database
	isTruncated := len(validIps) > maxIpsPerRow
	storedIps := validIps
	if isTruncated {
		storedIps = validIps[:maxIpsPerRow]
	}

	payload := map[string]interface{}{
		"ips":          storedIps,
		"count":        len(validIps),
		"is_truncated": isTruncated,
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	// 5. Insert
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO batch_ips (batch_id, ip_count, unique_ips) VALUES (?, ?, ?)`,
		batch.BatchID,
		len(validIps), // True count of valid IPs
		string(raw),
	)
	return err
}

// isValidIP performs lightweight IP validation in backend (defense-in-depth)
func isValidIP(ip string) bool {
	if ip == "" || ip == "unknown" {
		return false
	}
	// Use Go's net.ParseIP for standard-compliant validation
	return net.ParseIP(ip) != nil
}

func insertHourly(ctx context.Context, tx *sql.Tx, batch *model.OracleBatch) error {
	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO downloads_hourly (
			bucket_start,
			bucket_end,
			total_events,
			total_downloads,
			total_success,
			total_fail,
			by_status_json,
			by_type_json,
			by_browser_json,
			by_os_json,
			by_ext_ver_json,
			by_lang_json,
			by_country_json,
			by_error_type_json,
			batch_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, b := range batch.TimeBuckets {
		byStatusJSON, _ := json.Marshal(b.Counters.ByStatus)
		byTypeJSON, _ := json.Marshal(b.Counters.ByType)
		byBrowserJSON, _ := json.Marshal(b.Counters.ByBrowser)
		byOsJSON, _ := json.Marshal(b.Counters.ByOs)
		byExtVerJSON, _ := json.Marshal(b.Counters.ByExtVer)
		byLangJSON, _ := json.Marshal(b.Counters.ByLanguage)
		byCountryJSON, _ := json.Marshal(b.Counters.ByCountry)
		byErrorTypeJSON, _ := json.Marshal(b.Counters.ByErrorType)

		if _, err := stmt.ExecContext(
			ctx,
			b.BucketStart,
			b.BucketEnd,
			b.Totals.TotalEvents,
			b.Totals.TotalDownloads,
			b.Totals.TotalSuccess,
			b.Totals.TotalFail,
			string(byStatusJSON),
			string(byTypeJSON),
			string(byBrowserJSON),
			string(byOsJSON),
			string(byExtVerJSON),
			string(byLangJSON),
			string(byCountryJSON),
			string(byErrorTypeJSON),
			batch.BatchID,
		); err != nil {
			return err
		}
	}

	return nil
}

func updateTotals(ctx context.Context, tx *sql.Tx, batch *model.OracleBatch) error {
	// Aggregate all dimensions across all buckets.
	var aggEvents, aggDownloads, aggSuccess, aggFail int64
	aggStatus := map[string]int64{}
	aggType := map[string]int64{}
	aggBrowser := map[string]int64{}
	aggOs := map[string]int64{}
	aggExtVer := map[string]int64{}
	aggLang := map[string]int64{}
	aggCountry := map[string]int64{}
	aggErrorType := map[string]int64{}

	for _, b := range batch.TimeBuckets {
		aggEvents += b.Totals.TotalEvents
		aggDownloads += b.Totals.TotalDownloads
		aggSuccess += b.Totals.TotalSuccess
		aggFail += b.Totals.TotalFail

		mergeCounts(aggStatus, b.Counters.ByStatus)
		mergeCounts(aggType, b.Counters.ByType)
		mergeCounts(aggBrowser, b.Counters.ByBrowser)
		mergeCounts(aggOs, b.Counters.ByOs)
		mergeCounts(aggExtVer, b.Counters.ByExtVer)
		mergeCounts(aggLang, b.Counters.ByLanguage)
		mergeCounts(aggCountry, b.Counters.ByCountry)
		mergeCounts(aggErrorType, b.Counters.ByErrorType)
	}

	// Lifetime totals (global).
	if err := upsertTotal(ctx, tx, "totalEvents", aggEvents); err != nil {
		return err
	}
	if err := upsertTotal(ctx, tx, "totalDownloads", aggDownloads); err != nil {
		return err
	}
	if err := upsertTotal(ctx, tx, "totalSuccess", aggSuccess); err != nil {
		return err
	}
	if err := upsertTotal(ctx, tx, "totalFail", aggFail); err != nil {
		return err
	}

	// Define dimensions for cleaner iteration
	dimensions := []struct {
		prefix string
		counts map[string]int64
	}{
		{"status:", aggStatus},
		{"type:", aggType},
		{"browser:", aggBrowser},
		{"os:", aggOs},
		{"extVer:", aggExtVer},
		{"lang:", aggLang},
		{"country:", aggCountry},
		{"errorType:", aggErrorType},
	}

	for _, dim := range dimensions {
		for k, v := range dim.counts {
			if err := upsertTotal(ctx, tx, dim.prefix+k, v); err != nil {
				return err
			}
		}
	}

	return nil
}

func mergeCounts(dst, src map[string]int64) {
	for k, v := range src {
		dst[k] += v
	}
}

func upsertTotal(ctx context.Context, tx *sql.Tx, key string, delta int64) error {
	if delta == 0 {
		return nil
	}
	_, err := tx.ExecContext(ctx, `
		INSERT INTO downloads_totals (key, value)
		VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = downloads_totals.value + excluded.value
	`, key, delta)
	return err
}

func insertDOStateSnapshot(ctx context.Context, tx *sql.Tx, batch *model.OracleBatch) error {
	raw, _ := json.Marshal(batch.DOState)

	capturedAt := batch.GeneratedAt
	if capturedAt == 0 {
		capturedAt = time.Now().UnixMilli()
	}

	var lastEventAt, lastFlushAt sql.NullInt64
	if batch.DOState.LastEventAt != nil {
		lastEventAt = sql.NullInt64{Int64: *batch.DOState.LastEventAt, Valid: true}
	}
	if batch.DOState.LastFlushAt != nil {
		lastFlushAt = sql.NullInt64{Int64: *batch.DOState.LastFlushAt, Valid: true}
	}

	var requestsToday int64
	var quotaLevel, modeLabel string
	var remoteEnabledInt int64
	var batchSizeSuggestion int64
	var maxBatchEventsInt int64

	if batch.DOState.Quota != nil {
		requestsToday = batch.DOState.Quota.RequestsToday
		quotaLevel = batch.DOState.Quota.QuotaLevel
		modeLabel = batch.DOState.Quota.ModeLabel
		if batch.DOState.Quota.RemoteEnabled {
			remoteEnabledInt = 1
		}
		batchSizeSuggestion = batch.DOState.Quota.BatchSizeSuggestion
	}

	if batch.DOState.EnvSnapshot != nil {
		if n, err := strconv.ParseInt(batch.DOState.EnvSnapshot.MaxBatchEvents, 10, 64); err == nil {
			maxBatchEventsInt = n
		}
	}

	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO do_state_snapshots (
			captured_at,
			source,
			raw_json,
			total_events,
			total_downloads,
			total_success,
			total_fail,
			pending_events,
			last_event_at,
			last_flush_at,
			requests_today,
			quota_level,
			mode_label,
			remote_enabled,
			batch_size_suggestion,
			max_batch_events
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		capturedAt,
		"batch",
		string(raw),
		batch.DOState.TotalEvents,
		batch.DOState.TotalDownloads,
		batch.DOState.TotalSuccess,
		batch.DOState.TotalFail,
		batch.DOState.PendingEvents,
		lastEventAt,
		lastFlushAt,
		requestsToday,
		quotaLevel,
		modeLabel,
		remoteEnabledInt,
		batchSizeSuggestion,
		maxBatchEventsInt,
	)
	return err
}

func upsertDeliveryMetrics(ctx context.Context, tx *sql.Tx, batch *model.OracleBatch) error {
	deliveryID := "dlv-" + batch.BatchID
	accepted := batch.Summary.Totals.TotalDownloads
	stored := batch.Summary.Totals.TotalDownloads
	forwarded := int64(0)
	committed := int64(0)
	var minSeq, maxSeq sql.NullInt64
	createdAt := batch.GeneratedAt
	if createdAt == 0 {
		createdAt = time.Now().UnixMilli()
	}

	if batch.Delivery != nil {
		if batch.Delivery.DeliveryID != "" {
			deliveryID = batch.Delivery.DeliveryID
		}
		accepted = batch.Delivery.AcceptedCount
		stored = batch.Delivery.StoredCount
		forwarded = batch.Delivery.ForwardedCount
		committed = batch.Delivery.CommittedCount
		if batch.Delivery.CreatedAt > 0 {
			createdAt = batch.Delivery.CreatedAt
		}
		if batch.Delivery.MinSeq != nil {
			minSeq = sql.NullInt64{Int64: *batch.Delivery.MinSeq, Valid: true}
		}
		if batch.Delivery.MaxSeq != nil {
			maxSeq = sql.NullInt64{Int64: *batch.Delivery.MaxSeq, Valid: true}
		}
	}
	if accepted < 0 {
		accepted = 0
	}
	if stored < 0 {
		stored = 0
	}
	if forwarded < 0 {
		forwarded = 0
	}
	if committed < 0 {
		committed = 0
	}
	// Oracle ACK is the final "committed" stage; when ingest succeeds and the
	// worker payload does not carry committedCount yet, infer it from accepted.
	if committed == 0 && accepted > 0 {
		committed = accepted
	}

	day := dayUTC(createdAt)
	stages := []struct {
		name  string
		count int64
	}{
		{name: "accepted", count: accepted},
		{name: "stored", count: stored},
		{name: "forwarded", count: forwarded},
		{name: "committed", count: committed},
	}
	for _, stage := range stages {
		if stage.count <= 0 {
			continue
		}
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO pipeline_stage_daily (day_utc, stage, count, updated_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(day_utc, stage) DO UPDATE SET
			   count = pipeline_stage_daily.count + excluded.count,
			   updated_at = excluded.updated_at`,
			day,
			stage.name,
			stage.count,
			time.Now().UnixMilli(),
		); err != nil {
			return err
		}
	}

	status := "pending"
	if committed > 0 && committed >= accepted {
		status = "committed"
	} else if forwarded > 0 {
		status = "forwarded"
	}

	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO pipeline_delivery_events (
			delivery_id, batch_id, created_at, updated_at,
			accepted_count, stored_count, forwarded_count, committed_count,
			min_seq, max_seq, status
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(delivery_id) DO UPDATE SET
			batch_id = excluded.batch_id,
			updated_at = excluded.updated_at,
			accepted_count = excluded.accepted_count,
			stored_count = excluded.stored_count,
			forwarded_count = excluded.forwarded_count,
			committed_count = excluded.committed_count,
			min_seq = excluded.min_seq,
			max_seq = excluded.max_seq,
			status = excluded.status`,
		deliveryID,
		batch.BatchID,
		createdAt,
		time.Now().UnixMilli(),
		accepted,
		stored,
		forwarded,
		committed,
		minSeq,
		maxSeq,
		status,
	)
	return err
}

func insertFailureLogRow(
	ctx context.Context,
	exec interface {
		ExecContext(context.Context, string, ...interface{}) (sql.Result, error)
	},
	source, stage, errorCode, errorDetail string,
	sampleCount int64,
	tsUTC int64,
	batchID, deliveryID string,
) error {
	if sampleCount <= 0 {
		return nil
	}
	stage = sanitizeFailureField(stage, "unknown_stage")
	errorCode = sanitizeFailureField(errorCode, "unknown_error")
	source = sanitizeFailureField(source, "unknown")
	errorDetail = sanitizeFailureDetail(errorDetail)
	if tsUTC <= 0 {
		tsUTC = time.Now().UnixMilli()
	}
	_, err := exec.ExecContext(
		ctx,
		`INSERT INTO pipeline_failure_logs (
			ts_utc, day_utc, source, stage, error_code, error_detail, sample_count, batch_id, delivery_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tsUTC,
		dayUTC(tsUTC),
		source,
		stage,
		errorCode,
		errorDetail,
		sampleCount,
		batchID,
		deliveryID,
	)
	return err
}

func insertFailureLogsFromBatch(ctx context.Context, tx *sql.Tx, batch *model.OracleBatch) error {
	if len(batch.FailureLogs) == 0 {
		return nil
	}
	deliveryID := ""
	if batch.Delivery != nil {
		deliveryID = batch.Delivery.DeliveryID
	}
	for _, row := range batch.FailureLogs {
		if err := insertFailureLogRow(
			ctx,
			tx,
			row.Source,
			row.Stage,
			row.ErrorCode,
			row.ErrorDetail,
			row.SampleCount,
			row.TSUTC,
			batch.BatchID,
			deliveryID,
		); err != nil {
			return err
		}
	}
	return nil
}

func cleanupOldFailureLogs(ctx context.Context, tx *sql.Tx, retentionDays int) error {
	if retentionDays <= 0 {
		return nil
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays).UnixMilli()
	_, err := tx.ExecContext(ctx, `DELETE FROM pipeline_failure_logs WHERE ts_utc < ?`, cutoff)
	return err
}

func recordOracleFailure(
	db *sql.DB,
	stage string,
	errorCode string,
	errorDetail string,
	sampleCount int64,
	batchID string,
	deliveryID string,
) {
	if db == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := insertFailureLogRow(
		ctx,
		db,
		"oracle-backend",
		stage,
		errorCode,
		errorDetail,
		sampleCount,
		time.Now().UnixMilli(),
		batchID,
		deliveryID,
	); err != nil {
		logEvent("warn", "oracle_failure_log_write_failed", map[string]interface{}{
			"error": err.Error(),
		})
	}
}
