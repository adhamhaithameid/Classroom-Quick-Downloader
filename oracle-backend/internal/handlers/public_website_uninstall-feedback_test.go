package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

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
	var websiteToOracleCount int64
	if err := sqlDB.QueryRow(
		`SELECT COUNT(*) FROM website_sync_batches WHERE direction = ?`,
		websiteSyncDirectionWebsiteToOracle,
	).Scan(&websiteToOracleCount); err != nil {
		t.Fatalf("query website_sync_batches failed: %v", err)
	}
	if websiteToOracleCount != 1 {
		t.Fatalf("expected one website_to_oracle sync batch, got %d", websiteToOracleCount)
	}
	var lastWebsiteIngest sql.NullInt64
	if err := sqlDB.QueryRow(`SELECT last_website_ingest_at FROM website_sync_control WHERE id = 1`).Scan(&lastWebsiteIngest); err != nil {
		t.Fatalf("query website_sync_control failed: %v", err)
	}
	if !lastWebsiteIngest.Valid || lastWebsiteIngest.Int64 <= 0 {
		t.Fatalf("expected last_website_ingest_at to be set, got %+v", lastWebsiteIngest)
	}

	statsReq := httptest.NewRequest(http.MethodGet, "/api/public/website/uninstall", nil)
	statsReq.Header.Set("Origin", "https://adhamhaithameid.github.io")
	statsRR := httptest.NewRecorder()
	PublicWebsiteUninstallHandler(sqlDB).ServeHTTP(statsRR, statsReq)
	if statsRR.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d: %s", statsRR.Code, statsRR.Body.String())
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
			name:       "missing reason",
			origin:     "https://adhamhaithameid.github.io",
			header:     "",
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

func TestPublicWebsiteUninstallHandler_FailsClosedWhenDatabaseMissing(t *testing.T) {
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	req := httptest.NewRequest(http.MethodPost, "/api/public/website/uninstall", nil)
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	rr := httptest.NewRecorder()
	PublicWebsiteUninstallHandler(nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when database is unavailable, got %d", rr.Code)
	}
}
