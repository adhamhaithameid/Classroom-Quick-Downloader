package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/handlers"
	model "oracle-backend/internal/model"
)

func resetSessionStore() {
	sessionStore.Lock()
	sessionStore.tokens = make(map[string]time.Time)
	sessionStore.Unlock()
}

func resetLoginRateStore() {
	loginRateStore.Lock()
	loginRateStore.attempts = make(map[string]*loginAttempt)
	loginRateStore.Unlock()
}

func TestSpaHandler_AllowsStaticFilesAndBlocksTraversal(t *testing.T) {
	dir := t.TempDir()
	indexPath := filepath.Join(dir, "index.html")
	assetPath := filepath.Join(dir, "asset.txt")
	if err := os.WriteFile(indexPath, []byte("index"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(assetPath, []byte("asset"), 0o644); err != nil {
		t.Fatal(err)
	}

	h := spaHandler(dir)

	req := httptest.NewRequest(http.MethodGet, "/asset.txt", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for asset, got %d", rr.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/../secret.txt", nil)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden && rr.Code != http.StatusBadRequest {
		t.Fatalf("expected traversal to be blocked, got %d", rr.Code)
	}
}

func TestSpaHandler_ReplacesCSPNoncePlaceholderInIndex(t *testing.T) {
	dir := t.TempDir()
	indexPath := filepath.Join(dir, "index.html")
	if err := os.WriteFile(indexPath, []byte(`<html><body><script nonce="__CSP_NONCE__">console.log("ok")</script></body></html>`), 0o644); err != nil {
		t.Fatal(err)
	}

	h := securityHeadersMiddleware(spaHandler(dir))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for index, got %d", rr.Code)
	}
	body := rr.Body.String()
	if strings.Contains(body, "__CSP_NONCE__") {
		t.Fatalf("expected CSP nonce placeholder to be replaced")
	}
	csp := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "nonce-") {
		t.Fatalf("expected nonce in CSP header, got %q", csp)
	}
}

func TestResolveArchiverPath_Validation(t *testing.T) {
	tmp := t.TempDir()
	execPath := filepath.Join(tmp, "archiver")
	if err := os.WriteFile(execPath, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatalf("failed to write exec file: %v", err)
	}

	resolved, err := resolveArchiverPath(execPath)
	if err != nil {
		t.Fatalf("expected executable file to resolve, got error: %v", err)
	}
	expected, err := filepath.Abs(execPath)
	if err != nil {
		t.Fatalf("filepath.Abs failed: %v", err)
	}
	if resolved != expected {
		t.Fatalf("unexpected resolved path: got %s want %s", resolved, expected)
	}

	if _, err := resolveArchiverPath(""); err == nil {
		t.Fatalf("expected empty path to fail")
	}
	if _, err := resolveArchiverPath(tmp); err == nil {
		t.Fatalf("expected directory path to fail")
	}

	nonExecPath := filepath.Join(tmp, "archiver.txt")
	if err := os.WriteFile(nonExecPath, []byte("plain"), 0o644); err != nil {
		t.Fatalf("failed to write non-exec file: %v", err)
	}
	if _, err := resolveArchiverPath(nonExecPath); err == nil {
		t.Fatalf("expected non-executable file to fail")
	}
}

func TestAuthMiddleware_EnforcesSessionWhenEnabled(t *testing.T) {
	resetSessionStore()
	protected := requireAuth("secret", "", false)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	rr := httptest.NewRecorder()
	protected.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without session, got %d", rr.Code)
	}
}

func TestAuthMiddleware_AllowsArchiverSecret(t *testing.T) {
	resetSessionStore()
	protected := requireAuth("secret", "arch-secret", false)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	req.Header.Set("X-Archiver-Secret", "arch-secret")
	rr := httptest.NewRecorder()
	protected.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 with archiver secret, got %d", rr.Code)
	}
}

func TestPipelineEndpoints_RequireAuth(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "pipeline-auth.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	metrics := requireAuth("secret", "arch-secret", false)(handlers.PipelineMetricsHandler(sqlDB))
	failures := requireAuth("secret", "arch-secret", false)(handlers.PipelineFailuresHandler(sqlDB))

	req := httptest.NewRequest(http.MethodGet, "/api/pipeline/metrics", nil)
	rr := httptest.NewRecorder()
	metrics.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for metrics without auth, got %d", rr.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/pipeline/failures", nil)
	rr = httptest.NewRecorder()
	failures.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for failures without auth, got %d", rr.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/pipeline/metrics", nil)
	req.Header.Set("X-Archiver-Secret", "arch-secret")
	rr = httptest.NewRecorder()
	metrics.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for metrics with archiver secret, got %d", rr.Code)
	}
}

func TestLoginHandler_SetsSecureCookieOnSuccess(t *testing.T) {
	resetSessionStore()
	resetLoginRateStore()
	h := loginHandler("secret", false)

	body := bytes.NewBufferString(`{"password":"secret"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	req.TLS = &tls.ConnectionState{}
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	cookies := rr.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie to be set")
	}
	found := false
	for _, c := range cookies {
		if c.Name == sessionCookieName {
			found = true
			if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteStrictMode {
				t.Fatalf("expected secure HttpOnly Strict cookie, got: %+v", c)
			}
		}
	}
	if !found {
		t.Fatalf("expected cookie named %s", sessionCookieName)
	}
}

func TestLoginHandler_AllowsInsecureCookieOnHttpWhenAllowed(t *testing.T) {
	resetSessionStore()
	resetLoginRateStore()
	h := loginHandler("secret", true)

	body := bytes.NewBufferString(`{"password":"secret"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	cookies := rr.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie to be set")
	}
	for _, c := range cookies {
		if c.Name == sessionCookieName {
			if c.Secure {
				t.Fatalf("expected insecure cookie for HTTP when allowed, got: %+v", c)
			}
			if c.SameSite != http.SameSiteLaxMode {
				t.Fatalf("expected SameSite=Lax, got: %+v", c)
			}
		}
	}
}

func TestLoginHandler_HTTPCookieRemainsUsableWhenInsecureDisabled(t *testing.T) {
	resetSessionStore()
	resetLoginRateStore()
	h := loginHandler("secret", false)

	body := bytes.NewBufferString(`{"password":"secret"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var found bool
	for _, c := range rr.Result().Cookies() {
		if c.Name != sessionCookieName {
			continue
		}
		found = true
		if c.Secure {
			t.Fatalf("expected insecure cookie for HTTP deployments, got: %+v", c)
		}
		if c.SameSite != http.SameSiteLaxMode {
			t.Fatalf("expected SameSite=Lax, got: %+v", c)
		}
	}
	if !found {
		t.Fatalf("expected cookie named %s", sessionCookieName)
	}
}

func TestHashPassword_UsesBcrypt(t *testing.T) {
	hashA, err := hashPassword("super-secret")
	if err != nil {
		t.Fatalf("hashPassword failed: %v", err)
	}
	hashB, err := hashPassword("super-secret")
	if err != nil {
		t.Fatalf("hashPassword failed: %v", err)
	}
	if hashA == hashB {
		t.Fatalf("expected salted hashes to differ")
	}
	if !verifyPasswordHash(hashA, "super-secret") {
		t.Fatalf("expected verifyPasswordHash to accept valid password")
	}
	if verifyPasswordHash(hashA, "wrong-password") {
		t.Fatalf("expected verifyPasswordHash to reject invalid password")
	}
}

func TestAuthCheckHandler_ReflectsSessionState(t *testing.T) {
	resetSessionStore()
	resetLoginRateStore()
	login := loginHandler("secret", false)
	body := bytes.NewBufferString(`{"password":"secret"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	loginReq.TLS = &tls.ConnectionState{}
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	login.ServeHTTP(loginRR, loginReq)
	if loginRR.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d", loginRR.Code)
	}

	var sessionCookie *http.Cookie
	for _, c := range loginRR.Result().Cookies() {
		if c.Name == sessionCookieName {
			sessionCookie = c
		}
	}
	if sessionCookie == nil {
		t.Fatal("missing session cookie")
	}

	check := authCheckHandler("secret")
	checkReq := httptest.NewRequest(http.MethodGet, "/api/auth/check", nil)
	checkReq.AddCookie(sessionCookie)
	checkRR := httptest.NewRecorder()
	check.ServeHTTP(checkRR, checkReq)
	if checkRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", checkRR.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(checkRR.Body.Bytes(), &payload); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if authenticated, _ := payload["authenticated"].(bool); !authenticated {
		t.Fatalf("expected authenticated=true, got %v", payload["authenticated"])
	}
}

func TestIngestBatchHandler_RejectsInvalidSecret(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	handler := handlers.IngestBatchHandler(sqlDB, "secret")
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", bytes.NewBufferString(`{}`))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func TestLoginHandler_RateLimitsAfterFailures(t *testing.T) {
	resetSessionStore()
	resetLoginRateStore()
	h := loginHandler("secret", false)

	for i := 0; i < loginMaxAttempts; i++ {
		body := bytes.NewBufferString(`{"password":"wrong"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
		req.RemoteAddr = "1.2.3.4:1234"
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
	}

	body := bytes.NewBufferString(`{"password":"wrong"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", body)
	req.RemoteAddr = "1.2.3.4:1234"
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after too many attempts, got %d", rr.Code)
	}
}

func TestIngestBatchHandler_AcceptsValidBatch(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	handler := handlers.IngestBatchHandler(sqlDB, "secret")
	batch := model.OracleBatch{
		BatchID:     "batch-1",
		GeneratedAt: time.Now().UnixMilli(),
		TimeZone:    "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{},
		},
		TimeBuckets: []model.TimeBucket{
			{
				BucketStart: "2026-01-01T00:00:00Z",
				BucketEnd:   "2026-01-01T01:00:00Z",
				Totals: model.BucketTotals{
					TotalEvents:    1,
					TotalDownloads: 1,
					TotalSuccess:   1,
					TotalFail:      0,
				},
				Counters: model.BucketCounters{
					ByStatus:    map[string]int64{"success": 1},
					ByType:      map[string]int64{"pdf": 1},
					ByBrowser:   map[string]int64{"chrome": 1},
					ByOs:        map[string]int64{"mac": 1},
					ByExtVer:    map[string]int64{"1.0.0": 1},
					ByLanguage:  map[string]int64{"en": 1},
					ByCountry:   map[string]int64{"us": 1},
					ByErrorType: map[string]int64{},
				},
			},
		},
		DOState: model.DOState{OK: true},
	}
	body, _ := json.Marshal(batch)
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if ok, _ := payload["ok"].(bool); !ok {
		t.Fatalf("expected ok=true, got %v", payload["ok"])
	}
	if batchID, _ := payload["batchId"].(string); batchID != "batch-1" {
		t.Fatalf("expected batchId=batch-1, got %v", payload["batchId"])
	}
	if ingestedAt, ok := payload["ingestedAt"].(float64); !ok || ingestedAt <= 0 {
		t.Fatalf("expected ingestedAt > 0, got %v", payload["ingestedAt"])
	}
}

func TestCriticalStepUpFlow_EnforcedWhenFlagEnabled(t *testing.T) {
	resetSessionStore()
	resetLoginRateStore()
	stepUpSessionStore.Lock()
	stepUpSessionStore.tokens = make(map[string]stepUpSession)
	stepUpSessionStore.Unlock()
	stepUpChallengeStore.Lock()
	stepUpChallengeStore.items = make(map[string]stepUpChallenge)
	stepUpChallengeStore.Unlock()

	dbPath := filepath.Join(t.TempDir(), "stepup.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_stepup_enforced'`); err != nil {
		t.Fatalf("failed to enable stepup flag: %v", err)
	}

	login := loginHandler("viewer-secret", false)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"password":"viewer-secret"}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	login.ServeHTTP(loginRR, loginReq)
	if loginRR.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", loginRR.Code, loginRR.Body.String())
	}
	var sessionCookie *http.Cookie
	for _, c := range loginRR.Result().Cookies() {
		if c.Name == sessionCookieName {
			sessionCookie = c
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected viewer session cookie")
	}

	authMW := requireAuth("viewer-secret", "", false)
	protected := authMW(requireStepUp(sqlDB, "super-secret")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))

	protectedReq := httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", nil)
	protectedReq.AddCookie(sessionCookie)
	protectedRR := httptest.NewRecorder()
	protected.ServeHTTP(protectedRR, protectedReq)
	if protectedRR.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden without stepup, got %d", protectedRR.Code)
	}

	start := authMW(stepUpStartHandler(sqlDB))
	startReq := httptest.NewRequest(http.MethodPost, "/api/auth/stepup/start", nil)
	startReq.AddCookie(sessionCookie)
	startRR := httptest.NewRecorder()
	start.ServeHTTP(startRR, startReq)
	if startRR.Code != http.StatusOK {
		t.Fatalf("stepup start failed: %d %s", startRR.Code, startRR.Body.String())
	}
	var startPayload map[string]any
	if err := json.Unmarshal(startRR.Body.Bytes(), &startPayload); err != nil {
		t.Fatalf("invalid start payload: %v", err)
	}
	challengeID, _ := startPayload["challengeId"].(string)
	if challengeID == "" {
		t.Fatalf("missing challengeId: %v", startPayload)
	}

	verify := authMW(stepUpVerifyHandler(sqlDB, "super-secret", false))
	verifyReq := httptest.NewRequest(
		http.MethodPost,
		"/api/auth/stepup/verify",
		bytes.NewBufferString(`{"challengeId":"`+challengeID+`","password":"super-secret"}`),
	)
	verifyReq.Header.Set("Content-Type", "application/json")
	verifyReq.AddCookie(sessionCookie)
	verifyRR := httptest.NewRecorder()
	verify.ServeHTTP(verifyRR, verifyReq)
	if verifyRR.Code != http.StatusOK {
		t.Fatalf("stepup verify failed: %d %s", verifyRR.Code, verifyRR.Body.String())
	}

	var stepUpCookie *http.Cookie
	for _, c := range verifyRR.Result().Cookies() {
		if c.Name == stepUpSessionCookieName {
			stepUpCookie = c
		}
	}
	if stepUpCookie == nil {
		t.Fatal("expected stepup session cookie")
	}

	protectedReq = httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", nil)
	protectedReq.AddCookie(sessionCookie)
	protectedReq.AddCookie(stepUpCookie)
	protectedRR = httptest.NewRecorder()
	protected.ServeHTTP(protectedRR, protectedReq)
	if protectedRR.Code != http.StatusOK {
		t.Fatalf("expected success with stepup, got %d", protectedRR.Code)
	}
}

func TestStepUpVerify_RateLimitsFailures(t *testing.T) {
	resetSessionStore()
	resetLoginRateStore()
	stepUpRateStore.Lock()
	stepUpRateStore.attempts = make(map[string]*stepUpAttempt)
	stepUpRateStore.Unlock()
	stepUpChallengeStore.Lock()
	stepUpChallengeStore.items = make(map[string]stepUpChallenge)
	stepUpChallengeStore.Unlock()

	dbPath := filepath.Join(t.TempDir(), "stepup-rate.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_stepup_enforced'`); err != nil {
		t.Fatalf("failed to enable stepup flag: %v", err)
	}

	login := loginHandler("viewer-secret", false)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"password":"viewer-secret"}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRR := httptest.NewRecorder()
	login.ServeHTTP(loginRR, loginReq)
	if loginRR.Code != http.StatusOK {
		t.Fatalf("login failed: %d", loginRR.Code)
	}
	var sessionCookie *http.Cookie
	for _, c := range loginRR.Result().Cookies() {
		if c.Name == sessionCookieName {
			sessionCookie = c
		}
	}
	if sessionCookie == nil {
		t.Fatal("missing session cookie")
	}

	authMW := requireAuth("viewer-secret", "", false)
	start := authMW(stepUpStartHandler(sqlDB))
	verify := authMW(stepUpVerifyHandler(sqlDB, "super-secret", false))

	for i := 0; i < stepUpMaxAttempts+1; i++ {
		startReq := httptest.NewRequest(http.MethodPost, "/api/auth/stepup/start", nil)
		startReq.AddCookie(sessionCookie)
		startReq.RemoteAddr = "203.0.113.1:1234"
		startRR := httptest.NewRecorder()
		start.ServeHTTP(startRR, startReq)
		if startRR.Code != http.StatusOK {
			t.Fatalf("stepup start failed at %d: %d", i, startRR.Code)
		}
		var startPayload map[string]any
		if err := json.Unmarshal(startRR.Body.Bytes(), &startPayload); err != nil {
			t.Fatalf("invalid start payload: %v", err)
		}
		challengeID, _ := startPayload["challengeId"].(string)
		verifyReq := httptest.NewRequest(
			http.MethodPost,
			"/api/auth/stepup/verify",
			bytes.NewBufferString(`{"challengeId":"`+challengeID+`","password":"wrong"}`),
		)
		verifyReq.RemoteAddr = "203.0.113.1:1234"
		verifyReq.Header.Set("Content-Type", "application/json")
		verifyReq.AddCookie(sessionCookie)
		verifyRR := httptest.NewRecorder()
		verify.ServeHTTP(verifyRR, verifyReq)
		if i >= stepUpMaxAttempts-1 && verifyRR.Code == http.StatusTooManyRequests {
			return
		}
	}

	t.Fatalf("expected stepup verify to eventually return 429")
}

func TestCriticalStepUpFlow_BindsStepUpToParentSession(t *testing.T) {
	resetSessionStore()
	resetLoginRateStore()
	stepUpSessionStore.Lock()
	stepUpSessionStore.tokens = make(map[string]stepUpSession)
	stepUpSessionStore.Unlock()
	stepUpChallengeStore.Lock()
	stepUpChallengeStore.items = make(map[string]stepUpChallenge)
	stepUpChallengeStore.Unlock()

	dbPath := filepath.Join(t.TempDir(), "stepup-bind.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 1 WHERE name = 'feature_stepup_enforced'`); err != nil {
		t.Fatalf("failed to enable stepup flag: %v", err)
	}

	login := loginHandler("viewer-secret", false)
	loginAndGetSession := func(remote string) *http.Cookie {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"password":"viewer-secret"}`))
		req.RemoteAddr = remote
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		login.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("login failed: %d %s", rr.Code, rr.Body.String())
		}
		for _, c := range rr.Result().Cookies() {
			if c.Name == sessionCookieName {
				return c
			}
		}
		t.Fatalf("session cookie not found")
		return nil
	}

	sessionA := loginAndGetSession("203.0.113.10:1111")
	sessionB := loginAndGetSession("203.0.113.11:2222")

	authMW := requireAuth("viewer-secret", "", false)
	start := authMW(stepUpStartHandler(sqlDB))
	verify := authMW(stepUpVerifyHandler(sqlDB, "super-secret", false))

	startReq := httptest.NewRequest(http.MethodPost, "/api/auth/stepup/start", nil)
	startReq.RemoteAddr = "203.0.113.10:1111"
	startReq.AddCookie(sessionA)
	startRR := httptest.NewRecorder()
	start.ServeHTTP(startRR, startReq)
	if startRR.Code != http.StatusOK {
		t.Fatalf("stepup start failed: %d %s", startRR.Code, startRR.Body.String())
	}
	var startPayload map[string]any
	if err := json.Unmarshal(startRR.Body.Bytes(), &startPayload); err != nil {
		t.Fatalf("invalid start payload: %v", err)
	}
	challengeID, _ := startPayload["challengeId"].(string)
	if challengeID == "" {
		t.Fatalf("missing challenge id: %v", startPayload)
	}

	verifyReq := httptest.NewRequest(
		http.MethodPost,
		"/api/auth/stepup/verify",
		bytes.NewBufferString(`{"challengeId":"`+challengeID+`","password":"super-secret"}`),
	)
	verifyReq.RemoteAddr = "203.0.113.10:1111"
	verifyReq.Header.Set("Content-Type", "application/json")
	verifyReq.AddCookie(sessionA)
	verifyRR := httptest.NewRecorder()
	verify.ServeHTTP(verifyRR, verifyReq)
	if verifyRR.Code != http.StatusOK {
		t.Fatalf("stepup verify failed: %d %s", verifyRR.Code, verifyRR.Body.String())
	}

	var stepUpCookie *http.Cookie
	for _, c := range verifyRR.Result().Cookies() {
		if c.Name == stepUpSessionCookieName {
			stepUpCookie = c
		}
	}
	if stepUpCookie == nil {
		t.Fatal("stepup session cookie not found")
	}

	protected := authMW(requireStepUp(sqlDB, "super-secret")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))
	protectedReq := httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", nil)
	protectedReq.AddCookie(sessionB)
	protectedReq.AddCookie(stepUpCookie)
	protectedRR := httptest.NewRecorder()
	protected.ServeHTTP(protectedRR, protectedReq)
	if protectedRR.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for cross-session stepup reuse, got %d", protectedRR.Code)
	}
}
