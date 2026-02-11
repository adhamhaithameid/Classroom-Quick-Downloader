package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
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
