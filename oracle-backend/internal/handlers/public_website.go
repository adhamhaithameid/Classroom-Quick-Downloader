package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	publicWebsiteCacheControl = "public, max-age=120, stale-while-revalidate=60"
	defaultGitHubRepoSlug     = "adhamhaithameid/Classroom-Quick-Downloader"
)

var (
	isoCountryCodePattern = regexp.MustCompile(`^[A-Z]{2}$`)

	defaultPublicWebsiteAllowedOrigins = []string{
		"https://adhamhaithameid.github.io",
		"http://localhost:5173",
		"http://127.0.0.1:5173",
	}

	githubVersionFetcher = fetchLatestGitHubVersion
	githubVersionCache   = struct {
		mu      sync.Mutex
		version *string
		fetched time.Time
		lastErr error
		ttl     time.Duration
	}{
		ttl: 10 * time.Minute,
	}
)

type publicWebsiteOverviewResponse struct {
	OK          bool                  `json:"ok"`
	GeneratedAt int64                 `json:"generatedAt"`
	Totals      publicWebsiteTotals   `json:"totals"`
	Installs    publicWebsiteInstalls `json:"installs"`
	Versions    publicWebsiteVersions `json:"versions"`
	Status      publicWebsiteStatus   `json:"status"`
	Links       publicWebsiteLinks    `json:"links"`
}

type publicWebsiteStatusResponse struct {
	OK          bool                `json:"ok"`
	GeneratedAt int64               `json:"generatedAt"`
	Status      publicWebsiteStatus `json:"status"`
}

type publicWebsiteMapResponse struct {
	OK          bool                       `json:"ok"`
	GeneratedAt int64                      `json:"generatedAt"`
	Granularity string                     `json:"granularity"`
	Countries   []publicWebsiteCountryCell `json:"countries"`
	Totals      publicWebsiteMapTotals     `json:"totals"`
	PrivacyNote string                     `json:"privacyNote"`
}

type publicWebsiteTotals struct {
	Downloads int64 `json:"downloads"`
	Success   int64 `json:"success"`
	Fail      int64 `json:"fail"`
}

type publicWebsiteInstallBrowser struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	UsersCount  int64  `json:"usersCount"`
	Version     string `json:"version"`
	Rating      string `json:"rating"`
	RatingCount int64  `json:"ratingCount"`
}

type publicWebsiteInstalls struct {
	UsersTotal      int64                         `json:"usersTotal"`
	LastSyncedAtUTC int64                         `json:"lastSyncedAtUtc"`
	Browsers        []publicWebsiteInstallBrowser `json:"browsers"`
}

type publicWebsiteVersions struct {
	GitHub  *string `json:"github"`
	Chrome  *string `json:"chrome"`
	Firefox *string `json:"firefox"`
	Edge    *string `json:"edge"`
}

type publicWebsiteStatus struct {
	SystemLive   bool   `json:"systemLive"`
	LiveSinceUTC *int64 `json:"liveSinceUtc"`
	WorkerHealth string `json:"workerHealth"`
}

type publicWebsiteLinks struct {
	Chrome  string `json:"chrome"`
	Firefox string `json:"firefox"`
	Edge    string `json:"edge"`
	GitHub  string `json:"github"`
}

type publicWebsiteCountryCell struct {
	CountryCode string `json:"countryCode"`
	Count       int64  `json:"count"`
}

type publicWebsiteMapTotals struct {
	Countries int   `json:"countries"`
	Downloads int64 `json:"downloads"`
}

type gitHubReleaseInfo struct {
	TagName string `json:"tag_name"`
	Name    string `json:"name"`
}

func PublicWebsiteOverviewHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORS(w, r) {
			return
		}
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		payload, err := buildPublicWebsiteOverview(r.Context(), sqliteDB, store)
		if err != nil {
			http.Error(w, "failed to build public website overview", http.StatusInternalServerError)
			return
		}

		writePublicWebsiteJSON(w, http.StatusOK, payload)
	}
}

func PublicWebsiteMapHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORS(w, r) {
			return
		}
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		rawTotals, err := loadTotals(r.Context(), sqliteDB)
		if err != nil {
			http.Error(w, "failed to load totals", http.StatusInternalServerError)
			return
		}
		countries := make([]publicWebsiteCountryCell, 0, len(rawTotals))
		for key, value := range rawTotals {
			if !strings.HasPrefix(key, "country:") || value <= 0 {
				continue
			}
			code := strings.ToUpper(strings.TrimSpace(strings.TrimPrefix(key, "country:")))
			if code == "XX" || code == "UNKNOWN" || !isoCountryCodePattern.MatchString(code) {
				continue
			}
			countries = append(countries, publicWebsiteCountryCell{
				CountryCode: code,
				Count:       value,
			})
		}
		sort.Slice(countries, func(i, j int) bool {
			if countries[i].Count == countries[j].Count {
				return countries[i].CountryCode < countries[j].CountryCode
			}
			return countries[i].Count > countries[j].Count
		})

		payload := publicWebsiteMapResponse{
			OK:          true,
			GeneratedAt: time.Now().UTC().UnixMilli(),
			Granularity: "country",
			Countries:   countries,
			Totals: publicWebsiteMapTotals{
				Countries: len(countries),
				Downloads: rawTotals["totalDownloads"],
			},
			PrivacyNote: "Country-level usage is aggregated without storing raw IP addresses. VPN/proxy users may appear at exit-node locations.",
		}

		writePublicWebsiteJSON(w, http.StatusOK, payload)
	}
}

func PublicWebsiteStatusHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORS(w, r) {
			return
		}
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		status, err := buildPublicWebsiteStatus(r.Context(), sqliteDB)
		if err != nil {
			http.Error(w, "failed to load status", http.StatusInternalServerError)
			return
		}

		writePublicWebsiteJSON(w, http.StatusOK, publicWebsiteStatusResponse{
			OK:          true,
			GeneratedAt: time.Now().UTC().UnixMilli(),
			Status:      status,
		})
	}
}

func buildPublicWebsiteOverview(ctx context.Context, sqliteDB *sql.DB, store *controlPlaneStore) (publicWebsiteOverviewResponse, error) {
	rawTotals, err := loadTotals(ctx, sqliteDB)
	if err != nil {
		return publicWebsiteOverviewResponse{}, err
	}

	installs, links := buildPublicWebsiteInstalls(ctx, store)
	status, err := buildPublicWebsiteStatus(ctx, sqliteDB)
	if err != nil {
		return publicWebsiteOverviewResponse{}, err
	}

	gitHubVersion := fetchGitHubVersionCached(ctx)
	chromeVersion := stringPtrOrNil(lookupBrowserVersion(installs.Browsers, "chrome"))
	firefoxVersion := stringPtrOrNil(lookupBrowserVersion(installs.Browsers, "firefox"))
	edgeVersion := stringPtrOrNil(lookupBrowserVersion(installs.Browsers, "edge"))

	return publicWebsiteOverviewResponse{
		OK:          true,
		GeneratedAt: time.Now().UTC().UnixMilli(),
		Totals: publicWebsiteTotals{
			Downloads: rawTotals["totalDownloads"],
			Success:   rawTotals["totalSuccess"],
			Fail:      rawTotals["totalFail"],
		},
		Installs: installs,
		Versions: publicWebsiteVersions{
			GitHub:  gitHubVersion,
			Chrome:  chromeVersion,
			Firefox: firefoxVersion,
			Edge:    edgeVersion,
		},
		Status: status,
		Links:  links,
	}, nil
}

func buildPublicWebsiteStatus(ctx context.Context, sqliteDB *sql.DB) (publicWebsiteStatus, error) {
	liveSinceUTC, err := loadPublicLiveSinceUTC(ctx, sqliteDB)
	if err != nil {
		return publicWebsiteStatus{}, err
	}

	doSnapshot, err := loadLastDOSnapshot(ctx, sqliteDB)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return publicWebsiteStatus{}, err
	}

	return publicWebsiteStatus{
		SystemLive:   liveSinceUTC != nil,
		LiveSinceUTC: liveSinceUTC,
		WorkerHealth: derivePublicWorkerHealth(doSnapshot),
	}, nil
}

func derivePublicWorkerHealth(snapshot *summaryDOStateInfo) string {
	if snapshot == nil {
		return "down"
	}

	if !snapshot.RemoteEnabled {
		return "degraded"
	}
	if snapshot.PendingEvents > 250 {
		return "degraded"
	}
	if snapshot.LastFlushAt != nil {
		lastFlush := time.UnixMilli(*snapshot.LastFlushAt)
		if time.Since(lastFlush) > 6*time.Hour {
			return "degraded"
		}
	}
	return "up"
}

func loadPublicLiveSinceUTC(ctx context.Context, sqliteDB *sql.DB) (*int64, error) {
	var firstIngest sql.NullInt64
	if err := sqliteDB.QueryRowContext(ctx, `SELECT MIN(ingested_at) FROM batches`).Scan(&firstIngest); err != nil {
		return nil, err
	}
	if !firstIngest.Valid || firstIngest.Int64 <= 0 {
		return nil, nil
	}
	value := firstIngest.Int64
	return &value, nil
}

func buildPublicWebsiteInstalls(ctx context.Context, store *controlPlaneStore) (publicWebsiteInstalls, publicWebsiteLinks) {
	result := publicWebsiteInstalls{
		Browsers: make([]publicWebsiteInstallBrowser, 0, len(deploymentTargetDefs)),
	}
	links := publicWebsiteLinks{
		GitHub: "https://github.com/" + defaultGitHubRepoSlug,
	}

	rowByKey, dataByKey, err := loadDeploymentRecords(ctx, store)
	if err != nil {
		for _, def := range deploymentTargetDefs {
			url := resolveStoreURL(def, nil)
			appendPublicStoreLink(&links, def.Key, url)
			result.Browsers = append(result.Browsers, publicWebsiteInstallBrowser{
				Key:  def.Key,
				Name: def.Name,
			})
		}
		return result, links
	}

	for _, def := range deploymentTargetDefs {
		data := buildDeploymentTargetData(def, dataByKey[def.Key])
		url := resolveStoreURL(def, dataByKey[def.Key])
		appendPublicStoreLink(&links, def.Key, url)

		usersCount := int64FromAny(data["usersCount"])
		if usersCount <= 0 {
			usersCount = parseApproxUsersCount(stringFromAny(data["users"]))
		}
		if usersCount < 0 {
			usersCount = 0
		}

		syncedAt := int64FromAny(data["syncedAt"])
		if syncedAt <= 0 {
			syncedAt = rowByKey[def.Key].UpdatedAt
		}
		if syncedAt > result.LastSyncedAtUTC {
			result.LastSyncedAtUTC = syncedAt
		}

		result.UsersTotal += usersCount
		result.Browsers = append(result.Browsers, publicWebsiteInstallBrowser{
			Key:         def.Key,
			Name:        def.Name,
			UsersCount:  usersCount,
			Version:     strings.TrimSpace(stringFromAny(data["version"])),
			Rating:      strings.TrimSpace(stringFromAny(data["rating"])),
			RatingCount: int64FromAny(data["ratingCount"]),
		})
	}

	return result, links
}

func appendPublicStoreLink(links *publicWebsiteLinks, key, value string) {
	switch key {
	case "chrome":
		links.Chrome = value
	case "firefox":
		links.Firefox = value
	case "edge":
		links.Edge = value
	}
}

func lookupBrowserVersion(browsers []publicWebsiteInstallBrowser, key string) string {
	for _, browser := range browsers {
		if browser.Key == key {
			return strings.TrimSpace(browser.Version)
		}
	}
	return ""
}

func stringPtrOrNil(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func fetchGitHubVersionCached(ctx context.Context) *string {
	cache := &githubVersionCache
	cache.mu.Lock()
	defer cache.mu.Unlock()

	if cache.version != nil && time.Since(cache.fetched) < cache.ttl {
		return cache.version
	}

	version, err := githubVersionFetcher(ctx)
	cache.fetched = time.Now()
	if err != nil {
		cache.lastErr = err
		return cache.version
	}
	cache.lastErr = nil
	cache.version = version
	return cache.version
}

func fetchLatestGitHubVersion(ctx context.Context) (*string, error) {
	repoSlug := strings.TrimSpace(os.Getenv("GITHUB_REPO_SLUG"))
	if repoSlug == "" {
		repoSlug = defaultGitHubRepoSlug
	}

	reqCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	endpoint := "https://api.github.com/repos/" + repoSlug + "/releases/latest"
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, errors.New("github api returned non-2xx status")
	}

	var payload gitHubReleaseInfo
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return nil, err
	}

	version := strings.TrimSpace(payload.TagName)
	if version == "" {
		version = strings.TrimSpace(payload.Name)
	}
	version = strings.TrimPrefix(version, "v")
	if version == "" {
		return nil, errors.New("github release payload missing version")
	}
	return &version, nil
}

func writePublicWebsiteJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", publicWebsiteCacheControl)
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func preparePublicWebsiteCORS(w http.ResponseWriter, r *http.Request) bool {
	origin := normalizeRequestOriginHeader(r.Header.Get("Origin"))
	allowAllNoOrigin := origin == ""
	allowed := resolvePublicWebsiteAllowedOrigins()

	if r.Method == http.MethodOptions {
		if !allowAllNoOrigin && !isOriginAllowed(origin, allowed) {
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return false
		}
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.WriteHeader(http.StatusNoContent)
		return false
	}

	if !allowAllNoOrigin && !isOriginAllowed(origin, allowed) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return false
	}

	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
	}
	return true
}

func resolvePublicWebsiteAllowedOrigins() map[string]struct{} {
	allowed := make(map[string]struct{}, len(defaultPublicWebsiteAllowedOrigins))
	for _, entry := range defaultPublicWebsiteAllowedOrigins {
		if normalized := normalizeRequestOriginHeader(entry); normalized != "" {
			allowed[normalized] = struct{}{}
		}
	}

	raw := strings.TrimSpace(os.Getenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS"))
	if raw == "" {
		return allowed
	}
	for _, item := range strings.Split(raw, ",") {
		if normalized := normalizeRequestOriginHeader(item); normalized != "" {
			allowed[normalized] = struct{}{}
		}
	}
	return allowed
}

func normalizeRequestOriginHeader(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return parsed.Scheme + "://" + parsed.Host
}

func isOriginAllowed(origin string, allowed map[string]struct{}) bool {
	_, ok := allowed[origin]
	return ok
}

func resetPublicWebsiteVersionCacheForTest() {
	githubVersionCache.mu.Lock()
	defer githubVersionCache.mu.Unlock()
	githubVersionCache.version = nil
	githubVersionCache.fetched = time.Time{}
	githubVersionCache.lastErr = nil
}
