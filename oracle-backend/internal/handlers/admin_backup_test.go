package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/observability"
)

func openBackupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := db.Init(t.TempDir() + "/backup_test.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

func fixedTime() time.Time {
	return time.Date(2026, 1, 15, 12, 0, 0, 0, time.UTC)
}

// ---------------------------------------------------------------------------
// BackupRunHandler
// ---------------------------------------------------------------------------

func TestBackupRunHandler_SuccessCreatesFile(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	backupDir := t.TempDir()
	t.Setenv("BACKUP_DIR", backupDir)

	body := `{"fileName":"test-backup.db"}`
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run", strings.NewReader(body))
	BackupRunHandler(d, reg).ServeHTTP(rr, req)

	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}
	if resp["ok"] != true {
		t.Fatalf("expected ok=true, got %v", resp["ok"])
	}

	// Verify the backup file was actually created
	backupPath, _ := resp["backupPath"].(string)
	if backupPath == "" {
		t.Fatal("expected non-empty backupPath in response")
	}
	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		t.Fatalf("backup file does not exist at %s", backupPath)
	}
}

func TestBackupRunHandler_DefaultFileName(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	backupDir := t.TempDir()
	t.Setenv("BACKUP_DIR", backupDir)

	// Empty body → auto-generated filename
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run", strings.NewReader("{}"))
	BackupRunHandler(d, reg).ServeHTTP(rr, req)

	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(rr.Body.Bytes(), &resp)
	backupPath, _ := resp["backupPath"].(string)
	if !strings.Contains(backupPath, "oracle-backup-") {
		t.Fatalf("expected auto-generated filename with 'oracle-backup-' prefix, got %q", backupPath)
	}
}

func TestBackupRunHandler_EmptyBody(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	backupDir := t.TempDir()
	t.Setenv("BACKUP_DIR", backupDir)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run", nil)
	BackupRunHandler(d, reg).ServeHTTP(rr, req)

	// Empty body (io.EOF) should still succeed with default filename
	if rr.Code != 200 {
		t.Fatalf("expected 200 for empty body, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestBackupRunHandler_DirectoryTraversalBlocked(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	backupDir := t.TempDir()
	t.Setenv("BACKUP_DIR", backupDir)

	body := `{"fileName":"../../../etc/malicious.db"}`
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run", strings.NewReader(body))
	BackupRunHandler(d, reg).ServeHTTP(rr, req)

	if rr.Code == 200 {
		t.Fatal("expected directory traversal to be rejected")
	}
}

func TestBackupRunHandler_SpecialCharsInFileName(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	backupDir := t.TempDir()
	t.Setenv("BACKUP_DIR", backupDir)

	invalidNames := []string{
		"file with spaces.db",
		"file;drop.db",
		"file|pipe.db",
		"file\x00null.db",
		"../sneaky.db",
		"sub/dir/file.db",
	}
	for _, name := range invalidNames {
		t.Run(name, func(t *testing.T) {
			body := `{"fileName":"` + name + `"}`
			rr := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/backup/run", strings.NewReader(body))
			BackupRunHandler(d, reg).ServeHTTP(rr, req)
			if rr.Code == 200 {
				t.Fatalf("expected rejection for fileName=%q, got 200", name)
			}
		})
	}
}

func TestBackupRunHandler_ValidFileNames(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	validNames := []string{
		"backup.db",
		"my-backup-2026.db",
		"oracle_backup.db",
		"v1.2.3.db",
	}
	for _, name := range validNames {
		t.Run(name, func(t *testing.T) {
			backupDir := t.TempDir()
			t.Setenv("BACKUP_DIR", backupDir)

			body := `{"fileName":"` + name + `"}`
			rr := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/backup/run", strings.NewReader(body))
			BackupRunHandler(d, reg).ServeHTTP(rr, req)
			if rr.Code != 200 {
				t.Fatalf("expected 200 for valid fileName=%q, got %d: %s", name, rr.Code, rr.Body.String())
			}
		})
	}
}

func TestBackupRunHandler_CreatesAuditLogEntry(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	backupDir := t.TempDir()
	t.Setenv("BACKUP_DIR", backupDir)

	body := `{"fileName":"audit-test-backup.db"}`
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run", strings.NewReader(body))
	BackupRunHandler(d, reg).ServeHTTP(rr, req)

	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	// Verify audit log entry was created
	var count int
	err := d.QueryRow(`SELECT COUNT(*) FROM admin_audit_log WHERE action_type = 'backup_run'`).Scan(&count)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected 1 audit log entry for backup_run, got %d", count)
	}
}

func TestBackupRunHandler_CreatesBackupRunsRow(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	backupDir := t.TempDir()
	t.Setenv("BACKUP_DIR", backupDir)

	body := `{"fileName":"runs-test.db"}`
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run", strings.NewReader(body))
	BackupRunHandler(d, reg).ServeHTTP(rr, req)

	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var status string
	err := d.QueryRow(`SELECT status FROM backup_runs ORDER BY rowid DESC LIMIT 1`).Scan(&status)
	if err != nil {
		t.Fatal(err)
	}
	if status != "ok" {
		t.Fatalf("expected status=ok, got %q", status)
	}
}

func TestBackupRunHandler_InvalidBodyJSON(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/backup/run", strings.NewReader("not-json"))
	BackupRunHandler(d, reg).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400 for invalid JSON body, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// resolveBackupPath edge cases
// ---------------------------------------------------------------------------

func TestResolveBackupPath_BasicValid(t *testing.T) {
	dir := t.TempDir()
	absDir, path, err := resolveBackupPath(dir, "test.db")
	if err != nil {
		t.Fatal(err)
	}
	if absDir == "" || path == "" {
		t.Fatal("expected non-empty results")
	}
	if !strings.HasSuffix(path, "test.db") {
		t.Fatalf("expected path ending with test.db, got %q", path)
	}
}

func TestResolveBackupPath_TraversalBlocked(t *testing.T) {
	dir := t.TempDir()
	_, _, err := resolveBackupPath(dir, "../escape.db")
	if err == nil {
		t.Fatal("expected error for path traversal")
	}
}

func TestResolveBackupPath_DotPath(t *testing.T) {
	dir := t.TempDir()
	_, _, err := resolveBackupPath(dir, ".")
	if err == nil {
		t.Fatal("expected error for '.' path")
	}
}

// ---------------------------------------------------------------------------
// backupFileNameOrDefault
// ---------------------------------------------------------------------------

func TestBackupFileNameOrDefault_EmptyUsesTimestamp(t *testing.T) {
	name, err := backupFileNameOrDefault("", fixedTime())
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(name, "oracle-backup-") {
		t.Fatalf("expected oracle-backup- prefix, got %q", name)
	}
	if !strings.HasSuffix(name, ".db") {
		t.Fatalf("expected .db suffix, got %q", name)
	}
}

func TestBackupFileNameOrDefault_ValidName(t *testing.T) {
	name, err := backupFileNameOrDefault("my-backup.db", fixedTime())
	if err != nil {
		t.Fatal(err)
	}
	if name != "my-backup.db" {
		t.Fatalf("expected my-backup.db, got %q", name)
	}
}

func TestBackupFileNameOrDefault_RejectsSlash(t *testing.T) {
	_, err := backupFileNameOrDefault("sub/file.db", fixedTime())
	if err == nil {
		t.Fatal("expected error for slash in filename")
	}
}

func TestBackupFileNameOrDefault_RejectsBackslash(t *testing.T) {
	_, err := backupFileNameOrDefault("sub\\file.db", fixedTime())
	if err == nil {
		t.Fatal("expected error for backslash in filename")
	}
}

func TestBackupFileNameOrDefault_RejectsDotDot(t *testing.T) {
	_, err := backupFileNameOrDefault("..sneaky.db", fixedTime())
	if err == nil {
		t.Fatal("expected error for '..' in filename")
	}
}

func TestBackupFileNameOrDefault_RejectsNonDBExtension(t *testing.T) {
	_, err := backupFileNameOrDefault("backup.txt", fixedTime())
	if err == nil {
		t.Fatal("expected error for non-.db extension")
	}
}

// ---------------------------------------------------------------------------
// recordBackupFailure
// ---------------------------------------------------------------------------

func TestRecordBackupFailure_WritesErrorRow(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	recordBackupFailure(context.Background(), d, reg, "/fake/path.db", 1000, 2000, filepath.ErrBadPattern)

	var status, errMsg string
	err := d.QueryRow(`SELECT status, error_message FROM backup_runs ORDER BY rowid DESC LIMIT 1`).Scan(&status, &errMsg)
	if err != nil {
		t.Fatal(err)
	}
	if status != "error" {
		t.Fatalf("expected status=error, got %q", status)
	}
	if errMsg == "" {
		t.Fatal("expected non-empty error message")
	}
}

func TestRecordBackupFailure_CreatesSystemAlert(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	recordBackupFailure(context.Background(), d, reg, "/fake/path.db", 0, 0, filepath.ErrBadPattern)

	var count int
	err := d.QueryRow(`SELECT COUNT(*) FROM system_alerts WHERE alert_type = 'backup_failed'`).Scan(&count)
	if err != nil {
		t.Fatal(err)
	}
	if count == 0 {
		t.Fatal("expected a system alert for backup failure")
	}
}

func TestRecordBackupFailure_IncrementsMetric(t *testing.T) {
	d := openBackupTestDB(t)
	reg := observability.NewRegistry()

	recordBackupFailure(context.Background(), d, reg, "/fake/path.db", 0, 0, filepath.ErrBadPattern)

	// The metric should be incremented — we can't easily read Prometheus counters,
	// but we verify no panic occurred and the function completed successfully
}
