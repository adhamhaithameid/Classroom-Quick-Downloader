package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"oracle-backend/internal/db"
)

func openPublicWebsiteDB(t *testing.T) *sql.DB {
	t.Helper()
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "public-website.db"))
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	return sqlDB
}

func seedPublicWebsiteFixture(t *testing.T, sqlDB *sql.DB) {
	t.Helper()

	if _, err := sqlDB.Exec(`INSERT INTO downloads_totals (key, value) VALUES
		('totalDownloads', 1200),
		('totalSuccess', 1100),
		('totalFail', 100),
		('country:US', 400),
		('country:GB', 250),
		('country:XX', 999),
		('country:unknown', 888),
		('country:U1', 777)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`); err != nil {
		t.Fatalf("seed downloads_totals failed: %v", err)
	}

	if _, err := sqlDB.Exec(`INSERT INTO batches
		(batch_id, generated_at, ingested_at, events_count, downloads_count, success_count, fail_count)
		VALUES ('batch-1', 1700000000000, 1700000005000, 50, 50, 45, 5)`); err != nil {
		t.Fatalf("seed batches failed: %v", err)
	}

	if _, err := sqlDB.Exec(`INSERT INTO do_state_snapshots
		(captured_at, source, total_events, total_downloads, total_success, total_fail, pending_events, requests_today,
		 quota_level, mode_label, remote_enabled, batch_size_suggestion, max_batch_events)
		VALUES (1700000100000, 'test', 1200, 1200, 1100, 100, 10, 5, 'BELOW_LIMITS', 'chill', 1, 50, 10000)`); err != nil {
		t.Fatalf("seed do_state_snapshots failed: %v", err)
	}

	if _, err := sqlDB.Exec(`INSERT INTO admin_records
		(record_type, record_key, data_json, created_at, updated_at) VALUES
		('deployment_target', 'chrome', '{"name":"Chrome","usersCount":1000,"rating":"4.9","ratingCount":100,"version":"1.3.6","syncedAt":1700000200000}', 1700000200000, 1700000200000),
		('deployment_target', 'firefox', '{"name":"Firefox","usersCount":200,"rating":"4.7","ratingCount":20,"version":"1.3.5","syncedAt":1700000300000}', 1700000300000, 1700000300000),
		('deployment_target', 'edge', '{"name":"Edge","usersCount":300,"rating":"4.8","ratingCount":30,"version":"1.3.6","syncedAt":1700000400000}', 1700000400000, 1700000400000)
	`); err != nil {
		t.Fatalf("seed admin_records failed: %v", err)
	}
}

func TestPublicWebsiteOverviewHandler_ReturnsSanitizedPayload(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	seedPublicWebsiteFixture(t, sqlDB)

	originalFetcher := githubVersionFetcher
	t.Cleanup(func() {
		githubVersionFetcher = originalFetcher
		resetPublicWebsiteVersionCacheForTest()
	})
	githubVersionFetcher = func(context.Context) (*string, error) {
		v := "1.3.6"
		return &v, nil
	}
	resetPublicWebsiteVersionCacheForTest()
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	req := httptest.NewRequest(http.MethodGet, "/api/public/website/overview", nil)
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	rr := httptest.NewRecorder()

	PublicWebsiteOverviewHandler(sqlDB, nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	if rr.Header().Get("Access-Control-Allow-Origin") != "https://adhamhaithameid.github.io" {
		t.Fatalf("unexpected CORS origin header: %q", rr.Header().Get("Access-Control-Allow-Origin"))
	}
	if !strings.Contains(rr.Header().Get("Cache-Control"), "max-age=120") {
		t.Fatalf("expected cache-control header, got %q", rr.Header().Get("Cache-Control"))
	}

	var payload struct {
		OK     bool `json:"ok"`
		Totals struct {
			Downloads int64 `json:"downloads"`
		} `json:"totals"`
		Installs struct {
			UsersTotal int64 `json:"usersTotal"`
			Browsers   []struct {
				Key     string `json:"key"`
				Version string `json:"version"`
			} `json:"browsers"`
		} `json:"installs"`
		Versions struct {
			GitHub *string `json:"github"`
			Chrome *string `json:"chrome"`
		} `json:"versions"`
		Status struct {
			SystemLive   bool   `json:"systemLive"`
			WorkerHealth string `json:"workerHealth"`
		} `json:"status"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal payload failed: %v", err)
	}

	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if payload.Totals.Downloads != 1200 {
		t.Fatalf("expected downloads=1200, got %d", payload.Totals.Downloads)
	}
	if payload.Installs.UsersTotal != 1500 {
		t.Fatalf("expected usersTotal=1500, got %d", payload.Installs.UsersTotal)
	}
	if payload.Versions.GitHub == nil || *payload.Versions.GitHub != "1.3.6" {
		t.Fatalf("expected github version 1.3.6, got %+v", payload.Versions.GitHub)
	}
	if payload.Versions.Chrome == nil || *payload.Versions.Chrome != "1.3.6" {
		t.Fatalf("expected chrome version 1.3.6, got %+v", payload.Versions.Chrome)
	}
	if !payload.Status.SystemLive || payload.Status.WorkerHealth != "up" {
		t.Fatalf("unexpected status payload: %+v", payload.Status)
	}

	body := rr.Body.String()
	if strings.Contains(body, "doState") || strings.Contains(body, "batchId") || strings.Contains(body, "uniqueIps") {
		t.Fatalf("payload leaked private/internal fields: %s", body)
	}
}

func TestPublicWebsiteMapHandler_ReturnsIsoCountryBreakdown(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	seedPublicWebsiteFixture(t, sqlDB)

	req := httptest.NewRequest(http.MethodGet, "/api/public/website/map", nil)
	rr := httptest.NewRecorder()
	PublicWebsiteMapHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK        bool `json:"ok"`
		Countries []struct {
			CountryCode string `json:"countryCode"`
			Count       int64  `json:"count"`
		} `json:"countries"`
		Totals struct {
			Countries int   `json:"countries"`
			Downloads int64 `json:"downloads"`
		} `json:"totals"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal map payload failed: %v", err)
	}

	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if payload.Totals.Downloads != 1200 {
		t.Fatalf("expected downloads total 1200, got %d", payload.Totals.Downloads)
	}
	if payload.Totals.Countries != 2 {
		t.Fatalf("expected 2 valid countries, got %d", payload.Totals.Countries)
	}
	if len(payload.Countries) != 2 || payload.Countries[0].CountryCode != "US" || payload.Countries[1].CountryCode != "GB" {
		t.Fatalf("unexpected country payload: %+v", payload.Countries)
	}
}

func TestPublicWebsiteHandlers_RejectDisallowedOrigin(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	req := httptest.NewRequest(http.MethodGet, "/api/public/website/overview", nil)
	req.Header.Set("Origin", "https://evil.example")
	rr := httptest.NewRecorder()
	PublicWebsiteOverviewHandler(sqlDB, nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rr.Code)
	}
}

func TestPublicWebsiteHandlers_PreflightForAllowedOrigin(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	req := httptest.NewRequest(http.MethodOptions, "/api/public/website/status", nil)
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rr := httptest.NewRecorder()
	PublicWebsiteStatusHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rr.Code)
	}
	if rr.Header().Get("Access-Control-Allow-Origin") != "https://adhamhaithameid.github.io" {
		t.Fatalf("expected preflight origin header, got %q", rr.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestPublicWebsiteUninstallHandler_SubmitsAndAggregatesFeedback(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	body := `{
		"reason":"I found another workflow",
		"browser":"chrome",
		"version":"1.3.6",
		"source":"extension",
		"notes":"Need fewer clicks."
	}`

	req := httptest.NewRequest(http.MethodPost, "/api/public/website/uninstall", bytes.NewBufferString(body))
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	PublicWebsiteUninstallHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var response struct {
		OK           bool  `json:"ok"`
		SubmissionID int64 `json:"submissionId"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !response.OK || response.SubmissionID <= 0 {
		t.Fatalf("unexpected submit response: %+v", response)
	}

	statsReq := httptest.NewRequest(http.MethodGet, "/api/public/website/uninstall", nil)
	statsReq.Header.Set("Origin", "https://adhamhaithameid.github.io")
	statsRR := httptest.NewRecorder()
	PublicWebsiteUninstallHandler(sqlDB).ServeHTTP(statsRR, statsReq)
	if statsRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", statsRR.Code, statsRR.Body.String())
	}

	var stats struct {
		OK    bool `json:"ok"`
		Stats struct {
			TotalSubmissions int64 `json:"totalSubmissions"`
			TopReasons       []struct {
				Reason string `json:"reason"`
				Count  int64  `json:"count"`
			} `json:"topReasons"`
		} `json:"stats"`
	}
	if err := json.Unmarshal(statsRR.Body.Bytes(), &stats); err != nil {
		t.Fatalf("failed to decode stats payload: %v", err)
	}
	if !stats.OK || stats.Stats.TotalSubmissions != 1 {
		t.Fatalf("unexpected stats payload: %+v", stats)
	}
	if len(stats.Stats.TopReasons) == 0 || stats.Stats.TopReasons[0].Reason != "I found another workflow" {
		t.Fatalf("expected top reason to be recorded, got %+v", stats.Stats.TopReasons)
	}
}

func TestPublicWebsiteUninstallHandler_RejectsBadInputs(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	cases := []struct {
		name       string
		origin     string
		header     string
		body       string
		wantStatus int
	}{
		{
			name:       "disallowed origin",
			origin:     "https://evil.example",
			header:     "XMLHttpRequest",
			body:       `{"reason":"x","browser":"chrome","version":"1","source":"website"}`,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "missing required header",
			origin:     "https://adhamhaithameid.github.io",
			header:     "",
			body:       `{"reason":"x","browser":"chrome","version":"1","source":"website"}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing reason",
			origin:     "https://adhamhaithameid.github.io",
			header:     "XMLHttpRequest",
			body:       `{"reason":"","browser":"chrome","version":"1","source":"website"}`,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/public/website/uninstall", bytes.NewBufferString(tc.body))
			req.Header.Set("Origin", tc.origin)
			if tc.header != "" {
				req.Header.Set("X-Requested-With", tc.header)
			}
			req.Header.Set("Content-Type", "application/json")

			rr := httptest.NewRecorder()
			PublicWebsiteUninstallHandler(sqlDB).ServeHTTP(rr, req)
			if rr.Code != tc.wantStatus {
				t.Fatalf("expected %d, got %d: %s", tc.wantStatus, rr.Code, rr.Body.String())
			}
		})
	}
}
