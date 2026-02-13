package main

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

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

func TestDefaultMaxHeaderBytes_IsSetTo1MiB(t *testing.T) {
	if defaultMaxHeaderBytes != 1<<20 {
		t.Fatalf("expected defaultMaxHeaderBytes to be 1MiB, got %d", defaultMaxHeaderBytes)
	}
}

func TestRequestBodyLimitMiddleware_AdminRejectsOversizedBody(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			if strings.Contains(err.Error(), "http: request body too large") {
				http.Error(w, "request too large", http.StatusRequestEntityTooLarge)
				return
			}
			http.Error(w, "read failed", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	handler := requestBodyLimitMiddleware(inner)

	body := bytes.Repeat([]byte("a"), adminRequestBodyLimit+1)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 for oversized admin body, got %d", rr.Code)
	}
}

func TestRequestBodyLimitMiddleware_AuthRejectsOversizedBody(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			if strings.Contains(err.Error(), "http: request body too large") {
				http.Error(w, "request too large", http.StatusRequestEntityTooLarge)
				return
			}
			http.Error(w, "read failed", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	handler := requestBodyLimitMiddleware(inner)

	body := bytes.Repeat([]byte("a"), authRequestBodyLimit+1)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 for oversized auth body, got %d", rr.Code)
	}
}

func TestCSRFMiddleware_RejectsMissingHeaderOnMutatingAPI(t *testing.T) {
	handler := csrfHeaderMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", bytes.NewBufferString(`{}`))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when csrf header missing, got %d", rr.Code)
	}
}

func TestCSRFMiddleware_AllowsMutatingAPIWithHeader(t *testing.T) {
	handler := csrfHeaderMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", bytes.NewBufferString(`{}`))
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204 when csrf header present, got %d", rr.Code)
	}
}

func TestCSRFMiddleware_RejectsCrossOriginMutatingAPI(t *testing.T) {
	handler := csrfHeaderMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "http://oracle.local/api/admin/flags/update", bytes.NewBufferString(`{}`))
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Origin", "https://evil.example")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when origin mismatches host, got %d", rr.Code)
	}
}

func TestCSRFMiddleware_AllowsMatchingOriginMutatingAPI(t *testing.T) {
	handler := csrfHeaderMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "http://oracle.local/api/admin/flags/update", bytes.NewBufferString(`{}`))
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Origin", "https://oracle.local")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204 when origin matches host, got %d", rr.Code)
	}
}

func TestCleanupExpiredInMemoryStores_RemovesExpiredEntries(t *testing.T) {
	now := time.Now()
	sessionStore.Lock()
	sessionStore.tokens = map[string]time.Time{
		"expired-session": now.Add(-time.Minute),
		"valid-session":   now.Add(time.Hour),
	}
	sessionStore.Unlock()

	stepUpSessionStore.Lock()
	stepUpSessionStore.tokens = map[string]stepUpSession{
		"expired-stepup": {expiresAt: now.Add(-time.Minute)},
		"valid-stepup":   {expiresAt: now.Add(time.Hour)},
	}
	stepUpSessionStore.Unlock()

	stepUpChallengeStore.Lock()
	stepUpChallengeStore.items = map[string]stepUpChallenge{
		"expired-challenge": {expiresAt: now.Add(-time.Minute)},
		"valid-challenge":   {expiresAt: now.Add(time.Hour)},
	}
	stepUpChallengeStore.Unlock()

	loginRateStore.Lock()
	loginRateStore.attempts = map[string]*loginAttempt{
		"expired-login-ip": {firstAttemptAt: now.Add(-(loginLockout + inMemoryCleanupHorizon + time.Minute))},
		"valid-login-ip":   {firstAttemptAt: now.Add(-time.Minute)},
	}
	loginRateStore.Unlock()

	stepUpRateStore.Lock()
	stepUpRateStore.attempts = map[string]*stepUpAttempt{
		"expired-stepup-ip": {firstAttemptAt: now.Add(-(stepUpLockout + inMemoryCleanupHorizon + time.Minute))},
		"valid-stepup-ip":   {firstAttemptAt: now.Add(-time.Minute)},
	}
	stepUpRateStore.Unlock()

	cleanupExpiredInMemoryStores(now)

	sessionStore.RLock()
	if _, ok := sessionStore.tokens["expired-session"]; ok {
		t.Fatalf("expected expired viewer session to be removed")
	}
	if _, ok := sessionStore.tokens["valid-session"]; !ok {
		t.Fatalf("expected valid viewer session to remain")
	}
	sessionStore.RUnlock()

	stepUpSessionStore.RLock()
	if _, ok := stepUpSessionStore.tokens["expired-stepup"]; ok {
		t.Fatalf("expected expired step-up session to be removed")
	}
	if _, ok := stepUpSessionStore.tokens["valid-stepup"]; !ok {
		t.Fatalf("expected valid step-up session to remain")
	}
	stepUpSessionStore.RUnlock()

	stepUpChallengeStore.Lock()
	if _, ok := stepUpChallengeStore.items["expired-challenge"]; ok {
		t.Fatalf("expected expired step-up challenge to be removed")
	}
	if _, ok := stepUpChallengeStore.items["valid-challenge"]; !ok {
		t.Fatalf("expected valid step-up challenge to remain")
	}
	stepUpChallengeStore.Unlock()

	loginRateStore.Lock()
	if _, ok := loginRateStore.attempts["expired-login-ip"]; ok {
		t.Fatalf("expected expired login rate entry to be removed")
	}
	if _, ok := loginRateStore.attempts["valid-login-ip"]; !ok {
		t.Fatalf("expected valid login rate entry to remain")
	}
	loginRateStore.Unlock()

	stepUpRateStore.Lock()
	if _, ok := stepUpRateStore.attempts["expired-stepup-ip"]; ok {
		t.Fatalf("expected expired step-up rate entry to be removed")
	}
	if _, ok := stepUpRateStore.attempts["valid-stepup-ip"]; !ok {
		t.Fatalf("expected valid step-up rate entry to remain")
	}
	stepUpRateStore.Unlock()
}

func TestSecurityHeadersMiddleware_UsesScriptNonceWithoutUnsafeInline(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if cspNonceFromContext(r.Context()) == "" {
			t.Fatalf("expected CSP nonce in request context")
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d", rr.Code)
	}
	csp := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "script-src 'self' 'nonce-") {
		t.Fatalf("expected nonce-based script CSP, got: %q", csp)
	}
	if strings.Contains(csp, "script-src-attr 'unsafe-inline'") || strings.Contains(csp, "script-src 'self' 'unsafe-inline'") {
		t.Fatalf("expected CSP without unsafe-inline script permissions, got: %q", csp)
	}
}

func TestIsValidSession_UsesPersistedAuthSessionWhenMemoryIsEmpty(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "persisted-session.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	sessionStore.Lock()
	sessionStore.tokens = make(map[string]time.Time)
	sessionStore.Unlock()

	token := "persisted-viewer-token"
	expiresAt := time.Now().Add(2 * time.Hour)
	nowUnix := time.Now().Unix()
	if _, err := sqlDB.Exec(
		`INSERT INTO auth_sessions (token, session_kind, parent_token, expires_at, created_at, updated_at)
		 VALUES (?, ?, '', ?, ?, ?)`,
		token,
		authSessionKindViewer,
		expiresAt.Unix(),
		nowUnix,
		nowUnix,
	); err != nil {
		t.Fatalf("insert persisted session failed: %v", err)
	}

	if !isValidSession(token) {
		t.Fatalf("expected persisted session to validate")
	}

	sessionStore.RLock()
	_, ok := sessionStore.tokens[token]
	sessionStore.RUnlock()
	if !ok {
		t.Fatalf("expected persisted session to hydrate in-memory cache")
	}
}

func TestConsumeStepUpChallenge_UsesPersistedAuthChallenge(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "persisted-challenge.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	stepUpChallengeStore.Lock()
	stepUpChallengeStore.items = make(map[string]stepUpChallenge)
	stepUpChallengeStore.Unlock()

	challengeID := "persisted-challenge-token"
	clientIP := "203.0.113.44"
	expiresAt := time.Now().Add(3 * time.Minute)
	nowUnix := time.Now().Unix()
	if _, err := sqlDB.Exec(
		`INSERT INTO auth_stepup_challenges (challenge_id, client_ip, expires_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)`,
		challengeID,
		clientIP,
		expiresAt.Unix(),
		nowUnix,
		nowUnix,
	); err != nil {
		t.Fatalf("insert persisted challenge failed: %v", err)
	}

	if !consumeStepUpChallenge(challengeID, clientIP) {
		t.Fatalf("expected persisted challenge to be consumed")
	}
	if consumeStepUpChallenge(challengeID, clientIP) {
		t.Fatalf("expected challenge to be one-time use")
	}
}

func TestMetricsRoute_RequiresAuthMiddleware(t *testing.T) {
	mux := http.NewServeMux()
	authMW := requireAuth(nil, "secret", "", false)
	mux.Handle("/metrics", authMW(metricsHandler(appMetrics, nil)))

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated metrics request, got %d", rr.Code)
	}
}

func TestMetricsHandler_IncludesSchemaDriftMetricFromSQLite(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "metrics-schema.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	now := time.Now().UnixMilli()
	if _, err := sqlDB.Exec(
		`INSERT INTO cf_schema_registry (json_path, first_seen_at, last_seen_at, sample_type, is_projected)
		 VALUES (?, ?, ?, ?, 0)`,
		"root.field",
		now,
		now,
		"string",
	); err != nil {
		t.Fatalf("seed schema registry failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rr := httptest.NewRecorder()
	metricsHandler(observability.NewRegistry(), sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "oracle_schema_drift_paths_total 1") {
		t.Fatalf("expected schema drift metric in output, got: %s", rr.Body.String())
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

func TestLoggingMiddleware_CapturesActorFromAuthMiddleware(t *testing.T) {
	resetSessionStore()
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "oracle-auth-log.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	const rawToken = "test-session-token"
	sessionStore.Lock()
	sessionStore.tokens[rawToken] = time.Now().Add(sessionDuration)
	sessionStore.Unlock()

	protected := requireAuth(nil, "secret", "", false)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	handler := loggingMiddleware(sqlDB, observability.RequestContextMiddleware(protected))

	req := httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: rawToken})
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("unexpected status code: %d", rr.Code)
	}

	var userID, tokenID, role string
	if err := sqlDB.QueryRow(
		`SELECT user_id, token_id, role
		 FROM oracle_operation_logs
		 WHERE path = '/api/admin/flags/update'
		 ORDER BY id DESC
		 LIMIT 1`,
	).Scan(&userID, &tokenID, &role); err != nil {
		t.Fatalf("query oracle operation logs failed: %v", err)
	}
	if userID != "viewer" {
		t.Fatalf("expected user_id=viewer, got %q", userID)
	}
	if role != "viewer" {
		t.Fatalf("expected role=viewer, got %q", role)
	}
	if tokenID == "" || tokenID == "none" {
		t.Fatalf("expected non-empty token_id, got %q", tokenID)
	}
}
