package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/observability"
)

func TestRetryOutboxHandler_DoesNotResubmitSentRows(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	nowMs := time.Now().UnixMilli()
	_, err := sqlDB.Exec(
		`INSERT INTO ingest_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		 VALUES
		 ('e', '{}', 'k1', 'sent', 1, '', ?, ?),
		 ('e', '{}', 'k2', 'retry', 3, 'x', ?, ?)`,
		nowMs, nowMs, nowMs, nowMs,
	)
	if err != nil {
		t.Fatalf("seed outbox failed: %v", err)
	}

	var sentID, retryID int64
	if err := sqlDB.QueryRow(`SELECT id FROM ingest_outbox WHERE idempotency_key = 'k1'`).Scan(&sentID); err != nil {
		t.Fatalf("load sent id failed: %v", err)
	}
	if err := sqlDB.QueryRow(`SELECT id FROM ingest_outbox WHERE idempotency_key = 'k2'`).Scan(&retryID); err != nil {
		t.Fatalf("load retry id failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/outbox/retry", bytes.NewBufferString(`{"ids":[`+strconv.FormatInt(sentID, 10)+`,`+strconv.FormatInt(retryID, 10)+`]}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	RetryOutboxHandler(sqlDB, nil, observability.NewRegistry()).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var sentStatus string
	if err := sqlDB.QueryRow(`SELECT status FROM ingest_outbox WHERE id = ?`, sentID).Scan(&sentStatus); err != nil {
		t.Fatalf("load sent status failed: %v", err)
	}
	if sentStatus != "sent" {
		t.Fatalf("expected sent row to remain sent, got %s", sentStatus)
	}
	var retryStatus string
	if err := sqlDB.QueryRow(`SELECT status FROM ingest_outbox WHERE id = ?`, retryID).Scan(&retryStatus); err != nil {
		t.Fatalf("load retry status failed: %v", err)
	}
	if retryStatus != "pending" {
		t.Fatalf("expected retry row to become pending, got %s", retryStatus)
	}
}

func TestRetryOutboxHandler_RejectsMalformedJSON(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/outbox/retry", bytes.NewBufferString(`{`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	RetryOutboxHandler(sqlDB, nil, observability.NewRegistry()).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed JSON, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestOutboxStatusHandler_SQLiteSource(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	nowMs := time.Now().UnixMilli()
	if _, err := sqlDB.Exec(
		`INSERT INTO ingest_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		 VALUES ('e', '{}', 'status-k1', 'retry', 1, 'x', ?, ?)`,
		nowMs,
		nowMs,
	); err != nil {
		t.Fatalf("seed outbox row failed: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO outbox_dead_letter (outbox_id, event_type, payload_json, idempotency_key, attempts, last_error, failed_at)
		 VALUES (NULL, 'e', '{}', 'status-k1', 1, 'x', ?)`,
		nowMs,
	); err != nil {
		t.Fatalf("seed dead letter row failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/outbox/status?source=sqlite", nil)
	rr := httptest.NewRecorder()
	OutboxStatusHandler(sqlDB, nil, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK              bool             `json:"ok"`
		Source          string           `json:"source"`
		CountsByStatus  map[string]int64 `json:"countsByStatus"`
		DeadLetterCount int64            `json:"deadLetterCount"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse response failed: %v", err)
	}
	if !payload.OK || payload.Source != "sqlite" {
		t.Fatalf("unexpected response: %+v", payload)
	}
	if payload.CountsByStatus["retry"] < 1 {
		t.Fatalf("expected retry count >= 1, got %+v", payload.CountsByStatus)
	}
	if payload.DeadLetterCount < 1 {
		t.Fatalf("expected dead letter count >= 1, got %d", payload.DeadLetterCount)
	}
}

func TestOutboxStatusHandler_RejectsInvalidSource(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/admin/outbox/status?source=bad", nil)
	rr := httptest.NewRecorder()
	OutboxStatusHandler(sqlDB, nil, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestOutboxStatusHandler_DefaultAllWithoutPostgres(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	nowMs := time.Now().UnixMilli()
	if _, err := sqlDB.Exec(
		`INSERT INTO ingest_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		 VALUES ('e', '{}', 'status-default-all', 'pending', 0, '', ?, ?)`,
		nowMs,
		nowMs,
	); err != nil {
		t.Fatalf("seed outbox row failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/outbox/status", nil)
	rr := httptest.NewRecorder()
	OutboxStatusHandler(sqlDB, nil, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool                          `json:"ok"`
		Source  string                        `json:"source"`
		Sources map[string]outboxSourceStatus `json:"sources"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse response failed: %v", err)
	}
	if !payload.OK || payload.Source != "all" {
		t.Fatalf("unexpected response: %+v", payload)
	}
	if _, ok := payload.Sources["sqlite"]; !ok {
		t.Fatalf("expected sqlite source in response, got: %+v", payload.Sources)
	}
	if _, ok := payload.Sources["postgres"]; ok {
		t.Fatalf("did not expect postgres source in response when postgres DB is nil: %+v", payload.Sources)
	}
}

func TestOutboxStatusHandler_PostgresSourceWithoutPostgres(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/admin/outbox/status?source=postgres", nil)
	rr := httptest.NewRecorder()
	OutboxStatusHandler(sqlDB, nil, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when postgres source requested without postgres DB, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRetryOutboxHandler_RejectsInvalidSource(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/outbox/retry", bytes.NewBufferString(`{"source":"bad"}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	RetryOutboxHandler(sqlDB, nil, observability.NewRegistry()).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid source, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRetryOutboxHandler_PostgresSource(t *testing.T) {
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		t.Skip("POSTGRES_DSN not set")
	}

	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	postgresDB, err := db.InitPostgres(dsn)
	if err != nil {
		t.Fatalf("InitPostgres failed: %v", err)
	}
	defer postgresDB.Close()

	nowMs := time.Now().UnixMilli()
	idempotency := "pg-retry-" + strconv.FormatInt(nowMs, 10)
	if _, err := postgresDB.Exec(
		`INSERT INTO pg_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		 VALUES ($1, $2::jsonb, $3, 'retry', 2, 'x', $4, $4)
		 ON CONFLICT(idempotency_key) DO UPDATE SET status = 'retry', attempts = 2, next_run_at = $4, last_error = 'x'`,
		"control_plane_upsert",
		`{}`,
		idempotency,
		nowMs,
	); err != nil {
		t.Fatalf("seed pg_outbox failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/outbox/retry", bytes.NewBufferString(`{"source":"postgres"}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	RetryOutboxHandler(sqlDB, postgresDB, observability.NewRegistry()).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var status string
	if err := postgresDB.QueryRow(`SELECT status FROM pg_outbox WHERE idempotency_key = $1`, idempotency).Scan(&status); err != nil {
		t.Fatalf("query pg_outbox failed: %v", err)
	}
	if status != "pending" {
		t.Fatalf("expected status=pending after retry, got %s", status)
	}
}

func TestReplayDeadLetterHandler_PreservesIdempotencyKeyAndResetsOutboxRow(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	nowMs := time.Now().UnixMilli()
	res, err := sqlDB.Exec(
		`INSERT INTO ingest_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		 VALUES ('e', '{}', 'k1', 'dead', 10, 'boom', ?, ?)`,
		nowMs, nowMs,
	)
	if err != nil {
		t.Fatalf("seed outbox failed: %v", err)
	}
	outboxID, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("outbox last insert id failed: %v", err)
	}
	if _, err := sqlDB.Exec(
		`INSERT INTO outbox_dead_letter (outbox_id, event_type, payload_json, idempotency_key, attempts, last_error, failed_at)
		 VALUES (?, 'e', '{}', 'k1', 10, 'boom', ?)`,
		outboxID,
		nowMs,
	); err != nil {
		t.Fatalf("seed dead letter failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/outbox/replay-dead-letter", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	ReplayDeadLetterHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM ingest_outbox WHERE idempotency_key = 'k1'`).Scan(&count); err != nil {
		t.Fatalf("count outbox rows failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected single idempotency key row after replay, got %d", count)
	}
	var status string
	var attempts int64
	if err := sqlDB.QueryRow(`SELECT status, attempts FROM ingest_outbox WHERE id = ?`, outboxID).Scan(&status, &attempts); err != nil {
		t.Fatalf("load replayed row failed: %v", err)
	}
	if status != "pending" || attempts != 0 {
		t.Fatalf("expected pending/0 after replay, got %s/%d", status, attempts)
	}
}
