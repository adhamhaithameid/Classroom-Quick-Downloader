package handlers

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/observability"
)

func newAdminTestDB(t *testing.T) *sql.DB {
	t.Helper()
	prevSecret := getAuditCheckpointSecret()
	SetAuditCheckpointSecret("audit-checkpoint-test-secret")
	t.Cleanup(func() {
		if len(prevSecret) == 0 {
			SetAuditCheckpointSecret("")
			return
		}
		SetAuditCheckpointSecret(string(prevSecret))
	})
	dbPath := filepath.Join(t.TempDir(), "oracle-admin-test.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	return sqlDB
}

func TestIngestWritesOutboxAndSchemaRegistry(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	payload := `{
		"batchId":"batch-schema-1",
		"generatedAt":1739308800000,
		"timeZone":"UTC",
		"summary":{
			"totals":{"totalEvents":2,"totalDownloads":2,"totalSuccess":1,"totalFail":1},
			"browsers":{"chrome":2},
			"os":{"windows":2},
			"countries":{"us":2},
			"languages":{"en":2},
			"versions":{"1.0.0":2},
			"types":{"pdf":2},
			"errorReasons":{"none":1},
			"topBrowser":"chrome",
			"topOs":"windows",
			"topCountry":"us",
			"topType":"pdf"
		},
		"timeBuckets":[
			{
				"bucketStart":"2026-02-01T00:00:00Z",
				"bucketEnd":"2026-02-01T01:00:00Z",
				"totals":{"totalEvents":2,"totalDownloads":2,"totalSuccess":1,"totalFail":1},
				"counters":{
					"byStatus":{"success":1,"fail":1},
					"byType":{"pdf":2},
					"byBrowser":{"chrome":2},
					"byOs":{"windows":2},
					"byExtVersion":{"1.0.0":2},
					"byLanguage":{"en":2},
					"byCountry":{"us":2},
					"byErrorType":{"none":1}
				}
			}
		],
		"doState":{"ok":true}
	}`

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(payload))
	req.Header.Set("X-DO-SECRET", "secret")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	IngestBatchHandler(sqlDB, "secret").ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var outboxCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM ingest_outbox WHERE event_type = 'ingest_batch_committed'`).Scan(&outboxCount); err != nil {
		t.Fatalf("failed querying outbox: %v", err)
	}
	if outboxCount == 0 {
		t.Fatalf("expected outbox row after ingest")
	}

	var schemaPathCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM cf_schema_registry WHERE json_path = 'summary.totals.totalEvents'`).Scan(&schemaPathCount); err != nil {
		t.Fatalf("failed querying schema registry: %v", err)
	}
	if schemaPathCount == 0 {
		t.Fatalf("expected schema drift path to be registered")
	}
}

func TestFeatureFlagHandlers(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	getReq := httptest.NewRequest(http.MethodGet, "/api/admin/flags", nil)
	getRR := httptest.NewRecorder()
	FeatureFlagsHandler(sqlDB).ServeHTTP(getRR, getReq)
	if getRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from feature flags get, got %d", getRR.Code)
	}

	updatePayload := `{"name":"feature_sync_enabled","enabled":true}`
	updateReq := httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", bytes.NewBufferString(updatePayload))
	updateReq.Header.Set("Content-Type", "application/json")
	updateRR := httptest.NewRecorder()
	UpdateFeatureFlagHandler(sqlDB).ServeHTTP(updateRR, updateReq)
	if updateRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from feature flags update, got %d: %s", updateRR.Code, updateRR.Body.String())
	}

	enabled, err := IsFeatureEnabled(context.Background(), sqlDB, "feature_sync_enabled")
	if err != nil {
		t.Fatalf("IsFeatureEnabled failed: %v", err)
	}
	if !enabled {
		t.Fatalf("expected feature_sync_enabled to be true")
	}
}

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

func TestAuditVerifyChainHandler(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	ctx := context.Background()
	ctx = observability.WithRequestContext(ctx, "req-test-1", "corr-test-1")
	ctx = observability.WithActorContext(ctx, "viewer", "token-1", "viewer")
	if err := AppendAuditLog(ctx, sqlDB, "test_action_1", "test_resource", "1", "ok", map[string]any{"k": "v"}); err != nil {
		t.Fatalf("AppendAuditLog #1 failed: %v", err)
	}
	time.Sleep(1 * time.Millisecond)
	if err := AppendAuditLog(ctx, sqlDB, "test_action_2", "test_resource", "2", "ok", map[string]any{"n": 2}); err != nil {
		t.Fatalf("AppendAuditLog #2 failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/audit/verify-chain", nil)
	rr := httptest.NewRecorder()
	AuditVerifyChainHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if valid, _ := resp["valid"].(bool); !valid {
		t.Fatalf("expected valid chain, got: %v", resp)
	}
}

func TestAppendAuditLog_ConcurrentWritersDoNotForkChain(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	const writers = 32
	start := make(chan struct{})
	errCh := make(chan error, writers)
	var wg sync.WaitGroup

	for i := 0; i < writers; i++ {
		i := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			ctx := context.Background()
			ctx = observability.WithRequestContext(ctx, fmt.Sprintf("req-conc-%d", i), fmt.Sprintf("corr-conc-%d", i))
			ctx = observability.WithActorContext(ctx, "user-conc", "token-conc", "super_admin")
			errCh <- AppendAuditLog(
				ctx,
				sqlDB,
				"concurrent_append",
				"audit",
				strconv.Itoa(i),
				"ok",
				map[string]any{"seq": i},
			)
		}()
	}

	close(start)
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("concurrent append failed: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/audit/verify-chain", nil)
	rr := httptest.NewRecorder()
	AuditVerifyChainHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Valid     bool `json:"valid"`
		TotalRows int  `json:"totalRows"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if !resp.Valid {
		t.Fatalf("expected valid chain under concurrent appends, got %s", rr.Body.String())
	}
	if resp.TotalRows != writers {
		t.Fatalf("expected %d audit rows, got %d", writers, resp.TotalRows)
	}

	var duplicatePrevHashChains int64
	if err := sqlDB.QueryRow(
		`SELECT COUNT(*) FROM (
			SELECT prev_hash
			FROM admin_audit_log
			GROUP BY prev_hash
			HAVING COUNT(*) > 1
		)`,
	).Scan(&duplicatePrevHashChains); err != nil {
		t.Fatalf("failed to query duplicate prev_hash counts: %v", err)
	}
	if duplicatePrevHashChains != 0 {
		t.Fatalf("detected forked chain segments: %d duplicate predecessor hashes", duplicatePrevHashChains)
	}
}

func TestAuditVerifyChainHandler_DetectsPayloadHashTamper(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	payload := `{"a":1}`
	prev := strings.Repeat("0", 64)
	rowSum := sha256.Sum256([]byte(payload + ":" + prev))
	rowHash := hex.EncodeToString(rowSum[:])

	// Deliberately wrong payload_hash while row hash remains valid.
	if _, err := sqlDB.Exec(
		`INSERT INTO admin_audit_log (
			ts_utc, request_id, correlation_id, user_id, token_id, role,
			action_type, resource_type, resource_id, result, error_code,
			payload_json, prev_hash, payload_hash, row_hash
		) VALUES (?, 'r1', 'c1', 'u1', 't1', 'viewer', 'a', 'b', 'c', 'ok', '', ?, ?, ?, ?)`,
		time.Now().UnixMilli(),
		payload,
		prev,
		strings.Repeat("f", 64),
		rowHash,
	); err != nil {
		t.Fatalf("insert tampered row failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/audit/verify-chain", nil)
	rr := httptest.NewRecorder()
	AuditVerifyChainHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}
	if valid, _ := resp["valid"].(bool); valid {
		t.Fatalf("expected invalid chain due to payload hash mismatch: %v", resp)
	}
	if reason, _ := resp["reason"].(string); reason != "payload_hash_mismatch" {
		t.Fatalf("expected payload_hash_mismatch, got %v", resp["reason"])
	}
}

func TestAdminAuditLogAppendOnlyTriggers(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	ctx := context.Background()
	ctx = observability.WithRequestContext(ctx, "req-append-only", "corr-append-only")
	ctx = observability.WithActorContext(ctx, "viewer", "token", "viewer")
	if err := AppendAuditLog(ctx, sqlDB, "append_only_test", "audit", "1", "ok", map[string]any{"x": 1}); err != nil {
		t.Fatalf("AppendAuditLog failed: %v", err)
	}

	if _, err := sqlDB.Exec(`UPDATE admin_audit_log SET result = 'tampered' WHERE id = 1`); err == nil {
		t.Fatalf("expected update to fail due to append-only trigger")
	}
	if _, err := sqlDB.Exec(`DELETE FROM admin_audit_log WHERE id = 1`); err == nil {
		t.Fatalf("expected delete to fail due to append-only trigger")
	}
}

func TestSQLExecDryRunDoesNotMutate(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}
	if _, err := sqlDB.Exec(`INSERT INTO system_alerts (alert_type, severity, message, status, payload_json, created_at, updated_at)
		VALUES ('a', 'warning', 'm', 'open', '{}', 1, 1)`); err != nil {
		t.Fatalf("seed alert failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/sql/exec", bytes.NewBufferString(`{"sql":"DELETE FROM system_alerts","dryRun":true}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLExecHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected dry run success, got %d: %s", rr.Code, rr.Body.String())
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM system_alerts`).Scan(&count); err != nil {
		t.Fatalf("count failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected dry run not to delete rows, count=%d", count)
	}
}

func TestSQLQueryHandler_FeatureDisabled(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/sql/query", bytes.NewBufferString(`{"sql":"SELECT 1"}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when sql console flag disabled, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsWithMutatingCTE(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"WITH x AS (DELETE FROM system_alerts RETURNING 1) SELECT * FROM x"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for WITH statement on query endpoint, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM admin_audit_log"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsQuotedRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM \"feature_flags\""}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for quoted restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsQualifiedRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM main.feature_flags"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for qualified restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsCommaJoinRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM batches, feature_flags"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for comma-join restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsCommaJoinQualifiedRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM batches, \"main\".\"feature_flags\""}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for comma-join qualified restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsCommentObfuscatedRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM/*x*/feature_flags"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for comment-obfuscated restricted query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsBacktickRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM `+"`feature_flags`"+`"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for backtick restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLQueryHandler_RejectsBracketRestrictedTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM [feature_flags]"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLQueryHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for bracket restricted table query, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLExecHandler_RejectsForbiddenKeywords(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/exec",
		bytes.NewBufferString(`{"sql":"UPDATE system_alerts SET message = replace(message,'a','b')","dryRun":true}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLExecHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for forbidden keyword, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSQLExecHandler_RejectsRestrictedMutationTables(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("failed to enable sql console flag: %v", err)
	}

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/exec",
		bytes.NewBufferString(`{"sql":"DELETE FROM feature_flags","dryRun":true}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SQLExecHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for restricted mutation table, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestDangerClearDataDryRunAndExec(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_clear_data_enabled'`); err != nil {
		t.Fatalf("failed to enable clear data flag: %v", err)
	}
	if _, err := sqlDB.Exec(`INSERT INTO pipeline_failure_logs (ts_utc, day_utc, source, stage, error_code, error_detail, sample_count)
		VALUES (1, '2026-02-11', 'test', 'ingest', 'e', 'd', 1)`); err != nil {
		t.Fatalf("seed pipeline failure failed: %v", err)
	}

	dryReq := httptest.NewRequest(http.MethodPost, "/api/admin/danger/clear-data", bytes.NewBufferString(`{"scope":"pipeline_failure_logs","dryRun":true}`))
	dryReq.Header.Set("Content-Type", "application/json")
	dryRR := httptest.NewRecorder()
	DangerClearDataHandler(sqlDB).ServeHTTP(dryRR, dryReq)
	if dryRR.Code != http.StatusOK {
		t.Fatalf("expected dry run success, got %d: %s", dryRR.Code, dryRR.Body.String())
	}

	execReq := httptest.NewRequest(http.MethodPost, "/api/admin/danger/clear-data", bytes.NewBufferString(`{"scope":"pipeline_failure_logs","dryRun":false}`))
	execReq.Header.Set("Content-Type", "application/json")
	execRR := httptest.NewRecorder()
	DangerClearDataHandler(sqlDB).ServeHTTP(execRR, execReq)
	if execRR.Code != http.StatusOK {
		t.Fatalf("expected clear data success, got %d: %s", execRR.Code, execRR.Body.String())
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM pipeline_failure_logs`).Scan(&count); err != nil {
		t.Fatalf("count failed: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected rows to be deleted, got %d", count)
	}
}

func TestDangerClearData_FeatureDisabled(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/danger/clear-data", bytes.NewBufferString(`{"scope":"all_non_core","dryRun":true}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	DangerClearDataHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when clear-data flag disabled, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestBackupRunHandler_FailureCreatesAlertAndMetric(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	// Force backup directory creation failure by pointing BACKUP_DIR at a file.
	badPath := filepath.Join(t.TempDir(), "not-a-dir")
	if err := os.WriteFile(badPath, []byte("x"), 0o644); err != nil {
		t.Fatalf("seed file failed: %v", err)
	}
	prev := os.Getenv("BACKUP_DIR")
	if err := os.Setenv("BACKUP_DIR", badPath); err != nil {
		t.Fatalf("setenv failed: %v", err)
	}
	defer func() {
		if prev == "" {
			_ = os.Unsetenv("BACKUP_DIR")
		} else {
			_ = os.Setenv("BACKUP_DIR", prev)
		}
	}()

	reg := observability.NewRegistry()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/backup/run", bytes.NewBufferString(`{"fileName":"x.db"}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	BackupRunHandler(sqlDB, reg).ServeHTTP(rr, req)
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for backup failure, got %d: %s", rr.Code, rr.Body.String())
	}

	var alertCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM system_alerts WHERE alert_type = 'backup_failed'`).Scan(&alertCount); err != nil {
		t.Fatalf("query alerts failed: %v", err)
	}
	if alertCount == 0 {
		t.Fatalf("expected backup_failed alert")
	}

	var runCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM backup_runs WHERE status = 'error'`).Scan(&runCount); err != nil {
		t.Fatalf("query backup_runs failed: %v", err)
	}
	if runCount == 0 {
		t.Fatalf("expected error row in backup_runs")
	}

	if !strings.Contains(reg.RenderPrometheus(), "oracle_backup_failures_total") {
		t.Fatalf("expected backup failure metric, got: %s", reg.RenderPrometheus())
	}
}

func TestBackupRunHandler_RejectsInvalidFileNames(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	cases := []string{
		`{"fileName":"../escape.db"}`,
		`{"fileName":"..\\escape.db"}`,
		`{"fileName":"backup.txt"}`,
		`{"fileName":"bad name.db"}`,
	}
	for _, body := range cases {
		req := httptest.NewRequest(http.MethodPost, "/api/admin/backup/run", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		BackupRunHandler(sqlDB, observability.NewRegistry()).ServeHTTP(rr, req)
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for %s, got %d: %s", body, rr.Code, rr.Body.String())
		}
	}
}

func TestBackupRunHandler_RejectsMalformedJSON(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/backup/run", bytes.NewBufferString(`{`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	BackupRunHandler(sqlDB, observability.NewRegistry()).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed JSON, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestAlertsHandler_ReturnsOpenAlerts(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	if err := upsertOpenAlert(
		context.Background(),
		sqlDB,
		"no_sync_success",
		"critical",
		"no sync success in configured window",
		map[string]any{"endpoint": "chrome", "minutes": 30},
	); err != nil {
		t.Fatalf("seed alert failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/alerts", nil)
	rr := httptest.NewRecorder()
	AlertsHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("alerts list failed: %d %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK     bool `json:"ok"`
		Alerts []struct {
			AlertType string `json:"alertType"`
			Severity  string `json:"severity"`
			Status    string `json:"status"`
		} `json:"alerts"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse alerts payload failed: %v", err)
	}
	if !payload.OK || len(payload.Alerts) == 0 {
		t.Fatalf("expected alerts payload with items, got %+v", payload)
	}
	if payload.Alerts[0].AlertType != "no_sync_success" {
		t.Fatalf("unexpected alert type: %+v", payload.Alerts[0])
	}
}

func TestUpsertOpenAlert_ConcurrentSingleOpenRow(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	const workers = 20
	errCh := make(chan error, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		i := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			errCh <- upsertOpenAlert(
				context.Background(),
				sqlDB,
				"schema_drift_detected",
				"warning",
				"drift observed",
				map[string]any{"worker": i},
			)
		}()
	}
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("concurrent upsert failed: %v", err)
		}
	}

	var openRows int64
	if err := sqlDB.QueryRow(
		`SELECT COUNT(*) FROM system_alerts WHERE alert_type = ? AND status = 'open'`,
		"schema_drift_detected",
	).Scan(&openRows); err != nil {
		t.Fatalf("count open alerts failed: %v", err)
	}
	if openRows != 1 {
		t.Fatalf("expected exactly one open alert row, got %d", openRows)
	}
}

func TestMigrationsStatusHandler_StateMatrix(t *testing.T) {
	tests := []struct {
		name               string
		postgresConfigured bool
		postgresErr        *string
		wantStatus         string
		wantConfigured     bool
	}{
		{
			name:               "postgres-disabled",
			postgresConfigured: false,
			postgresErr:        nil,
			wantStatus:         "disabled",
			wantConfigured:     false,
		},
		{
			name:               "postgres-ready",
			postgresConfigured: true,
			postgresErr:        nil,
			wantStatus:         "ready",
			wantConfigured:     true,
		},
		{
			name:               "postgres-error",
			postgresConfigured: true,
			postgresErr:        ptr("dsn auth failed"),
			wantStatus:         "error",
			wantConfigured:     true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/admin/migrations/status", nil)
			rr := httptest.NewRecorder()
			MigrationsStatusHandler(tc.postgresConfigured, tc.postgresErr).ServeHTTP(rr, req)
			if rr.Code != http.StatusOK {
				t.Fatalf("migrations status failed: %d %s", rr.Code, rr.Body.String())
			}

			var payload map[string]any
			if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
				t.Fatalf("parse payload failed: %v", err)
			}
			postgres, _ := payload["postgres"].(map[string]any)
			if postgres == nil {
				t.Fatalf("postgres payload missing: %#v", payload)
			}
			if got, _ := postgres["status"].(string); got != tc.wantStatus {
				t.Fatalf("unexpected postgres status=%q want=%q", got, tc.wantStatus)
			}
			if got, _ := postgres["configured"].(bool); got != tc.wantConfigured {
				t.Fatalf("unexpected postgres configured=%v want=%v", got, tc.wantConfigured)
			}
		})
	}
}

func ptr[T any](v T) *T { return &v }

func TestIngestRawSnapshotRedactsIPData(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	payload := `{
		"batchId":"batch-redact-1",
		"generatedAt":1739308800000,
		"timeZone":"UTC",
		"summary":{"totals":{"totalEvents":1,"totalDownloads":1,"totalSuccess":1,"totalFail":0}},
		"timeBuckets":[],
		"doState":{"ok":true},
		"uniqueIps":["1.1.1.1","8.8.8.8"],
		"clientIp":"9.9.9.9",
		"nested":{"ip_address":"4.4.4.4"}
	}`

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", bytes.NewBufferString(payload))
	req.Header.Set("X-DO-SECRET", "secret")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	IngestBatchHandler(sqlDB, "secret").ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var rawPayload string
	if err := sqlDB.QueryRow(`SELECT payload_json FROM cf_snapshots_raw ORDER BY id DESC LIMIT 1`).Scan(&rawPayload); err != nil {
		t.Fatalf("failed to load raw snapshot payload: %v", err)
	}
	if strings.Contains(rawPayload, "1.1.1.1") || strings.Contains(rawPayload, "8.8.8.8") || strings.Contains(rawPayload, "9.9.9.9") || strings.Contains(rawPayload, "4.4.4.4") {
		t.Fatalf("expected IP values to be redacted, got payload: %s", rawPayload)
	}
	if !strings.Contains(rawPayload, "REDACTED") {
		t.Fatalf("expected redaction markers in payload, got: %s", rawPayload)
	}
}

func TestOracleOperationLogsHandlers_ListDeleteAndClear(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	now := time.Now().UnixMilli()
	if err := InsertOracleOperationLog(context.Background(), sqlDB, OracleOperationLogEntry{
		TSUTC:         now - int64((10*24*time.Hour)/time.Millisecond),
		RequestID:     "req-old",
		CorrelationID: "corr-old",
		UserID:        "viewer",
		TokenID:       "tok-old",
		Role:          "viewer",
		ActionType:    "admin",
		ResourceType:  "record",
		ResourceID:    "old",
		Method:        "POST",
		Path:          "/api/admin/records/upsert",
		StatusCode:    200,
		Result:        "ok",
		LatencyMS:     12,
	}); err != nil {
		t.Fatalf("insert old oracle operation log failed: %v", err)
	}
	if err := InsertOracleOperationLog(context.Background(), sqlDB, OracleOperationLogEntry{
		TSUTC:         now,
		RequestID:     "req-new",
		CorrelationID: "corr-new",
		UserID:        "super-admin",
		TokenID:       "tok-new",
		Role:          "super_admin",
		ActionType:    "admin",
		ResourceType:  "record",
		ResourceID:    "new",
		Method:        "POST",
		Path:          "/api/admin/records/delete",
		StatusCode:    200,
		Result:        "ok",
		LatencyMS:     9,
	}); err != nil {
		t.Fatalf("insert new oracle operation log failed: %v", err)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/oracle-logs?limit=10", nil)
	listRR := httptest.NewRecorder()
	OracleOperationLogsListHandler(sqlDB).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("list failed: %d %s", listRR.Code, listRR.Body.String())
	}

	dryDeleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/oracle-logs/delete-older", bytes.NewBufferString(`{"days":5,"dryRun":true}`))
	dryDeleteReq.Header.Set("Content-Type", "application/json")
	dryDeleteRR := httptest.NewRecorder()
	OracleOperationLogsDeleteOlderHandler(sqlDB).ServeHTTP(dryDeleteRR, dryDeleteReq)
	if dryDeleteRR.Code != http.StatusOK {
		t.Fatalf("delete older dry-run failed: %d %s", dryDeleteRR.Code, dryDeleteRR.Body.String())
	}

	deleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/oracle-logs/delete-older", bytes.NewBufferString(`{"days":5,"dryRun":false}`))
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	OracleOperationLogsDeleteOlderHandler(sqlDB).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("delete older failed: %d %s", deleteRR.Code, deleteRR.Body.String())
	}

	var remaining int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM oracle_operation_logs`).Scan(&remaining); err != nil {
		t.Fatalf("count after delete older failed: %v", err)
	}
	if remaining != 1 {
		t.Fatalf("expected one row after delete older, got %d", remaining)
	}

	clearInvalidReq := httptest.NewRequest(http.MethodPost, "/api/admin/oracle-logs/clear-all", bytes.NewBufferString(`{"confirm":"NOPE","dryRun":false}`))
	clearInvalidReq.Header.Set("Content-Type", "application/json")
	clearInvalidRR := httptest.NewRecorder()
	OracleOperationLogsClearAllHandler(sqlDB).ServeHTTP(clearInvalidRR, clearInvalidReq)
	if clearInvalidRR.Code != http.StatusBadRequest {
		t.Fatalf("expected clear-all confirm validation failure, got %d", clearInvalidRR.Code)
	}

	clearReq := httptest.NewRequest(http.MethodPost, "/api/admin/oracle-logs/clear-all", bytes.NewBufferString(`{"confirm":"CLEAR_ALL_LOGS","dryRun":false}`))
	clearReq.Header.Set("Content-Type", "application/json")
	clearRR := httptest.NewRecorder()
	OracleOperationLogsClearAllHandler(sqlDB).ServeHTTP(clearRR, clearReq)
	if clearRR.Code != http.StatusOK {
		t.Fatalf("clear-all failed: %d %s", clearRR.Code, clearRR.Body.String())
	}

	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM oracle_operation_logs`).Scan(&remaining); err != nil {
		t.Fatalf("count after clear-all failed: %v", err)
	}
	if remaining != 0 {
		t.Fatalf("expected zero rows after clear-all, got %d", remaining)
	}
}

func TestRecordsCRUDHandlers(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_stepup_enforced'`); err != nil {
		t.Fatalf("failed to set stepup flag: %v", err)
	}

	upsertReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/records/upsert",
		bytes.NewBufferString(`{"recordType":"extension_version_note","recordKey":"v1","data":{"version":"1.0.0","note":"initial"}}`),
	)
	upsertReq.Header.Set("Content-Type", "application/json")
	upsertRR := httptest.NewRecorder()
	RecordsUpsertHandler(sqlDB).ServeHTTP(upsertRR, upsertReq)
	if upsertRR.Code != http.StatusOK {
		t.Fatalf("upsert failed: %d %s", upsertRR.Code, upsertRR.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/records/list?type=extension_version_note", nil)
	listRR := httptest.NewRecorder()
	RecordsListHandler(sqlDB).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("list failed: %d %s", listRR.Code, listRR.Body.String())
	}
	var listResp map[string]any
	if err := json.Unmarshal(listRR.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("failed to parse list response: %v", err)
	}
	records, ok := listResp["records"].([]any)
	if !ok || len(records) == 0 {
		t.Fatalf("expected records in list response: %v", listResp)
	}

	deleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/records/delete", bytes.NewBufferString(`{"recordType":"extension_version_note","recordKey":"v1"}`))
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	RecordsDeleteHandler(sqlDB).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("delete failed: %d %s", deleteRR.Code, deleteRR.Body.String())
	}
}

func TestCanonicalJSON_SortsNestedMapsDeterministically(t *testing.T) {
	in := map[string]any{
		"z": map[string]any{
			"b": 1,
			"a": 2,
		},
		"a": 1,
	}
	raw, err := canonicalJSON(in)
	if err != nil {
		t.Fatalf("canonicalJSON failed: %v", err)
	}
	want := `{"a":1,"z":{"a":2,"b":1}}`
	if raw != want {
		t.Fatalf("unexpected canonical JSON: got %s want %s", raw, want)
	}
}

func TestBackupFileNameOrDefault_Validation(t *testing.T) {
	now := time.Unix(1700000000, 0).UTC()

	name, err := backupFileNameOrDefault("", now)
	if err != nil {
		t.Fatalf("unexpected error for default name: %v", err)
	}
	if name != "oracle-backup-1700000000.db" {
		t.Fatalf("unexpected default name: %s", name)
	}

	valid, err := backupFileNameOrDefault("safe-file_1.db", now)
	if err != nil {
		t.Fatalf("unexpected error for valid name: %v", err)
	}
	if valid != "safe-file_1.db" {
		t.Fatalf("unexpected valid name: %s", valid)
	}

	invalid := []string{"../x.db", "..\\x.db", "x.txt", "name with spaces.db", "x.db/../y.db"}
	for _, v := range invalid {
		if _, err := backupFileNameOrDefault(v, now); err == nil {
			t.Fatalf("expected validation error for %q", v)
		}
	}
}

func TestResolveBackupPath_RejectsTraversal(t *testing.T) {
	baseDir := t.TempDir()

	_, path, err := resolveBackupPath(baseDir, "a.db")
	if err != nil {
		t.Fatalf("unexpected error resolving valid path: %v", err)
	}
	if !strings.HasSuffix(path, string(filepath.Separator)+"a.db") {
		t.Fatalf("unexpected path: %s", path)
	}

	if _, _, err := resolveBackupPath(baseDir, "../escape.db"); err == nil {
		t.Fatalf("expected traversal rejection")
	}
}
