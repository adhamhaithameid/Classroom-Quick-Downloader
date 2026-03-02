package main

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	"oracle-backend/internal/db"
)

func TestExtractArchiverMetadata(t *testing.T) {
	meta := []byte(`{
		"archivedDay":"2026-02-13",
		"row":["2026-02-13",100,90,10,"90.00%"],
		"summary":{"totals":{"totalDownloads":100}}
	}`)
	day, rowJSON, summaryJSON := extractArchiverMetadata(meta)
	if day != "2026-02-13" {
		t.Fatalf("expected archived day, got %q", day)
	}
	if string(rowJSON) == "" {
		t.Fatalf("expected row json to be extracted")
	}
	if string(summaryJSON) == "" {
		t.Fatalf("expected summary json to be extracted")
	}
}

func TestExtractArchiverMetadata_InvalidJSON(t *testing.T) {
	day, rowJSON, summaryJSON := extractArchiverMetadata([]byte("{bad-json"))
	if day != "" || rowJSON != nil || summaryJSON != nil {
		t.Fatalf("expected empty metadata for invalid JSON, got day=%q row=%q summary=%q", day, string(rowJSON), string(summaryJSON))
	}
}

func TestRecordSheetsFlushRunResult_PersistsToDB(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "flush.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	setAuthStateDB(sqlDB)
	t.Cleanup(func() {
		setAuthStateDB(nil)
	})

	recordSheetsFlushRunResult(
		context.Background(),
		"ok",
		"sheet-abc",
		"http://127.0.0.1:8080/api/stats/summary",
		[]byte(`["2026-02-13", 1]`),
		[]byte(`{"totals":{"totalDownloads":1}}`),
		[]byte(`{"archivedDay":"2026-02-13"}`),
		"2026-02-13",
		"",
	)

	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM sheets_flush_runs`).Scan(&count); err != nil {
		t.Fatalf("query sheets_flush_runs failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one stored flush record, got %d", count)
	}

	var metaRaw string
	if err := sqlDB.QueryRow(`SELECT COALESCE(meta_json, '') FROM sheets_flush_runs ORDER BY id DESC LIMIT 1`).Scan(&metaRaw); err != nil {
		t.Fatalf("query sheets meta_json failed: %v", err)
	}
	var meta map[string]any
	if err := json.Unmarshal([]byte(metaRaw), &meta); err != nil {
		t.Fatalf("decode meta_json failed: %v", err)
	}
	verification, ok := meta["verification"].(map[string]any)
	if !ok {
		t.Fatalf("expected meta_json.verification object, got %v", meta["verification"])
	}
	if verified, ok := verification["verified"].(bool); !ok || !verified {
		t.Fatalf("expected verification.verified=true, got %v", verification["verified"])
	}
}

func TestRunArchiver_InvalidPathPersistsErrorFlushRun(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "flush-invalid-path.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	setAuthStateDB(sqlDB)
	t.Cleanup(func() {
		setAuthStateDB(nil)
	})
	t.Setenv("ARCHIVER_PATH", filepath.Join(t.TempDir(), "missing-archiver"))

	runArchiver("sheet-abc", "/tmp/creds.json", "", "", "http://127.0.0.1:8080/api/stats/summary")

	var status string
	var errMsg string
	if err := sqlDB.QueryRow(`
		SELECT status, COALESCE(error_message, '')
		FROM sheets_flush_runs
		ORDER BY id DESC
		LIMIT 1`,
	).Scan(&status, &errMsg); err != nil {
		t.Fatalf("query sheets_flush_runs failed: %v", err)
	}
	if status != "error" {
		t.Fatalf("expected error status for invalid archiver path, got %q", status)
	}
	if strings.TrimSpace(errMsg) == "" {
		t.Fatalf("expected error message to be persisted for invalid archiver path")
	}
}

func TestRunArchiver_MkdirTempFailurePersistsErrorFlushRun(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "flush-temp-fail.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	setAuthStateDB(sqlDB)
	t.Cleanup(func() {
		setAuthStateDB(nil)
	})

	tmpRoot := t.TempDir()
	t.Setenv("TMPDIR", filepath.Join(tmpRoot, "missing-temp-dir"))
	t.Setenv("ARCHIVER_PATH", "/usr/bin/true")

	runArchiver("sheet-abc", "/tmp/creds.json", "", "", "http://127.0.0.1:8080/api/stats/summary")

	var status string
	var errMsg string
	if err := sqlDB.QueryRow(`
		SELECT status, COALESCE(error_message, '')
		FROM sheets_flush_runs
		ORDER BY id DESC
		LIMIT 1`,
	).Scan(&status, &errMsg); err != nil {
		t.Fatalf("query sheets_flush_runs failed: %v", err)
	}
	if status != "error" {
		t.Fatalf("expected error status for temp-dir failure, got %q", status)
	}
	if strings.TrimSpace(errMsg) == "" {
		t.Fatalf("expected error message to be persisted for temp-dir failure")
	}
}
