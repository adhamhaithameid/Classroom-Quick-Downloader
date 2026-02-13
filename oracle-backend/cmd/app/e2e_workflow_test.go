package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"oracle-backend/internal/db"
	"oracle-backend/internal/handlers"
)

func newAuthWorkflowMux(t *testing.T, dashboardPassword string) (*http.ServeMux, *sql.DB) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "workflow.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}

	resetSessionStore()
	resetLoginRateStore()
	setAuthStateDB(sqlDB)
	t.Cleanup(func() {
		setAuthStateDB(nil)
		resetSessionStore()
		resetLoginRateStore()
	})

	authMiddleware := requireAuth(sqlDB, dashboardPassword, "", false)

	mux := http.NewServeMux()
	mux.Handle("/ingest-batch", handlers.IngestBatchHandler(sqlDB, "workflow-secret"))
	mux.Handle("/api/stats/summary", authMiddleware(handlers.SummaryHandler(sqlDB)))
	mux.HandleFunc("/api/auth/login", loginHandler(sqlDB, dashboardPassword))
	mux.HandleFunc("/api/auth/check", authCheckHandler(sqlDB, dashboardPassword))
	mux.HandleFunc("/api/auth/logout", logoutHandler(sqlDB))
	return mux, sqlDB
}

func TestE2EWorkflow_LoginAuthenticateReadLogout(t *testing.T) {
	// Arrange
	mux, sqlDB := newAuthWorkflowMux(t, "viewer-secret")
	defer sqlDB.Close()

	ingestPayload := `{
		"batchId":"e2e-auth-flow",
		"generatedAt":1739308800000,
		"timeZone":"UTC",
		"summary":{"totals":{"totalEvents":7,"totalDownloads":7,"totalSuccess":6,"totalFail":1}},
		"timeBuckets":[],
		"doState":{"ok":true}
	}`
	seedReq := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(ingestPayload))
	seedReq.Header.Set("X-DO-SECRET", "workflow-secret")
	seedReq.Header.Set("Content-Type", "application/json")
	seedRR := httptest.NewRecorder()
	mux.ServeHTTP(seedRR, seedReq)
	if seedRR.Code != http.StatusOK {
		t.Fatalf("expected ingest to succeed, got %d: %s", seedRR.Code, seedRR.Body.String())
	}

	// Act + Assert (unauthenticated request blocked)
	unauthReq := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	unauthRR := httptest.NewRecorder()
	mux.ServeHTTP(unauthRR, unauthReq)
	if unauthRR.Code != http.StatusUnauthorized {
		t.Fatalf("expected summary without session to be 401, got %d", unauthRR.Code)
	}

	// Act: login
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"password":"viewer-secret"}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	mux.ServeHTTP(loginRR, loginReq)
	if loginRR.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d: %s", loginRR.Code, loginRR.Body.String())
	}

	var sessionCookie *http.Cookie
	for _, c := range loginRR.Result().Cookies() {
		if c.Name == sessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || sessionCookie.Value == "" {
		t.Fatalf("expected non-empty %s cookie", sessionCookieName)
	}

	// Act + Assert: auth check reports authenticated=true
	checkReq := httptest.NewRequest(http.MethodGet, "/api/auth/check", nil)
	checkReq.AddCookie(sessionCookie)
	checkRR := httptest.NewRecorder()
	mux.ServeHTTP(checkRR, checkReq)
	if checkRR.Code != http.StatusOK {
		t.Fatalf("expected auth check 200, got %d: %s", checkRR.Code, checkRR.Body.String())
	}
	var checkPayload map[string]any
	if err := json.Unmarshal(checkRR.Body.Bytes(), &checkPayload); err != nil {
		t.Fatalf("failed to parse auth check payload: %v", err)
	}
	if authenticated, _ := checkPayload["authenticated"].(bool); !authenticated {
		t.Fatalf("expected authenticated=true, payload=%v", checkPayload)
	}

	// Act + Assert: authenticated summary succeeds
	summaryReq := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	summaryReq.AddCookie(sessionCookie)
	summaryRR := httptest.NewRecorder()
	mux.ServeHTTP(summaryRR, summaryReq)
	if summaryRR.Code != http.StatusOK {
		t.Fatalf("expected summary with session 200, got %d: %s", summaryRR.Code, summaryRR.Body.String())
	}
	var summaryPayload map[string]any
	if err := json.Unmarshal(summaryRR.Body.Bytes(), &summaryPayload); err != nil {
		t.Fatalf("failed to parse summary payload: %v", err)
	}
	if totalDownloads, _ := summaryPayload["totalDownloads"].(float64); totalDownloads < 7 {
		t.Fatalf("expected totalDownloads >= 7, got %v", summaryPayload["totalDownloads"])
	}

	// Act: logout
	logoutReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutReq.AddCookie(sessionCookie)
	logoutRR := httptest.NewRecorder()
	mux.ServeHTTP(logoutRR, logoutReq)
	if logoutRR.Code != http.StatusOK {
		t.Fatalf("expected logout 200, got %d: %s", logoutRR.Code, logoutRR.Body.String())
	}

	// Assert: old cookie no longer grants access
	afterLogoutReq := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	afterLogoutReq.AddCookie(sessionCookie)
	afterLogoutRR := httptest.NewRecorder()
	mux.ServeHTTP(afterLogoutRR, afterLogoutReq)
	if afterLogoutRR.Code != http.StatusUnauthorized {
		t.Fatalf("expected summary after logout to be 401, got %d", afterLogoutRR.Code)
	}
}
