package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var githubRepoSlugPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

type githubOpenCountsResponse struct {
	OK               bool   `json:"ok"`
	Error            string `json:"error,omitempty"`
	Repo             string `json:"repo"`
	OpenIssues       int64  `json:"openIssues"`
	OpenPRs          int64  `json:"openPRs"`
	Branches         int64  `json:"branches"`
	Discussions      int64  `json:"discussions"`
	IssuesKnown      bool   `json:"issuesKnown"`
	PRsKnown         bool   `json:"prsKnown"`
	BranchesKnown    bool   `json:"branchesKnown"`
	DiscussionsKnown bool   `json:"discussionsKnown"`
	Source           string `json:"source,omitempty"`
	Partial          bool   `json:"partial,omitempty"`
	FetchedAt        int64  `json:"fetchedAt"`
	Cached           bool   `json:"cached"`
	Stale            bool   `json:"stale,omitempty"`
	CacheTTLSec      int64  `json:"cacheTtlSec"`
}

type githubCounts struct {
	issues           int64
	prs              int64
	branches         int64
	discussions      int64
	issuesKnown      bool
	prsKnown         bool
	branchesKnown    bool
	discussionsKnown bool
}

type githubCountsCache struct {
	counts    githubCounts
	fetchedAt time.Time
	expiresAt time.Time
}

type githubCountsFetcher func(ctx context.Context, client *http.Client, repoSlug string, token string) (githubCounts, error)

func DashboardLinksHandler(cloudflareURL, websiteURL, uptimeKumaURL, githubRepoURL, googleSheetsURL, figmaDesignURL string) http.HandlerFunc {
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
				"website":      normalizeExternalURL(websiteURL),
				"uptimeKuma":   normalizeExternalURL(uptimeKumaURL),
				"githubRepo":   normalizeExternalURL(githubRepoURL),
				"googleSheets": normalizeExternalURL(googleSheetsURL),
				"figmaDesign":  normalizeExternalURL(figmaDesignURL),
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
				OK:               true,
				Repo:             repoSlug,
				OpenIssues:       cache.counts.issues,
				OpenPRs:          cache.counts.prs,
				Branches:         cache.counts.branches,
				Discussions:      cache.counts.discussions,
				IssuesKnown:      cache.counts.issuesKnown,
				PRsKnown:         cache.counts.prsKnown,
				BranchesKnown:    cache.counts.branchesKnown,
				DiscussionsKnown: cache.counts.discussionsKnown,
				Source:           "cache",
				Partial:          !allGitHubCountsKnown(cache.counts),
				FetchedAt:        cache.fetchedAt.UnixMilli(),
				Cached:           true,
				CacheTTLSec:      int64(cacheTTL.Seconds()),
			}
			mu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
		mu.Unlock()

		counts, err := fetcher(r.Context(), client, repoSlug, token)
		if err != nil {
			mu.Lock()
			staleAvailable := !cache.fetchedAt.IsZero()
			resp := githubOpenCountsResponse{
				OK:               staleAvailable,
				Repo:             repoSlug,
				OpenIssues:       cache.counts.issues,
				OpenPRs:          cache.counts.prs,
				Branches:         cache.counts.branches,
				Discussions:      cache.counts.discussions,
				IssuesKnown:      cache.counts.issuesKnown,
				PRsKnown:         cache.counts.prsKnown,
				BranchesKnown:    cache.counts.branchesKnown,
				DiscussionsKnown: cache.counts.discussionsKnown,
				Source:           "stale_cache",
				Partial:          !allGitHubCountsKnown(cache.counts),
				FetchedAt:        cache.fetchedAt.UnixMilli(),
				Cached:           staleAvailable,
				Stale:            staleAvailable,
				CacheTTLSec:      int64(cacheTTL.Seconds()),
			}
			mu.Unlock()

			if staleAvailable {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(resp)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(githubOpenCountsResponse{
				OK:               false,
				Error:            "github_unreachable",
				Repo:             repoSlug,
				OpenIssues:       0,
				OpenPRs:          0,
				Branches:         0,
				Discussions:      0,
				IssuesKnown:      false,
				PRsKnown:         false,
				BranchesKnown:    false,
				DiscussionsKnown: false,
				Source:           "unavailable",
				Partial:          true,
				FetchedAt:        0,
				Cached:           false,
				Stale:            true,
				CacheTTLSec:      int64(cacheTTL.Seconds()),
			})
			return
		}

		mu.Lock()
		cache.counts = counts
		cache.fetchedAt = now
		cache.expiresAt = now.Add(cacheTTL)
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(githubOpenCountsResponse{
			OK:               true,
			Repo:             repoSlug,
			OpenIssues:       counts.issues,
			OpenPRs:          counts.prs,
			Branches:         counts.branches,
			Discussions:      counts.discussions,
			IssuesKnown:      counts.issuesKnown,
			PRsKnown:         counts.prsKnown,
			BranchesKnown:    counts.branchesKnown,
			DiscussionsKnown: counts.discussionsKnown,
			Source:           "live",
			Partial:          !allGitHubCountsKnown(counts),
			FetchedAt:        now.UnixMilli(),
			Cached:           false,
			CacheTTLSec:      int64(cacheTTL.Seconds()),
		})
	}
}

func fetchGitHubOpenCounts(ctx context.Context, client *http.Client, repoSlug string, token string) (githubCounts, error) {
	var (
		issuesKnown      bool
		prsKnown         bool
		branchesKnown    bool
		discussionsKnown bool
	)

	issues, issuesErr := fetchGitHubSearchOpenCount(ctx, client, repoSlug, true, token)
	prs, prsErr := fetchGitHubSearchOpenCount(ctx, client, repoSlug, false, token)
	if issuesErr == nil {
		issuesKnown = true
	}
	if prsErr == nil {
		prsKnown = true
	}
	if issuesErr != nil || prsErr != nil {
		// Fallback path: derive issues using repo metadata (issues+PRs) minus open PR list count.
		openIssuesAndPRs, err := fetchGitHubRepoOpenIssuesCount(ctx, client, repoSlug, token)
		if err != nil {
			return githubCounts{}, err
		}
		if prsErr != nil {
			prs, err = fetchGitHubRepoCollectionCount(ctx, client, repoSlug, "pulls", token)
			if err == nil {
				prsKnown = true
			} else {
				prs = 0
			}
		}
		if issuesErr != nil {
			if prsKnown {
				issues = openIssuesAndPRs - prs
				if issues < 0 {
					issues = 0
				}
				issuesKnown = true
			} else {
				// Without a known PR count, "open_issues_count" contains PRs too.
				issues = openIssuesAndPRs
				issuesKnown = false
			}
		}
	}
	branches, err := fetchGitHubRepoCollectionCount(ctx, client, repoSlug, "branches", token)
	if err != nil {
		branches = 0
		branchesKnown = false
	} else {
		branchesKnown = true
	}
	discussions, err := fetchGitHubRepoCollectionCount(ctx, client, repoSlug, "discussions", token)
	if err != nil {
		discussions = 0
		discussionsKnown = false
	} else {
		discussionsKnown = true
	}
	return githubCounts{
		issues:           issues,
		prs:              prs,
		branches:         branches,
		discussions:      discussions,
		issuesKnown:      issuesKnown,
		prsKnown:         prsKnown,
		branchesKnown:    branchesKnown,
		discussionsKnown: discussionsKnown,
	}, nil
}

func allGitHubCountsKnown(counts githubCounts) bool {
	return counts.issuesKnown && counts.prsKnown && counts.branchesKnown && counts.discussionsKnown
}

func fetchGitHubSearchOpenCount(ctx context.Context, client *http.Client, repoSlug string, isIssue bool, token string) (int64, error) {
	u, err := url.Parse("https://api.github.com/search/issues")
	if err != nil {
		return 0, err
	}
	itemType := "is:issue"
	if !isIssue {
		itemType = "is:pr"
	}
	q := u.Query()
	q.Set("q", "repo:"+repoSlug+" "+itemType+" is:open")
	q.Set("per_page", "1")
	u.RawQuery = q.Encode()
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
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
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
	if payload.TotalCount < 0 {
		return 0, nil
	}
	return payload.TotalCount, nil
}

func fetchGitHubRepoOpenIssuesCount(ctx context.Context, client *http.Client, repoSlug string, token string) (int64, error) {
	u, err := url.Parse("https://api.github.com/repos/" + repoSlug)
	if err != nil {
		return 0, err
	}
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
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(body))
		if msg == "" {
			msg = resp.Status
		}
		return 0, errors.New(msg)
	}
	var payload struct {
		OpenIssuesCount int64 `json:"open_issues_count"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return 0, err
	}
	if payload.OpenIssuesCount < 0 {
		return 0, nil
	}
	return payload.OpenIssuesCount, nil
}

func fetchGitHubRepoCollectionCount(ctx context.Context, client *http.Client, repoSlug string, collection string, token string) (int64, error) {
	u, err := url.Parse("https://api.github.com/repos/" + repoSlug + "/" + collection)
	if err != nil {
		return 0, err
	}
	q := u.Query()
	q.Set("per_page", "1")
	q.Set("page", "1")
	u.RawQuery = q.Encode()

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

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode == http.StatusNotFound && collection == "discussions" {
		// Discussions can be disabled for a repo; treat as zero instead of hard-failing dashboard notifications.
		return 0, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(body))
		if msg == "" {
			msg = resp.Status
		}
		return 0, errors.New(msg)
	}

	if lastPage, ok := parseGitHubLastPage(resp.Header.Get("Link")); ok {
		return lastPage, nil
	}

	var arr []json.RawMessage
	if err := json.Unmarshal(body, &arr); err != nil {
		return 0, err
	}
	return int64(len(arr)), nil
}

func parseGitHubLastPage(linkHeader string) (int64, bool) {
	if strings.TrimSpace(linkHeader) == "" {
		return 0, false
	}
	parts := strings.Split(linkHeader, ",")
	for _, part := range parts {
		segment := strings.TrimSpace(part)
		if !strings.Contains(segment, `rel="last"`) {
			continue
		}
		start := strings.Index(segment, "<")
		end := strings.Index(segment, ">")
		if start < 0 || end <= start+1 {
			continue
		}
		parsed, err := url.Parse(segment[start+1 : end])
		if err != nil {
			continue
		}
		pageRaw := strings.TrimSpace(parsed.Query().Get("page"))
		if pageRaw == "" {
			continue
		}
		page, err := strconv.ParseInt(pageRaw, 10, 64)
		if err != nil || page < 0 {
			continue
		}
		return page, true
	}
	return 0, false
}
