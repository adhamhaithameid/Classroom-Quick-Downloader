package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"oracle-backend/internal/db"
)

func TestAppendAuditLogOrHTTPError_NilDBAllowed(t *testing.T) {
	rr := httptest.NewRecorder()

	ok := appendAuditLogOrHTTPError(
		rr,
		context.Background(),
		nil,
		"test_action",
		"test_resource",
		"resource-1",
		"ok",
		map[string]any{"k": "v"},
	)

	if !ok {
		t.Fatal("expected helper to pass when db is nil")
	}
	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200 when no error is written, got %d", rr.Code)
	}
}

func TestAppendAuditLogOrHTTPError_ClosedDBReturns500(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "audit-helper-closed.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("db close failed: %v", err)
	}

	rr := httptest.NewRecorder()
	ok := appendAuditLogOrHTTPError(
		rr,
		context.Background(),
		sqlDB,
		"test_action",
		"test_resource",
		"resource-1",
		"ok",
		map[string]any{"k": "v"},
	)

	if ok {
		t.Fatal("expected helper to fail when db is closed")
	}
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on audit write failure, got %d", rr.Code)
	}
}

func TestAppendAuditLogOrHTTPError_WritesAuditRow(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "audit-helper-ok.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	rr := httptest.NewRecorder()
	ok := appendAuditLogOrHTTPError(
		rr,
		context.Background(),
		sqlDB,
		"test_action",
		"test_resource",
		"resource-1",
		"ok",
		map[string]any{"k": "v"},
	)
	if !ok {
		t.Fatal("expected helper to succeed on valid db")
	}

	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM admin_audit_log`).Scan(&count); err != nil {
		t.Fatalf("count query failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 audit row, got %d", count)
	}
}
