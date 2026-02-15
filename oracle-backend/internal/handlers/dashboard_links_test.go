package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestDashboardLinksHandler_NormalizesInvalidValues(t *testing.T) {
	h := DashboardLinksHandler(
		"https://example.com/a",
		"javascript:alert(1)",
		"http://github.com/example/repo",
		"not-a-url",
		"https://www.figma.com/design/abc",
	)
	req := httptest.NewRequest(http.MethodGet, "/api/admin/dashboard-links", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var payload struct {
		OK    bool              `json:"ok"`
		Links map[string]string `json:"links"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.OK {
		t.Fatalf("expected ok=true")
	}
	if payload.Links["cloudflare"] != "https://example.com/a" {
		t.Fatalf("unexpected cloudflare url: %q", payload.Links["cloudflare"])
	}
	if payload.Links["uptimeKuma"] != "" {
		t.Fatalf("expected invalid uptime url to be blank, got %q", payload.Links["uptimeKuma"])
	}
	if payload.Links["githubRepo"] != "http://github.com/example/repo" {
		t.Fatalf("unexpected github url: %q", payload.Links["githubRepo"])
	}
	if payload.Links["googleSheets"] != "" {
		t.Fatalf("expected invalid sheets url to be blank, got %q", payload.Links["googleSheets"])
	}
	if payload.Links["figmaDesign"] != "https://www.figma.com/design/abc" {
		t.Fatalf("unexpected figma url: %q", payload.Links["figmaDesign"])
	}
}

func TestGitHubOpenCountsHandler_UsesCache(t *testing.T) {
	callCount := 0
	handler := gitHubOpenCountsHandlerWithFetcher(
		"owner/repo",
		"",
		5*time.Minute,
		func(_ context.Context, _ *http.Client, _ string, _ string) (githubCounts, error) {
			callCount++
			return githubCounts{
				issues:           11,
				prs:              7,
				branches:         13,
				discussions:      5,
				issuesKnown:      true,
				prsKnown:         true,
				branchesKnown:    true,
				discussionsKnown: true,
			}, nil
		},
	)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/github/open-counts", nil)
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req)
	if rr1.Code != http.StatusOK {
		t.Fatalf("expected first request 200, got %d", rr1.Code)
	}
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req)
	if rr2.Code != http.StatusOK {
		t.Fatalf("expected second request 200, got %d", rr2.Code)
	}
	if callCount != 1 {
		t.Fatalf("expected fetcher call count 1 due cache, got %d", callCount)
	}

	var first struct {
		Cached bool `json:"cached"`
	}
	if err := json.Unmarshal(rr1.Body.Bytes(), &first); err != nil {
		t.Fatalf("decode first response: %v", err)
	}
	if first.Cached {
		t.Fatalf("expected first response not cached")
	}

	var second struct {
		Cached bool `json:"cached"`
	}
	if err := json.Unmarshal(rr2.Body.Bytes(), &second); err != nil {
		t.Fatalf("decode second response: %v", err)
	}
	if !second.Cached {
		t.Fatalf("expected second response cached")
	}
}

func TestGitHubOpenCountsHandler_ReturnsStaleOnFetchError(t *testing.T) {
	callCount := 0
	handler := gitHubOpenCountsHandlerWithFetcher(
		"owner/repo",
		"",
		5*time.Millisecond,
		func(_ context.Context, _ *http.Client, _ string, _ string) (githubCounts, error) {
			callCount++
			if callCount == 1 {
				return githubCounts{
					issues:           3,
					prs:              2,
					branches:         4,
					discussions:      1,
					issuesKnown:      true,
					prsKnown:         true,
					branchesKnown:    true,
					discussionsKnown: true,
				}, nil
			}
			return githubCounts{}, context.DeadlineExceeded
		},
	)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/github/open-counts", nil)
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req)
	if rr1.Code != http.StatusOK {
		t.Fatalf("expected warm-up request 200, got %d", rr1.Code)
	}

	time.Sleep(12 * time.Millisecond)
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req)
	if rr2.Code != http.StatusOK {
		t.Fatalf("expected stale fallback 200, got %d", rr2.Code)
	}
	var payload struct {
		OK          bool   `json:"ok"`
		OpenIssues  int64  `json:"openIssues"`
		OpenPRs     int64  `json:"openPRs"`
		Branches    int64  `json:"branches"`
		Discussions int64  `json:"discussions"`
		Stale       bool   `json:"stale"`
		Source      string `json:"source"`
		Partial     bool   `json:"partial"`
	}
	if err := json.Unmarshal(rr2.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode stale response: %v", err)
	}
	if !payload.OK || !payload.Stale {
		t.Fatalf("expected stale ok response, got %+v", payload)
	}
	if payload.Source != "stale_cache" || payload.Partial {
		t.Fatalf("expected stale cache source and non-partial values, got %+v", payload)
	}
	if payload.OpenIssues != 3 || payload.OpenPRs != 2 || payload.Branches != 4 || payload.Discussions != 1 {
		t.Fatalf("unexpected stale counts: %+v", payload)
	}
}
