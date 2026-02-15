package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// normalizeExternalURL
// ---------------------------------------------------------------------------

func TestNormalizeExternalURL_ValidHTTPS(t *testing.T) {
	u := normalizeExternalURL("https://example.com/path")
	if u != "https://example.com/path" {
		t.Fatalf("expected normalized URL, got %s", u)
	}
}

func TestNormalizeExternalURL_ValidHTTP(t *testing.T) {
	u := normalizeExternalURL("http://example.com")
	if u != "http://example.com" {
		t.Fatalf("expected normalized URL, got %s", u)
	}
}

func TestNormalizeExternalURL_Empty(t *testing.T) {
	if normalizeExternalURL("") != "" {
		t.Fatal("expected empty for empty input")
	}
}

func TestNormalizeExternalURL_Whitespace(t *testing.T) {
	if normalizeExternalURL("   ") != "" {
		t.Fatal("expected empty for whitespace")
	}
}

func TestNormalizeExternalURL_NoScheme(t *testing.T) {
	if normalizeExternalURL("example.com") != "" {
		t.Fatal("expected empty for missing scheme")
	}
}

func TestNormalizeExternalURL_FTPScheme(t *testing.T) {
	if normalizeExternalURL("ftp://example.com") != "" {
		t.Fatal("expected empty for non-http/https scheme")
	}
}

func TestNormalizeExternalURL_NoHost(t *testing.T) {
	if normalizeExternalURL("https://") != "" {
		t.Fatal("expected empty for missing host")
	}
}

func TestNormalizeExternalURL_WithWhitespace(t *testing.T) {
	u := normalizeExternalURL("  https://example.com  ")
	if u != "https://example.com" {
		t.Fatalf("expected trimmed URL, got %q", u)
	}
}

// ---------------------------------------------------------------------------
// DashboardLinksHandler
// ---------------------------------------------------------------------------

func TestDashboardLinksHandler_Success(t *testing.T) {
	h := DashboardLinksHandler(
		"https://dash.cloudflare.com",
		"http://129.151.233.229:3001/status/cqd",
		"https://github.com/user/repo",
		"https://docs.google.com/spreadsheets/d/abc",
		"https://www.figma.com/design/abc",
	)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/dashboard/links", nil)
	h.ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["ok"] != true {
		t.Fatal("expected ok=true")
	}
	links := resp["links"].(map[string]interface{})
	if links["cloudflare"].(string) != "https://dash.cloudflare.com" {
		t.Fatal("wrong cloudflare URL")
	}
}

func TestDashboardLinksHandler_EmptyURLs(t *testing.T) {
	h := DashboardLinksHandler("", "", "", "", "")
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/dashboard/links", nil)
	h.ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	links := resp["links"].(map[string]interface{})
	if links["cloudflare"].(string) != "" {
		t.Fatal("expected empty cloudflare URL")
	}
}

func TestDashboardLinksHandler_MethodNotAllowed(t *testing.T) {
	h := DashboardLinksHandler("", "", "", "", "")
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/dashboard/links", nil)
	h.ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// gitHubOpenCountsHandlerWithFetcher
// ---------------------------------------------------------------------------

func TestGitHubOpenCountsHandler_FreshFetch(t *testing.T) {
	fakeFetcher := func(_ context.Context, _ *http.Client, _ string, _ string) (githubCounts, error) {
		return githubCounts{
			issues:           5,
			prs:              3,
			branches:         2,
			discussions:      1,
			issuesKnown:      true,
			prsKnown:         true,
			branchesKnown:    true,
			discussionsKnown: true,
		}, nil
	}
	h := gitHubOpenCountsHandlerWithFetcher("user/repo", "token", time.Minute, fakeFetcher)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/github/counts", nil)
	h.ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp githubOpenCountsResponse
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if !resp.OK || resp.OpenIssues != 5 || resp.OpenPRs != 3 {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if resp.Cached {
		t.Fatal("expected cached=false on first fetch")
	}
	if resp.Source != "live" || resp.Partial {
		t.Fatalf("expected live non-partial response, got %+v", resp)
	}
}

func TestGitHubOpenCountsHandler_CachedResponse(t *testing.T) {
	calls := 0
	fakeFetcher := func(_ context.Context, _ *http.Client, _ string, _ string) (githubCounts, error) {
		calls++
		return githubCounts{
			issues:           5,
			prs:              3,
			branches:         2,
			discussions:      1,
			issuesKnown:      true,
			prsKnown:         true,
			branchesKnown:    true,
			discussionsKnown: true,
		}, nil
	}
	h := gitHubOpenCountsHandlerWithFetcher("user/repo", "token", time.Hour, fakeFetcher)

	// First call populates cache
	rr1 := httptest.NewRecorder()
	h.ServeHTTP(rr1, httptest.NewRequest(http.MethodGet, "/", nil))

	// Second call should use cache
	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2, httptest.NewRequest(http.MethodGet, "/", nil))
	var resp githubOpenCountsResponse
	json.Unmarshal(rr2.Body.Bytes(), &resp)
	if !resp.Cached {
		t.Fatal("expected cached=true on second call")
	}
	if resp.Source != "cache" {
		t.Fatalf("expected cache source, got %+v", resp)
	}
	if calls != 1 {
		t.Fatalf("expected 1 fetch call, got %d", calls)
	}
}

func TestGitHubOpenCountsHandler_FetchError_NoCache(t *testing.T) {
	fakeFetcher := func(_ context.Context, _ *http.Client, _ string, _ string) (githubCounts, error) {
		return githubCounts{}, errors.New("network error")
	}
	h := gitHubOpenCountsHandlerWithFetcher("user/repo", "", time.Minute, fakeFetcher)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/github/counts", nil)
	h.ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200 (error in body), got %d", rr.Code)
	}
	var resp githubOpenCountsResponse
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp.OK {
		t.Fatal("expected OK=false on error with no cache")
	}
	if resp.Error != "github_unreachable" {
		t.Fatalf("expected github_unreachable error, got %s", resp.Error)
	}
	if resp.Source != "unavailable" || !resp.Partial {
		t.Fatalf("expected unavailable partial response, got %+v", resp)
	}
	if resp.IssuesKnown || resp.PRsKnown || resp.BranchesKnown || resp.DiscussionsKnown {
		t.Fatalf("expected unknown counters when unreachable, got %+v", resp)
	}
}

func TestGitHubOpenCountsHandler_FetchError_StaleCache(t *testing.T) {
	call := 0
	fakeFetcher := func(_ context.Context, _ *http.Client, _ string, _ string) (githubCounts, error) {
		call++
		if call == 1 {
			return githubCounts{
				issues:           10,
				prs:              2,
				branches:         6,
				discussions:      4,
				issuesKnown:      true,
				prsKnown:         true,
				branchesKnown:    true,
				discussionsKnown: true,
			}, nil
		}
		return githubCounts{}, errors.New("fail")
	}
	// Very short TTL so cache expires immediately
	h := gitHubOpenCountsHandlerWithFetcher("user/repo", "", time.Nanosecond, fakeFetcher)

	// First call populates cache
	rr1 := httptest.NewRecorder()
	h.ServeHTTP(rr1, httptest.NewRequest(http.MethodGet, "/", nil))

	// Wait for cache to expire
	time.Sleep(10 * time.Millisecond)

	// Second call should return stale data
	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2, httptest.NewRequest(http.MethodGet, "/", nil))
	var resp githubOpenCountsResponse
	json.Unmarshal(rr2.Body.Bytes(), &resp)
	if !resp.OK {
		t.Fatal("expected OK=true with stale cache")
	}
	if !resp.Stale {
		t.Fatal("expected stale=true")
	}
	if resp.Source != "stale_cache" {
		t.Fatalf("expected stale cache source, got %+v", resp)
	}
	if resp.OpenIssues != 10 {
		t.Fatalf("expected stale issues=10, got %d", resp.OpenIssues)
	}
}

func TestGitHubOpenCountsHandler_InvalidSlug(t *testing.T) {
	fakeFetcher := func(_ context.Context, _ *http.Client, _ string, _ string) (githubCounts, error) {
		return githubCounts{}, nil
	}
	h := gitHubOpenCountsHandlerWithFetcher("not a valid slug!!", "", time.Minute, fakeFetcher)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	if rr.Code != 500 {
		t.Fatalf("expected 500 for invalid slug, got %d", rr.Code)
	}
}

func TestGitHubOpenCountsHandler_MethodNotAllowed(t *testing.T) {
	fakeFetcher := func(_ context.Context, _ *http.Client, _ string, _ string) (githubCounts, error) {
		return githubCounts{}, nil
	}
	h := gitHubOpenCountsHandlerWithFetcher("user/repo", "", time.Minute, fakeFetcher)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/", nil))
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestGitHubOpenCountsHandler_NegativeTTL(t *testing.T) {
	fakeFetcher := func(_ context.Context, _ *http.Client, _ string, _ string) (githubCounts, error) {
		return githubCounts{
			issues:           1,
			prs:              1,
			branches:         1,
			discussions:      0,
			issuesKnown:      true,
			prsKnown:         true,
			branchesKnown:    true,
			discussionsKnown: true,
		}, nil
	}
	// Negative TTL should be clamped to 1 minute
	h := gitHubOpenCountsHandlerWithFetcher("user/repo", "", -time.Hour, fakeFetcher)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// githubRepoSlugPattern
// ---------------------------------------------------------------------------

func TestGitHubRepoSlugPattern(t *testing.T) {
	valid := []string{"user/repo", "org-name/project.name", "A_B/C.D"}
	for _, s := range valid {
		if !githubRepoSlugPattern.MatchString(s) {
			t.Fatalf("expected %q to match", s)
		}
	}
	invalid := []string{"", "noslash", "has space/repo", "user/repo/extra", "user/"}
	for _, s := range invalid {
		if githubRepoSlugPattern.MatchString(s) {
			t.Fatalf("expected %q to NOT match", s)
		}
	}
}
