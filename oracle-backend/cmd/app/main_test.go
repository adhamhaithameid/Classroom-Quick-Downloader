package main

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"oracle-backend/internal/db"
	"oracle-backend/internal/observability"
)

func TestGetClientIPTrustedProxyUsesForwarded(t *testing.T) {
	prev := trustedProxyNets
	defer setTrustedProxyNets(prev)

	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.RemoteAddr = "10.1.2.3:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.10, 10.1.2.3")

	ip := getClientIP(req)
	if ip != "203.0.113.10" {
		t.Fatalf("expected forwarded IP, got %q", ip)
	}
}

func TestGetClientIPUntrustedProxyIgnoresForwarded(t *testing.T) {
	prev := trustedProxyNets
	defer setTrustedProxyNets(prev)

	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.RemoteAddr = "192.168.1.5:4321"
	req.Header.Set("X-Forwarded-For", "203.0.113.10")

	ip := getClientIP(req)
	if ip != "192.168.1.5" {
		t.Fatalf("expected remote IP, got %q", ip)
	}
}

func TestLoggingMiddleware_PersistsOracleOperationLogs(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "oracle-logs.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	handler := observability.RequestContextMiddleware(
		loggingMiddleware(sqlDB, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusCreated)
		})),
	)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/flags", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("unexpected status code: %d", rr.Code)
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM oracle_operation_logs WHERE path = '/api/admin/flags'`).Scan(&count); err != nil {
		t.Fatalf("query oracle operation logs failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one oracle operation log row, got %d", count)
	}
}

func TestLoggingMiddleware_SkipsStaticAssetPaths(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "oracle-no-log.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	handler := observability.RequestContextMiddleware(
		loggingMiddleware(sqlDB, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		})),
	)
	req := httptest.NewRequest(http.MethodGet, "/logo.svg", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d", rr.Code)
	}

	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM oracle_operation_logs`).Scan(&count); err != nil {
		t.Fatalf("query oracle operation logs failed: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected zero oracle operation log rows for static asset path, got %d", count)
	}
}

func TestIsOracleOperationPath(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{path: "/api/stats/summary", want: true},
		{path: "/api/admin/flags", want: true},
		{path: "/ingest-batch", want: true},
		{path: "/storeBatch", want: true},
		{path: "/health", want: true},
		{path: "/metrics", want: true},
		{path: "/logo.svg", want: false},
		{path: "/", want: false},
	}
	for _, tc := range cases {
		got := isOracleOperationPath(tc.path)
		if got != tc.want {
			t.Fatalf("path=%q got=%v want=%v", tc.path, got, tc.want)
		}
	}
}
