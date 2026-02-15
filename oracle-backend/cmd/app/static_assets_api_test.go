package main

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestStaticAssetsAPI_ServesDashboardBundlesAndSPAFallback(t *testing.T) {
	t.Parallel()

	staticDir := filepath.Join("..", "..", "static")
	handler := securityHeadersMiddleware(spaHandler(staticDir))

	reqJS := httptest.NewRequest(http.MethodGet, "/oracle-dashboard.js", nil)
	rrJS := httptest.NewRecorder()
	handler.ServeHTTP(rrJS, reqJS)
	if rrJS.Code != http.StatusOK {
		t.Fatalf("expected JS asset 200, got %d", rrJS.Code)
	}
	jsBody := rrJS.Body.String()
	if !strings.Contains(jsBody, "loadDeploymentStoreMetrics") {
		t.Fatalf("expected JS asset to contain dashboard runtime logic")
	}

	reqCSS := httptest.NewRequest(http.MethodGet, "/oracle-dashboard.css", nil)
	rrCSS := httptest.NewRecorder()
	handler.ServeHTTP(rrCSS, reqCSS)
	if rrCSS.Code != http.StatusOK {
		t.Fatalf("expected CSS asset 200, got %d", rrCSS.Code)
	}
	cssBody := rrCSS.Body.String()
	if !strings.Contains(cssBody, ".sidebar") {
		t.Fatalf("expected CSS asset to contain dashboard layout styles")
	}

	reqFallback := httptest.NewRequest(http.MethodGet, "/route/that/does/not/exist", nil)
	rrFallback := httptest.NewRecorder()
	handler.ServeHTTP(rrFallback, reqFallback)
	if rrFallback.Code != http.StatusOK {
		t.Fatalf("expected SPA fallback 200, got %d", rrFallback.Code)
	}
	fallbackBody := rrFallback.Body.String()
	if !strings.Contains(fallbackBody, "<!DOCTYPE html>") {
		t.Fatalf("expected SPA fallback to return index HTML")
	}
	if !strings.Contains(fallbackBody, `/oracle-dashboard.css`) {
		t.Fatalf("expected fallback HTML to reference split CSS bundle")
	}
	if !strings.Contains(fallbackBody, `/oracle-dashboard.js`) {
		t.Fatalf("expected fallback HTML to reference split JS bundle")
	}
}

func TestStaticAssetsAPI_AddsCSPAndDoesNotForceNoStoreForStaticRequests(t *testing.T) {
	t.Parallel()

	staticDir := filepath.Join("..", "..", "static")
	handler := securityHeadersMiddleware(spaHandler(staticDir))

	req := httptest.NewRequest(http.MethodGet, "/oracle-dashboard.js", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected static asset 200, got %d", rr.Code)
	}

	csp := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "script-src 'self'") {
		t.Fatalf("expected CSP script-src self on static asset response, got %q", csp)
	}
	if cache := rr.Header().Get("Cache-Control"); cache != "" {
		t.Fatalf("expected static asset to avoid auth no-store cache override, got %q", cache)
	}
}
