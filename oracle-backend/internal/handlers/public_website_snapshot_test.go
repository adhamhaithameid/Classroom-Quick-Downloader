package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPublicWebsiteSnapshotHandler_ReturnsVersionedPayload(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	seedPublicWebsiteFixture(t, sqlDB)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	req := httptest.NewRequest(http.MethodGet, "/api/public/website/snapshot", nil)
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	rr := httptest.NewRecorder()
	PublicWebsiteSnapshotHandler(sqlDB, nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		SchemaVersion string `json:"schemaVersion"`
		OK            bool   `json:"ok"`
		SnapshotID    string `json:"snapshotId"`
		Overview      struct {
			SchemaVersion string `json:"schemaVersion"`
			Totals        struct {
				Downloads int64 `json:"downloads"`
			} `json:"totals"`
		} `json:"overview"`
		Map struct {
			SchemaVersion string `json:"schemaVersion"`
			Totals        struct {
				Downloads int64 `json:"downloads"`
			} `json:"totals"`
		} `json:"map"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal payload failed: %v", err)
	}
	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if payload.SchemaVersion != publicWebsiteSchemaVersion {
		t.Fatalf("expected schemaVersion=%s, got %s", publicWebsiteSchemaVersion, payload.SchemaVersion)
	}
	if payload.Overview.SchemaVersion != publicWebsiteSchemaVersion {
		t.Fatalf("expected nested overview schemaVersion=%s, got %s", publicWebsiteSchemaVersion, payload.Overview.SchemaVersion)
	}
	if payload.Map.SchemaVersion != publicWebsiteSchemaVersion {
		t.Fatalf("expected nested map schemaVersion=%s, got %s", publicWebsiteSchemaVersion, payload.Map.SchemaVersion)
	}
	if payload.Overview.Totals.Downloads != 1200 || payload.Map.Totals.Downloads != 1200 {
		t.Fatalf("expected snapshot downloads=1200, got overview=%d map=%d", payload.Overview.Totals.Downloads, payload.Map.Totals.Downloads)
	}
	if !strings.HasPrefix(payload.SnapshotID, "ws-public-website-snapshot-") {
		t.Fatalf("unexpected snapshotId: %q", payload.SnapshotID)
	}
}

func TestPublicWebsiteSnapshotHandler_ReusesStoredSnapshotUntilRefreshWindow(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	seedPublicWebsiteFixture(t, sqlDB)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	firstReq := httptest.NewRequest(http.MethodGet, "/api/public/website/snapshot", nil)
	firstReq.Header.Set("Origin", "https://adhamhaithameid.github.io")
	firstRR := httptest.NewRecorder()
	PublicWebsiteSnapshotHandler(sqlDB, nil).ServeHTTP(firstRR, firstReq)
	if firstRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", firstRR.Code, firstRR.Body.String())
	}

	secondReq := httptest.NewRequest(http.MethodGet, "/api/public/website/snapshot", nil)
	secondReq.Header.Set("Origin", "https://adhamhaithameid.github.io")
	secondRR := httptest.NewRecorder()
	PublicWebsiteSnapshotHandler(sqlDB, nil).ServeHTTP(secondRR, secondReq)
	if secondRR.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", secondRR.Code, secondRR.Body.String())
	}

	var firstPayload struct {
		SnapshotID string `json:"snapshotId"`
	}
	if err := json.Unmarshal(firstRR.Body.Bytes(), &firstPayload); err != nil {
		t.Fatalf("failed to decode first snapshot payload: %v", err)
	}
	var secondPayload struct {
		SnapshotID string `json:"snapshotId"`
	}
	if err := json.Unmarshal(secondRR.Body.Bytes(), &secondPayload); err != nil {
		t.Fatalf("failed to decode second snapshot payload: %v", err)
	}
	if firstPayload.SnapshotID == "" || secondPayload.SnapshotID == "" {
		t.Fatalf("expected non-empty snapshot IDs, got first=%q second=%q", firstPayload.SnapshotID, secondPayload.SnapshotID)
	}
	if firstPayload.SnapshotID != secondPayload.SnapshotID {
		t.Fatalf("expected snapshot to be reused, got first=%q second=%q", firstPayload.SnapshotID, secondPayload.SnapshotID)
	}

	var storedSnapshots int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM website_public_snapshots`).Scan(&storedSnapshots); err != nil {
		t.Fatalf("failed to count website_public_snapshots rows: %v", err)
	}
	if storedSnapshots != 1 {
		t.Fatalf("expected exactly 1 stored snapshot row, got %d", storedSnapshots)
	}
}

func TestPublicWebsiteSnapshotHandler_UsesPrivacyPointersFromControlPlane(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	seedPublicWebsiteFixture(t, sqlDB)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	if _, err := sqlDB.Exec(`INSERT INTO admin_records
		(record_type, record_key, data_json, created_at, updated_at)
		VALUES
		('website_user_privacy', 'public', '{"headline":"Privacy for students","description":"Only aggregated public metrics.","userPrivacyUrl":"https://classroom-quick-downloader-website.pages.dev/privacy","fullPrivacyUrl":"https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/PRIVACY.md"}', 1771600000000, 1771600000000)
	`); err != nil {
		t.Fatalf("seed privacy record failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/public/website/snapshot", nil)
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	rr := httptest.NewRecorder()
	PublicWebsiteSnapshotHandler(sqlDB, nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		Privacy struct {
			Headline       string `json:"headline"`
			Description    string `json:"description"`
			UserPrivacyURL string `json:"userPrivacyUrl"`
			FullPrivacyURL string `json:"fullPrivacyUrl"`
		} `json:"privacy"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode snapshot payload failed: %v", err)
	}
	if payload.Privacy.Headline != "Privacy for students" {
		t.Fatalf("expected privacy headline override, got %q", payload.Privacy.Headline)
	}
	if payload.Privacy.Description != "Only aggregated public metrics." {
		t.Fatalf("expected privacy description override, got %q", payload.Privacy.Description)
	}
	if payload.Privacy.UserPrivacyURL != "https://classroom-quick-downloader-website.pages.dev/privacy" {
		t.Fatalf("unexpected userPrivacyUrl: %q", payload.Privacy.UserPrivacyURL)
	}
	if payload.Privacy.FullPrivacyURL != "https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/PRIVACY.md" {
		t.Fatalf("unexpected fullPrivacyUrl: %q", payload.Privacy.FullPrivacyURL)
	}
}
