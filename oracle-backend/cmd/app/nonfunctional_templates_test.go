package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"oracle-backend/internal/db"
	"oracle-backend/internal/handlers"
)

func TestNonFunctionalTemplate_SQLInjectionPayloadDoesNotMutateSchema(t *testing.T) {
	// Arrange
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	payloads := []string{
		"/api/stats/timeseries?from=2026-01-01%27%3BDROP%20TABLE%20batches%3B--&to=2026-01-02",
		"/api/stats/breakdown?dimension=type%27%3BDROP%20TABLE%20admin_records%3B--",
		"/api/admin/oracle-logs?limit=100%3BDROP%20TABLE%20feature_flags",
	}

	// Act
	for _, route := range payloads {
		req := httptest.NewRequest(http.MethodGet, route, nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
	}

	// Assert
	var batchesExists int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='batches'`).Scan(&batchesExists); err != nil {
		t.Fatalf("schema check for batches failed: %v", err)
	}
	if batchesExists != 1 {
		t.Fatalf("expected batches table to remain intact, got count=%d", batchesExists)
	}

	var flagsExists int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='feature_flags'`).Scan(&flagsExists); err != nil {
		t.Fatalf("schema check for feature_flags failed: %v", err)
	}
	if flagsExists != 1 {
		t.Fatalf("expected feature_flags table to remain intact, got count=%d", flagsExists)
	}
}

func TestNonFunctionalTemplate_AuthHeaderValidation(t *testing.T) {
	// Arrange
	resetSessionStore()
	protected := requireAuth(nil, "viewer-secret", "archiver-secret", false)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	cases := []struct {
		name          string
		path          string
		authHeader    string
		archiverToken string
		wantStatus    int
	}{
		{
			name:       "missing credentials",
			path:       "/api/secure",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "authorization bearer does not bypass cookie auth",
			path:       "/api/secure",
			authHeader: "Bearer fake-jwt-token",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:          "invalid archiver token",
			path:          "/api/stats/summary",
			archiverToken: "wrong-secret",
			wantStatus:    http.StatusUnauthorized,
		},
		{
			name:          "valid archiver token on allowed path",
			path:          "/api/stats/summary",
			archiverToken: "archiver-secret",
			wantStatus:    http.StatusOK,
		},
		{
			name:          "valid archiver token on disallowed path",
			path:          "/api/secure",
			archiverToken: "archiver-secret",
			wantStatus:    http.StatusUnauthorized,
		},
	}

	// Act + Assert
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			if tc.archiverToken != "" {
				req.Header.Set("X-Archiver-Secret", tc.archiverToken)
			}
			rr := httptest.NewRecorder()
			protected.ServeHTTP(rr, req)
			if rr.Code != tc.wantStatus {
				t.Fatalf("expected status=%d, got %d", tc.wantStatus, rr.Code)
			}
		})
	}
}

func TestNonFunctionalTemplate_SQLQueryBlocksQuotedRestrictedTables(t *testing.T) {
	// Arrange
	dbPath := filepath.Join(t.TempDir(), "sql-console-test.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_sql_console_enabled'`); err != nil {
		t.Fatalf("enable sql console flag failed: %v", err)
	}
	h := handlers.SQLQueryHandler(sqlDB, nil)

	// Act
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/sql/query",
		bytes.NewBufferString(`{"sql":"SELECT * FROM \"feature_flags\"","limit":10}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	// Assert
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected quoted restricted-table query to be rejected with 400, got %d: %s", rr.Code, rr.Body.String())
	}
}
