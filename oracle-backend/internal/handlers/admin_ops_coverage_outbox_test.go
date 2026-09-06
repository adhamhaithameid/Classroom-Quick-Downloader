package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"oracle-backend/internal/observability"
)

// ---------------------------------------------------------------------------
// OutboxStatusHandler
// ---------------------------------------------------------------------------

func TestOutboxStatusHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox-status", nil)
	OutboxStatusHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestOutboxStatusHandler_SQLiteSourceWithMetrics(t *testing.T) {
	d := openAdminCoverageDB(t)
	reg := observability.NewRegistry()

	// source=sqlite (avoid source=all which queries nil postgres)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/outbox-status?source=sqlite", nil)
	OutboxStatusHandler(d, nil, reg).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestOutboxStatusHandler_InvalidSource(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/outbox-status?source=invalid", nil)
	OutboxStatusHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// RetryOutboxHandler
// ---------------------------------------------------------------------------

func TestRetryOutboxHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/outbox/retry", nil)
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestRetryOutboxHandler_InvalidBody(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox/retry", bytes.NewReader([]byte("bad")))
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRetryOutboxHandler_EmptyIDs(t *testing.T) {
	// Empty IDs means "retry all" — returns 200
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"source": "sqlite", "ids": []int64{}})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox/retry", bytes.NewReader(body))
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// ReplayDeadLetterHandler
// ---------------------------------------------------------------------------

func TestReplayDeadLetterHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/dead-letter/replay", nil)
	ReplayDeadLetterHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestReplayDeadLetterHandler_EmptyDB(t *testing.T) {
	// ReplayDeadLetterHandler doesn't parse the body — it reads from the DB directly
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/dead-letter/replay", nil)
	ReplayDeadLetterHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// RetryOutboxHandler edge cases
// ---------------------------------------------------------------------------

func TestRetryOutboxHandler_WithSpecificIDs(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"source": "sqlite", "ids": []int64{1, 2, 3}})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox/retry", bytes.NewReader(body))
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRetryOutboxHandler_InvalidSource(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"source": "mysql"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox/retry", bytes.NewReader(body))
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRetryOutboxHandler_DefaultSource(t *testing.T) {
	d := openAdminCoverageDB(t)
	// Empty body — defaults to sqlite source
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/outbox/retry", nil)
	RetryOutboxHandler(d, nil, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// ReplayDeadLetterHandler edge cases
// ---------------------------------------------------------------------------

func TestReplayDeadLetterHandler_WithDeadLetterData(t *testing.T) {
	d := openAdminCoverageDB(t)
	// Insert outbox entry and dead letter entry
	_, _ = d.Exec(`INSERT INTO ingest_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		VALUES ('test_event', '{}', 'idem-replay-1', 'dead', 5, 'too many retries', 1700000000000, 1700000000000)`)
	var outboxID int64
	_ = d.QueryRow("SELECT id FROM ingest_outbox WHERE idempotency_key = 'idem-replay-1'").Scan(&outboxID)
	_, _ = d.Exec(`INSERT INTO outbox_dead_letter (outbox_id, event_type, payload_json, idempotency_key, attempts, created_at)
		VALUES (?, 'test_event', '{}', 'idem-replay-1', 5, 1700000000000)`, outboxID)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/dead-letter/replay", nil)
	ReplayDeadLetterHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}
