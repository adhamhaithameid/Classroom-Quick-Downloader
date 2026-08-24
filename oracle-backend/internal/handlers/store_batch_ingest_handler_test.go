package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	model "oracle-backend/internal/model"
)

// ──────────────────────────────────────────────────────────────────────────────
// IngestBatchHandler edge cases
// ──────────────────────────────────────────────────────────────────────────────

func TestIngestBatchHandler_MethodNotAllowed(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	req := httptest.NewRequest(http.MethodGet, "/ingest-batch", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestIngestBatchHandler_MissingSecret(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "")
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for missing DO_SHARED_SECRET, got %d", rr.Code)
	}
}

func TestIngestBatchHandler_ThrottlesUnauthorizedFailureRows(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()
	resetIngestUnauthorizedFailureThrottle()
	t.Cleanup(resetIngestUnauthorizedFailureThrottle)

	handler := IngestBatchHandler(sqlDB, "secret")
	for i := 0; i < ingestUnauthorizedFailureBurst+5; i++ {
		req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(`{}`))
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for unauthorized request #%d, got %d", i+1, rr.Code)
		}
	}

	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM pipeline_failure_logs WHERE source = 'oracle-backend' AND stage = 'ingest_auth' AND error_code = 'unauthorized'`).Scan(&count); err != nil {
		t.Fatalf("failed to query failure log count: %v", err)
	}
	if count != ingestUnauthorizedFailureBurst {
		t.Fatalf("expected throttled failure rows to cap at %d, got %d", ingestUnauthorizedFailureBurst, count)
	}
}

func TestIngestBatchHandler_InvalidJSON(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(`{invalid`))
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid JSON, got %d", rr.Code)
	}
}

func TestIngestBatchHandler_RejectsUnknownFields(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	req := httptest.NewRequest(
		http.MethodPost,
		"/ingest-batch",
		strings.NewReader(`{"batchId":"strict-decode-test","unexpected":true}`),
	)
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown JSON field, got %d", rr.Code)
	}
}

func TestIngestBatchHandler_MissingBatchID(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(`{"timeZone":"UTC"}`))
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing batchId, got %d", rr.Code)
	}
}

func TestIngestBatchHandler_Idempotent(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	batch := model.OracleBatch{
		BatchID:     "idempotent-test-" + time.Now().Format("150405"),
		GeneratedAt: time.Now().UnixMilli(),
		TimeZone:    "UTC",
		DOState:     model.DOState{OK: true},
	}
	bodyBytes, _ := json.Marshal(batch)

	// First ingest
	req1 := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	req1.Header.Set("X-DO-SECRET", "secret")
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusOK {
		t.Fatalf("first ingest: expected 200, got %d", rr1.Code)
	}

	// Second ingest of same batch — should succeed (idempotent)
	req2 := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	req2.Header.Set("X-DO-SECRET", "secret")
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Fatalf("second ingest: expected 200 (idempotent), got %d", rr2.Code)
	}

	// Should still have exactly 1 batch row
	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = ?`, batch.BatchID).Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 batch row (idempotent), got %d", count)
	}
}

func TestIngestBatchHandler_EmptyTimeBucketsStillCreatesBatch(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	batch := model.OracleBatch{
		BatchID:     "empty-buckets-" + time.Now().Format("150405"),
		GeneratedAt: time.Now().UnixMilli(),
		TimeZone:    "UTC",
		TimeBuckets: []model.TimeBucket{},
		DOState:     model.DOState{OK: true},
	}
	bodyBytes, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = ?`, batch.BatchID).Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected batch row to exist for empty time buckets, got %d", count)
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// IngestBatchHandler — full batch with timebuckets and DO state
// ──────────────────────────────────────────────────────────────────────────────

func TestIngestBatchHandler_FullBatchWithTimeBuckets(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	handler := IngestBatchHandler(sqlDB, "secret")
	lastEvent := int64(1700000000000)
	batch := model.OracleBatch{
		BatchID:     "full-batch-" + time.Now().Format("150405.000"),
		GeneratedAt: time.Now().UnixMilli(),
		TimeZone:    "UTC",
		TimeBuckets: []model.TimeBucket{
			{
				BucketStart: time.Now().Add(-time.Hour).UTC().Format(time.RFC3339),
				BucketEnd:   time.Now().UTC().Format(time.RFC3339),
				Totals: model.BucketTotals{
					TotalEvents:    10,
					TotalDownloads: 8,
					TotalSuccess:   7,
					TotalFail:      1,
				},
				Counters: model.BucketCounters{
					ByStatus:    map[string]int64{"completed": 7, "error": 1},
					ByType:      map[string]int64{"document": 5, "image": 3},
					ByBrowser:   map[string]int64{"chrome": 8},
					ByOs:        map[string]int64{"windows": 8},
					ByExtVer:    map[string]int64{"1.0.0": 8},
					ByLanguage:  map[string]int64{"en": 8},
					ByCountry:   map[string]int64{"US": 8},
					ByErrorType: map[string]int64{"network": 1},
				},
			},
		},
		DOState: model.DOState{
			OK:             true,
			TotalEvents:    100,
			TotalDownloads: 80,
			TotalSuccess:   70,
			TotalFail:      10,
			PendingEvents:  0,
			LastEventAt:    &lastEvent,
			Quota: &model.DOStateQuota{
				RequestsToday:       5,
				QuotaLevel:          "normal",
				ModeLabel:           "standard",
				RemoteEnabled:       true,
				BatchSizeSuggestion: 100,
			},
			EnvSnapshot: &model.DOStateEnvSnapshot{
				MaxBatchEvents: "1000",
			},
		},
	}
	bodyBytes, _ := json.Marshal(batch)

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	// Verify batch was stored
	var count int
	sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = ?`, batch.BatchID).Scan(&count)
	if count != 1 {
		t.Fatalf("expected batch to be stored, got count=%d", count)
	}

	// Verify hourly data was inserted
	var hourlyCount int
	sqlDB.QueryRow(`SELECT COUNT(*) FROM downloads_hourly WHERE batch_id = ?`, batch.BatchID).Scan(&hourlyCount)
	if hourlyCount < 1 {
		t.Fatalf("expected at least 1 hourly row, got %d", hourlyCount)
	}

	// Verify DO state snapshot was captured
	var doCount int
	sqlDB.QueryRow("SELECT COUNT(*) FROM do_state_snapshots").Scan(&doCount)
	if doCount < 1 {
		t.Fatalf("expected at least 1 DO state snapshot, got %d", doCount)
	}
}
