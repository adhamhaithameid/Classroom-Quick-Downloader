package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"oracle-backend/internal/db"
)

func TestManualSheetsFlushHandler_MethodNotAllowed(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "manual-flush-method.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/admin/sheets/flush-now", nil)
	rr := httptest.NewRecorder()
	ManualSheetsFlushHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestManualSheetsFlushHandler_RequiresSheetsConfig(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "manual-flush-config.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	t.Setenv("SHEETS_ID", "")

	req := httptest.NewRequest(http.MethodPost, "/api/admin/sheets/flush-now", nil)
	rr := httptest.NewRecorder()
	ManualSheetsFlushHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if payload.OK || payload.Error != "sheets_not_configured" {
		t.Fatalf("unexpected payload: %+v", payload)
	}
}

func TestManualSheetsFlushHandler_RejectsConcurrentRuns(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "manual-flush-concurrent.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	if !tryAcquireManualSheetsFlush() {
		t.Fatal("expected manual flush gate to be available at test start")
	}
	defer releaseManualSheetsFlush()

	t.Setenv("SHEETS_ID", "sheet-abc")

	req := httptest.NewRequest(http.MethodPost, "/api/admin/sheets/flush-now", nil)
	rr := httptest.NewRecorder()
	ManualSheetsFlushHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestManualSheetsFlushHandler_Success(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "manual-flush-success.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	setAuthStateDB(sqlDB)
	t.Cleanup(func() {
		setAuthStateDB(nil)
	})

	t.Setenv("SHEETS_ID", "sheet-abc")
	t.Setenv("GOOGLE_CREDS_PATH", "/tmp/fake-creds.json")
	t.Setenv("ARCHIVER_PATH", "/usr/bin/true")

	req := httptest.NewRequest(http.MethodPost, "/api/admin/sheets/flush-now", nil)
	rr := httptest.NewRecorder()
	ManualSheetsFlushHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK       bool `json:"ok"`
		FlushRun struct {
			Status  string `json:"status"`
			SheetID string `json:"sheetId"`
		} `json:"flushRun"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if !payload.OK {
		t.Fatalf("expected ok=true, got payload=%+v", payload)
	}
	if payload.FlushRun.Status != "ok" {
		t.Fatalf("expected flush status=ok, got %q", payload.FlushRun.Status)
	}
	if payload.FlushRun.SheetID != "sheet-abc" {
		t.Fatalf("expected sheet id sheet-abc, got %q", payload.FlushRun.SheetID)
	}
}
