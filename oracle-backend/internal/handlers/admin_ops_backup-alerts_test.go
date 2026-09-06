package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"oracle-backend/internal/observability"
)

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
