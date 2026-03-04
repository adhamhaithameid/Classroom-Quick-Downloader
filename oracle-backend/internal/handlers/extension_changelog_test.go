package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"oracle-backend/internal/db"
)

func openExtensionChangelogDB(t *testing.T) *sql.DB {
	t.Helper()
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "extension-changelog.db"))
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	return sqlDB
}

type extRoundTripFunc func(*http.Request) (*http.Response, error)

func (f extRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func installGitHubRawMarkdownStub(t *testing.T, markdown string) {
	t.Helper()
	prev := http.DefaultTransport
	http.DefaultTransport = extRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.Hostname() != "raw.githubusercontent.com" {
			return nil, io.EOF
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(markdown)),
			Request:    req,
		}, nil
	})
	t.Cleanup(func() {
		http.DefaultTransport = prev
	})
}

func TestExtensionChangelogPublicHandler_ReturnsSchemaAndETag(t *testing.T) {
	sqlDB := openExtensionChangelogDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://classroom-quick-downloader-website.pages.dev")

	now := time.Now().UnixMilli()
	if _, err := sqlDB.Exec(`INSERT INTO extension_changelog_entries (id, version, date, summary, added_json, changed_json, fixed_json, is_important, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"v1-3-8-release", "1.3.8", "2026-03-02", "Stability update", `[]`, `["Improved changelog sync"]`, `[]`, 1, now, now); err != nil {
		t.Fatalf("failed seeding entry: %v", err)
	}
	if _, err := sqlDB.Exec(`INSERT INTO extension_notification_rules (id, target, priority, effect, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		"rule-v138", "1.3.8", "major", "pulse", now, now); err != nil {
		t.Fatalf("failed seeding rule: %v", err)
	}

	handler := ExtensionChangelogPublicHandler(sqlDB)
	req := httptest.NewRequest(http.MethodGet, "/api/public/extension/changelog", nil)
	req.Header.Set("Origin", "https://classroom-quick-downloader-website.pages.dev")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	etag := rr.Header().Get("ETag")
	if etag == "" {
		t.Fatal("expected ETag header")
	}

	var payload struct {
		SchemaVersion string `json:"schemaVersion"`
		OK            bool   `json:"ok"`
		UpdateState   string `json:"updateState"`
		Entries       []struct {
			Version string `json:"version"`
		} `json:"entries"`
		Config struct {
			Rules []struct {
				ID string `json:"id"`
			} `json:"rules"`
		} `json:"config"`
		Meta struct {
			ContentChecksum string `json:"contentChecksum"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if payload.SchemaVersion != "1" {
		t.Fatalf("expected schemaVersion=1, got %q", payload.SchemaVersion)
	}
	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if payload.UpdateState != "new_data" {
		t.Fatalf("expected updateState=new_data, got %q", payload.UpdateState)
	}
	if len(payload.Entries) != 1 || payload.Entries[0].Version != "1.3.8" {
		t.Fatalf("unexpected entries payload: %+v", payload.Entries)
	}
	if len(payload.Config.Rules) != 1 || payload.Config.Rules[0].ID != "rule-v138" {
		t.Fatalf("unexpected rules payload: %+v", payload.Config.Rules)
	}
	if strings.TrimSpace(payload.Meta.ContentChecksum) == "" {
		t.Fatal("expected non-empty meta.contentChecksum")
	}

	notModifiedReq := httptest.NewRequest(http.MethodGet, "/api/public/extension/changelog", nil)
	notModifiedReq.Header.Set("Origin", "https://classroom-quick-downloader-website.pages.dev")
	notModifiedReq.Header.Set("If-None-Match", etag)
	notModifiedRR := httptest.NewRecorder()
	handler.ServeHTTP(notModifiedRR, notModifiedReq)
	if notModifiedRR.Code != http.StatusNotModified {
		t.Fatalf("expected 304, got %d: %s", notModifiedRR.Code, notModifiedRR.Body.String())
	}
}

func TestExtChangelogImportGitHubPreviewAndDuplicateImport(t *testing.T) {
	sqlDB := openExtensionChangelogDB(t)
	markdown := `## v1.3.8
### Summary
Improved changelog reliability.
### Added
- Added Oracle changelog source.
### Changed
- Updated notification styling behavior.
### Fixed
- Fixed duplicate parsing edge case.`
	installGitHubRawMarkdownStub(t, markdown)

	url := "https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/user-friendly-changelog.md"
	previewHandler := ExtChangelogImportGitHubPreviewHandler(sqlDB)
	importHandler := ExtChangelogImportGitHubHandler(sqlDB)

	previewReq := httptest.NewRequest(http.MethodPost, "/api/admin/extension-changelog/import-github/preview", bytes.NewBufferString(`{"url":"`+url+`"}`))
	previewReq.Header.Set("Content-Type", "application/json")
	previewRR := httptest.NewRecorder()
	previewHandler.ServeHTTP(previewRR, previewReq)
	if previewRR.Code != http.StatusOK {
		t.Fatalf("preview expected 200, got %d: %s", previewRR.Code, previewRR.Body.String())
	}

	var previewPayload struct {
		OK          bool   `json:"ok"`
		ParsedCount int    `json:"parsedCount"`
		Checksum    string `json:"checksum"`
		Duplicate   bool   `json:"duplicate"`
	}
	if err := json.Unmarshal(previewRR.Body.Bytes(), &previewPayload); err != nil {
		t.Fatalf("preview unmarshal failed: %v", err)
	}
	if !previewPayload.OK || previewPayload.ParsedCount == 0 || previewPayload.Checksum == "" {
		t.Fatalf("unexpected preview payload: %s", previewRR.Body.String())
	}
	if previewPayload.Duplicate {
		t.Fatal("expected duplicate=false before first import")
	}

	importReq := httptest.NewRequest(http.MethodPost, "/api/admin/extension-changelog/import-github", bytes.NewBufferString(`{"url":"`+url+`"}`))
	importReq.Header.Set("Content-Type", "application/json")
	importRR := httptest.NewRecorder()
	importHandler.ServeHTTP(importRR, importReq)
	if importRR.Code != http.StatusOK {
		t.Fatalf("import expected 200, got %d: %s", importRR.Code, importRR.Body.String())
	}

	var importPayload struct {
		OK       bool `json:"ok"`
		Imported int  `json:"imported"`
		Skipped  bool `json:"skipped"`
	}
	if err := json.Unmarshal(importRR.Body.Bytes(), &importPayload); err != nil {
		t.Fatalf("import unmarshal failed: %v", err)
	}
	if !importPayload.OK || importPayload.Imported == 0 || importPayload.Skipped {
		t.Fatalf("unexpected first import payload: %s", importRR.Body.String())
	}

	previewAfterReq := httptest.NewRequest(http.MethodPost, "/api/admin/extension-changelog/import-github/preview", bytes.NewBufferString(`{"url":"`+url+`"}`))
	previewAfterReq.Header.Set("Content-Type", "application/json")
	previewAfterRR := httptest.NewRecorder()
	previewHandler.ServeHTTP(previewAfterRR, previewAfterReq)
	if previewAfterRR.Code != http.StatusOK {
		t.Fatalf("preview after import expected 200, got %d: %s", previewAfterRR.Code, previewAfterRR.Body.String())
	}
	if err := json.Unmarshal(previewAfterRR.Body.Bytes(), &previewPayload); err != nil {
		t.Fatalf("preview after import unmarshal failed: %v", err)
	}
	if !previewPayload.Duplicate {
		t.Fatalf("expected duplicate=true after first import, payload=%s", previewAfterRR.Body.String())
	}

	importAgainReq := httptest.NewRequest(http.MethodPost, "/api/admin/extension-changelog/import-github", bytes.NewBufferString(`{"url":"`+url+`"}`))
	importAgainReq.Header.Set("Content-Type", "application/json")
	importAgainRR := httptest.NewRecorder()
	importHandler.ServeHTTP(importAgainRR, importAgainReq)
	if importAgainRR.Code != http.StatusOK {
		t.Fatalf("second import expected 200, got %d: %s", importAgainRR.Code, importAgainRR.Body.String())
	}
	if err := json.Unmarshal(importAgainRR.Body.Bytes(), &importPayload); err != nil {
		t.Fatalf("second import unmarshal failed: %v", err)
	}
	if !importPayload.OK || !importPayload.Skipped || importPayload.Imported != 0 {
		t.Fatalf("unexpected second import payload: %s", importAgainRR.Body.String())
	}
}

func TestExtChangelogImportGitHubPreviewRejectsInvalidHost(t *testing.T) {
	sqlDB := openExtensionChangelogDB(t)
	handler := ExtChangelogImportGitHubPreviewHandler(sqlDB)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/extension-changelog/import-github/preview", bytes.NewBufferString(`{"url":"https://example.com/changelog.md"}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid host, got %d: %s", rr.Code, rr.Body.String())
	}
}
