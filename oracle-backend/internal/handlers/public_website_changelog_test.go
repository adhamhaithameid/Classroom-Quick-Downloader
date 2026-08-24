package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPublicWebsiteUserChangelogHandler_ReturnsSanitizedEntries(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	if _, err := sqlDB.Exec(`INSERT INTO admin_records
		(record_type, record_key, data_json, created_at, updated_at)
		VALUES
		('website_user_changelog_entry', 'release-136', '{"version":"1.3.6","title":"Faster downloads","summary":"Improved download stability and speed.","highlights":["Fewer failed requests","Cleaner progress feedback"],"releasedAtUtc":1771600000000}', 1771600000000, 1771600000000),
		('website_user_changelog_entry', 'bad-entry', '{"version":"","title":"bad","summary":""}', 1771600000001, 1771600000001)
	`); err != nil {
		t.Fatalf("seed changelog records failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/public/website/changelog", nil)
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	rr := httptest.NewRecorder()
	PublicWebsiteUserChangelogHandler(sqlDB, nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool `json:"ok"`
		Entries []struct {
			ID         string   `json:"id"`
			Version    string   `json:"version"`
			Summary    string   `json:"summary"`
			Highlights []string `json:"highlights"`
		} `json:"entries"`
		FullChangelogURL string `json:"fullChangelogUrl"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode payload failed: %v", err)
	}

	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if len(payload.Entries) != 1 {
		t.Fatalf("expected one valid changelog entry, got %d", len(payload.Entries))
	}
	if payload.Entries[0].Version != "1.3.6" {
		t.Fatalf("unexpected version: %+v", payload.Entries[0])
	}
	if !strings.Contains(payload.FullChangelogURL, "CHANGELOG.md") {
		t.Fatalf("unexpected full changelog URL: %s", payload.FullChangelogURL)
	}
	if strings.Contains(rr.Body.String(), "record_type") || strings.Contains(rr.Body.String(), "data_json") {
		t.Fatalf("payload leaked internal fields: %s", rr.Body.String())
	}
}
