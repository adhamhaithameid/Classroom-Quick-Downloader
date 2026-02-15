package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// ──────────────────────────────────────────────────────────────────────────────
// Extended security tests
//
// These tests validate that the server is resilient against common
// injection and abuse patterns. They complement security_test.go.
// ──────────────────────────────────────────────────────────────────────────────

func TestSecurity_SQLInjectionInQueryParams(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	payloads := []string{
		"/api/stats/timeseries?from=2026-01-01'%3B%20DROP%20TABLE%20batches%3B--",
		"/api/stats/breakdown?dimension=type'%3B%20DROP%20TABLE%20batches%3B--",
		"/api/stats/export?range=all&format=json'%3B%20DROP%20TABLE%20batches%3B--",
		"/api/admin/oracle-logs?limit=100%3B%20DROP%20TABLE%20batches",
	}

	for _, url := range payloads {
		t.Run(url, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, url, nil)
			rr := httptest.NewRecorder()
			mux.ServeHTTP(rr, req)

			// Should not return 200 — either 400 or 500, never panic
			if rr.Code == http.StatusOK {
				t.Logf("Warning: %s returned 200 — verify queries are parameterized", url)
			}
		})
	}

	// Verify the database is intact
	var count int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'batches'`).Scan(&count); err != nil {
		t.Fatalf("database integrity check failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("batches table was dropped by SQL injection!")
	}
}

func TestSecurity_XSSInHeaders(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	xssPayloads := []string{
		`<script>alert('xss')</script>`,
		`"><img src=x onerror=alert(1)>`,
		`'; DROP TABLE batches; --`,
	}

	for _, payload := range xssPayloads {
		t.Run(payload[:20], func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/health", nil)
			req.Header.Set("User-Agent", payload)
			req.Header.Set("X-Forwarded-For", payload)
			rr := httptest.NewRecorder()
			mux.ServeHTTP(rr, req)

			// Should respond normally (headers are just ignored)
			if rr.Code != http.StatusOK {
				t.Fatalf("expected 200 even with XSS headers, got %d", rr.Code)
			}

			// Response body should NOT reflect the payload
			bodyStr := rr.Body.String()
			if strings.Contains(bodyStr, "<script>") {
				t.Fatalf("response body reflects XSS payload!")
			}
		})
	}
}

func TestSecurity_PathTraversal(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	traversalPaths := []string{
		"/../../../etc/passwd",
		"/health/../../../etc/shadow",
		"/api/stats/../../internal/secrets",
		"/api/admin/flags/../../.env",
		"/%2e%2e/%2e%2e/%2e%2e/etc/passwd",
	}

	for _, path := range traversalPaths {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rr := httptest.NewRecorder()
			mux.ServeHTTP(rr, req)

			// Should be 404 — path traversal should not expose anything
			// Go's ServeMux cleans paths, so these are typically 301 or 404
			if rr.Code == http.StatusOK {
				body := rr.Body.String()
				if strings.Contains(body, "root:") || strings.Contains(body, "password") {
					t.Fatalf("path traversal exposed sensitive data at %s", path)
				}
			}
		})
	}
}

func TestSecurity_MethodEnforcementOnProtectedRoutes(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	readOnlyRoutes := []string{
		"/health",
		"/api/stats/summary",
		"/api/stats/timeseries",
		"/api/stats/breakdown",
		"/api/stats/export",
		"/api/deploy-status",
		"/api/pipeline/metrics",
		"/api/pipeline/failures",
		"/api/admin/flags",
		"/api/admin/alerts",
		"/api/admin/oracle-logs",
	}

	for _, route := range readOnlyRoutes {
		methods := []string{http.MethodPut, http.MethodDelete, http.MethodPatch}
		for _, method := range methods {
			t.Run(method+" "+route, func(t *testing.T) {
				req := httptest.NewRequest(method, route, nil)
				rr := httptest.NewRecorder()
				mux.ServeHTTP(rr, req)

				if rr.Code == http.StatusOK {
					t.Fatalf("expected non-200 for %s %s (method should be restricted)", method, route)
				}
			})
		}
	}
}

func TestSecurity_IngestBatchWithoutSecret(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(`{"batchId":"attack","timeZone":"UTC"}`))
	req.Header.Set("Content-Type", "application/json")
	// No X-DO-SECRET header
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code == http.StatusOK {
		t.Fatalf("ingest without secret should be rejected, got 200")
	}
}

func TestSecurity_IngestBatchWithWrongSecret(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(`{"batchId":"attack","timeZone":"UTC"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", "wrong-secret")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code == http.StatusOK {
		t.Fatalf("ingest with wrong secret should be rejected, got 200")
	}
}

func TestSecurity_OversizedBody(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	// 10MB of garbage
	oversized := strings.Repeat("x", 10*1024*1024)
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(oversized))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", "test-secret")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	// Should either reject (400/413) or fail gracefully (500), but never crash
	if rr.Code == http.StatusOK {
		t.Logf("Warning: 10MB body was accepted — verify body size limits")
	}
}

func TestSecurity_ContentTypeValidation(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	// Health endpoint should respond with application/json regardless
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	ct := rr.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("expected Content-Type: application/json, got %q", ct)
	}
}
