package handlers

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	"oracle-backend/internal/db"
)

func openPipelineDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := db.Init(t.TempDir() + "/pipeline.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

// ---------------------------------------------------------------------------
// parsePositiveInt
// ---------------------------------------------------------------------------

func TestParsePositiveInt_Empty(t *testing.T) {
	if parsePositiveInt("", 10, 1, 100) != 10 {
		t.Fatal("expected fallback")
	}
}

func TestParsePositiveInt_Invalid(t *testing.T) {
	if parsePositiveInt("abc", 10, 1, 100) != 10 {
		t.Fatal("expected fallback for non-number")
	}
}

func TestParsePositiveInt_BelowMin(t *testing.T) {
	if parsePositiveInt("0", 10, 1, 100) != 1 {
		t.Fatal("expected min clamped")
	}
}

func TestParsePositiveInt_AboveMax(t *testing.T) {
	if parsePositiveInt("200", 10, 1, 100) != 100 {
		t.Fatal("expected max clamped")
	}
}

func TestParsePositiveInt_Valid(t *testing.T) {
	if parsePositiveInt("42", 10, 1, 100) != 42 {
		t.Fatal("expected 42")
	}
}

func TestParsePositiveInt_ExactMin(t *testing.T) {
	if parsePositiveInt("1", 10, 1, 100) != 1 {
		t.Fatal("expected 1")
	}
}

func TestParsePositiveInt_ExactMax(t *testing.T) {
	if parsePositiveInt("100", 10, 1, 100) != 100 {
		t.Fatal("expected 100")
	}
}

// ---------------------------------------------------------------------------
// PipelineMetricsHandler comprehensive coverage
// ---------------------------------------------------------------------------

func TestPipelineMetricsHandler_WithCustomParams(t *testing.T) {
	d := openPipelineDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/pipeline/metrics?days=7&limit=50", nil)
	PipelineMetricsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestPipelineMetricsHandler_WithData(t *testing.T) {
	d := openPipelineDB(t)
	// Insert a batch with delivery metrics
	_, _ = d.Exec(`INSERT INTO batches (batch_id, generated_at, ingested_at,
		events_count, downloads_count, success_count, fail_count)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		"p-batch-1", 1700000000000, 1700000001000, 10, 5, 4, 1)
	_, _ = d.Exec(`INSERT INTO delivery_metrics
		(batch_id, generated_at, delivery_id, sent_at, received_at, committed_at,
		 forwarded_at, stored_at, do_status, http_status,
		 queue_latency_ms, process_latency_ms, total_latency_ms, attempt,
		 day_utc, hour_utc, body_size)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"p-batch-1", 1700000000000, "del-1", 1700000000000, 1700000000500,
		1700000001000, 1700000000600, 1700000001000,
		"delivered", 200, 500, 300, 1000, 1, "2023-11-14", "2023-11-14T00", 1024)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/pipeline/metrics?days=90", nil)
	PipelineMetricsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}



// ---------------------------------------------------------------------------
// PipelineFailuresHandler comprehensive coverage
// ---------------------------------------------------------------------------

func TestPipelineFailuresHandler_WithCustomParams(t *testing.T) {
	d := openPipelineDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/pipeline/failures?days=7&limit=20", nil)
	PipelineFailuresHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestPipelineFailuresHandler_WithFailureData(t *testing.T) {
	d := openPipelineDB(t)
	_, _ = d.Exec(`INSERT INTO failure_logs
		(ts_utc, source, stage, error_code, error_detail, sample_count, batch_id, delivery_id)
		VALUES (?,?,?,?,?,?,?,?)`,
		1700000000000, "do", "ingest", "timeout", "connection timeout", 5, "batch-f1", "del-f1")

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/pipeline/failures?days=90", nil)
	PipelineFailuresHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}


