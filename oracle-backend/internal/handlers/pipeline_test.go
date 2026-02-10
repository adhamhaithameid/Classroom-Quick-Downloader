package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"oracle-backend/internal/db"
	model "oracle-backend/internal/model"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "oracle-test.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	return sqlDB
}

func postBatch(t *testing.T, handler http.Handler, batch model.OracleBatch, secret string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(batch)
	if err != nil {
		t.Fatalf("json marshal failed: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", secret)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	return rr
}

func TestPipelineMetricsAndFailuresFromIngest(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	ingest := IngestBatchHandler(sqlDB, "secret")
	now := time.Now().UnixMilli()
	batch := model.OracleBatch{
		BatchID:     "batch-observe-1",
		GeneratedAt: now,
		TimeZone:    "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{
				TotalEvents:    5,
				TotalDownloads: 5,
				TotalSuccess:   5,
				TotalFail:      0,
			},
		},
		TimeBuckets: []model.TimeBucket{},
		DOState:     model.DOState{OK: true},
		Delivery: &model.DeliverySnapshot{
			DeliveryID:     "dlv-batch-observe-1",
			AcceptedCount:  5,
			StoredCount:    5,
			ForwardedCount: 5,
			CommittedCount: 5,
			CreatedAt:      now,
		},
		FailureLogs: []model.FailureLogEntry{
			{
				Key:         "2026-02-10|track_ingest|invalid_payload",
				Source:      "cloudflare-do",
				Stage:       "track_ingest",
				ErrorCode:   "invalid_payload",
				ErrorDetail: strings.Repeat("x", 500),
				SampleCount: 2,
				TSUTC:       now,
			},
		},
	}

	rr := postBatch(t, ingest, batch, "secret")
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 from ingest, got %d (%s)", rr.Code, rr.Body.String())
	}

	metricsReq := httptest.NewRequest(http.MethodGet, "/api/pipeline/metrics?days=30&limit=20", nil)
	metricsRR := httptest.NewRecorder()
	PipelineMetricsHandler(sqlDB).ServeHTTP(metricsRR, metricsReq)
	if metricsRR.Code != http.StatusOK {
		t.Fatalf("metrics status=%d body=%s", metricsRR.Code, metricsRR.Body.String())
	}
	var metrics pipelineMetricsResponse
	if err := json.Unmarshal(metricsRR.Body.Bytes(), &metrics); err != nil {
		t.Fatalf("metrics json parse failed: %v", err)
	}
	if metrics.Totals["accepted"] != 5 || metrics.Totals["committed"] != 5 {
		t.Fatalf("unexpected totals: %+v", metrics.Totals)
	}
	if len(metrics.Recent) == 0 || metrics.Recent[0].DeliveryID != "dlv-batch-observe-1" {
		t.Fatalf("expected recent delivery chain to include dlv-batch-observe-1, got %+v", metrics.Recent)
	}
	if len(metrics.Recent[0].MissingStages) != 0 {
		t.Fatalf("expected no missing stages for committed delivery, got %+v", metrics.Recent[0].MissingStages)
	}

	failReq := httptest.NewRequest(http.MethodGet, "/api/pipeline/failures?days=30&limit=20", nil)
	failRR := httptest.NewRecorder()
	PipelineFailuresHandler(sqlDB).ServeHTTP(failRR, failReq)
	if failRR.Code != http.StatusOK {
		t.Fatalf("failures status=%d body=%s", failRR.Code, failRR.Body.String())
	}
	var failures pipelineFailuresResponse
	if err := json.Unmarshal(failRR.Body.Bytes(), &failures); err != nil {
		t.Fatalf("failures json parse failed: %v", err)
	}
	if len(failures.Recent) == 0 {
		t.Fatalf("expected recent failures to include ingested failure logs")
	}
	row := failures.Recent[0]
	if row.Source != "cloudflare-do" || row.Stage != "track_ingest" || row.ErrorCode != "invalid_payload" {
		t.Fatalf("unexpected failure row: %+v", row)
	}
	if row.SampleCount != 2 {
		t.Fatalf("expected sampleCount=2, got %d", row.SampleCount)
	}
	if len(row.ErrorDetail) > maxFailureDetailLen {
		t.Fatalf("expected sanitized error detail <= %d chars, got %d", maxFailureDetailLen, len(row.ErrorDetail))
	}
	if len(failures.Daily) == 0 {
		t.Fatalf("expected daily failure summary rows")
	}
}

func TestIngestBatchUnauthorizedWritesFailureLog(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	ingest := IngestBatchHandler(sqlDB, "secret")
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", bytes.NewBufferString(`{}`))
	rr := httptest.NewRecorder()
	ingest.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}

	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM pipeline_failure_logs WHERE source = 'oracle-backend' AND stage = 'ingest_auth'`).Scan(&count); err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if count == 0 {
		t.Fatalf("expected unauthorized ingest to be logged into pipeline_failure_logs")
	}
}

func TestFailureLogRetentionCleanupRunsOnIngest(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	oldTs := time.Now().UTC().AddDate(0, 0, -(failureLogRetentionDays + 2)).UnixMilli()
	_, err := sqlDB.Exec(
		`INSERT INTO pipeline_failure_logs (ts_utc, day_utc, source, stage, error_code, error_detail, sample_count, batch_id, delivery_id)
		 VALUES (?, ?, 'oracle-backend', 'old_stage', 'old_error', 'old detail', 1, 'old-batch', '')`,
		oldTs,
		dayUTC(oldTs),
	)
	if err != nil {
		t.Fatalf("seed old failure log failed: %v", err)
	}

	ingest := IngestBatchHandler(sqlDB, "secret")
	now := time.Now().UnixMilli()
	batch := model.OracleBatch{
		BatchID:     "batch-retention-1",
		GeneratedAt: now,
		TimeZone:    "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{
				TotalEvents:    1,
				TotalDownloads: 1,
				TotalSuccess:   1,
				TotalFail:      0,
			},
		},
		TimeBuckets: []model.TimeBucket{},
		DOState:     model.DOState{OK: true},
	}
	rr := postBatch(t, ingest, batch, "secret")
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 from ingest, got %d", rr.Code)
	}

	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM pipeline_failure_logs WHERE stage = 'old_stage'`).Scan(&count); err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected old failure logs to be cleaned up, found %d rows", count)
	}
}
