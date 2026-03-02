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

		downloads := rawTotals["totalDownloads"]
		countries := make([]publicWebsiteCountryCell, 0, len(rawTotals))

		published, publishedErr := loadWebsitePublishedDataset(r.Context(), sqliteDB)
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

		payload := publicWebsiteMapResponse{
			OK:          true,
			GeneratedAt: time.Now().UTC().UnixMilli(),
			Granularity: "country",
			Countries:   countries,
			Totals: publicWebsiteMapTotals{
				Countries: len(countries),
				Downloads: downloads,
			},
			PrivacyNote: "Country-level usage is aggregated without storing raw IP addresses. VPN/proxy users may appear at exit-node locations.",
		}

		writePublicWebsiteJSON(w, http.StatusOK, payload)
	}
}

func PublicWebsiteStatusHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods: "GET, OPTIONS",
		}) {
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

func PublicWebsiteUserChangelogHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods: "GET, OPTIONS",
		}) {
			return
		}
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		payload, err := buildPublicWebsiteUserChangelog(r.Context(), store)
		if err != nil {
			http.Error(w, "failed to load changelog", http.StatusInternalServerError)
			return
		}

		writePublicWebsiteJSON(w, http.StatusOK, payload)
	}
}

func PublicWebsiteUninstallHandler(sqliteDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !preparePublicWebsiteCORSWithOptions(w, r, publicWebsiteCORSOptions{
			AllowedMethods:        "GET, POST, OPTIONS",
			RequireOriginForWrite: true,
		}) {
			return
		}

		switch r.Method {
		case http.MethodGet:
			stats, err := loadPublicWebsiteUninstallStats(r.Context(), sqliteDB)
			if err != nil {
				http.Error(w, "failed to load uninstall stats", http.StatusInternalServerError)
				return
			}
			writePublicWebsiteJSON(w, http.StatusOK, publicWebsiteUninstallStatsResponse{
				OK:          true,
				GeneratedAt: time.Now().UTC().UnixMilli(),
				Stats:       stats,
			})
			return
		case http.MethodPost:
			if strings.TrimSpace(r.Header.Get("X-Requested-With")) != "XMLHttpRequest" {
				http.Error(w, "missing required header", http.StatusBadRequest)
				return
			}

			var req publicWebsiteUninstallRequest
			if err := decodeJSONBodyStrict(r, &req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			clean := sanitizePublicWebsiteUninstallRequest(req)
			if clean.Reason == "" {
				http.Error(w, "reason is required", http.StatusBadRequest)
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
				http.Error(w, "failed to save feedback", http.StatusInternalServerError)
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
				OK:           true,
				GeneratedAt:  now,
				SubmissionID: submissionID,
				Message:      "Thanks. Your feedback was submitted successfully.",
			})
			return
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
	}
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

	gitHubVersion := fetchGitHubVersionCached(ctx)
	chromeVersion := stringPtrOrNil(lookupBrowserVersion(installs.Browsers, "chrome"))
	firefoxVersion := stringPtrOrNil(lookupBrowserVersion(installs.Browsers, "firefox"))
	edgeVersion := stringPtrOrNil(lookupBrowserVersion(installs.Browsers, "edge"))

	return publicWebsiteOverviewResponse{
		OK:          true,
		GeneratedAt: time.Now().UTC().UnixMilli(),
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

func buildPublicWebsiteUserChangelog(ctx context.Context, store *controlPlaneStore) (publicWebsiteUserChangelogResponse, error) {
	now := time.Now().UTC().UnixMilli()
	fullURL := githubMarkdownURL("CHANGELOG.md")
	records, err := store.listRecords(ctx, publicWebsiteUserChangelogRecordType)
	if err != nil {
		return publicWebsiteUserChangelogResponse{}, err
	}

	entries := make([]publicWebsiteUserChangelogEntry, 0, len(records))
	var lastUpdated *int64
	for _, row := range records {
		data := decodeRecordDataMap(row.Data)
		version := trimAndLimit(stringFromAny(data["version"]), 64)
		title := trimAndLimit(stringFromAny(data["title"]), 120)
		summary := trimAndLimit(stringFromAny(data["summary"]), 500)
		if version == "" || summary == "" {
			continue
		}
		highlights := normalizeStringList(data["highlights"], 6, 180)
		releasedAt := int64PtrFromAny(data["releasedAtUtc"])
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
		latestVersion := "latest"
		if gitHubVersion := fetchGitHubVersionCached(ctx); gitHubVersion != nil && strings.TrimSpace(*gitHubVersion) != "" {
			latestVersion = strings.TrimSpace(*gitHubVersion)
		}
		entries = append(entries, publicWebsiteUserChangelogEntry{
			ID:      "default-latest",
			Version: latestVersion,
			Title:   "Stability and security improvements",
			Summary: "This release focuses on faster downloads, better reliability, and safer handling across supported browsers.",
			Highlights: []string{
				"More stable download handling for large coursework files.",
				"Improved compatibility with recent browser updates.",
				"Security and reliability hardening.",
			},
			ReleasedAtUTC: &now,
		})
		lastUpdated = &now
	}

	return publicWebsiteUserChangelogResponse{
		OK:               true,
		GeneratedAt:      now,
		Headline:         "What's new for students",
		Description:      "Simple release notes focused on what changed and why it helps your daily workflow.",
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

	res, err := http.DefaultClient.Do(req) // #nosec G107,G704 -- fixed GitHub API host with bounded timeout and static path pattern.
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

type publicWebsiteCORSOptions struct {
	AllowedMethods        string
	RequireOriginForWrite bool
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
			http.Error(w, "origin required", http.StatusForbidden)
			return false
		}
		if origin != "" && !isOriginAllowed(origin, allowed) {
			http.Error(w, "origin not allowed", http.StatusForbidden)
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
		http.Error(w, "origin required", http.StatusForbidden)
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
