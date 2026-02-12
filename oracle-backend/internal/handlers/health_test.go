package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"oracle-backend/internal/db"
)

func TestAPIHealthHandler_ReturnsOK(t *testing.T) {
	// Arrange
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rr := httptest.NewRecorder()

	// Act
	APIHealthHandler(rr, req)

	// Assert
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected application/json, got %q", ct)
	}
	var resp healthResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if !resp.OK {
		t.Fatalf("expected ok=true, got %v", resp.OK)
	}
}

func TestAPIHealthHandler_HEAD(t *testing.T) {
	// Arrange
	req := httptest.NewRequest(http.MethodHead, "/api/health", nil)
	rr := httptest.NewRecorder()

	// Act
	APIHealthHandler(rr, req)

	// Assert
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for HEAD, got %d", rr.Code)
	}
}

func TestAPIHealthHandler_MethodNotAllowed(t *testing.T) {
	methods := []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch}
	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			// Arrange
			req := httptest.NewRequest(method, "/api/health", nil)
			rr := httptest.NewRecorder()

			// Act
			APIHealthHandler(rr, req)

			// Assert
			if rr.Code != http.StatusMethodNotAllowed {
				t.Fatalf("expected 405 for %s, got %d", method, rr.Code)
			}
		})
	}
}

func newHealthTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "health-test.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	return sqlDB
}

func TestDBHealthHandler_ReturnsOK(t *testing.T) {
	// Arrange
	sqlDB := newHealthTestDB(t)
	defer sqlDB.Close()
	handler := DBHealthHandler(sqlDB)
	req := httptest.NewRequest(http.MethodGet, "/api/db-health", nil)
	rr := httptest.NewRecorder()

	// Act
	handler.ServeHTTP(rr, req)

	// Assert
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp healthResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if !resp.OK {
		t.Fatalf("expected ok=true")
	}
}

func TestDBHealthHandler_MethodNotAllowed(t *testing.T) {
	// Arrange
	sqlDB := newHealthTestDB(t)
	defer sqlDB.Close()
	handler := DBHealthHandler(sqlDB)
	req := httptest.NewRequest(http.MethodPost, "/api/db-health", nil)
	rr := httptest.NewRecorder()

	// Act
	handler.ServeHTTP(rr, req)

	// Assert
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestDBHealthHandler_FailsWithClosedDB(t *testing.T) {
	// Arrange
	sqlDB := newHealthTestDB(t)
	sqlDB.Close() // Close before use
	handler := DBHealthHandler(sqlDB)
	req := httptest.NewRequest(http.MethodGet, "/api/db-health", nil)
	rr := httptest.NewRecorder()

	// Act
	handler.ServeHTTP(rr, req)

	// Assert
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for closed DB, got %d", rr.Code)
	}
}
