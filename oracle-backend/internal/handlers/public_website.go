package handlers

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	publicWebsiteCacheControl            = "public, max-age=120, stale-while-revalidate=60"
	publicWebsiteSchemaVersion           = "1"
	defaultGitHubRepoSlug                = "adhamhaithameid/Classroom-Quick-Downloader"
	publicWebsiteUserChangelogRecordType = "website_user_changelog_entry"
	publicWebsiteUserChangelogConfigType = "website_user_changelog_config"
	publicWebsitePrivacyRecordType       = "website_user_privacy"
	publicWebsiteEventsBodyLimitBytes    = 128 << 10 // 128 KiB
	publicWebsiteEventsMaxPerRequest     = 64
	publicWebsiteMetaJSONMaxBytes        = 4 << 10 // 4 KiB
	publicWebsiteRawEventJSONMaxBytes    = 8 << 10 // 8 KiB
	publicWebsiteSnapshotRefreshInterval = 3 * time.Hour
	publicWebsiteSnapshotPayloadMaxBytes = 2 << 20 // 2 MiB
)

var (
	isoCountryCodePattern = regexp.MustCompile(`^[A-Z]{2}$`)
	websiteEventIDPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{6,120}$`)

	defaultPublicWebsiteAllowedOrigins = []string{
		"https://adhamhaithameid.github.io",
		"https://classroom-quick-downloader-website.pages.dev",
		"https://not-stable.classroom-quick-downloader-website.pages.dev",
		"https://classroom-quick-downloader.pages.dev",
		"http://localhost:5173",
		"http://127.0.0.1:5173",
	}

	publicWebsiteEventActionToType = map[string]string{
		"install_click":  "cta",
		"download_click": "cta",
		"map_yes":        "map",
		"map_no":         "map",
	}

	publicWebsiteEventAllowedPlacements = map[string]struct{}{
		"nav_install":                 {},
		"nav_mobile_install":          {},
		"footer_download":             {},
		"hero_install":                {},
		"hero_download":               {},
		"final_install":               {},
		"final_download":              {},
		"map_prompt_yes":              {},
		"map_prompt_no":               {},
		"map_prompt_install":          {},
		"uninstall_reinstall_chrome":  {},
		"uninstall_reinstall_firefox": {},
		"uninstall_reinstall_edge":    {},
		"website_link_header":         {},
		"website_link_footer":         {},
	}

	publicWebsiteSnapshotBuildMu sync.Mutex
)

type publicWebsiteOverviewResponse struct {
	SchemaVersion string                `json:"schemaVersion"`
	OK            bool                  `json:"ok"`
	GeneratedAt   int64                 `json:"generatedAt"`
	Totals        publicWebsiteTotals   `json:"totals"`
	Installs      publicWebsiteInstalls `json:"installs"`
	Versions      publicWebsiteVersions `json:"versions"`
	Status        publicWebsiteStatus   `json:"status"`
	Links         publicWebsiteLinks    `json:"links"`
}

type publicWebsiteStatusResponse struct {
	SchemaVersion string              `json:"schemaVersion"`
	OK            bool                `json:"ok"`
	GeneratedAt   int64               `json:"generatedAt"`
	Status        publicWebsiteStatus `json:"status"`
}

type publicWebsiteMapResponse struct {
	SchemaVersion string                     `json:"schemaVersion"`
	OK            bool                       `json:"ok"`
	GeneratedAt   int64                      `json:"generatedAt"`
	Granularity   string                     `json:"granularity"`
	Countries     []publicWebsiteCountryCell `json:"countries"`
	Totals        publicWebsiteMapTotals     `json:"totals"`
	PrivacyNote   string                     `json:"privacyNote"`
}

type publicWebsiteSnapshotResponse struct {
	SchemaVersion        string                             `json:"schemaVersion"`
	OK                   bool                               `json:"ok"`
	GeneratedAt          int64                              `json:"generatedAt"`
	SnapshotID           string                             `json:"snapshotId"`
	Overview             publicWebsiteOverviewResponse      `json:"overview"`
	Map                  publicWebsiteMapResponse           `json:"map"`
	Changelog            publicWebsiteUserChangelogResponse `json:"changelog"`
	UserChangelogSummary publicWebsiteChangelogSummary      `json:"userChangelogSummary"`
	Privacy              publicWebsitePrivacyPointers       `json:"privacy"`
}

type publicWebsiteChangelogSummary struct {
	Headline         string `json:"headline"`
	Description      string `json:"description"`
	EntriesCount     int    `json:"entriesCount"`
	LastUpdatedAtUTC *int64 `json:"lastUpdatedAtUtc"`
	FullChangelogURL string `json:"fullChangelogUrl"`
}

type publicWebsitePrivacyPointers struct {
	Headline       string `json:"headline"`
	Description    string `json:"description"`
	UserPrivacyURL string `json:"userPrivacyUrl"`
	FullPrivacyURL string `json:"fullPrivacyUrl"`
}

type publicWebsiteUserChangelogResponse struct {
	SchemaVersion    string                            `json:"schemaVersion"`
	OK               bool                              `json:"ok"`
	GeneratedAt      int64                             `json:"generatedAt"`
	Source           string                            `json:"source"`
	SourceURL        string                            `json:"sourceUrl,omitempty"`
	Headline         string                            `json:"headline"`
	Description      string                            `json:"description"`
	Entries          []publicWebsiteUserChangelogEntry `json:"entries"`
	FullChangelogURL string                            `json:"fullChangelogUrl"`
	LastUpdatedAtUTC *int64                            `json:"lastUpdatedAtUtc"`
}

type publicWebsiteUserChangelogEntry struct {
	ID            string   `json:"id"`
	Version       string   `json:"version"`
	Title         string   `json:"title"`
	Summary       string   `json:"summary"`
	Highlights    []string `json:"highlights"`
	ReleasedAtUTC *int64   `json:"releasedAtUtc"`
}

type userFriendlyMarkdownRelease struct {
	Version string
	Summary string
	Added   []string
	Changed []string
	Fixed   []string
}

type publicWebsiteUserChangelogConfig struct {
	Source      string
	MarkdownURL string
}

type publicWebsiteUninstallRequest struct {
	Reason  string `json:"reason"`
	Browser string `json:"browser"`
	Version string `json:"version"`
	Source  string `json:"source"`
	Notes   string `json:"notes"`
}

type publicWebsiteUninstallResponse struct {
	SchemaVersion string `json:"schemaVersion"`
	OK            bool   `json:"ok"`
	GeneratedAt   int64  `json:"generatedAt"`
	SubmissionID  int64  `json:"submissionId"`
	Message       string `json:"message"`
}

type publicWebsiteUninstallStatsResponse struct {
	SchemaVersion string                      `json:"schemaVersion"`
	OK            bool                        `json:"ok"`
	GeneratedAt   int64                       `json:"generatedAt"`
	Stats         publicWebsiteUninstallStats `json:"stats"`
}

type publicWebsiteUninstallStats struct {
	TotalSubmissions   int64                      `json:"totalSubmissions"`
	LastSubmittedAtUTC *int64                     `json:"lastSubmittedAtUtc"`
	TopReasons         []publicWebsiteReasonCount `json:"topReasons"`
}

type publicWebsiteReasonCount struct {
	Reason string `json:"reason"`
	Count  int64  `json:"count"`
}

type publicWebsiteEventsIngestRequest struct {
	SchemaVersion string                          `json:"schemaVersion"`
	SessionID     string                          `json:"sessionId"`
	PagePath      string                          `json:"pagePath"`
	Events        []publicWebsiteEventIngestEvent `json:"events"`
}

type publicWebsiteEventIngestEvent struct {
	EventID   string         `json:"eventId"`
	EventType string         `json:"eventType"`
	Action    string         `json:"action"`
	Placement string         `json:"placement"`
	TSUTC     *int64         `json:"tsUtc,omitempty"`
	Meta      map[string]any `json:"meta,omitempty"`
}

type publicWebsiteEventsIngestResponse struct {
	SchemaVersion string `json:"schemaVersion"`
	OK            bool   `json:"ok"`
	GeneratedAt   int64  `json:"generatedAt"`
	AcceptedCount int    `json:"acceptedCount"`
	RejectedCount int    `json:"rejectedCount"`
}

type publicWebsiteEventsBatchIngestRequest struct {
	SchemaVersion  string                          `json:"schemaVersion"`
	BatchID        string                          `json:"batchId"`
	BatchChecksum  string                          `json:"batchChecksum,omitempty"`
	ExpectedEvents *int                            `json:"expectedEventCount,omitempty"`
	GeneratedAtUTC int64                           `json:"generatedAtUtc"`
	Attempt        int                             `json:"attempt"`
	SessionID      string                          `json:"sessionId"`
	PagePath       string                          `json:"pagePath"`
	Events         []publicWebsiteEventIngestEvent `json:"events"`
}

type publicWebsiteEventsBatchIngestResponse struct {
	SchemaVersion string `json:"schemaVersion"`
	OK            bool   `json:"ok"`
	BatchID       string `json:"batchId"`
	GeneratedAt   int64  `json:"generatedAt"`
	AcceptedCount int    `json:"acceptedCount"`
	RejectedCount int    `json:"rejectedCount"`
	Checksum      string `json:"checksum,omitempty"`
	ChecksumState string `json:"checksumStatus,omitempty"`
	RowCountState string `json:"rowCountStatus,omitempty"`
	Integrity     string `json:"integrityStatus,omitempty"`
}

type publicWebsiteErrorEnvelope struct {
	SchemaVersion string                  `json:"schemaVersion"`
	OK            bool                    `json:"ok"`
	Error         publicWebsiteErrorShape `json:"error"`
}

type publicWebsiteErrorShape struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

type websiteEventsIngestMetadata struct {
	Source         string
	BatchID        string
	TriggeredBy    string
	Attempt        int
	SessionID      string
	PagePath       string
	GeneratedAtUTC int64
	CorrelationID  string
	BatchChecksum  string
	ExpectedEvents *int
}

type websiteEventsIngestResult struct {
	Accepted       int
	Rejected       int
	Received       int
	Accounted      int
	BatchChecksum  string
	ChecksumStatus string
	RowCountStatus string
	Integrity      string
	IntegrityNotes []string
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

func PublicWebsiteOverviewHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods: "GET, OPTIONS",
		}) {
			return
		}
		if r.Method != http.MethodGet {
			writePublicWebsiteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is allowed for this endpoint.", false)
			return
		}

		snapshot, err := loadOrRefreshPublicWebsiteSnapshot(r.Context(), sqliteDB, postgresDB, false)
		if err != nil {
			writePublicWebsiteError(w, http.StatusInternalServerError, "snapshot_build_failed", "Failed to build public website overview.", true)
			return
		}

		writePublicWebsiteJSON(w, http.StatusOK, snapshot.Overview)
	}
}

func PublicWebsiteMapHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods: "GET, OPTIONS",
		}) {
			return
		}
		if r.Method != http.MethodGet {
			writePublicWebsiteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is allowed for this endpoint.", false)
			return
		}

		snapshot, err := loadOrRefreshPublicWebsiteSnapshot(r.Context(), sqliteDB, postgresDB, false)
		if err != nil {
			writePublicWebsiteError(w, http.StatusInternalServerError, "snapshot_build_failed", "Failed to load map data.", true)
			return
		}
		writePublicWebsiteJSON(w, http.StatusOK, snapshot.Map)
	}
}

func PublicWebsiteSnapshotHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods: "GET, OPTIONS",
		}) {
			return
		}
		if r.Method != http.MethodGet {
			writePublicWebsiteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is allowed for this endpoint.", false)
			return
		}

		payload, err := loadOrRefreshPublicWebsiteSnapshot(r.Context(), sqliteDB, postgresDB, false)
		if err != nil {
			writePublicWebsiteError(w, http.StatusInternalServerError, "snapshot_build_failed", "Failed to build website snapshot.", true)
			return
		}
		writePublicWebsiteJSON(w, http.StatusOK, payload)
	}
}

func PublicWebsiteStatusHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods: "GET, OPTIONS",
		}) {
			return
		}
		if r.Method != http.MethodGet {
			writePublicWebsiteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is allowed for this endpoint.", false)
			return
		}

		snapshot, err := loadOrRefreshPublicWebsiteSnapshot(r.Context(), sqliteDB, postgresDB, false)
		if err != nil {
			writePublicWebsiteError(w, http.StatusInternalServerError, "snapshot_build_failed", "Failed to load status data.", true)
			return
		}

		writePublicWebsiteJSON(w, http.StatusOK, publicWebsiteStatusResponse{
			SchemaVersion: publicWebsiteSchemaVersion,
			OK:            true,
			GeneratedAt:   snapshot.GeneratedAt,
			Status:        snapshot.Overview.Status,
		})
	}
}

func PublicWebsiteUserChangelogHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods: "GET, OPTIONS",
		}) {
			return
		}
		if r.Method != http.MethodGet {
			writePublicWebsiteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET is allowed for this endpoint.", false)
			return
		}

		snapshot, err := loadOrRefreshPublicWebsiteSnapshot(r.Context(), sqliteDB, postgresDB, false)
		if err != nil {
			writePublicWebsiteError(w, http.StatusInternalServerError, "snapshot_build_failed", "Failed to load changelog data.", true)
			return
		}

		writePublicWebsiteJSON(w, http.StatusOK, snapshot.Changelog)
	}
}

func StartPublicWebsiteSnapshotRefreshLoop(ctx context.Context, sqliteDB, postgresDB *sql.DB) {
	if sqliteDB == nil {
		return
	}

	refresh := func(triggeredBy string) {
		runCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()

		snapshot, err := loadOrRefreshPublicWebsiteSnapshot(runCtx, sqliteDB, postgresDB, true)
		if err != nil {
			logEvent("error", "public_website_snapshot_refresh_failed", map[string]interface{}{
				"error":       trimAndLimit(err.Error(), 240),
				"triggeredBy": triggeredBy,
			})
			return
		}
		logEvent("info", "public_website_snapshot_refreshed", map[string]interface{}{
			"snapshotId":  snapshot.SnapshotID,
			"generatedAt": snapshot.GeneratedAt,
			"triggeredBy": triggeredBy,
		})
	}

	refresh("oracle_scheduler_snapshot_startup")
	ticker := time.NewTicker(publicWebsiteSnapshotRefreshInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			refresh("oracle_scheduler_snapshot_interval")
		}
	}
}

func loadOrRefreshPublicWebsiteSnapshot(
	ctx context.Context,
	sqliteDB, postgresDB *sql.DB,
	forceRefresh bool,
) (publicWebsiteSnapshotResponse, error) {
	if sqliteDB == nil {
		return publicWebsiteSnapshotResponse{}, errors.New("database not available")
	}

	latest, latestErr := loadLatestPublicWebsiteSnapshot(ctx, sqliteDB)
	if latestErr != nil && !errors.Is(latestErr, sql.ErrNoRows) {
		return publicWebsiteSnapshotResponse{}, latestErr
	}
	if latestErr == nil && !forceRefresh && !shouldRefreshPublicWebsiteSnapshot(latest, time.Now().UTC()) {
		return latest, nil
	}

	publicWebsiteSnapshotBuildMu.Lock()
	defer publicWebsiteSnapshotBuildMu.Unlock()

	latest, latestErr = loadLatestPublicWebsiteSnapshot(ctx, sqliteDB)
	if latestErr != nil && !errors.Is(latestErr, sql.ErrNoRows) {
		return publicWebsiteSnapshotResponse{}, latestErr
	}
	if latestErr == nil && !forceRefresh && !shouldRefreshPublicWebsiteSnapshot(latest, time.Now().UTC()) {
		return latest, nil
	}

	built, err := buildPublicWebsiteSnapshot(ctx, sqliteDB, postgresDB)
	if err != nil {
		if latestErr == nil {
			return latest, nil
		}
		return publicWebsiteSnapshotResponse{}, err
	}
	if err := savePublicWebsiteSnapshot(ctx, sqliteDB, built); err != nil {
		logEvent("error", "public_website_snapshot_store_failed", map[string]interface{}{
			"error":      trimAndLimit(err.Error(), 240),
			"snapshotId": built.SnapshotID,
		})
	}
	return built, nil
}

func shouldRefreshPublicWebsiteSnapshot(snapshot publicWebsiteSnapshotResponse, nowUTC time.Time) bool {
	if snapshot.GeneratedAt <= 0 {
		return true
	}
	if strings.TrimSpace(snapshot.SnapshotID) == "" {
		return true
	}
	if snapshot.SchemaVersion != publicWebsiteSchemaVersion {
		return true
	}
	age := nowUTC.Sub(time.UnixMilli(snapshot.GeneratedAt))
	return age >= publicWebsiteSnapshotRefreshInterval
}

func buildPublicWebsiteSnapshot(
	ctx context.Context,
	sqliteDB, postgresDB *sql.DB,
) (publicWebsiteSnapshotResponse, error) {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	overview, err := buildPublicWebsiteOverview(ctx, sqliteDB, store)
	if err != nil {
		return publicWebsiteSnapshotResponse{}, err
	}
	worldMap, err := buildPublicWebsiteMap(ctx, sqliteDB)
	if err != nil {
		return publicWebsiteSnapshotResponse{}, err
	}
	changelog, err := buildPublicWebsiteUserChangelog(ctx, store)
	if err != nil {
		return publicWebsiteSnapshotResponse{}, err
	}

	generatedAt := time.Now().UTC().UnixMilli()
	overview.GeneratedAt = generatedAt
	worldMap.GeneratedAt = generatedAt
	changelog.GeneratedAt = generatedAt

	return publicWebsiteSnapshotResponse{
		SchemaVersion:        publicWebsiteSchemaVersion,
		OK:                   overview.OK && worldMap.OK && changelog.OK,
		GeneratedAt:          generatedAt,
		SnapshotID:           newWebsiteBatchID("public_website_snapshot"),
		Overview:             overview,
		Map:                  worldMap,
		Changelog:            changelog,
		UserChangelogSummary: buildPublicWebsiteChangelogSummary(changelog),
		Privacy:              buildPublicWebsitePrivacyPointers(ctx, store),
	}, nil
}

func buildPublicWebsiteChangelogSummary(changelog publicWebsiteUserChangelogResponse) publicWebsiteChangelogSummary {
	return publicWebsiteChangelogSummary{
		Headline:         changelog.Headline,
		Description:      changelog.Description,
		EntriesCount:     len(changelog.Entries),
		LastUpdatedAtUTC: changelog.LastUpdatedAtUTC,
		FullChangelogURL: changelog.FullChangelogURL,
	}
}

func buildPublicWebsitePrivacyPointers(ctx context.Context, store *controlPlaneStore) publicWebsitePrivacyPointers {
	userPrivacyURL := "https://classroom-quick-downloader-website.pages.dev/privacy"
	if publicSiteURL := strings.TrimSpace(os.Getenv("PUBLIC_SITE_URL")); publicSiteURL != "" {
		userPrivacyURL = strings.TrimRight(publicSiteURL, "/") + "/privacy"
	}

	pointers := publicWebsitePrivacyPointers{
		Headline:       "Privacy, simplified",
		Description:    "We only expose aggregated, public-safe metrics and never publish raw IP data.",
		UserPrivacyURL: userPrivacyURL,
		FullPrivacyURL: githubMarkdownURL("PRIVACY.md"),
	}
	if store == nil {
		return pointers
	}

	records, err := store.listRecords(ctx, publicWebsitePrivacyRecordType)
	if err != nil || len(records) == 0 {
		return pointers
	}
	data := decodeRecordDataMap(records[0].Data)
	if normalized := trimAndLimit(stringFromAny(data["headline"]), 120); normalized != "" {
		pointers.Headline = normalized
	}
	if normalized := trimAndLimit(stringFromAny(data["description"]), 300); normalized != "" {
		pointers.Description = normalized
	}
	if normalized := normalizeExternalURL(stringFromAny(data["userPrivacyUrl"])); normalized != "" {
		pointers.UserPrivacyURL = normalized
	}
	if normalized := normalizeExternalURL(stringFromAny(data["fullPrivacyUrl"])); normalized != "" {
		pointers.FullPrivacyURL = normalized
	}
	return pointers
}

func loadLatestPublicWebsiteSnapshot(ctx context.Context, sqliteDB *sql.DB) (publicWebsiteSnapshotResponse, error) {
	var payloadJSON string
	if err := sqliteDB.QueryRowContext(
		ctx,
		`SELECT payload_json
		 FROM website_public_snapshots
		 ORDER BY generated_at DESC, id DESC
		 LIMIT 1`,
	).Scan(&payloadJSON); err != nil { // #nosec G701 -- static query without user input.
		return publicWebsiteSnapshotResponse{}, err
	}

	var payload publicWebsiteSnapshotResponse
	if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
		return publicWebsiteSnapshotResponse{}, err
	}
	payload.SchemaVersion = publicWebsiteSchemaVersion
	payload.Overview.SchemaVersion = publicWebsiteSchemaVersion
	payload.Map.SchemaVersion = publicWebsiteSchemaVersion
	payload.Changelog.SchemaVersion = publicWebsiteSchemaVersion
	if payload.UserChangelogSummary.FullChangelogURL == "" {
		payload.UserChangelogSummary = buildPublicWebsiteChangelogSummary(payload.Changelog)
	}
	if payload.Privacy.FullPrivacyURL == "" || payload.Privacy.UserPrivacyURL == "" {
		payload.Privacy = buildPublicWebsitePrivacyPointers(ctx, newControlPlaneStore(sqliteDB, nil))
	}
	return payload, nil
}

func savePublicWebsiteSnapshot(
	ctx context.Context,
	sqliteDB *sql.DB,
	snapshot publicWebsiteSnapshotResponse,
) error {
	if sqliteDB == nil {
		return errors.New("database not available")
	}
	payloadBytes, err := json.Marshal(snapshot)
	if err != nil {
		return err
	}
	if len(payloadBytes) > publicWebsiteSnapshotPayloadMaxBytes {
		return errors.New("snapshot payload exceeds size limit")
	}

	_, err = sqliteDB.ExecContext(
		ctx,
		`INSERT INTO website_public_snapshots (
			snapshot_id,
			schema_version,
			generated_at,
			payload_json,
			created_at
		) VALUES (?, ?, ?, ?, ?)`,
		trimAndLimit(snapshot.SnapshotID, 120),
		publicWebsiteSchemaVersion,
		snapshot.GeneratedAt,
		string(payloadBytes),
		time.Now().UTC().UnixMilli(),
	) // #nosec G701 -- static insert statement with bound params only.
	return err
}

func PublicWebsiteUninstallHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if sqliteDB == nil {
			writePublicWebsiteError(w, http.StatusServiceUnavailable, "database_unavailable", "Database is unavailable.", true)
			return
		}
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods:        "GET, POST, OPTIONS",
			RequireOriginForWrite: true,
			StructuredErrors:      true,
		}) {
			return
		}

		switch r.Method {
		case http.MethodGet:
			stats, err := loadPublicWebsiteUninstallStats(r.Context(), sqliteDB)
			if err != nil {
				writePublicWebsiteError(w, http.StatusInternalServerError, "uninstall_stats_load_failed", "Failed to load uninstall stats.", true)
				return
			}
			writePublicWebsiteJSON(w, http.StatusOK, publicWebsiteUninstallStatsResponse{
				SchemaVersion: publicWebsiteSchemaVersion,
				OK:            true,
				GeneratedAt:   time.Now().UTC().UnixMilli(),
				Stats:         stats,
			})
			return
		case http.MethodPost:
			if strings.TrimSpace(r.Header.Get("X-Requested-With")) != "XMLHttpRequest" {
				writePublicWebsiteError(w, http.StatusBadRequest, "missing_required_header", "X-Requested-With header is required.", false)
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, publicWebsiteEventsBodyLimitBytes)

			var req publicWebsiteUninstallRequest
			if err := decodeJSONBodyStrict(r, &req); err != nil {
				writePublicWebsiteError(w, http.StatusBadRequest, "invalid_request_body", "Request body must be valid JSON and match the expected schema.", false)
				return
			}

			clean := sanitizePublicWebsiteUninstallRequest(req)
			if clean.Reason == "" {
				writePublicWebsiteError(w, http.StatusBadRequest, "reason_required", "reason is required.", false)
				return
			}

			now := time.Now().UTC().UnixMilli()
			origin := normalizeRequestOriginHeader(r.Header.Get("Origin"))
			res, err := sqliteDB.ExecContext(
				r.Context(),
				`INSERT INTO website_uninstall_feedback (
					reason, browser, extension_version, source, notes, origin, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				clean.Reason,
				clean.Browser,
				clean.Version,
				clean.Source,
				clean.Notes,
				origin,
				now,
			) // #nosec G701 -- static INSERT with placeholders and bound parameters.
			if err != nil {
				writePublicWebsiteError(w, http.StatusInternalServerError, "feedback_save_failed", "Failed to save feedback.", true)
				return
			}

			submissionID, _ := res.LastInsertId()
			if err := RecordWebsiteToOracleBatch(
				r.Context(),
				sqliteDB,
				submissionID,
				clean.Browser,
				clean.Version,
				clean.Source,
			); err != nil {
				logEvent("warn", "website_uninstall_batch_record_failed", map[string]interface{}{
					"error":        err.Error(),
					"submissionId": submissionID,
				})
			}
			writePublicWebsiteJSON(w, http.StatusCreated, publicWebsiteUninstallResponse{
				SchemaVersion: publicWebsiteSchemaVersion,
				OK:            true,
				GeneratedAt:   now,
				SubmissionID:  submissionID,
				Message:       "Thanks. Your feedback was submitted successfully.",
			})
			return
		default:
			writePublicWebsiteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only GET and POST are allowed for this endpoint.", false)
			return
		}
	}
}

func PublicWebsiteEventsHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if sqliteDB == nil {
			writePublicWebsiteError(w, http.StatusServiceUnavailable, "database_unavailable", "Database is unavailable.", true)
			return
		}
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods:        "POST, OPTIONS",
			RequireOriginForWrite: true,
			StructuredErrors:      true,
		}) {
			return
		}
		if r.Method != http.MethodPost {
			writePublicWebsiteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is allowed for this endpoint.", false)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, publicWebsiteEventsBodyLimitBytes)
		var req publicWebsiteEventsIngestRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			writePublicWebsiteError(w, http.StatusBadRequest, "invalid_request_body", "Request body must be valid JSON and match the expected schema.", false)
			return
		}
		if req.SchemaVersion != publicWebsiteSchemaVersion {
			writePublicWebsiteError(w, http.StatusBadRequest, "schema_version_required", "schemaVersion must be \"1\".", false)
			return
		}
		if len(req.Events) == 0 {
			writePublicWebsiteError(w, http.StatusBadRequest, "events_required", "events must be a non-empty array.", false)
			return
		}
		if len(req.Events) > publicWebsiteEventsMaxPerRequest {
			writePublicWebsiteError(w, http.StatusBadRequest, "events_batch_too_large", "events length exceeds the maximum allowed batch size.", false)
			return
		}

		sanitizedSessionID := sanitizeWebsiteEventSessionID(req.SessionID)
		sanitizedPagePath := sanitizeWebsiteEventPagePath(req.PagePath)
		nowUTC := time.Now().UTC()
		nowMillis := nowUTC.UnixMilli()
		result, err := ingestWebsiteEvents(
			r.Context(),
			sqliteDB,
			req.Events,
			nowUTC,
			websiteEventsIngestMetadata{
				Source:         "website_public_events",
				BatchID:        newWebsiteBatchID(websiteSyncDirectionWebsiteToOracle),
				TriggeredBy:    "website_events_ingest",
				Attempt:        1,
				SessionID:      sanitizedSessionID,
				PagePath:       sanitizedPagePath,
				GeneratedAtUTC: nowMillis,
				CorrelationID:  trimAndLimit(r.Header.Get("X-Correlation-ID"), 200),
			},
		)
		if err != nil {
			writePublicWebsiteError(w, http.StatusInternalServerError, "ingest_failed", "Failed to ingest website events.", true)
			return
		}

		writePublicWebsiteJSON(w, http.StatusOK, publicWebsiteEventsIngestResponse{
			SchemaVersion: publicWebsiteSchemaVersion,
			OK:            true,
			GeneratedAt:   nowMillis,
			AcceptedCount: result.Accepted,
			RejectedCount: result.Rejected,
		})
	}
}

func ingestWebsiteEvents(
	ctx context.Context,
	sqliteDB *sql.DB,
	events []publicWebsiteEventIngestEvent,
	nowUTC time.Time,
	metadata websiteEventsIngestMetadata,
) (websiteEventsIngestResult, error) {
	if sqliteDB == nil {
		return websiteEventsIngestResult{}, errors.New("database not available")
	}
	tx, err := sqliteDB.BeginTx(ctx, nil)
	if err != nil {
		return websiteEventsIngestResult{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	nowMillis := nowUTC.UnixMilli()
	ingestMeta := normalizeWebsiteEventsIngestMetadata(metadata, nowMillis)
	result := websiteEventsIngestResult{
		Received:       len(events),
		BatchChecksum:  computeWebsiteEventsBatchChecksum(ingestMeta.BatchID, ingestMeta.GeneratedAtUTC, ingestMeta.SessionID, ingestMeta.PagePath, events),
		ChecksumStatus: "not_provided",
		RowCountStatus: "not_provided",
		Integrity:      "ok",
	}
	for _, rawEvent := range events {
		eventID, eventType, action, placement, dayUTC, valid := sanitizeWebsiteEventForAggregate(rawEvent, nowUTC)
		if !valid {
			result.Rejected++
			continue
		}

		insertRes, execErr := tx.ExecContext(
			ctx,
			`INSERT INTO website_event_idempotency (event_id, created_at)
			 VALUES (?, ?)
			 ON CONFLICT(event_id) DO NOTHING`,
			eventID,
			nowMillis,
		)
		if execErr != nil {
			return websiteEventsIngestResult{}, execErr
		}
		insertedRows, rowsErr := insertRes.RowsAffected()
		if rowsErr != nil {
			return websiteEventsIngestResult{}, rowsErr
		}
		if insertedRows == 0 {
			result.Rejected++
			continue
		}

		metaPayload := normalizeWebsiteEventMeta(rawEvent.Meta)
		metaJSON := encodeWebsiteEventMetaJSON(metaPayload)
		rawEventJSON := encodeWebsiteRawEventJSON(rawEvent, eventID, eventType, action, placement, metaPayload)
		var eventTSUTC any
		if rawEvent.TSUTC != nil && *rawEvent.TSUTC > 0 {
			eventTSUTC = *rawEvent.TSUTC
		}

		if _, execErr = tx.ExecContext(
			ctx,
			`INSERT INTO website_events_raw (
				event_id, source, batch_id, session_id, page_path,
				event_type, action, placement, event_ts_utc, generated_at_utc, attempt,
				correlation_id, meta_json, raw_event_json, ingested_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			eventID,
			ingestMeta.Source,
			ingestMeta.BatchID,
			ingestMeta.SessionID,
			ingestMeta.PagePath,
			eventType,
			action,
			placement,
			eventTSUTC,
			ingestMeta.GeneratedAtUTC,
			ingestMeta.Attempt,
			ingestMeta.CorrelationID,
			metaJSON,
			rawEventJSON,
			nowMillis,
		); execErr != nil {
			return websiteEventsIngestResult{}, execErr
		}

		if _, execErr = tx.ExecContext(
			ctx,
			`INSERT INTO website_event_daily (day_utc, event_type, action, placement, count, last_seen_at)
			 VALUES (?, ?, ?, ?, 1, ?)
			 ON CONFLICT(day_utc, event_type, action, placement)
			 DO UPDATE SET
				count = website_event_daily.count + 1,
				last_seen_at = excluded.last_seen_at`,
			dayUTC,
			eventType,
			action,
			placement,
			nowMillis,
		); execErr != nil {
			return websiteEventsIngestResult{}, execErr
		}
		result.Accepted++
	}

	result.Accounted = result.Accepted + result.Rejected

	expectedChecksum := strings.ToLower(strings.TrimSpace(ingestMeta.BatchChecksum))
	computedChecksum := strings.ToLower(strings.TrimSpace(result.BatchChecksum))
	if expectedChecksum != "" {
		if expectedChecksum == computedChecksum {
			result.ChecksumStatus = "match"
		} else {
			result.ChecksumStatus = "mismatch"
			result.IntegrityNotes = append(result.IntegrityNotes, "batch checksum mismatch")
		}
	}

	if ingestMeta.ExpectedEvents != nil {
		expectedEvents := *ingestMeta.ExpectedEvents
		if expectedEvents < 0 {
			expectedEvents = 0
		}
		if expectedEvents == result.Received {
			result.RowCountStatus = "match"
		} else {
			result.RowCountStatus = "mismatch"
			result.IntegrityNotes = append(result.IntegrityNotes, "expected event count mismatch")
		}
	}

	if result.Accounted != result.Received {
		result.RowCountStatus = "mismatch"
		result.IntegrityNotes = append(result.IntegrityNotes, "ingested event accounting mismatch")
	}
	if len(result.IntegrityNotes) > 0 {
		result.Integrity = "critical"
	} else {
		result.Integrity = "ok"
	}

	details := map[string]any{
		"acceptedCount":  result.Accepted,
		"rejectedCount":  result.Rejected,
		"receivedCount":  result.Received,
		"accountedCount": result.Accounted,
		"attempt":        ingestMeta.Attempt,
		"sessionId":      ingestMeta.SessionID,
		"pagePath":       ingestMeta.PagePath,
		"generatedAtUtc": ingestMeta.GeneratedAtUTC,
		"source":         ingestMeta.Source,
		"batchChecksum":  result.BatchChecksum,
		"checksumStatus": result.ChecksumStatus,
		"rowCountStatus": result.RowCountStatus,
		"integrity":      result.Integrity,
	}
	if ingestMeta.ExpectedEvents != nil {
		details["expectedEventCount"] = maxInt64(int64(*ingestMeta.ExpectedEvents), 0)
	}
	if expectedChecksum != "" {
		details["expectedBatchChecksum"] = expectedChecksum
	}
	if len(result.IntegrityNotes) > 0 {
		details["integrityNotes"] = result.IntegrityNotes
	}
	if ingestMeta.CorrelationID != "" {
		details["correlationId"] = ingestMeta.CorrelationID
	}

	if err := markWebsiteIngestTimestampTx(ctx, tx, nowMillis); err != nil {
		return websiteEventsIngestResult{}, err
	}
	if err := insertWebsiteSyncBatchWithRunner(
		ctx,
		tx,
		websiteSyncDirectionWebsiteToOracle,
		ingestMeta.BatchID,
		ingestMeta.TriggeredBy,
		"ok",
		details,
		nowMillis,
	); err != nil {
		return websiteEventsIngestResult{}, err
	}

	if err := tx.Commit(); err != nil {
		return websiteEventsIngestResult{}, err
	}
	return result, nil
}

func normalizeWebsiteEventsIngestMetadata(input websiteEventsIngestMetadata, nowMillis int64) websiteEventsIngestMetadata {
	output := input
	output.Source = trimAndLimit(output.Source, 64)
	if output.Source == "" {
		output.Source = "website_events_ingest"
	}
	output.BatchID = trimAndLimit(output.BatchID, 160)
	if output.BatchID == "" {
		output.BatchID = newWebsiteBatchID(websiteSyncDirectionWebsiteToOracle)
	}
	output.TriggeredBy = trimAndLimit(output.TriggeredBy, 120)
	if output.TriggeredBy == "" {
		output.TriggeredBy = "website_events_ingest"
	}
	if output.Attempt < 1 {
		output.Attempt = 1
	}
	if output.Attempt > 20 {
		output.Attempt = 20
	}
	output.SessionID = sanitizeWebsiteEventSessionID(output.SessionID)
	output.PagePath = sanitizeWebsiteEventPagePath(output.PagePath)
	if output.GeneratedAtUTC <= 0 {
		output.GeneratedAtUTC = nowMillis
	}
	output.CorrelationID = trimAndLimit(output.CorrelationID, 200)
	output.BatchChecksum = strings.ToLower(trimAndLimit(strings.TrimSpace(output.BatchChecksum), 80))
	if output.ExpectedEvents != nil {
		v := *output.ExpectedEvents
		if v < 0 {
			v = 0
		}
		output.ExpectedEvents = &v
	}
	return output
}

func computeWebsiteEventsBatchChecksum(
	batchID string,
	generatedAtUTC int64,
	sessionID string,
	pagePath string,
	events []publicWebsiteEventIngestEvent,
) string {
	h := sha256.New()
	writeLine := func(v string) {
		_, _ = h.Write([]byte(v))
		_, _ = h.Write([]byte{'\n'})
	}

	writeLine(publicWebsiteSchemaVersion)
	writeLine(trimAndLimit(batchID, 160))
	writeLine(strconv.FormatInt(generatedAtUTC, 10))
	writeLine(sanitizeWebsiteEventSessionID(sessionID))
	writeLine(sanitizeWebsiteEventPagePath(pagePath))
	writeLine(strconv.Itoa(len(events)))

	refUTC := time.Now().UTC()
	if generatedAtUTC > 0 {
		refUTC = time.UnixMilli(generatedAtUTC).UTC()
	}
	for _, event := range events {
		eventID, eventType, action, placement, _, ok := sanitizeWebsiteEventForAggregate(event, refUTC)
		if !ok {
			eventID = strings.TrimSpace(event.EventID)
			eventType = strings.ToLower(strings.TrimSpace(event.EventType))
			action = strings.ToLower(strings.TrimSpace(event.Action))
			placement = sanitizeWebsiteEventPlacement(event.Placement)
		}
		ts := int64(0)
		if event.TSUTC != nil && *event.TSUTC > 0 {
			ts = *event.TSUTC
		}
		writeLine(eventID)
		writeLine(eventType)
		writeLine(action)
		writeLine(placement)
		writeLine(strconv.FormatInt(ts, 10))
	}
	return hex.EncodeToString(h.Sum(nil))
}

func normalizeWebsiteEventMeta(raw map[string]any) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	out := make(map[string]any, len(raw))
	count := 0
	for k, v := range raw {
		if count >= 16 {
			break
		}
		key := trimAndLimit(k, 64)
		if key == "" {
			continue
		}
		switch value := v.(type) {
		case string:
			out[key] = trimAndLimit(value, 256)
		case float64, bool, nil:
			out[key] = value
		default:
			continue
		}
		count++
	}
	return out
}

func encodeWebsiteEventMetaJSON(meta map[string]any) string {
	if len(meta) == 0 {
		return "{}"
	}
	bytes, err := json.Marshal(meta)
	if err != nil || len(bytes) > publicWebsiteMetaJSONMaxBytes {
		return "{}"
	}
	return string(bytes)
}

func encodeWebsiteRawEventJSON(
	input publicWebsiteEventIngestEvent,
	eventID string,
	eventType string,
	action string,
	placement string,
	meta map[string]any,
) string {
	payload := map[string]any{
		"eventId":   eventID,
		"eventType": eventType,
		"action":    action,
		"placement": placement,
	}
	if input.TSUTC != nil && *input.TSUTC > 0 {
		payload["tsUtc"] = *input.TSUTC
	}
	if len(meta) > 0 {
		payload["meta"] = meta
	}
	bytes, err := json.Marshal(payload)
	if err != nil || len(bytes) > publicWebsiteRawEventJSONMaxBytes {
		return "{}"
	}
	return string(bytes)
}

func buildPublicWebsiteOverview(ctx context.Context, sqliteDB *sql.DB, store *controlPlaneStore) (publicWebsiteOverviewResponse, error) {
	rawTotals, err := loadTotals(ctx, sqliteDB)
	if err != nil {
		return publicWebsiteOverviewResponse{}, err
	}
	downloads := rawTotals["totalDownloads"]
	published, publishedErr := loadWebsitePublishedDataset(ctx, sqliteDB)
	if publishedErr == nil && published.Active {
		downloads = maxInt64(published.Downloads, 0)
	}

	installs, links := buildPublicWebsiteInstalls(ctx, store)
	status, err := buildPublicWebsiteStatus(ctx, sqliteDB)
	if err != nil {
		return publicWebsiteOverviewResponse{}, err
	}

	gitHubVersion := resolveLatestExtensionVersion(ctx, store)
	if gitHubVersion == nil {
		gitHubVersion = stringPtrOrNil(lookupBrowserVersion(installs.Browsers, "chrome"))
	}
	chromeVersion := stringPtrOrNil(lookupBrowserVersion(installs.Browsers, "chrome"))
	firefoxVersion := stringPtrOrNil(lookupBrowserVersion(installs.Browsers, "firefox"))
	edgeVersion := stringPtrOrNil(lookupBrowserVersion(installs.Browsers, "edge"))

	return publicWebsiteOverviewResponse{
		SchemaVersion: publicWebsiteSchemaVersion,
		OK:            true,
		GeneratedAt:   time.Now().UTC().UnixMilli(),
		Totals: publicWebsiteTotals{
			Downloads: downloads,
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

func buildPublicWebsiteMap(ctx context.Context, sqliteDB *sql.DB) (publicWebsiteMapResponse, error) {
	rawTotals, err := loadTotals(ctx, sqliteDB)
	if err != nil {
		return publicWebsiteMapResponse{}, err
	}

	downloads := rawTotals["totalDownloads"]
	countries := make([]publicWebsiteCountryCell, 0, len(rawTotals))

	published, publishedErr := loadWebsitePublishedDataset(ctx, sqliteDB)
	if publishedErr == nil && published.Active {
		downloads = maxInt64(published.Downloads, 0)
		countries = normalizeWebsiteCountryCells(published.Countries, 300)
	} else {
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
	}

	return publicWebsiteMapResponse{
		SchemaVersion: publicWebsiteSchemaVersion,
		OK:            true,
		GeneratedAt:   time.Now().UTC().UnixMilli(),
		Granularity:   "country",
		Countries:     countries,
		Totals: publicWebsiteMapTotals{
			Countries: len(countries),
			Downloads: downloads,
		},
		PrivacyNote: "Country-level usage is aggregated without storing raw IP addresses. VPN/proxy users may appear at exit-node locations.",
	}, nil
}

func defaultPublicWebsiteUserChangelogEntries() []publicWebsiteUserChangelogEntry {
	mkTS := func(ms int64) *int64 {
		v := ms
		return &v
	}

	return []publicWebsiteUserChangelogEntry{
		{
			ID:      "release-138",
			Version: "1.3.8",
			Title:   "Reliable changelog delivery for all users",
			Summary: "Changelog updates now re-open correctly even when the version number stays the same, so release communication remains accurate.",
			Highlights: []string{
				"Revision-aware changelog updates from Cloudflare to extension clients.",
				"Improved version-pill behavior after same-version republish events.",
				"Stronger sync consistency between dashboard publish and user-visible release notes.",
			},
			ReleasedAtUTC: mkTS(1772409600000), // 2026-03-02
		},
		{
			ID:      "release-137",
			Version: "1.3.7",
			Title:   "Cleaner updates and smoother daily use",
			Summary: "We improved release messaging and polished the core flow so classroom downloads feel simpler and more predictable.",
			Highlights: []string{
				"Clearer changelog wording focused on normal users.",
				"Better stability when running large download batches.",
				"UI polish across key website and extension touchpoints.",
			},
			ReleasedAtUTC: mkTS(1772236800000), // 2026-02-28
		},
		{
			ID:      "release-136",
			Version: "1.3.6",
			Title:   "Stability and security improvements",
			Summary: "This release improves reliability in real classroom usage and adds additional hardening under the hood.",
			Highlights: []string{
				"Fewer stuck-progress cases during heavy downloads.",
				"Improved behavior after tab wakeups and network hiccups.",
				"Extra hardening for safer extension operation.",
			},
			ReleasedAtUTC: mkTS(1771545600000), // 2026-02-20
		},
		{
			ID:      "release-135",
			Version: "1.3.5",
			Title:   "Popup quality and interaction fixes",
			Summary: "We refined popup behavior and tightened the user flow so actions feel faster and more consistent.",
			Highlights: []string{
				"Better keyboard interaction in popup controls.",
				"Clearer live status while downloads run.",
				"General bug fixes for day-to-day usage.",
			},
			ReleasedAtUTC: mkTS(1771459200000), // 2026-02-19
		},
		{
			ID:      "release-134",
			Version: "1.3.4",
			Title:   "Compatibility and reliability pass",
			Summary: "This update focuses on better compatibility with current browsers and steadier behavior across different classroom page types.",
			Highlights: []string{
				"Improved cross-browser consistency.",
				"Safer request validation paths.",
				"UI feedback polish in extension flows.",
			},
			ReleasedAtUTC: mkTS(1771372800000), // 2026-02-18
		},
		{
			ID:      "release-133",
			Version: "1.3.3",
			Title:   "Performance and recovery updates",
			Summary: "We reduced friction in high-volume sessions with faster queue handling and better recovery from interruptions.",
			Highlights: []string{
				"Faster start for multi-file downloads.",
				"Better recovery after refreshes mid-run.",
				"Reduced noisy errors in successful paths.",
			},
			ReleasedAtUTC: mkTS(1770854400000), // 2026-02-12
		},
		{
			ID:      "release-132",
			Version: "1.3.2",
			Title:   "Tracking accuracy and backend polish",
			Summary: "We improved internal tracking quality while keeping the same privacy-first model and no personal data collection.",
			Highlights: []string{
				"More accurate handling for partial/cancelled actions.",
				"Smoother background sync behavior.",
				"Better resilience in long-running sessions.",
			},
			ReleasedAtUTC: mkTS(1770508800000), // 2026-02-08
		},
		{
			ID:      "release-131",
			Version: "1.3.1",
			Title:   "Foundation stability for the 1.3 line",
			Summary: "The first wave of 1.3 improvements focused on reliability and responsiveness for classrooms with many attachments.",
			Highlights: []string{
				"Faster queue behavior in heavy courses.",
				"Improved consistency on complex classroom pages.",
				"General reliability and cleanup fixes.",
			},
			ReleasedAtUTC: mkTS(1770163200000), // 2026-02-04
		},
	}
}

func buildPublicWebsiteUserChangelog(ctx context.Context, store *controlPlaneStore) (publicWebsiteUserChangelogResponse, error) {
	now := time.Now().UTC().UnixMilli()
	fullURL := githubMarkdownURL("CHANGELOG.md")
	config, err := loadPublicWebsiteUserChangelogConfig(ctx, store)
	if err != nil {
		return publicWebsiteUserChangelogResponse{}, err
	}

	if strings.EqualFold(config.Source, "github") {
		markdownURL := config.MarkdownURL
		if markdownURL == "" {
			markdownURL = githubRawMarkdownURL("user-friendly-changelog.md")
		}
		markdown, fetchErr := fetchRemoteUserFriendlyChangelogMarkdown(ctx, markdownURL)
		if fetchErr != nil {
			logEvent("warn", "public_user_changelog_github_fetch_failed", map[string]interface{}{
				"error": trimAndLimit(fetchErr.Error(), 240),
				"url":   trimAndLimit(markdownURL, 240),
			})
		} else {
			releases := parseUserFriendlyChangelogMarkdown(markdown)
			entries := mapParsedReleasesToChangelogEntries(releases)
			if len(entries) > 0 {
				lastUpdated := now
				return publicWebsiteUserChangelogResponse{
					SchemaVersion:    publicWebsiteSchemaVersion,
					OK:               true,
					GeneratedAt:      now,
					Source:           "github",
					SourceURL:        markdownURL,
					Headline:         "Arc-style release notes for normal users",
					Description:      "Simple updates focused on what changed and how it helps your day-to-day classroom workflow.",
					Entries:          entries,
					FullChangelogURL: fullURL,
					LastUpdatedAtUTC: &lastUpdated,
				}, nil
			}
		}
	}

	records, err := store.listRecords(ctx, publicWebsiteUserChangelogRecordType)
	if err != nil {
		return publicWebsiteUserChangelogResponse{}, err
	}

	entries := make([]publicWebsiteUserChangelogEntry, 0, len(records))
	var lastUpdated *int64
	for _, row := range records {
		data := decodeRecordDataMap(row.Data)
		markdown := trimAndLimit(stringFromAny(data["markdown"]), 24000)
		releasedAt := int64PtrFromAny(data["releasedAtUtc"])
		title := trimAndLimit(stringFromAny(data["title"]), 120)

		if markdown != "" {
			parsedReleases := parseUserFriendlyChangelogMarkdown(markdown)
			for idx, release := range parsedReleases {
				if release.Version == "" || release.Summary == "" {
					continue
				}
				entryID := trimAndLimit(row.RecordKey, 120)
				if len(parsedReleases) > 1 {
					entryID = trimAndLimit(entryID+"-"+strings.ReplaceAll(strings.ToLower(release.Version), ".", "-"), 120)
				}
				entryTitle := title
				if entryTitle == "" {
					if idx == 0 {
						entryTitle = "Release highlights"
					} else {
						entryTitle = "Release update"
					}
				}
				entries = append(entries, publicWebsiteUserChangelogEntry{
					ID:            entryID,
					Version:       release.Version,
					Title:         entryTitle,
					Summary:       release.Summary,
					Highlights:    flattenReleaseHighlights(release, 9),
					ReleasedAtUTC: releasedAt,
				})
			}
			if row.UpdatedAt > 0 && (lastUpdated == nil || row.UpdatedAt > *lastUpdated) {
				updated := row.UpdatedAt
				lastUpdated = &updated
			}
			continue
		}

		version := trimAndLimit(stringFromAny(data["version"]), 64)
		summary := trimAndLimit(stringFromAny(data["summary"]), 500)
		if version == "" || summary == "" {
			continue
		}
		highlights := normalizeStringList(data["highlights"], 9, 180)
		if len(highlights) == 0 {
			added := normalizeStringList(data["added"], 3, 180)
			changed := normalizeStringList(data["changed"], 3, 180)
			fixed := normalizeStringList(data["fixed"], 3, 180)
			for _, item := range added {
				highlights = append(highlights, "Added: "+item)
			}
			for _, item := range changed {
				highlights = append(highlights, "Changed: "+item)
			}
			for _, item := range fixed {
				highlights = append(highlights, "Fixed: "+item)
			}
		}
		entries = append(entries, publicWebsiteUserChangelogEntry{
			ID:            trimAndLimit(row.RecordKey, 120),
			Version:       version,
			Title:         title,
			Summary:       summary,
			Highlights:    highlights,
			ReleasedAtUTC: releasedAt,
		})
		if row.UpdatedAt > 0 && (lastUpdated == nil || row.UpdatedAt > *lastUpdated) {
			updated := row.UpdatedAt
			lastUpdated = &updated
		}
	}

	sort.Slice(entries, func(i, j int) bool {
		iTs := int64(0)
		jTs := int64(0)
		if entries[i].ReleasedAtUTC != nil {
			iTs = *entries[i].ReleasedAtUTC
		}
		if entries[j].ReleasedAtUTC != nil {
			jTs = *entries[j].ReleasedAtUTC
		}
		if iTs == jTs {
			return entries[i].Version > entries[j].Version
		}
		return iTs > jTs
	})

	if len(entries) == 0 {
		entries = defaultPublicWebsiteUserChangelogEntries()
		if len(entries) > 0 && entries[0].ReleasedAtUTC != nil {
			lastUpdated = entries[0].ReleasedAtUTC
		} else {
			lastUpdated = &now
		}
	}

	return publicWebsiteUserChangelogResponse{
		SchemaVersion:    publicWebsiteSchemaVersion,
		OK:               true,
		GeneratedAt:      now,
		Source:           "oracle",
		SourceURL:        "",
		Headline:         "Arc-style release notes for normal users",
		Description:      "Simple updates focused on what changed and how it helps your day-to-day classroom workflow.",
		Entries:          entries,
		FullChangelogURL: fullURL,
		LastUpdatedAtUTC: lastUpdated,
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

func githubMarkdownURL(filename string) string {
	repoSlug := strings.TrimSpace(os.Getenv("GITHUB_REPO_SLUG"))
	if repoSlug == "" {
		repoSlug = defaultGitHubRepoSlug
	}
	filename = strings.TrimSpace(filename)
	if filename == "" {
		return "https://github.com/" + repoSlug
	}
	return "https://github.com/" + repoSlug + "/blob/main/" + filename
}

func githubRawMarkdownURL(filename string) string {
	repoSlug := strings.TrimSpace(os.Getenv("GITHUB_REPO_SLUG"))
	if repoSlug == "" {
		repoSlug = defaultGitHubRepoSlug
	}
	filename = strings.TrimSpace(filename)
	if filename == "" {
		filename = "user-friendly-changelog.md"
	}
	parts := strings.SplitN(repoSlug, "/", 2)
	if len(parts) != 2 {
		return ""
	}
	return "https://raw.githubusercontent.com/" + parts[0] + "/" + parts[1] + "/main/" + filename
}

func decodeRecordDataMap(raw json.RawMessage) map[string]any {
	out := make(map[string]any)
	if len(raw) == 0 {
		return out
	}
	_ = json.Unmarshal(raw, &out)
	return out
}

func int64PtrFromAny(value any) *int64 {
	v := int64FromAny(value)
	if v <= 0 {
		return nil
	}
	return &v
}

func loadPublicWebsiteUserChangelogConfig(ctx context.Context, store *controlPlaneStore) (publicWebsiteUserChangelogConfig, error) {
	config := publicWebsiteUserChangelogConfig{
		Source:      "oracle",
		MarkdownURL: githubRawMarkdownURL("user-friendly-changelog.md"),
	}
	records, err := store.listRecords(ctx, publicWebsiteUserChangelogConfigType)
	if err != nil {
		return config, err
	}
	if len(records) == 0 {
		return config, nil
	}
	var selected *controlPlaneRecordRow
	for i := range records {
		row := records[i]
		if strings.EqualFold(strings.TrimSpace(row.RecordKey), "active") {
			selected = &row
			break
		}
	}
	if selected == nil {
		selected = &records[0]
	}
	data := decodeRecordDataMap(selected.Data)
	source := strings.ToLower(strings.TrimSpace(stringFromAny(data["source"])))
	switch source {
	case "github":
		config.Source = "github"
	default:
		config.Source = "oracle"
	}
	rawURL := strings.TrimSpace(stringFromAny(data["markdownUrl"]))
	if rawURL != "" {
		parsed, parseErr := url.Parse(rawURL)
		if parseErr == nil && strings.EqualFold(parsed.Scheme, "https") {
			config.MarkdownURL = rawURL
		}
	}
	return config, nil
}

func fetchRemoteUserFriendlyChangelogMarkdown(ctx context.Context, rawURL string) (string, error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return "", errors.New("github raw changelog url is empty")
	}
	parsed, err := url.Parse(rawURL)
	if err != nil || !strings.EqualFold(parsed.Scheme, "https") {
		return "", errors.New("github raw changelog url is invalid")
	}
	reqCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, rawURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "ClassroomQuickDownloader-Oracle/4.1")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", errors.New("github changelog request failed with non-2xx status")
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	if err != nil {
		return "", err
	}
	markdown := strings.TrimSpace(string(body))
	if markdown == "" {
		return "", errors.New("github changelog markdown is empty")
	}
	return markdown, nil
}

func normalizeStringList(value any, maxItems, maxLen int) []string {
	items := make([]string, 0, maxItems)
	switch typed := value.(type) {
	case []string:
		for _, item := range typed {
			normalized := trimAndLimit(item, maxLen)
			if normalized == "" {
				continue
			}
			items = append(items, normalized)
			if len(items) >= maxItems {
				break
			}
		}
	case []any:
		for _, item := range typed {
			normalized := trimAndLimit(stringFromAny(item), maxLen)
			if normalized == "" {
				continue
			}
			items = append(items, normalized)
			if len(items) >= maxItems {
				break
			}
		}
	}
	return items
}

func parseUserFriendlyChangelogMarkdown(markdown string) []userFriendlyMarkdownRelease {
	lines := strings.Split(strings.ReplaceAll(markdown, "\r\n", "\n"), "\n")
	releases := make([]userFriendlyMarkdownRelease, 0, 16)

	var current *userFriendlyMarkdownRelease
	section := ""
	pushCurrent := func() {
		if current == nil {
			return
		}
		current.Version = trimAndLimit(strings.TrimPrefix(strings.TrimPrefix(current.Version, "v"), "V"), 64)
		current.Summary = trimAndLimit(current.Summary, 600)
		if current.Summary == "" {
			if len(current.Added) > 0 {
				current.Summary = trimAndLimit(current.Added[0], 600)
			} else if len(current.Changed) > 0 {
				current.Summary = trimAndLimit(current.Changed[0], 600)
			} else if len(current.Fixed) > 0 {
				current.Summary = trimAndLimit(current.Fixed[0], 600)
			}
		}
		if current.Version != "" && current.Summary != "" {
			releases = append(releases, *current)
		}
		current = nil
	}

	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		if strings.HasPrefix(strings.ToLower(line), "## v") || strings.HasPrefix(strings.ToLower(line), "## ") {
			pushCurrent()
			version := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(line, "##"), "v"))
			version = strings.TrimPrefix(version, "V")
			current = &userFriendlyMarkdownRelease{
				Version: version,
				Added:   make([]string, 0, 8),
				Changed: make([]string, 0, 8),
				Fixed:   make([]string, 0, 8),
			}
			section = ""
			continue
		}
		if current == nil {
			continue
		}
		switch strings.ToLower(line) {
		case "### summary":
			section = "summary"
			continue
		case "### added":
			section = "added"
			continue
		case "### changed":
			section = "changed"
			continue
		case "### fixed":
			section = "fixed"
			continue
		}

		value := strings.TrimSpace(strings.TrimPrefix(line, "-"))
		value = trimAndLimit(value, 240)
		if value == "" {
			continue
		}
		switch section {
		case "summary":
			if current.Summary == "" {
				current.Summary = value
			} else {
				current.Summary = trimAndLimit(current.Summary+" "+value, 600)
			}
		case "added":
			current.Added = append(current.Added, value)
		case "changed":
			current.Changed = append(current.Changed, value)
		case "fixed":
			current.Fixed = append(current.Fixed, value)
		default:
			if current.Summary == "" {
				current.Summary = value
			}
		}
	}

	pushCurrent()
	return releases
}

func flattenReleaseHighlights(release userFriendlyMarkdownRelease, maxItems int) []string {
	out := make([]string, 0, maxItems)
	for _, item := range release.Added {
		out = append(out, "Added: "+trimAndLimit(item, 180))
		if len(out) >= maxItems {
			return out
		}
	}
	for _, item := range release.Changed {
		out = append(out, "Changed: "+trimAndLimit(item, 180))
		if len(out) >= maxItems {
			return out
		}
	}
	for _, item := range release.Fixed {
		out = append(out, "Fixed: "+trimAndLimit(item, 180))
		if len(out) >= maxItems {
			return out
		}
	}
	return out
}

func mapParsedReleasesToChangelogEntries(releases []userFriendlyMarkdownRelease) []publicWebsiteUserChangelogEntry {
	entries := make([]publicWebsiteUserChangelogEntry, 0, len(releases))
	for i, release := range releases {
		version := trimAndLimit(release.Version, 64)
		summary := trimAndLimit(release.Summary, 500)
		if version == "" || summary == "" {
			continue
		}
		entryID := trimAndLimit("github-release-"+strings.ReplaceAll(strings.ToLower(version), ".", "-"), 120)
		if entryID == "github-release-" {
			entryID = "github-release-" + trimAndLimit(strconv.Itoa(i+1), 16)
		}
		entries = append(entries, publicWebsiteUserChangelogEntry{
			ID:            entryID,
			Version:       version,
			Title:         "Release update",
			Summary:       summary,
			Highlights:    flattenReleaseHighlights(release, 9),
			ReleasedAtUTC: nil,
		})
	}
	return entries
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
	if err := sqliteDB.QueryRowContext(ctx, `SELECT MIN(ingested_at) FROM batches`).Scan(&firstIngest); err != nil { // #nosec G701 -- static aggregate query with no user input.
		return nil, err
	}
	if !firstIngest.Valid || firstIngest.Int64 <= 0 {
		return nil, nil
	}
	value := firstIngest.Int64
	return &value, nil
}

func loadPublicWebsiteUninstallStats(ctx context.Context, sqliteDB *sql.DB) (publicWebsiteUninstallStats, error) {
	var stats publicWebsiteUninstallStats
	var lastSubmitted sql.NullInt64
	// #nosec G701 -- static aggregate query with no dynamic SQL segments.
	if err := sqliteDB.QueryRowContext(
		ctx,
		`SELECT COUNT(*), MAX(created_at) FROM website_uninstall_feedback`,
	).Scan(&stats.TotalSubmissions, &lastSubmitted); err != nil {
		return publicWebsiteUninstallStats{}, err
	}
	if lastSubmitted.Valid && lastSubmitted.Int64 > 0 {
		value := lastSubmitted.Int64
		stats.LastSubmittedAtUTC = &value
	}

	rows, err := sqliteDB.QueryContext(
		ctx,
		`SELECT reason, COUNT(*) AS c
		 FROM website_uninstall_feedback
		 GROUP BY reason
		 ORDER BY c DESC, reason ASC
		 LIMIT 8`,
	) // #nosec G701 -- static reporting query with no user-provided SQL fragments.
	if err != nil {
		return publicWebsiteUninstallStats{}, err
	}
	defer rows.Close()

	topReasons := make([]publicWebsiteReasonCount, 0, 8)
	for rows.Next() {
		var row publicWebsiteReasonCount
		if err := rows.Scan(&row.Reason, &row.Count); err != nil {
			return publicWebsiteUninstallStats{}, err
		}
		topReasons = append(topReasons, row)
	}
	if err := rows.Err(); err != nil {
		return publicWebsiteUninstallStats{}, err
	}

	stats.TopReasons = topReasons
	return stats, nil
}

func sanitizePublicWebsiteUninstallRequest(input publicWebsiteUninstallRequest) publicWebsiteUninstallRequest {
	reason := trimAndLimit(input.Reason, 120)
	browser := strings.ToLower(trimAndLimit(input.Browser, 32))
	version := trimAndLimit(input.Version, 64)
	source := trimAndLimit(input.Source, 64)
	notes := trimAndLimit(input.Notes, 1000)

	if browser == "" {
		browser = "unknown"
	}
	if version == "" {
		version = "unknown"
	}
	if source == "" {
		source = "website"
	}

	return publicWebsiteUninstallRequest{
		Reason:  reason,
		Browser: browser,
		Version: version,
		Source:  source,
		Notes:   notes,
	}
}

func sanitizeWebsiteEventSessionID(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "anonymous"
	}
	if len(value) > 96 {
		value = value[:96]
	}
	return value
}

func sanitizeWebsiteEventPagePath(raw string) string {
	path := strings.TrimSpace(raw)
	if path == "" {
		return "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if len(path) > 200 {
		path = path[:200]
	}
	return path
}

func sanitizeWebsiteEventPlacement(raw string) string {
	placement := strings.ToLower(strings.TrimSpace(raw))
	if placement == "" {
		return "unknown"
	}
	if _, ok := publicWebsiteEventAllowedPlacements[placement]; ok {
		return placement
	}
	return "unknown"
}

func sanitizeWebsiteEventForAggregate(
	input publicWebsiteEventIngestEvent,
	nowUTC time.Time,
) (eventID, eventType, action, placement, dayUTC string, ok bool) {
	eventID = strings.TrimSpace(input.EventID)
	if !websiteEventIDPattern.MatchString(eventID) {
		return "", "", "", "", "", false
	}

	eventType = strings.ToLower(strings.TrimSpace(input.EventType))
	action = strings.ToLower(strings.TrimSpace(input.Action))
	expectedType, actionAllowed := publicWebsiteEventActionToType[action]
	if !actionAllowed {
		return "", "", "", "", "", false
	}
	if eventType == "" {
		eventType = expectedType
	}
	if eventType != expectedType {
		return "", "", "", "", "", false
	}

	placement = sanitizeWebsiteEventPlacement(input.Placement)
	eventTime := nowUTC
	if input.TSUTC != nil && *input.TSUTC > 0 {
		ts := time.UnixMilli(*input.TSUTC).UTC()
		if ts.Year() >= 2015 && ts.Year() <= 2200 {
			eventTime = ts
		}
	}
	dayUTC = eventTime.Format("2006-01-02")
	return eventID, eventType, action, placement, dayUTC, true
}

func trimAndLimit(input string, maxLen int) string {
	input = strings.TrimSpace(input)
	if input == "" || maxLen <= 0 {
		return ""
	}
	runes := []rune(input)
	if len(runes) <= maxLen {
		return input
	}
	return string(runes[:maxLen])
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

func resolveLatestExtensionVersion(ctx context.Context, store *controlPlaneStore) *string {
	if store == nil {
		return nil
	}

	records, err := store.listRecords(ctx, "extension_version_note")
	if err != nil || len(records) == 0 {
		return nil
	}

	bestVersion := ""
	bestRank := int64(-1)
	for _, row := range records {
		data := decodeRecordDataMap(row.Data)
		version := strings.TrimSpace(stringFromAny(data["version"]))
		version = strings.TrimPrefix(version, "v")
		version = trimAndLimit(version, 64)
		if version == "" {
			continue
		}

		rank := int64FromAny(data["releasedAtUtc"])
		if rank <= 0 {
			rank = int64FromAny(data["createdAtUtc"])
		}
		if rank <= 0 {
			rank = row.UpdatedAt
		}
		if rank <= 0 {
			rank = row.CreatedAt
		}

		if rank > bestRank {
			bestRank = rank
			bestVersion = version
		}
	}

	return stringPtrOrNil(bestVersion)
}

func writePublicWebsiteJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", publicWebsiteCacheControl)
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

type publicWebsiteCORSOptions struct {
	AllowedMethods        string
	RequireOriginForWrite bool
	StructuredErrors      bool
}

func preparePublicWebsiteCORS(w http.ResponseWriter, r *http.Request) bool {
	return preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
		AllowedMethods: "GET, OPTIONS",
	})
}

func preparePublicWebsiteCORSWithOptions(w http.ResponseWriter, r *http.Request, options publicWebsiteCORSOptions) bool {
	origin := normalizeRequestOriginHeader(r.Header.Get("Origin"))
	allowAllNoOrigin := origin == ""
	allowed := resolvePublicWebsiteAllowedOrigins()
	allowedMethods := strings.TrimSpace(options.AllowedMethods)
	if allowedMethods == "" {
		allowedMethods = "GET, OPTIONS"
	}
	requireOrigin := options.RequireOriginForWrite && r.Method != http.MethodGet

	if r.Method == http.MethodOptions {
		if origin == "" && requireOrigin {
			writePublicWebsiteCORSFailure(w, options.StructuredErrors, http.StatusForbidden, "origin_required", "Origin header is required for write requests.")
			return false
		}
		if origin != "" && !isOriginAllowed(origin, allowed) {
			writePublicWebsiteCORSFailure(w, options.StructuredErrors, http.StatusForbidden, "origin_not_allowed", "Origin is not allowed for this endpoint.")
			return false
		}
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", allowedMethods)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.WriteHeader(http.StatusNoContent)
		return false
	}

	if requireOrigin && origin == "" {
		writePublicWebsiteCORSFailure(w, options.StructuredErrors, http.StatusForbidden, "origin_required", "Origin header is required for write requests.")
		return false
	}

	if !allowAllNoOrigin && !isOriginAllowed(origin, allowed) {
		writePublicWebsiteCORSFailure(w, options.StructuredErrors, http.StatusForbidden, "origin_not_allowed", "Origin is not allowed for this endpoint.")
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
