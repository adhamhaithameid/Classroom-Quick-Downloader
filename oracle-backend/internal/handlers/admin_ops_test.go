package handlers

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/observability"
)

func newAdminTestDB(t *testing.T) *sql.DB {
	t.Helper()
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
		"doState":{"ok":true},
		"extra":{"newThing":{"enabled":true}}
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
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM cf_schema_registry WHERE json_path = 'extra.newThing.enabled'`).Scan(&schemaPathCount); err != nil {
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
	RetryOutboxHandler(sqlDB, observability.NewRegistry()).ServeHTTP(rr, req)
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
	SQLQueryHandler(sqlDB).ServeHTTP(rr, req)
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
	SQLQueryHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for WITH statement on query endpoint, got %d: %s", rr.Code, rr.Body.String())
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
