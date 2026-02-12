package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
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
		DefaultURL:   "https://chromewebstore.google.com/",
		StoreEnvName: "ORACLE_CHROME_STORE_URL",
	},
	{
		Key:          "firefox",
		Name:         "Firefox",
		DefaultURL:   "https://addons.mozilla.org/",
		StoreEnvName: "ORACLE_FIREFOX_STORE_URL",
	},
	{
		Key:          "edge",
		Name:         "Edge",
		DefaultURL:   "https://microsoftedge.microsoft.com/addons/",
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
	htmlTagPattern          = regexp.MustCompile(`<[^>]+>`)
	spaceCollapsePattern    = regexp.MustCompile(`\s+`)
)

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

		type deploymentTargetResponse struct {
			RecordKey string         `json:"recordKey"`
			Data      map[string]any `json:"data"`
			CreatedAt int64          `json:"createdAt"`
			UpdatedAt int64          `json:"updatedAt"`
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

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"targets": targets,
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

		_, dataByKey, err := loadDeploymentRecords(r.Context(), store)
		if err != nil {
			http.Error(w, "failed to load deployment targets", http.StatusInternalServerError)
			return
		}

		type syncResult struct {
			Key         string `json:"key"`
			Name        string `json:"name"`
			URL         string `json:"url"`
			Users       string `json:"users"`
			UsersCount  int64  `json:"usersCount"`
			Version     string `json:"version"`
			Status      string `json:"status"`
			Error       string `json:"error,omitempty"`
			LatencyMS   int64  `json:"latencyMs"`
			SyncedAtUTC int64  `json:"syncedAtUtc"`
		}
		results := make([]syncResult, 0, len(targetSet))
		var okCount int64
		nowMs := time.Now().UnixMilli()

		for _, def := range deploymentTargetDefs {
			if _, selected := targetSet[def.Key]; !selected {
				continue
			}
			existing := dataByKey[def.Key]
			data := buildDeploymentTargetData(def, existing)
			url, _ := data["url"].(string)
			url = strings.TrimSpace(url)
			start := time.Now()

			users, usersCount, version, syncErr := fetchAndParseStoreStats(r.Context(), client, def.Key, url)
			latencyMs := time.Since(start).Milliseconds()
			result := syncResult{
				Key:         def.Key,
				Name:        def.Name,
				URL:         url,
				Users:       users,
				UsersCount:  usersCount,
				Version:     version,
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
				if sqliteDB != nil {
					_ = upsertOpenAlert(
						r.Context(),
						sqliteDB,
						"deployment_sync_failed",
						"warning",
						"deployment store sync failed",
						map[string]any{"target": def.Key, "error": result.Error},
					)
				}
			} else {
				result.Status = "ok"
				data["users"] = users
				data["usersCount"] = usersCount
				data["version"] = version
				data["syncStatus"] = "ok"
				data["syncError"] = ""
				data["syncLatencyMs"] = latencyMs
				data["syncedAt"] = nowMs
			}

			persisted := req.DryRun
			if !req.DryRun {
				if err := store.upsertRecord(r.Context(), "deployment_target", def.Key, data); err != nil {
					result.Status = "error"
					result.Error = "failed to persist sync result"
				} else {
					persisted = true
				}
			}

			if syncErr == nil && persisted {
				okCount++
				if metrics != nil && !req.DryRun {
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

		if sqliteDB != nil {
			action := "deployment_sync"
			if req.DryRun {
				action = "deployment_sync_dryrun"
			}
			_ = AppendAuditLog(
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
			)
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

func fetchAndParseStoreStats(ctx context.Context, client *http.Client, key, url string) (string, int64, string, error) {
	if err := validateStoreURL(key, url); err != nil {
		return "", 0, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", 0, "", err
	}
	req.Header.Set("User-Agent", "oracle-dashboard-sync/1.0")
	// #nosec G704 -- URL is validated by validateStoreURL (scheme + host allowlist, with explicit opt-in overrides).
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return "", 0, "", fmt.Errorf("store request failed with status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return "", 0, "", err
	}

	users, version := parseStoreStatsFromHTML(key, string(body))
	if users == "" && version == "" {
		return "", 0, "", fmt.Errorf("could not parse users/version from store page")
	}
	usersCount := parseApproxUsersCount(users)
	return users, usersCount, version, nil
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
	users := extractStoreUsers(html)
	version := extractStoreVersion(html)
	if users != "" || version != "" {
		return users, version
	}

	plain := spaceCollapsePattern.ReplaceAllString(htmlTagPattern.ReplaceAllString(html, " "), " ")
	return extractStoreUsers(plain), extractStoreVersion(plain)
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
