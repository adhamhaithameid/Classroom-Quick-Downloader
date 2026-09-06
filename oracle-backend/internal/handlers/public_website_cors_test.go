package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

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

func TestPublicWebsiteHandlers_AllowsCloudflarePagesDefaultOrigin(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	req := httptest.NewRequest(http.MethodGet, "/api/public/website/map", nil)
	req.Header.Set("Origin", "https://classroom-quick-downloader.pages.dev")
	rr := httptest.NewRecorder()
	PublicWebsiteMapHandler(sqlDB, nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if rr.Header().Get("Access-Control-Allow-Origin") != "https://classroom-quick-downloader.pages.dev" {
		t.Fatalf("unexpected CORS origin header: %q", rr.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestPublicWebsiteHandlers_AllowsCustomDomainDefaultOrigin(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	req := httptest.NewRequest(http.MethodGet, "/api/public/website/map", nil)
	req.Header.Set("Origin", "https://classroom-quick-downloader.adhamhaithameid.is-a.dev")
	rr := httptest.NewRecorder()
	PublicWebsiteMapHandler(sqlDB, nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if rr.Header().Get("Access-Control-Allow-Origin") != "https://classroom-quick-downloader.adhamhaithameid.is-a.dev" {
		t.Fatalf("unexpected CORS origin header: %q", rr.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestResolvePublicWebsiteAllowedOrigins_IncludesPublicSiteURL(t *testing.T) {
	t.Setenv("PUBLIC_SITE_URL", "https://example-root-domain.com/path")
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "")
	allowed := resolvePublicWebsiteAllowedOrigins()
	if _, ok := allowed["https://example-root-domain.com"]; !ok {
		t.Fatalf("expected PUBLIC_SITE_URL origin to be auto-allowed, got map: %+v", allowed)
	}
}

func TestResolvePublicWebsiteAllowedOrigins_DefaultsExcludeDevOrigins(t *testing.T) {
	t.Setenv("PUBLIC_SITE_URL", "")
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "")
	allowed := resolvePublicWebsiteAllowedOrigins()
	if _, ok := allowed["http://localhost:5173"]; ok {
		t.Fatalf("expected localhost origin to be excluded from production defaults")
	}
	if _, ok := allowed["http://127.0.0.1:5173"]; ok {
		t.Fatalf("expected loopback origin to be excluded from production defaults")
	}
	if _, ok := allowed["https://not-stable.classroom-quick-downloader-website.pages.dev"]; ok {
		t.Fatalf("expected not-stable pages origin to be excluded from production defaults")
	}
}

func TestResolvePublicWebsiteAllowedOrigins_EnvAllowsExplicitDevOrigin(t *testing.T) {
	t.Setenv("PUBLIC_SITE_URL", "")
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "http://localhost:5173,https://not-stable.classroom-quick-downloader-website.pages.dev")
	allowed := resolvePublicWebsiteAllowedOrigins()
	if _, ok := allowed["http://localhost:5173"]; !ok {
		t.Fatalf("expected localhost origin to be allowed when explicitly configured")
	}
	if _, ok := allowed["https://not-stable.classroom-quick-downloader-website.pages.dev"]; !ok {
		t.Fatalf("expected not-stable pages origin to be allowed when explicitly configured")
	}
}

func TestPublicWebsiteHandlers_PreflightForAllowedOrigin(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://adhamhaithameid.github.io")

	req := httptest.NewRequest(http.MethodOptions, "/api/public/website/status", nil)
	req.Header.Set("Origin", "https://adhamhaithameid.github.io")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rr := httptest.NewRecorder()
	PublicWebsiteStatusHandler(sqlDB, nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rr.Code)
	}
	if rr.Header().Get("Access-Control-Allow-Origin") != "https://adhamhaithameid.github.io" {
		t.Fatalf("expected preflight origin header, got %q", rr.Header().Get("Access-Control-Allow-Origin"))
	}
}
