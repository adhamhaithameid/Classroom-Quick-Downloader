// oracle-backend/internal/handlers/store_batch.go
package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	model "oracle-backend/internal/model"
)

type ingestResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message,omitempty"`
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
			http.Error(w, "server misconfigured: DO_SHARED_SECRET not set", http.StatusInternalServerError)
			return
		}

		headerSecret := r.Header.Get("X-DO-SECRET")
		if headerSecret == "" || headerSecret != sharedSecret {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var batch model.OracleBatch
		if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if batch.BatchID == "" {
			http.Error(w, "missing batchId", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		if err := ingestBatch(ctx, db, &batch); err != nil {
			http.Error(w, "failed to ingest batch: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ingestResponse{
			OK:      true,
			Message: "ingested",
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

	return tx.Commit()
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

		for k, v := range b.Counters.ByStatus {
			aggStatus[k] += v
		}
		for k, v := range b.Counters.ByType {
			aggType[k] += v
		}
		for k, v := range b.Counters.ByBrowser {
			aggBrowser[k] += v
		}
		for k, v := range b.Counters.ByOs {
			aggOs[k] += v
		}
		for k, v := range b.Counters.ByExtVer {
			aggExtVer[k] += v
		}
		for k, v := range b.Counters.ByLanguage {
			aggLang[k] += v
		}
		for k, v := range b.Counters.ByCountry {
			aggCountry[k] += v
		}
		for k, v := range b.Counters.ByErrorType {
			aggErrorType[k] += v
		}
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

	// Per-status.
	for status, v := range aggStatus {
		if err := upsertTotal(ctx, tx, "status:"+status, v); err != nil {
			return err
		}
	}

	// Per-type.
	for t, v := range aggType {
		if err := upsertTotal(ctx, tx, "type:"+t, v); err != nil {
			return err
		}
	}

	// Per-browser.
	for br, v := range aggBrowser {
		if err := upsertTotal(ctx, tx, "browser:"+br, v); err != nil {
			return err
		}
	}

	// Per-OS.
	for osName, v := range aggOs {
		if err := upsertTotal(ctx, tx, "os:"+osName, v); err != nil {
			return err
		}
	}

	// Per extension version.
	for ver, v := range aggExtVer {
		if err := upsertTotal(ctx, tx, "extVer:"+ver, v); err != nil {
			return err
		}
	}

	// Per language.
	for lang, v := range aggLang {
		if err := upsertTotal(ctx, tx, "lang:"+lang, v); err != nil {
			return err
		}
	}

	// Per country.
	for c, v := range aggCountry {
		if err := upsertTotal(ctx, tx, "country:"+c, v); err != nil {
			return err
		}
	}

	// Per error type.
	for e, v := range aggErrorType {
		if err := upsertTotal(ctx, tx, "errorType:"+e, v); err != nil {
			return err
		}
	}

	return nil
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