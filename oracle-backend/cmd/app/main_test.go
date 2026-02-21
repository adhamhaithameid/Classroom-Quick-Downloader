package main

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
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

func TestDecodeJSONBodyStrict_AcceptsValidObject(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"password":"secret"}`))
	var payload struct {
		Password string `json:"password"`
	}
	if err := decodeJSONBodyStrict(req, &payload); err != nil {
		t.Fatalf("expected valid JSON payload, got err: %v", err)
	}
	if payload.Password != "secret" {
		t.Fatalf("unexpected password value: %q", payload.Password)
	}
}

func TestDecodeJSONBodyStrict_RejectsUnknownField(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"password":"secret","extra":true}`))
	var payload struct {
		Password string `json:"password"`
	}
	if err := decodeJSONBodyStrict(req, &payload); err == nil {
		t.Fatal("expected unknown field to be rejected")
	}
}

func TestDecodeJSONBodyStrict_RejectsTrailingJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"password":"secret"}{"password":"two"}`))
	var payload struct {
		Password string `json:"password"`
	}
	if err := decodeJSONBodyStrict(req, &payload); err == nil {
		t.Fatal("expected trailing JSON to be rejected")
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

func TestCSRFMiddleware_SkipsPublicWebsiteEndpoints(t *testing.T) {
	handler := csrfHeaderMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/public/website/uninstall", bytes.NewBufferString(`{}`))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for public website endpoint, got %d", rr.Code)
	}
}

func TestCSRFMiddleware_RejectsCrossOriginMutatingAPI(t *testing.T) {
	prevOrigins := csrfAllowedOrigins
	defer func() { csrfAllowedOrigins = prevOrigins }()
	csrfAllowedOrigins = nil

	handler := csrfHeaderMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "http://oracle.local/api/admin/flags/update", bytes.NewBufferString(`{}`))
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Origin", "https://evil.example")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when origin mismatches, got %d", rr.Code)
	}
}

func TestCSRFMiddleware_AllowsMatchingOriginMutatingAPI(t *testing.T) {
	prevOrigins := csrfAllowedOrigins
	defer func() { csrfAllowedOrigins = prevOrigins }()
	csrfAllowedOrigins = nil

	handler := csrfHeaderMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "https://oracle.local/api/admin/flags/update", bytes.NewBufferString(`{}`))
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Origin", "https://oracle.local")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204 when origin matches canonical request origin, got %d", rr.Code)
	}
}

func TestCSRFMiddleware_RejectsSchemeMismatchWithoutTrustedProxyProto(t *testing.T) {
	prevOrigins := csrfAllowedOrigins
	prevProxies := trustedProxyNets
	defer func() {
		csrfAllowedOrigins = prevOrigins
		setTrustedProxyNets(prevProxies)
	}()
	csrfAllowedOrigins = nil
	setTrustedProxyNets(nil)

	handler := csrfHeaderMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "http://oracle.local/api/admin/flags/update", bytes.NewBufferString(`{}`))
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Origin", "https://oracle.local")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when origin scheme mismatches request context, got %d", rr.Code)
	}
}

func TestCSRFMiddleware_AllowsForwardedHTTPSWithoutTrustedProxyCIDRs(t *testing.T) {
	prevOrigins := csrfAllowedOrigins
	prevProxies := trustedProxyNets
	defer func() {
		csrfAllowedOrigins = prevOrigins
		setTrustedProxyNets(prevProxies)
	}()
	csrfAllowedOrigins = nil
	setTrustedProxyNets(nil)

	handler := csrfHeaderMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "http://oracle.local/api/admin/flags/update", bytes.NewBufferString(`{}`))
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("X-Forwarded-Proto", "https")
	req.Header.Set("Origin", "https://oracle.local")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204 when forwarded proto indicates https, got %d", rr.Code)
	}
}

func TestCSRFMiddleware_AllowsConfiguredPublicOrigin(t *testing.T) {
	prevOrigins := csrfAllowedOrigins
	defer func() { csrfAllowedOrigins = prevOrigins }()
	csrfAllowedOrigins = loadCSRFAllowedOrigins("https://dashboard.example.com", "")

	handler := csrfHeaderMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "http://internal-oracle:8080/api/admin/flags/update", bytes.NewBufferString(`{}`))
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Origin", "https://dashboard.example.com")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204 when origin is in configured CSRF allowlist, got %d", rr.Code)
	}
}

func TestNormalizeOriginValue_NormalizesSchemeHostAndDefaultPorts(t *testing.T) {
	cases := []struct {
		raw  string
		want string
	}{
		{raw: " HTTPS://Oracle.Local:443/path ", want: "https://oracle.local"},
		{raw: "http://oracle.local:80", want: "http://oracle.local"},
		{raw: "http://oracle.local:8080", want: "http://oracle.local:8080"},
		{raw: "https://[2001:db8::1]:443", want: "https://[2001:db8::1]"},
	}
	for _, tc := range cases {
		got, err := normalizeOriginValue(tc.raw)
		if err != nil {
			t.Fatalf("normalizeOriginValue(%q) returned unexpected error: %v", tc.raw, err)
		}
		if got != tc.want {
			t.Fatalf("normalizeOriginValue(%q)=%q want=%q", tc.raw, got, tc.want)
		}
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
	if !strings.Contains(csp, "style-src 'self'") {
		t.Fatalf("expected style-src self directive, got: %q", csp)
	}
	if !strings.Contains(csp, "https://fonts.googleapis.com") {
		t.Fatalf("expected style-src to allow Google Fonts stylesheet origin, got: %q", csp)
	}
	if !strings.Contains(csp, "style-src 'self' https://fonts.googleapis.com 'nonce-") {
		t.Fatalf("expected nonce-based style CSP with Google Fonts allowed, got: %q", csp)
	}
	if strings.Contains(csp, "style-src 'self' 'unsafe-inline'") {
		t.Fatalf("expected CSP without unsafe-inline style-src, got: %q", csp)
	}
	if strings.Contains(csp, "style-src-attr 'unsafe-inline'") {
		t.Fatalf("expected CSP without unsafe-inline style-src-attr, got: %q", csp)
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

func TestSecurityHeadersMiddleware_AddsNoStoreForSensitiveAPIs(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d", rr.Code)
	}
	if got := rr.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("expected Cache-Control no-store, got %q", got)
	}
	if got := rr.Header().Get("Pragma"); got != "no-cache" {
		t.Fatalf("expected Pragma no-cache, got %q", got)
	}
}

func TestSecurityHeadersMiddleware_DoesNotForceNoStoreOnStaticPages(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("unexpected status: %d", rr.Code)
	}
	if got := rr.Header().Get("Cache-Control"); got != "" {
		t.Fatalf("expected no Cache-Control override for static pages, got %q", got)
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

func TestGetClientIPTrustedProxyRejectsInvalidForwardedIP(t *testing.T) {
	prev := trustedProxyNets
	defer setTrustedProxyNets(prev)

	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.RemoteAddr = "10.1.2.3:1234"
	req.Header.Set("X-Forwarded-For", "not-an-ip")

	ip := getClientIP(req)
	if ip != "10.1.2.3" {
		t.Fatalf("expected remote IP fallback, got %q", ip)
	}
}

func TestGetClientIPTrustedProxyUsesXRealIPWhenValid(t *testing.T) {
	prev := trustedProxyNets
	defer setTrustedProxyNets(prev)

	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.RemoteAddr = "10.1.2.3:1234"
	req.Header.Set("X-Real-IP", "203.0.113.77")
	req.Header.Set("X-Forwarded-For", "203.0.113.10")

	ip := getClientIP(req)
	if ip != "203.0.113.77" {
		t.Fatalf("expected X-Real-IP to win, got %q", ip)
	}
}

func TestGetClientIPTrustedProxyUsesForwardedHeaderForValue(t *testing.T) {
	prev := trustedProxyNets
	defer setTrustedProxyNets(prev)

	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.RemoteAddr = "10.1.2.3:1234"
	req.Header.Set("Forwarded", `for="203.0.113.88";proto=https`)
	req.Header.Set("X-Real-IP", "203.0.113.77")

	ip := getClientIP(req)
	if ip != "203.0.113.88" {
		t.Fatalf("expected Forwarded for= to win, got %q", ip)
	}
}

func TestGetClientIPTrustedProxyAcceptsForwardedHostPortValue(t *testing.T) {
	prev := trustedProxyNets
	defer setTrustedProxyNets(prev)

	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.RemoteAddr = "10.1.2.3:1234"
	req.Header.Set("Forwarded", `for=203.0.113.10:443;proto=https`)
	req.Header.Set("X-Forwarded-For", "203.0.113.44")

	ip := getClientIP(req)
	if ip != "203.0.113.10" {
		t.Fatalf("expected Forwarded for=host:port to resolve to IP, got %q", ip)
	}
}

func TestGetClientIPTrustedProxyAcceptsForwardedIPv6HostPortValue(t *testing.T) {
	prev := trustedProxyNets
	defer setTrustedProxyNets(prev)

	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.RemoteAddr = "10.1.2.3:1234"
	req.Header.Set("Forwarded", `for="[2001:db8::10]:8443";proto=https`)
	req.Header.Set("X-Forwarded-For", "203.0.113.44")

	ip := getClientIP(req)
	if ip != "2001:db8::10" {
		t.Fatalf("expected Forwarded IPv6 host:port to resolve to IP, got %q", ip)
	}
}

func TestGetClientIPTrustedProxyFallsBackToForwardedWhenXRealInvalid(t *testing.T) {
	prev := trustedProxyNets
	defer setTrustedProxyNets(prev)

	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.RemoteAddr = "10.1.2.3:1234"
	req.Header.Set("X-Real-IP", "not-an-ip")
	req.Header.Set("X-Forwarded-For", "203.0.113.10")

	ip := getClientIP(req)
	if ip != "203.0.113.10" {
		t.Fatalf("expected X-Forwarded-For fallback, got %q", ip)
	}
}

func TestParseForwardedProtoHeaderValue(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		raw  string
		want string
	}{
		{name: "forwarded https", raw: `for=203.0.113.10;proto=https`, want: "https"},
		{name: "forwarded http uppercase", raw: `For=203.0.113.10; Proto=HTTP`, want: "http"},
		{name: "forwarded invalid proto", raw: `for=203.0.113.10;proto=ftp`, want: ""},
		{name: "forwarded missing proto", raw: `for=203.0.113.10`, want: ""},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := parseForwardedProtoHeaderValue(tc.raw); got != tc.want {
				t.Fatalf("parseForwardedProtoHeaderValue(%q)=%q want=%q", tc.raw, got, tc.want)
			}
		})
	}
}

func TestParseXForwardedProtoHeaderValue(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		raw  string
		want string
	}{
		{name: "https", raw: "https", want: "https"},
		{name: "http first in list", raw: "http, https", want: "http"},
		{name: "trim spaces", raw: "   HTTPS   ", want: "https"},
		{name: "invalid value", raw: "ws", want: ""},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := parseXForwardedProtoHeaderValue(tc.raw); got != tc.want {
				t.Fatalf("parseXForwardedProtoHeaderValue(%q)=%q want=%q", tc.raw, got, tc.want)
			}
		})
	}
}

func TestParseTrustedProxyCIDRs_IgnoresInvalidAndParsesIPv4IPv6(t *testing.T) {
	t.Parallel()

	nets := parseTrustedProxyCIDRs("10.0.0.0/8, invalid-entry, 203.0.113.9, 2001:db8::1")
	if len(nets) != 3 {
		t.Fatalf("expected 3 parsed trusted proxy entries, got %d", len(nets))
	}
}

func TestNormalizeSessionCookieSecureMode(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{in: "true", want: "true"},
		{in: "YES", want: "true"},
		{in: "always", want: "true"},
		{in: "false", want: "false"},
		{in: "0", want: "false"},
		{in: "never", want: "false"},
		{in: "", want: "auto"},
		{in: "unexpected", want: "auto"},
	}
	for _, tc := range cases {
		got := normalizeSessionCookieSecureMode(tc.in)
		if got != tc.want {
			t.Fatalf("normalizeSessionCookieSecureMode(%q)=%q want=%q", tc.in, got, tc.want)
		}
	}
}

func TestCookieSecurityPolicy_RespectsModeOverride(t *testing.T) {
	prev := sessionCookieSecureMode
	defer func() { sessionCookieSecureMode = prev }()

	req := httptest.NewRequest(http.MethodGet, "http://example.com", nil)

	sessionCookieSecureMode = "true"
	secure, sameSite := cookieSecurityPolicy(req)
	if !secure || sameSite != http.SameSiteStrictMode {
		t.Fatalf("expected forced secure strict cookie policy, got secure=%v sameSite=%v", secure, sameSite)
	}

	sessionCookieSecureMode = "false"
	secure, sameSite = cookieSecurityPolicy(req)
	if secure || sameSite != http.SameSiteLaxMode {
		t.Fatalf("expected forced insecure lax cookie policy, got secure=%v sameSite=%v", secure, sameSite)
	}
}

func TestCookieSecurityPolicy_UsesTrustedForwardedProto(t *testing.T) {
	prevMode := sessionCookieSecureMode
	prevProxy := trustedProxyNets
	defer func() {
		sessionCookieSecureMode = prevMode
		setTrustedProxyNets(prevProxy)
	}()

	sessionCookieSecureMode = "auto"
	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest(http.MethodGet, "http://example.com", nil)
	req.RemoteAddr = "10.1.2.3:1234"
	req.Header.Set("X-Forwarded-Proto", "https")

	secure, sameSite := cookieSecurityPolicy(req)
	if !secure || sameSite != http.SameSiteStrictMode {
		t.Fatalf("expected secure strict policy behind trusted https proxy, got secure=%v sameSite=%v", secure, sameSite)
	}
}

func TestCookieSecurityPolicy_IgnoresUntrustedForwardedProto(t *testing.T) {
	prevMode := sessionCookieSecureMode
	prevProxy := trustedProxyNets
	defer func() {
		sessionCookieSecureMode = prevMode
		setTrustedProxyNets(prevProxy)
	}()

	sessionCookieSecureMode = "auto"
	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest(http.MethodGet, "http://example.com", nil)
	req.RemoteAddr = "192.168.1.7:4321"
	req.Header.Set("X-Forwarded-Proto", "https")

	secure, sameSite := cookieSecurityPolicy(req)
	if secure || sameSite != http.SameSiteLaxMode {
		t.Fatalf("expected untrusted forwarded proto to be ignored, got secure=%v sameSite=%v", secure, sameSite)
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

func TestLoggingMiddleware_SkipsHealthPath(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "oracle-skip-health.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	handler := observability.RequestContextMiddleware(
		loggingMiddleware(sqlDB, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		})),
	)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
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
		t.Fatalf("expected zero oracle operation log rows for /health, got %d", count)
	}
}

func TestLoggingMiddleware_SkipsMetricsPath(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "oracle-skip-metrics.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	handler := observability.RequestContextMiddleware(
		loggingMiddleware(sqlDB, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		})),
	)
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
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
		t.Fatalf("expected zero oracle operation log rows for /metrics, got %d", count)
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
		{path: "/health", want: false},
		{path: "/metrics", want: false},
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

func TestIsWeakSecretValue(t *testing.T) {
	tests := []struct {
		name   string
		secret string
		want   bool
	}{
		{name: "empty", secret: "", want: false},
		{name: "strong secret", secret: "not-weak-secret-example", want: false},
		{name: "trimmed weak value", secret: "  secret  ", want: true},
		{name: "case-insensitive weak value", secret: "Change-Me-In-Production", want: true},
		{name: "password weak value", secret: "password", want: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := isWeakSecretValue(tc.secret); got != tc.want {
				t.Fatalf("isWeakSecretValue(%q)=%v want %v", tc.secret, got, tc.want)
			}
		})
	}
}

func TestValidateAuditCheckpointSecret(t *testing.T) {
	tests := []struct {
		name    string
		secret  string
		wantErr bool
	}{
		{name: "missing secret", secret: "", wantErr: true},
		{name: "weak secret", secret: "secret", wantErr: true},
		{name: "valid secret", secret: "audit-anchor-secret-123", wantErr: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateAuditCheckpointSecret(tc.secret)
			if (err != nil) != tc.wantErr {
				t.Fatalf("validateAuditCheckpointSecret(%q) error=%v wantErr=%v", tc.secret, err, tc.wantErr)
			}
		})
	}
}

func TestValidateProductionSecurityConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name                        string
		appEnv                      string
		allowLoopbackBypass         bool
		allowEmptyDashboardPassword bool
		allowHTTPStoreURLs          bool
		allowUntrustedStoreURLs     bool
		trustedProxyCIDRs           string
		wantErrContains             string
	}{
		{
			name:                        "non-production allows dev flags",
			appEnv:                      "development",
			allowLoopbackBypass:         true,
			allowEmptyDashboardPassword: true,
			allowHTTPStoreURLs:          true,
			allowUntrustedStoreURLs:     true,
			trustedProxyCIDRs:           "0.0.0.0/0,::/0",
		},
		{
			name:                "prod rejects loopback bypass",
			appEnv:              "production",
			allowLoopbackBypass: true,
			wantErrContains:     "ALLOW_LOOPBACK_BYPASS",
		},
		{
			name:                        "prod rejects empty dashboard password",
			appEnv:                      "production",
			allowEmptyDashboardPassword: true,
			wantErrContains:             "ALLOW_EMPTY_DASHBOARD_PASSWORD",
		},
		{
			name:               "prod rejects http store urls",
			appEnv:             "production",
			allowHTTPStoreURLs: true,
			wantErrContains:    "ORACLE_ALLOW_HTTP_STORE_URLS",
		},
		{
			name:                    "prod rejects untrusted store urls",
			appEnv:                  "production",
			allowUntrustedStoreURLs: true,
			wantErrContains:         "ORACLE_ALLOW_UNTRUSTED_STORE_URLS",
		},
		{
			name:              "prod rejects ipv4 wildcard trusted proxy",
			appEnv:            "production",
			trustedProxyCIDRs: "0.0.0.0/0",
			wantErrContains:   "TRUSTED_PROXY_CIDRS",
		},
		{
			name:              "prod rejects ipv6 wildcard trusted proxy",
			appEnv:            "production",
			trustedProxyCIDRs: "::/0",
			wantErrContains:   "TRUSTED_PROXY_CIDRS",
		},
		{
			name:              "prod accepts strict trusted proxy cidrs",
			appEnv:            "  PROD  ",
			trustedProxyCIDRs: "10.0.0.0/8,2001:db8::/32",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := validateProductionSecurityConfig(
				tc.appEnv,
				tc.allowLoopbackBypass,
				tc.allowEmptyDashboardPassword,
				tc.allowHTTPStoreURLs,
				tc.allowUntrustedStoreURLs,
				parseTrustedProxyCIDRs(tc.trustedProxyCIDRs),
			)
			if tc.wantErrContains == "" {
				if err != nil {
					t.Fatalf("expected no error, got %v", err)
				}
				return
			}

			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tc.wantErrContains)
			}
			if !strings.Contains(err.Error(), tc.wantErrContains) {
				t.Fatalf("expected error containing %q, got %q", tc.wantErrContains, err.Error())
			}
		})
	}
}

func TestUpsertSystemAlert_ConcurrentSingleOpenRow(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "oracle-alert-upsert.db"))
	if err != nil {
		t.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	const workers = 20
	errCh := make(chan error, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		i := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			errCh <- upsertSystemAlert(
				context.Background(),
				sqlDB,
				"no_sync_success",
				"warning",
				"concurrency check",
				map[string]any{"worker": i},
			)
		}()
	}
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("concurrent upsert failed: %v", err)
		}
	}

	var openRows int64
	if err := sqlDB.QueryRow(
		`SELECT COUNT(*) FROM system_alerts WHERE alert_type = ? AND status = 'open'`,
		"no_sync_success",
	).Scan(&openRows); err != nil {
		t.Fatalf("count open alerts failed: %v", err)
	}
	if openRows != 1 {
		t.Fatalf("expected exactly one open alert row, got %d", openRows)
	}
}
