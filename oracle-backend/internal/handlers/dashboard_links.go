package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

var githubRepoSlugPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

type githubOpenCountsResponse struct {
	OK          bool   `json:"ok"`
	Error       string `json:"error,omitempty"`
	Repo        string `json:"repo"`
	OpenIssues  int64  `json:"openIssues"`
	OpenPRs     int64  `json:"openPRs"`
	FetchedAt   int64  `json:"fetchedAt"`
	Cached      bool   `json:"cached"`
	Stale       bool   `json:"stale,omitempty"`
	CacheTTLSec int64  `json:"cacheTtlSec"`
}

type githubCountsCache struct {
	issues    int64
	prs       int64
	fetchedAt time.Time
	expiresAt time.Time
}

type githubCountsFetcher func(ctx context.Context, client *http.Client, repoSlug string, token string) (int64, int64, error)

func DashboardLinksHandler(cloudflareURL, uptimeKumaURL, githubRepoURL, googleSheetsURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"links": map[string]string{
				"cloudflare":   normalizeExternalURL(cloudflareURL),
				"uptimeKuma":   normalizeExternalURL(uptimeKumaURL),
				"githubRepo":   normalizeExternalURL(githubRepoURL),
				"googleSheets": normalizeExternalURL(googleSheetsURL),
			},
		})
	}
}

func normalizeExternalURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return ""
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return ""
	}
	if parsed.Host == "" {
		return ""
	}
	return parsed.String()
}

func GitHubOpenCountsHandler(repoSlug string, token string, cacheTTL time.Duration) http.HandlerFunc {
	return gitHubOpenCountsHandlerWithFetcher(repoSlug, token, cacheTTL, fetchGitHubOpenCounts)
}

func gitHubOpenCountsHandlerWithFetcher(repoSlug string, token string, cacheTTL time.Duration, fetcher githubCountsFetcher) http.HandlerFunc {
	repoSlug = strings.TrimSpace(repoSlug)
	if cacheTTL <= 0 {
		cacheTTL = time.Minute
	}
	client := &http.Client{Timeout: 8 * time.Second}
	var mu sync.Mutex
	cache := githubCountsCache{}

	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !githubRepoSlugPattern.MatchString(repoSlug) {
			http.Error(w, "invalid repo slug configuration", http.StatusInternalServerError)
			return
		}
		now := time.Now()

		mu.Lock()
		if !cache.expiresAt.IsZero() && now.Before(cache.expiresAt) {
			resp := githubOpenCountsResponse{
				OK:          true,
				Repo:        repoSlug,
				OpenIssues:  cache.issues,
				OpenPRs:     cache.prs,
				FetchedAt:   cache.fetchedAt.UnixMilli(),
				Cached:      true,
				CacheTTLSec: int64(cacheTTL.Seconds()),
			}
			mu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
		mu.Unlock()

		issues, prs, err := fetcher(r.Context(), client, repoSlug, token)
		if err != nil {
			mu.Lock()
			staleAvailable := !cache.fetchedAt.IsZero()
			resp := githubOpenCountsResponse{
				OK:          staleAvailable,
				Repo:        repoSlug,
				OpenIssues:  cache.issues,
				OpenPRs:     cache.prs,
				FetchedAt:   cache.fetchedAt.UnixMilli(),
				Cached:      staleAvailable,
				Stale:       staleAvailable,
				CacheTTLSec: int64(cacheTTL.Seconds()),
			}
			mu.Unlock()

			if staleAvailable {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(githubOpenCountsResponse{
				OK:          false,
				Error:       "github_unreachable",
				Repo:        repoSlug,
				OpenIssues:  0,
				OpenPRs:     0,
				FetchedAt:   0,
				Cached:      false,
				Stale:       true,
				CacheTTLSec: int64(cacheTTL.Seconds()),
			})
			return
		}

		mu.Lock()
		cache.issues = issues
		cache.prs = prs
		cache.fetchedAt = now
		cache.expiresAt = now.Add(cacheTTL)
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(githubOpenCountsResponse{
			OK:          true,
			Repo:        repoSlug,
			OpenIssues:  issues,
			OpenPRs:     prs,
			FetchedAt:   now.UnixMilli(),
			Cached:      false,
			CacheTTLSec: int64(cacheTTL.Seconds()),
		})
	}
}

func fetchGitHubOpenCounts(ctx context.Context, client *http.Client, repoSlug string, token string) (int64, int64, error) {
	issues, err := fetchGitHubSearchCount(ctx, client, repoSlug, "issue", token)
	if err != nil {
		return 0, 0, err
	}
	prs, err := fetchGitHubSearchCount(ctx, client, repoSlug, "pr", token)
	if err != nil {
		return 0, 0, err
	}
	return issues, prs, nil
}

func fetchGitHubSearchCount(ctx context.Context, client *http.Client, repoSlug string, kind string, token string) (int64, error) {
	q := fmt.Sprintf("repo:%s type:%s state:open", repoSlug, kind)
	u, err := url.Parse("https://api.github.com/search/issues")
	if err != nil {
		return 0, err
	}
	values := u.Query()
	values.Set("q", q)
	values.Set("per_page", "1")
	u.RawQuery = values.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "oracle-dashboard/1.0")
	if strings.TrimSpace(token) != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(token))
	}

	resp, err := client.Do(req) // #nosec G107,G704 -- request target is fixed to api.github.com and repo slug is strict allowlisted config.
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(body))
		if msg == "" {
			msg = resp.Status
		}
		return 0, errors.New(msg)
	}

	var payload struct {
		TotalCount int64 `json:"total_count"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return 0, err
	}
	return payload.TotalCount, nil
}
