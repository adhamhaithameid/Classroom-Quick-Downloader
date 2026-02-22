package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"oracle-backend/internal/db"
	"oracle-backend/internal/handlers"
	"oracle-backend/internal/observability"
)

// ──────────────────────────────────────────────────────────────────────────────
// Integration test helpers
// ──────────────────────────────────────────────────────────────────────────────

// newIntegrationMux sets up a minimal production-like http.ServeMux backed by
// an in-memory SQLite database. It mirrors the route registrations in main.go
// that don't require PostgreSQL.
func newIntegrationMux(t *testing.T) (*http.ServeMux, *sql.DB) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "integration.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}

	metrics := observability.NewRegistry()

	mux := http.NewServeMux()

	// Unauthenticated routes (same as production)
	mux.HandleFunc("/health", handlers.APIHealthHandler)
	mux.HandleFunc("/health/api", handlers.APIHealthHandler)
	mux.Handle("/health/db", handlers.DBHealthHandler(sqlDB))
	mux.Handle("/ingest-batch", handlers.IngestBatchHandler(sqlDB, "test-secret"))
	mux.Handle("/storeBatch", handlers.IngestBatchHandler(sqlDB, "test-secret"))
	mux.Handle("/api/public/website/overview", handlers.PublicWebsiteOverviewHandler(sqlDB, nil))
	mux.Handle("/api/public/website/map", handlers.PublicWebsiteMapHandler(sqlDB))
	mux.Handle("/api/public/website/status", handlers.PublicWebsiteStatusHandler(sqlDB))
	mux.Handle("/api/public/website/changelog", handlers.PublicWebsiteUserChangelogHandler(sqlDB, nil))
	mux.Handle("/api/public/website/privacy", handlers.PublicWebsiteUserPrivacyHandler(sqlDB, nil))
	mux.Handle("/api/public/website/uninstall", handlers.PublicWebsiteUninstallHandler(sqlDB))

	// Stats routes (no auth wrapper for integration test)
	mux.Handle("/api/stats/summary", handlers.SummaryHandler(sqlDB))
	mux.Handle("/api/stats/timeseries", handlers.TimeSeriesHandler(sqlDB))
	mux.Handle("/api/stats/breakdown", handlers.BreakdownHandler(sqlDB))
	mux.Handle("/api/stats/comparison", handlers.ComparisonHandler(sqlDB))
	mux.Handle("/api/stats/export", handlers.ExportHandler(sqlDB))
	mux.Handle("/api/deploy-status", handlers.DeployStatusHandler())
	mux.Handle("/api/pipeline/metrics", handlers.PipelineMetricsHandler(sqlDB))
	mux.Handle("/api/pipeline/failures", handlers.PipelineFailuresHandler(sqlDB))

	// Admin routes (no auth wrapper for integration test)
	allowedRecordTypes := map[string]struct{}{
		"deployment_target":            {},
		"deployment_update_sentence":   {},
		"extension_version_note":       {},
		"creative_design":              {},
		"creative_email_template":      {},
		"newsletter_subscriber":        {},
		"newsletter_campaign":          {},
		"website_user_changelog_entry": {},
		"website_user_privacy_section": {},
	}
	mux.Handle("/api/admin/flags", handlers.FeatureFlagsHandler(sqlDB))
	mux.Handle("/api/admin/alerts", handlers.AlertsHandler(sqlDB))
	mux.Handle("/api/admin/oracle-logs", handlers.OracleOperationLogsListHandler(sqlDB))
	mux.Handle("/api/admin/records/list", handlers.RecordsListHandlerV4(sqlDB, nil, allowedRecordTypes))
	mux.Handle("/api/admin/records/upsert", handlers.RecordsUpsertHandlerV4(sqlDB, nil, allowedRecordTypes))
	mux.Handle("/api/admin/records/delete", handlers.RecordsDeleteHandlerV4(sqlDB, nil, allowedRecordTypes))
	mux.Handle("/api/admin/creative/designs", handlers.CreativeDesignsListHandler(sqlDB, nil))
	mux.Handle("/api/admin/creative/designs/upsert", handlers.CreativeDesignsUpsertHandler(sqlDB, nil))
	mux.Handle("/api/admin/creative/designs/delete", handlers.CreativeDesignsDeleteHandler(sqlDB, nil))
	mux.Handle("/api/admin/creative/emails", handlers.CreativeEmailsListHandler(sqlDB, nil))
	mux.Handle("/api/admin/creative/emails/upsert", handlers.CreativeEmailsUpsertHandler(sqlDB, nil))
	mux.Handle("/api/admin/creative/emails/delete", handlers.CreativeEmailsDeleteHandler(sqlDB, nil))
	mux.Handle("/api/admin/newsletter/subscribers", handlers.NewsletterSubscribersListHandler(sqlDB, nil))
	mux.Handle("/api/admin/newsletter/subscribers/upsert", handlers.NewsletterSubscribersUpsertHandler(sqlDB, nil))
	mux.Handle("/api/admin/newsletter/subscribers/delete", handlers.NewsletterSubscribersDeleteHandler(sqlDB, nil))
	mux.Handle("/api/admin/newsletter/campaigns", handlers.NewsletterCampaignsListHandler(sqlDB, nil))
	mux.Handle("/api/admin/newsletter/campaigns/upsert", handlers.NewsletterCampaignsUpsertHandler(sqlDB, nil))
	mux.Handle("/api/admin/newsletter/campaigns/delete", handlers.NewsletterCampaignsDeleteHandler(sqlDB, nil))
	mux.Handle("/api/admin/deployments/targets", handlers.DeploymentsTargetsHandler(sqlDB, nil))
	mux.Handle("/api/admin/deployments/sync", handlers.DeploymentsSyncHandler(sqlDB, nil, metrics))

	return mux, sqlDB
}

// ──────────────────────────────────────────────────────────────────────────────
// Route existence tests
// ──────────────────────────────────────────────────────────────────────────────

func TestIntegration_AllRegisteredRoutesRespondNon404(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	getRoutes := []string{
		"/health",
		"/health/api",
		"/health/db",
		"/api/stats/summary",
		"/api/public/website/overview",
		"/api/public/website/map",
		"/api/public/website/status",
		"/api/public/website/changelog",
		"/api/public/website/privacy",
		"/api/public/website/uninstall",
		"/api/stats/timeseries?from=2026-01-01&to=2026-01-31",
		"/api/stats/breakdown?from=2026-01-01&to=2026-01-31",
		"/api/stats/comparison?from1=2026-01-01&to1=2026-01-15&from2=2026-01-16&to2=2026-01-31",
		"/api/stats/export?format=json&range=all&granularity=day",
		"/api/deploy-status",
		"/api/pipeline/metrics?days=7&limit=20",
		"/api/pipeline/failures?days=7&limit=20",
		"/api/admin/flags",
		"/api/admin/alerts",
		"/api/admin/oracle-logs",
		"/api/admin/deployments/targets",
	}

	for _, route := range getRoutes {
		t.Run("GET "+route, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, route, nil)
			rr := httptest.NewRecorder()
			mux.ServeHTTP(rr, req)

			if rr.Code == http.StatusNotFound {
				t.Fatalf("route %s returned 404 — not registered", route)
			}
		})
	}
}

func TestIntegration_HealthEndpointReturnsOK(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp struct {
		OK bool `json:"ok"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if !resp.OK {
		t.Fatalf("expected ok=true")
	}
}

func TestIntegration_DBHealthEndpointReturnsOK(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/health/db", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestIntegration_DeployStatusEndpoint(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	// Set env for predictable output
	os.Setenv("GIT_COMMIT", "abc123def")
	defer os.Unsetenv("GIT_COMMIT")

	req := httptest.NewRequest(http.MethodGet, "/api/deploy-status", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	commit, _ := resp["commit"].(string)
	if commit != "abc123d" {
		t.Fatalf("expected commit=abc123d, got %q", commit)
	}
}

func TestIntegration_FeatureFlagsEndpoint(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/admin/flags", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if resp["ok"] != true {
		t.Fatalf("expected ok=true")
	}
}

func TestIntegration_SummaryEndpointEmptyDB(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if resp["ok"] != true {
		t.Fatalf("expected ok=true even for empty DB")
	}
}

func TestIntegration_OracleLogsEndpointEmptyDB(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/admin/oracle-logs", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestIntegration_AlertsEndpointEmptyDB(t *testing.T) {
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/admin/alerts", nil)
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}
