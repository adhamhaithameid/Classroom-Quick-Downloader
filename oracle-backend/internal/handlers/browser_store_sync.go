package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"oracle-backend/internal/observability"
)

type deploymentTargetDef struct {
	Key          string
	Name         string
	DefaultURL   string
	StoreEnvName string
}

var deploymentTargetDefs = []deploymentTargetDef{
	{
		Key:          "chrome",
		Name:         "Chrome",
		DefaultURL:   "https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid",
		StoreEnvName: "ORACLE_CHROME_STORE_URL",
	},
	{
		Key:          "firefox",
		Name:         "Firefox",
		DefaultURL:   "https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/",
		StoreEnvName: "ORACLE_FIREFOX_STORE_URL",
	},
	{
		Key:          "edge",
		Name:         "Edge",
		DefaultURL:   "https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn",
		StoreEnvName: "ORACLE_EDGE_STORE_URL",
	},
}

var deploymentTargetAllowedHosts = map[string]map[string]struct{}{
	"chrome": {
		"chromewebstore.google.com": {},
		"chrome.google.com":         {},
	},
	"firefox": {
		"addons.mozilla.org": {},
	},
	"edge": {
		"microsoftedge.microsoft.com": {},
	},
}

var (
	storeUsersJSONPattern   = regexp.MustCompile(`"users"\s*:\s*"([^"]+)"`)
	storeVersionJSONPattern = regexp.MustCompile(`"version"\s*:\s*"([0-9][^"]{0,31})"`)
	storeUsersTextPattern   = regexp.MustCompile(`(?i)\b([0-9][0-9,.\s]*[kKmM+]?)\s*(?:users|user|downloads?)\b`)
	storeUsersTextPattern2  = regexp.MustCompile(`(?i)\b(?:users|user|downloads?)\b[^0-9]{0,24}([0-9][0-9,.\s]*[kKmM+]?)`)
	storeVersionTextPattern = regexp.MustCompile(`(?i)\bversion\b[^0-9]{0,24}([0-9]+(?:\.[0-9A-Za-z-]+){1,5})`)
	storeMetaRatingPattern  = regexp.MustCompile(`(?i)itemprop\s*=\s*["']ratingvalue["']\s+content\s*=\s*["']([0-9]+(?:\.[0-9]+)?)["']`)
	storeMetaCountPattern   = regexp.MustCompile(`(?i)itemprop\s*=\s*["']ratingcount["']\s+content\s*=\s*["']([0-9][0-9,]*)["']`)
	storeRatingTextPattern  = regexp.MustCompile(`(?i)\b([0-9]+(?:\.[0-9]+)?)\s*\(\s*([0-9][0-9,]*)\s*(?:ratings?|reviews?)\s*\)`)
	storeRatedByPattern     = regexp.MustCompile(`(?i)\brated\s+([0-9]+(?:\.[0-9]+)?)\s+by\s+([0-9][0-9,]*)\s+review`)
	edgeCRXIDPattern        = regexp.MustCompile(`^[a-z0-9]{32}$`)
	edgeUsersMetaPattern    = regexp.MustCompile(`(?i)itemprop\s*=\s*["']userinteractioncount["']\s+content\s*=\s*["']([0-9][0-9,]*)["']`)
	htmlTagPattern          = regexp.MustCompile(`<[^>]+>`)
	spaceCollapsePattern    = regexp.MustCompile(`\s+`)
)

type deploymentSyncResult struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	URL         string `json:"url"`
	Users       string `json:"users"`
	UsersCount  int64  `json:"usersCount"`
	UsersMetric string `json:"usersMetric,omitempty"`
	Version     string `json:"version"`
	Rating      string `json:"rating"`
	RatingCount int64  `json:"ratingCount"`
	SyncSource  string `json:"syncSource,omitempty"`
	Status      string `json:"status"`
	Error       string `json:"error,omitempty"`
	LatencyMS   int64  `json:"latencyMs"`
	SyncedAtUTC int64  `json:"syncedAtUtc"`
}

type storeStats struct {
	users       string
	usersCount  int64
	usersMetric string
	version     string
	rating      string
	ratingCount int64
	source      string
}

type deploymentTargetResponse struct {
	RecordKey string         `json:"recordKey"`
	Data      map[string]any `json:"data"`
	CreatedAt int64          `json:"createdAt"`
	UpdatedAt int64          `json:"updatedAt"`
}

type deploymentTargetAggregate struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	UsersCount  int64  `json:"usersCount"`
	Reviews     int64  `json:"reviews"`
	Rating      string `json:"rating"`
	Version     string `json:"version"`
	SyncedAtUTC int64  `json:"syncedAtUtc"`
}

type deploymentTargetsAggregate struct {
	UsersTotal      int64                       `json:"usersTotal"`
	ReviewsTotal    int64                       `json:"reviewsTotal"`
	Browsers        []deploymentTargetAggregate `json:"browsers"`
	LastSyncedAtUTC int64                       `json:"lastSyncedAtUtc"`
}

var (
	// Tunable in tests to keep retry behavior deterministic and fast.
	deploymentsAutoSyncMaxAttempts = 3
	deploymentsAutoSyncRetryDelay  = 10 * time.Second
)

func normalizeDeploymentsAutoSyncAttempts(value int) int {
	if value < 1 {
		return 1
	}
	if value > 10 {
		return 10
	}
	return value
}

func normalizeDeploymentsAutoSyncRetryDelay(value time.Duration) time.Duration {
	if value < time.Second {
		return time.Second
	}
	if value > 5*time.Minute {
		return 5 * time.Minute
	}
	return value
}

func findTargetDef(key string) (deploymentTargetDef, bool) {
	for _, item := range deploymentTargetDefs {
		if item.Key == key {
			return item, true
		}
	}
	return deploymentTargetDef{}, false
}

func buildDeploymentTargetData(def deploymentTargetDef, existing map[string]any) map[string]any {
	out := map[string]any{
		"name": def.Name,
		"url":  resolveStoreURL(def, existing),
	}
	for k, v := range existing {
		out[k] = v
	}
	if _, ok := out["name"]; !ok || strings.TrimSpace(fmt.Sprintf("%v", out["name"])) == "" {
		out["name"] = def.Name
	}
	if _, ok := out["url"]; !ok || strings.TrimSpace(fmt.Sprintf("%v", out["url"])) == "" {
		out["url"] = resolveStoreURL(def, existing)
	}
	return out
}

func resolveStoreURL(def deploymentTargetDef, existing map[string]any) string {
	if existing != nil {
		if current, ok := existing["url"].(string); ok && strings.HasPrefix(strings.TrimSpace(current), "http") {
			return strings.TrimSpace(current)
		}
	}
	if configured := strings.TrimSpace(os.Getenv(def.StoreEnvName)); strings.HasPrefix(configured, "http") {
		return configured
	}
	return def.DefaultURL
}

func loadDeploymentRecords(ctx context.Context, store *controlPlaneStore) (map[string]controlPlaneRecordRow, map[string]map[string]any, error) {
	rows, err := store.listRecords(ctx, "deployment_target")
	if err != nil {
		return nil, nil, err
	}
	rowByKey := make(map[string]controlPlaneRecordRow, len(rows))
	dataByKey := make(map[string]map[string]any, len(rows))
	for _, row := range rows {
		rowByKey[row.RecordKey] = row
		m := map[string]any{}
		if len(row.Data) > 0 {
			_ = json.Unmarshal(row.Data, &m)
		}
		dataByKey[row.RecordKey] = m
	}
	return rowByKey, dataByKey, nil
}

func summarizeDeploymentTargets(targets []deploymentTargetResponse) deploymentTargetsAggregate {
	summary := deploymentTargetsAggregate{
		Browsers: make([]deploymentTargetAggregate, 0, len(targets)),
	}
	for _, target := range targets {
		data := target.Data
		usersCount := int64FromAny(data["usersCount"])
		if usersCount <= 0 {
			usersCount = parseApproxUsersCount(stringFromAny(data["users"]))
		}
		if usersCount < 0 {
			usersCount = 0
		}

		reviewsCount := int64FromAny(data["ratingCount"])
		if reviewsCount < 0 {
			reviewsCount = 0
		}

		syncedAtUTC := int64FromAny(data["syncedAt"])
		if syncedAtUTC <= 0 {
			syncedAtUTC = target.UpdatedAt
		}

		name := stringFromAny(data["name"])
		if name == "" {
			name = target.RecordKey
		}

		summary.UsersTotal += usersCount
		summary.ReviewsTotal += reviewsCount
		if syncedAtUTC > summary.LastSyncedAtUTC {
			summary.LastSyncedAtUTC = syncedAtUTC
		}

		summary.Browsers = append(summary.Browsers, deploymentTargetAggregate{
			Key:         target.RecordKey,
			Name:        name,
			UsersCount:  usersCount,
			Reviews:     reviewsCount,
			Rating:      stringFromAny(data["rating"]),
			Version:     stringFromAny(data["version"]),
			SyncedAtUTC: syncedAtUTC,
		})
	}

	sort.Slice(summary.Browsers, func(i, j int) bool {
		if summary.Browsers[i].UsersCount == summary.Browsers[j].UsersCount {
			return summary.Browsers[i].Key < summary.Browsers[j].Key
		}
		return summary.Browsers[i].UsersCount > summary.Browsers[j].UsersCount
	})

	return summary
}

func DeploymentsTargetsHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if sqliteDB != nil && !ensureFeatureEnabled(w, r, sqliteDB, "feature_management_hub_enabled") {
			return
		}

		rowByKey, dataByKey, err := loadDeploymentRecords(r.Context(), store)
		if err != nil {
			http.Error(w, "failed to load deployment targets", http.StatusInternalServerError)
			return
		}

		targets := make([]deploymentTargetResponse, 0, len(deploymentTargetDefs))
		for _, def := range deploymentTargetDefs {
			existing := dataByKey[def.Key]
			data := buildDeploymentTargetData(def, existing)
			row := rowByKey[def.Key]
			targets = append(targets, deploymentTargetResponse{
				RecordKey: def.Key,
				Data:      data,
				CreatedAt: row.CreatedAt,
				UpdatedAt: row.UpdatedAt,
			})
		}
		aggregates := summarizeDeploymentTargets(targets)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":         true,
			"targets":    targets,
			"aggregates": aggregates,
		})
	}
}

func DeploymentsSyncHandler(sqliteDB, postgresDB *sql.DB, metrics *observability.Registry) http.HandlerFunc {
	client := &http.Client{Timeout: 15 * time.Second}
	return deploymentsSyncHandlerWithClient(sqliteDB, postgresDB, client, metrics)
}

func deploymentsSyncHandlerWithClient(sqliteDB, postgresDB *sql.DB, client *http.Client, metrics *observability.Registry) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if sqliteDB != nil && !ensureFeatureEnabled(w, r, sqliteDB, "feature_management_hub_enabled") {
			return
		}
		if sqliteDB != nil && !ensureFeatureEnabled(w, r, sqliteDB, "feature_sync_enabled") {
			return
		}

		var req struct {
			Targets []string `json:"targets"`
			DryRun  bool     `json:"dryRun"`
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil && err != io.EOF {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		targetSet := map[string]struct{}{}
		if len(req.Targets) == 0 {
			for _, def := range deploymentTargetDefs {
				targetSet[def.Key] = struct{}{}
			}
		} else {
			for _, key := range req.Targets {
				k := strings.TrimSpace(strings.ToLower(key))
				if _, ok := findTargetDef(k); !ok {
					http.Error(w, "unknown deployment target: "+k, http.StatusBadRequest)
					return
				}
				targetSet[k] = struct{}{}
			}
		}

		results, okCount, err := syncDeploymentTargets(r.Context(), store, sqliteDB, client, metrics, targetSet, req.DryRun, true)
		if err != nil {
			http.Error(w, "failed to load deployment targets", http.StatusInternalServerError)
			return
		}

		if sqliteDB != nil {
			action := "deployment_sync"
			if req.DryRun {
				action = "deployment_sync_dryrun"
			}
			if !appendAuditLogOrHTTPError(
				w,
				r.Context(),
				sqliteDB,
				action,
				"deployment_target",
				"bulk",
				"ok",
				map[string]any{
					"targets": len(results),
					"ok":      okCount,
					"dryRun":  req.DryRun,
				},
			) {
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"dryRun":  req.DryRun,
			"count":   len(results),
			"okCount": okCount,
			"results": results,
		})
	}
}

func syncDeploymentTargets(
	ctx context.Context,
	store *controlPlaneStore,
	sqliteDB *sql.DB,
	client *http.Client,
	metrics *observability.Registry,
	targetSet map[string]struct{},
	dryRun bool,
	emitAlerts bool,
) ([]deploymentSyncResult, int64, error) {
	_, dataByKey, err := loadDeploymentRecords(ctx, store)
	if err != nil {
		return nil, 0, err
	}

	results := make([]deploymentSyncResult, 0, len(targetSet))
	var okCount int64
	nowMs := time.Now().UnixMilli()
	for _, def := range deploymentTargetDefs {
		if _, selected := targetSet[def.Key]; !selected {
			continue
		}

		existing := dataByKey[def.Key]
		data := buildDeploymentTargetData(def, existing)
		targetURL, _ := data["url"].(string)
		targetURL = strings.TrimSpace(targetURL)
		start := time.Now()

		stats, syncErr := fetchAndParseStoreStats(ctx, client, def.Key, targetURL)
		latencyMs := time.Since(start).Milliseconds()

		result := deploymentSyncResult{
			Key:         def.Key,
			Name:        def.Name,
			URL:         targetURL,
			Users:       stats.users,
			UsersCount:  stats.usersCount,
			UsersMetric: stats.usersMetric,
			Version:     stats.version,
			Rating:      stats.rating,
			RatingCount: stats.ratingCount,
			SyncSource:  stats.source,
			LatencyMS:   latencyMs,
			SyncedAtUTC: nowMs,
		}

		if syncErr != nil {
			result.Status = "error"
			result.Error = truncateAlertError(syncErr.Error())
			data["syncStatus"] = "error"
			data["syncError"] = result.Error
			data["syncLatencyMs"] = latencyMs
			data["syncedAt"] = nowMs
			if emitAlerts && sqliteDB != nil {
				_ = upsertOpenAlert(
					ctx,
					sqliteDB,
					"deployment_sync_failed",
					"warning",
					"deployment store sync failed",
					map[string]any{"target": def.Key, "error": result.Error},
				)
			}
		} else {
			result.Status = "ok"
			if strings.TrimSpace(stats.users) != "" {
				data["users"] = strings.TrimSpace(stats.users)
				data["usersCount"] = stats.usersCount
				if stats.usersMetric != "" {
					data["usersMetric"] = stats.usersMetric
				}
			}
			if strings.TrimSpace(stats.version) != "" {
				data["version"] = strings.TrimSpace(stats.version)
			}
			if strings.TrimSpace(stats.rating) != "" {
				data["rating"] = strings.TrimSpace(stats.rating)
				data["ratingCount"] = stats.ratingCount
			}
			data["syncStatus"] = "ok"
			data["syncError"] = ""
			data["syncLatencyMs"] = latencyMs
			data["syncedAt"] = nowMs

			result.Users = stringFromAny(data["users"])
			result.UsersCount = int64FromAny(data["usersCount"])
			result.Version = stringFromAny(data["version"])
			result.Rating = stringFromAny(data["rating"])
			result.RatingCount = int64FromAny(data["ratingCount"])
		}

		persisted := dryRun
		if !dryRun {
			if err := store.upsertRecord(ctx, "deployment_target", def.Key, data); err != nil {
				result.Status = "error"
				result.Error = "failed to persist sync result"
			} else {
				persisted = true
			}
		}

		if syncErr == nil && persisted {
			okCount++
			if metrics != nil && !dryRun {
				metrics.SetGauge(
					"oracle_sync_duration_seconds",
					map[string]string{"endpoint": def.Key},
					float64(latencyMs)/1000.0,
				)
				metrics.SetGauge(
					"oracle_sync_last_success_timestamp_seconds",
					map[string]string{"endpoint": def.Key},
					float64(nowMs)/1000.0,
				)
			}
		}

		results = append(results, result)
	}

	return results, okCount, nil
}

func fetchAndParseStoreStats(ctx context.Context, client *http.Client, key, url string) (storeStats, error) {
	if err := validateStoreURL(key, url); err != nil {
		return storeStats{}, err
	}
	if key == "edge" {
		stats, err := fetchEdgeStoreStatsByDetailsAPI(ctx, client, url)
		if err == nil {
			return stats, nil
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return storeStats{}, err
	}
	req.Header.Set("User-Agent", "oracle-dashboard-sync/1.0")
	// #nosec G704 -- URL is validated by validateStoreURL (scheme + host allowlist, with explicit opt-in overrides).
	resp, err := client.Do(req)
	if err != nil {
		return storeStats{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return storeStats{}, fmt.Errorf("store request failed with status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return storeStats{}, err
	}

	stats := parseStoreStatsFullFromHTML(key, string(body))
	if stats.users == "" && stats.version == "" && stats.rating == "" {
		return storeStats{}, fmt.Errorf("could not parse users/version/rating from store page")
	}
	if stats.users != "" && stats.usersCount == 0 {
		stats.usersCount = parseApproxUsersCount(stats.users)
	}
	return stats, nil
}

func fetchEdgeStoreStatsByDetailsAPI(ctx context.Context, client *http.Client, listingURL string) (storeStats, error) {
	parsed, err := url.Parse(strings.TrimSpace(listingURL))
	if err != nil {
		return storeStats{}, err
	}
	crxID := extractEdgeCRXIDFromPath(parsed.Path)
	if crxID == "" {
		return storeStats{}, fmt.Errorf("edge listing URL missing CRX id")
	}

	detailsURL := fmt.Sprintf("%s://%s/addons/getproductdetailsbycrxid/%s?hl=en-US&gl=US", parsed.Scheme, parsed.Host, crxID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, detailsURL, nil)
	if err != nil {
		return storeStats{}, err
	}
	req.Header.Set("User-Agent", "oracle-dashboard-sync/1.0")
	resp, err := client.Do(req) // #nosec G107,G704 -- URL host/scheme are inherited from validated edge listing URL.
	if err != nil {
		return storeStats{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return storeStats{}, fmt.Errorf("edge details request failed with status %d", resp.StatusCode)
	}

	var payload struct {
		ActiveInstallCount float64 `json:"activeInstallCount"`
		AverageRating      float64 `json:"averageRating"`
		RatingCount        float64 `json:"ratingCount"`
		Version            string  `json:"version"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 512*1024)).Decode(&payload); err != nil {
		return storeStats{}, err
	}

	stats := storeStats{
		version: strings.TrimSpace(payload.Version),
	}
	if payload.ActiveInstallCount >= 0 {
		stats.usersCount = int64(payload.ActiveInstallCount)
		stats.users = strconv.FormatInt(stats.usersCount, 10)
	}
	if payload.AverageRating > 0 {
		stats.rating = formatRating(payload.AverageRating)
	}
	if payload.RatingCount >= 0 {
		stats.ratingCount = int64(payload.RatingCount)
	}
	if stats.users == "" && stats.version == "" && stats.rating == "" {
		return storeStats{}, fmt.Errorf("edge details payload missing metrics")
	}
	return stats, nil
}

func extractEdgeCRXIDFromPath(pathValue string) string {
	segments := strings.Split(strings.Trim(path.Clean(pathValue), "/"), "/")
	for i := len(segments) - 1; i >= 0; i-- {
		candidate := strings.TrimSpace(strings.ToLower(segments[i]))
		if edgeCRXIDPattern.MatchString(candidate) {
			return candidate
		}
	}
	return ""
}

func validateStoreURL(key, rawURL string) error {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return fmt.Errorf("target URL is not configured")
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return fmt.Errorf("target URL is invalid")
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return fmt.Errorf("target URL must use http/https")
	}
	if parsed.Scheme == "http" && os.Getenv("ORACLE_ALLOW_HTTP_STORE_URLS") != "true" {
		return fmt.Errorf("target URL must use https")
	}
	if parsed.Host == "" {
		return fmt.Errorf("target URL host is missing")
	}
	if os.Getenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS") == "true" {
		return nil
	}

	host := strings.ToLower(parsed.Hostname())
	allowed := deploymentTargetAllowedHosts[key]
	if len(allowed) == 0 {
		return fmt.Errorf("target has no allowed host configuration")
	}
	if _, ok := allowed[host]; !ok {
		return fmt.Errorf("target URL host is not allowed for %s", key)
	}
	return nil
}

func parseStoreStatsFromHTML(key, html string) (string, string) {
	stats := parseStoreStatsFullFromHTML(key, html)
	return stats.users, stats.version
}

func parseStoreStatsFullFromHTML(key, html string) storeStats {
	users := extractStoreUsers(html)
	version := extractStoreVersion(html)
	rating, ratingCount := extractStoreRating(html)
	if users != "" || version != "" || rating != "" {
		return storeStats{
			users:       users,
			usersCount:  parseApproxUsersCount(users),
			version:     version,
			rating:      rating,
			ratingCount: ratingCount,
		}
	}

	plain := spaceCollapsePattern.ReplaceAllString(htmlTagPattern.ReplaceAllString(html, " "), " ")
	users = extractStoreUsers(plain)
	version = extractStoreVersion(plain)
	rating, ratingCount = extractStoreRating(plain)

	stats := storeStats{
		users:       users,
		usersCount:  parseApproxUsersCount(users),
		version:     version,
		rating:      rating,
		ratingCount: ratingCount,
	}
	if key == "edge" && stats.users == "" {
		if usersMeta := extractStoreUsersFromEdgeMeta(html); usersMeta != "" {
			stats.users = usersMeta
			stats.usersCount = parseApproxUsersCount(usersMeta)
		}
	}
	return stats
}

func extractStoreUsers(input string) string {
	if match := storeUsersJSONPattern.FindStringSubmatch(input); len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	if match := storeUsersTextPattern.FindStringSubmatch(input); len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	if match := storeUsersTextPattern2.FindStringSubmatch(input); len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	return ""
}

func extractStoreVersion(input string) string {
	if match := storeVersionJSONPattern.FindStringSubmatch(input); len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	if match := storeVersionTextPattern.FindStringSubmatch(input); len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	return ""
}

func extractStoreRating(input string) (string, int64) {
	var (
		rating      string
		ratingCount int64
	)

	if match := storeMetaRatingPattern.FindStringSubmatch(input); len(match) > 1 {
		rating = normalizeRating(match[1])
	}
	if match := storeMetaCountPattern.FindStringSubmatch(input); len(match) > 1 {
		ratingCount = parseApproxUsersCount(match[1])
	}
	if rating != "" {
		return rating, ratingCount
	}

	if match := storeRatingTextPattern.FindStringSubmatch(input); len(match) > 2 {
		rating = normalizeRating(match[1])
		ratingCount = parseApproxUsersCount(match[2])
		return rating, ratingCount
	}
	if match := storeRatedByPattern.FindStringSubmatch(input); len(match) > 2 {
		rating = normalizeRating(match[1])
		ratingCount = parseApproxUsersCount(match[2])
		return rating, ratingCount
	}
	return "", 0
}

func extractStoreUsersFromEdgeMeta(input string) string {
	if match := edgeUsersMetaPattern.FindStringSubmatch(input); len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	return ""
}

func normalizeRating(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	f, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return ""
	}
	return formatRating(f)
}

func formatRating(value float64) string {
	if value <= 0 {
		return ""
	}
	return strconv.FormatFloat(value, 'f', 1, 64)
}

func parseApproxUsersCount(users string) int64 {
	v := strings.ToLower(strings.TrimSpace(users))
	if v == "" {
		return 0
	}
	v = strings.ReplaceAll(v, ",", "")
	v = strings.ReplaceAll(v, " ", "")
	v = strings.TrimSuffix(v, "+")
	mult := float64(1)
	if strings.HasSuffix(v, "k") {
		mult = 1_000
		v = strings.TrimSuffix(v, "k")
	}
	if strings.HasSuffix(v, "m") {
		mult = 1_000_000
		v = strings.TrimSuffix(v, "m")
	}
	n, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return 0
	}
	return int64(n * mult)
}

func stringFromAny(value any) string {
	if value == nil {
		return ""
	}
	if s, ok := value.(string); ok {
		return strings.TrimSpace(s)
	}
	v := strings.TrimSpace(fmt.Sprintf("%v", value))
	if v == "<nil>" {
		return ""
	}
	return v
}

func int64FromAny(value any) int64 {
	switch v := value.(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case int32:
		return int64(v)
	case float64:
		return int64(v)
	case float32:
		return int64(v)
	case json.Number:
		i, err := v.Int64()
		if err == nil {
			return i
		}
	case string:
		return parseApproxUsersCount(v)
	}
	return parseApproxUsersCount(fmt.Sprintf("%v", value))
}

func StartDeploymentsAutoSyncLoop(
	ctx context.Context,
	sqliteDB, postgresDB *sql.DB,
	metrics *observability.Registry,
	interval time.Duration,
) {
	if interval <= 0 {
		interval = 15 * time.Minute
	}

	store := newControlPlaneStore(sqliteDB, postgresDB)
	client := &http.Client{Timeout: 15 * time.Second}
	maxAttempts := normalizeDeploymentsAutoSyncAttempts(deploymentsAutoSyncMaxAttempts)
	retryDelay := normalizeDeploymentsAutoSyncRetryDelay(deploymentsAutoSyncRetryDelay)

	runOnce := func() {
		if sqliteDB != nil {
			managementEnabled, err := IsFeatureEnabled(ctx, sqliteDB, "feature_management_hub_enabled")
			if err != nil || !managementEnabled {
				return
			}
			syncEnabled, err := IsFeatureEnabled(ctx, sqliteDB, "feature_sync_enabled")
			if err != nil || !syncEnabled {
				return
			}
		}

		targetSet := make(map[string]struct{}, len(deploymentTargetDefs))
		targetKeys := make([]string, 0, len(deploymentTargetDefs))
		for _, def := range deploymentTargetDefs {
			targetSet[def.Key] = struct{}{}
			targetKeys = append(targetKeys, def.Key)
		}
		sort.Strings(targetKeys)

		var (
			results      []deploymentSyncResult
			okCount      int64
			err          error
			attemptsUsed int
		)
		for attempt := 1; attempt <= maxAttempts; attempt++ {
			attemptsUsed = attempt
			runCtx, cancel := context.WithTimeout(ctx, 40*time.Second)
			results, okCount, err = syncDeploymentTargets(runCtx, store, sqliteDB, client, metrics, targetSet, false, true)
			cancel()
			// Any successful target means sync made progress; keep regular schedule.
			if err == nil && (okCount > 0 || len(results) == 0) {
				break
			}
			if attempt < maxAttempts {
				log.Printf(
					"[Scheduler] deployment auto-sync attempt %d/%d failed (ok=%d total=%d err=%v); retrying in %s",
					attempt,
					maxAttempts,
					okCount,
					len(results),
					err,
					retryDelay,
				)
				select {
				case <-ctx.Done():
					return
				case <-time.After(retryDelay):
				}
				continue
			}
		}

		resultState := "ok"
		if err != nil || (len(results) > 0 && okCount == 0) {
			resultState = "error"
		} else if int64(len(results)) != okCount {
			resultState = "partial"
		}
		log.Printf(
			"[Scheduler] deployment auto-sync completed: state=%s ok=%d total=%d attempts=%d targets=%s",
			resultState,
			okCount,
			len(results),
			attemptsUsed,
			strings.Join(targetKeys, ","),
		)

		if sqliteDB != nil {
			payload := map[string]any{
				"targets":   len(results),
				"ok":        okCount,
				"automatic": true,
				"attempts":  attemptsUsed,
				"interval":  interval.String(),
			}
			if err != nil {
				payload["error"] = truncateAlertError(err.Error())
			}
			auditCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			if err := AppendAuditLog(auditCtx, sqliteDB, "deployment_sync_auto", "deployment_target", "bulk", resultState, payload); err != nil {
				log.Printf("[Scheduler] deployment auto-sync audit write failed: %v", err)
			}
			cancel()
		}
	}

	runOnce()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runOnce()
		}
	}
}
