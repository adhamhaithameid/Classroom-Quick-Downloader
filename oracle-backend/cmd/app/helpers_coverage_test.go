package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"oracle-backend/internal/db"
)

func TestGetenvAndGetenvFloat(t *testing.T) {
	t.Setenv("ORACLE_TEST_STR", "value")
	if got := getenv("ORACLE_TEST_STR", "default"); got != "value" {
		t.Fatalf("expected env value, got %q", got)
	}
	if got := getenv("ORACLE_TEST_STR_MISSING", "default"); got != "default" {
		t.Fatalf("expected default value, got %q", got)
	}

	t.Setenv("ORACLE_TEST_FLOAT", "2.75")
	if got := getenvFloat("ORACLE_TEST_FLOAT", 1.0); got != 2.75 {
		t.Fatalf("expected parsed float 2.75, got %f", got)
	}
	t.Setenv("ORACLE_TEST_FLOAT", "invalid")
	if got := getenvFloat("ORACLE_TEST_FLOAT", 1.0); got != 1.0 {
		t.Fatalf("expected fallback float 1.0, got %f", got)
	}
	t.Setenv("ORACLE_TEST_FLOAT", "")
	if got := getenvFloat("ORACLE_TEST_FLOAT", 3.5); got != 3.5 {
		t.Fatalf("expected fallback float 3.5, got %f", got)
	}
}

func TestHealthDBHandler(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "health.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}

	h := HealthDBHandler(sqlDB)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health/db", nil)
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if got := rr.Body.String(); got != "ok" {
		t.Fatalf("expected body ok, got %q", got)
	}

	rr = httptest.NewRecorder()
	headReq := httptest.NewRequest(http.MethodHead, "/health/db", nil)
	h.ServeHTTP(rr, headReq)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for HEAD, got %d", rr.Code)
	}
	if rr.Body.Len() != 0 {
		t.Fatalf("expected empty body for HEAD, got %q", rr.Body.String())
	}

	rr = httptest.NewRecorder()
	postReq := httptest.NewRequest(http.MethodPost, "/health/db", nil)
	h.ServeHTTP(rr, postReq)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for POST, got %d", rr.Code)
	}

	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close db failed: %v", err)
	}
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 on closed db, got %d", rr.Code)
	}
}

func TestScheduleSheetsArchiver_NoSheetConfiguredReturnsImmediately(t *testing.T) {
	t.Setenv("SHEETS_ID", "")
	done := make(chan struct{})
	go func() {
		scheduleSheetsArchiver()
		close(done)
	}()
	select {
	case <-done:
		// expected
	case <-time.After(2 * time.Second):
		t.Fatal("scheduleSheetsArchiver should return immediately when SHEETS_ID is unset")
	}
}

func TestRunArchiver_HandlesInvalidAndValidConfiguredPath(t *testing.T) {
	t.Setenv("ARCHIVER_PATH", filepath.Join(t.TempDir(), "missing-archiver"))
	runArchiver("sheet", "/tmp/creds.json", "", "", "http://127.0.0.1:18080/api/stats/summary")

	t.Setenv("ARCHIVER_PATH", "/usr/bin/true")
	runArchiver("sheet", "/tmp/creds.json", "", "", "http://127.0.0.1:18080/api/stats/summary")
}

func TestRunArchiver_TimesOutHungProcess(t *testing.T) {
	scriptDir := t.TempDir()
	scriptPath := filepath.Join(scriptDir, "hang-archiver.sh")
	script := "#!/bin/sh\nsleep 5\n"
	if err := os.WriteFile(scriptPath, []byte(script), 0o755); err != nil {
		t.Fatalf("failed to write hanging script: %v", err)
	}

	t.Setenv("ARCHIVER_PATH", scriptPath)
	t.Setenv("ARCHIVER_RUN_TIMEOUT_SECONDS", "1")

	start := time.Now()
	runArchiver("sheet", "/tmp/creds.json", "", "", "http://127.0.0.1:18080/api/stats/summary")
	elapsed := time.Since(start)

	if elapsed >= 4*time.Second {
		t.Fatalf("expected runArchiver timeout to stop hanging process quickly, elapsed=%s", elapsed)
	}
}

func TestSanitizeLogValue_ReplacesNewLines(t *testing.T) {
	in := "line1\nline2\rline3"
	got := sanitizeLogValue(in)
	if got != "line1_line2_line3" {
		t.Fatalf("unexpected sanitized value: %q", got)
	}
}

func TestStartInMemoryStoreCleanupLoop_StopsOnCancel(t *testing.T) {
	now := time.Now()
	sessionStore.Lock()
	sessionStore.tokens = map[string]time.Time{"expired": now.Add(-time.Minute)}
	sessionStore.Unlock()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		startInMemoryStoreCleanupLoop(ctx, time.Millisecond)
		close(done)
	}()
	cancel()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("cleanup loop did not stop after cancel")
	}
}

func TestStepUpCheckHandler(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "stepup-check.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	defer sqlDB.Close()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(nil)

	resetSessionStore()
	stepUpSessionStore.Lock()
	stepUpSessionStore.tokens = map[string]stepUpSession{
		"stepup-token": {
			expiresAt:          time.Now().Add(5 * time.Minute),
			parentSessionToken: "parent-session",
		},
	}
	stepUpSessionStore.Unlock()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/stepup/check", nil)
	req.AddCookie(&http.Cookie{Name: stepUpSessionCookieName, Value: "stepup-token"})
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "parent-session"})
	rr := httptest.NewRecorder()
	stepUpCheckHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var payload map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}
	if payload["ok"] != true {
		t.Fatalf("expected ok=true, got %v", payload["ok"])
	}
	if payload["active"] != true {
		t.Fatalf("expected active=true, got %v", payload["active"])
	}
}

func TestLoopbackAndForwardedHelpers(t *testing.T) {
	if !isLoopbackAddr("127.0.0.1:1234") {
		t.Fatal("expected 127.0.0.1 to be loopback")
	}
	if isLoopbackAddr("203.0.113.5:1234") {
		t.Fatal("expected external address to be non-loopback")
	}

	req := httptest.NewRequest(http.MethodGet, "http://localhost", nil)
	if hasForwardedIp(req) {
		t.Fatal("expected no forwarded headers")
	}
	req.Header.Set("X-Forwarded-For", "203.0.113.10")
	if !hasForwardedIp(req) {
		t.Fatal("expected forwarded headers to be detected")
	}

	if !isLoopbackHost("localhost:8080") {
		t.Fatal("expected localhost to be loopback host")
	}
	if !isLoopbackHost("127.0.0.1:8080") {
		t.Fatal("expected 127.0.0.1 to be loopback host")
	}
	if isLoopbackHost("example.com:8080") {
		t.Fatal("expected example.com to be non-loopback host")
	}
}

func TestHealthDBHandlerNilDBReturnsServiceUnavailable(t *testing.T) {
	h := HealthDBHandler((*sql.DB)(nil))
	rr := httptest.NewRecorder()
	h(rr, httptest.NewRequest(http.MethodGet, "/health/db", nil))
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 for nil DB health handler, got %d", rr.Code)
	}
}

func TestResolveArchiverAPIURL(t *testing.T) {
	cases := []struct {
		name       string
		configured string
		addr       string
		want       string
	}{
		{
			name:       "configured explicit url",
			configured: "https://oracle.local/custom",
			addr:       ":8080",
			want:       "https://oracle.local/custom",
		},
		{
			name:       "configured url missing path defaults",
			configured: "https://oracle.local",
			addr:       ":8080",
			want:       "https://oracle.local/api/stats/summary",
		},
		{
			name:       "derive from colon addr",
			configured: "",
			addr:       ":9090",
			want:       "http://127.0.0.1:9090/api/stats/summary",
		},
		{
			name:       "derive from wildcard addr",
			configured: "",
			addr:       "0.0.0.0:8081",
			want:       "http://127.0.0.1:8081/api/stats/summary",
		},
		{
			name:       "invalid configured falls back to default",
			configured: "://bad-url",
			addr:       "bad",
			want:       "http://127.0.0.1:8080/api/stats/summary",
		},
		{
			name:       "non-http configured scheme falls back to default",
			configured: "ftp://oracle.local/summary",
			addr:       ":8080",
			want:       "http://127.0.0.1:8080/api/stats/summary",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveArchiverAPIURL(tc.configured, tc.addr)
			if got != tc.want {
				t.Fatalf("resolveArchiverAPIURL(%q,%q)=%q want=%q", tc.configured, tc.addr, got, tc.want)
			}
		})
	}
}

func TestArchiverRunTimeout(t *testing.T) {
	t.Setenv("ARCHIVER_RUN_TIMEOUT_SECONDS", "")
	if got := archiverRunTimeout(); got != defaultArchiverRunTimeout {
		t.Fatalf("expected default timeout %s, got %s", defaultArchiverRunTimeout, got)
	}

	t.Setenv("ARCHIVER_RUN_TIMEOUT_SECONDS", "invalid")
	if got := archiverRunTimeout(); got != defaultArchiverRunTimeout {
		t.Fatalf("expected invalid env to use default timeout %s, got %s", defaultArchiverRunTimeout, got)
	}

	t.Setenv("ARCHIVER_RUN_TIMEOUT_SECONDS", "0")
	if got := archiverRunTimeout(); got != defaultArchiverRunTimeout {
		t.Fatalf("expected zero env to use default timeout %s, got %s", defaultArchiverRunTimeout, got)
	}

	t.Setenv("ARCHIVER_RUN_TIMEOUT_SECONDS", "1")
	if got := archiverRunTimeout(); got != 1*time.Second {
		t.Fatalf("expected one-second timeout, got %s", got)
	}

	t.Setenv("ARCHIVER_RUN_TIMEOUT_SECONDS", "999999")
	if got := archiverRunTimeout(); got != maxArchiverRunTimeout {
		t.Fatalf("expected max timeout clamp %s, got %s", maxArchiverRunTimeout, got)
	}
}

func TestDeploymentsAutoSyncEnabled(t *testing.T) {
	t.Setenv("DEPLOYMENTS_AUTO_SYNC_ENABLED", "")
	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_ENABLED", "")
	if !deploymentsAutoSyncEnabled() {
		t.Fatal("expected default auto-sync to be enabled when env is empty")
	}

	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_ENABLED", "true")
	if !deploymentsAutoSyncEnabled() {
		t.Fatal("expected auto-sync enabled when set to true")
	}

	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_ENABLED", "false")
	if deploymentsAutoSyncEnabled() {
		t.Fatal("expected auto-sync disabled when set to false")
	}

	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_ENABLED", "on")
	if !deploymentsAutoSyncEnabled() {
		t.Fatal("expected auto-sync enabled when set to on")
	}

	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_ENABLED", "")
	t.Setenv("DEPLOYMENTS_AUTO_SYNC_ENABLED", "false")
	if deploymentsAutoSyncEnabled() {
		t.Fatal("expected legacy env alias to disable auto-sync")
	}

	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_ENABLED", "")
	t.Setenv("DEPLOYMENTS_AUTO_SYNC_ENABLED", "true")
	if !deploymentsAutoSyncEnabled() {
		t.Fatal("expected legacy env alias to enable auto-sync")
	}

	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_ENABLED", "garbage")
	t.Setenv("DEPLOYMENTS_AUTO_SYNC_ENABLED", "")
	if !deploymentsAutoSyncEnabled() {
		t.Fatal("expected invalid value to default to enabled")
	}
}

func TestDeploymentsAutoSyncInterval(t *testing.T) {
	t.Setenv("DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS", "")
	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS", "")
	if got := deploymentsAutoSyncInterval(); got != defaultDeploymentsAutoSyncInterval {
		t.Fatalf("expected default interval %s, got %s", defaultDeploymentsAutoSyncInterval, got)
	}

	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS", "invalid")
	if got := deploymentsAutoSyncInterval(); got != defaultDeploymentsAutoSyncInterval {
		t.Fatalf("expected invalid env to use default interval %s, got %s", defaultDeploymentsAutoSyncInterval, got)
	}

	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS", "1")
	if got := deploymentsAutoSyncInterval(); got != minDeploymentsAutoSyncInterval {
		t.Fatalf("expected minimum clamp %s, got %s", minDeploymentsAutoSyncInterval, got)
	}

	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS", "999999")
	if got := deploymentsAutoSyncInterval(); got != maxDeploymentsAutoSyncInterval {
		t.Fatalf("expected maximum clamp %s, got %s", maxDeploymentsAutoSyncInterval, got)
	}

	t.Setenv("ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS", "")
	t.Setenv("DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS", "120")
	if got := deploymentsAutoSyncInterval(); got != 120*time.Second {
		t.Fatalf("expected legacy interval alias to apply, got %s", got)
	}
}
