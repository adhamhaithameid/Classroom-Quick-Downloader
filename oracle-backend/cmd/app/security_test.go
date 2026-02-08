package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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

func TestAuthMiddleware_EnforcesSessionWhenEnabled(t *testing.T) {
	resetSessionStore()
	protected := requireAuth("secret", "")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
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
	protected := requireAuth("secret", "arch-secret")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
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

func TestLoginHandler_SetsSecureCookieOnSuccess(t *testing.T) {
	resetSessionStore()
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

func TestAuthCheckHandler_ReflectsSessionState(t *testing.T) {
	resetSessionStore()
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
					ByStatus:   map[string]int64{"success": 1},
					ByType:     map[string]int64{"pdf": 1},
					ByBrowser:  map[string]int64{"chrome": 1},
					ByOs:       map[string]int64{"mac": 1},
					ByExtVer:   map[string]int64{"1.0.0": 1},
					ByLanguage: map[string]int64{"en": 1},
					ByCountry:  map[string]int64{"us": 1},
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
}
