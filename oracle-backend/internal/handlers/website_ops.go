package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

const (
	websiteSyncDirectionOracleToWebsite           = "oracle_to_website"
	websiteSyncDirectionCloudflareToWebsite       = "cloudflare_to_website"
	websiteSyncDirectionWebsiteToOracle           = "website_to_oracle"
	websiteSyncDirectionCloudflareTrafficToOracle = "cloudflare_traffic_to_oracle"

	defaultCloudflarePublicSiteMetricsURL = "https://cqd-analytics.adhamhaithameid.workers.dev/public/site-metrics"
	websiteOpsBodyLimitBytes              = 256 << 10 // 256 KiB
	websiteAnalyticsMaxPlacements         = 24
	websiteAnalyticsMaxSeriesDays         = 366
)

var websiteCloudflarePullHoursUTC = []int{3, 6, 9, 12, 15, 18, 21}

var (
	errCloudflareWebsiteFetch    = errors.New("cloudflare_website_fetch_failed")
	errCloudflareWebsitePublish  = errors.New("cloudflare_website_publish_failed")
	errWebsiteMonotonicViolation = errors.New("website_dataset_monotonic_violation")
)

type websiteOpsCountryCount struct {
	CountryCode string `json:"countryCode"`
	Count       int64  `json:"count"`
}

type websiteSyncControlRow struct {
	OneAMFlushEnabled    bool
	OverrideEnabled      bool
	OverrideDownloads    int64
	OverrideCountriesRaw string
	PublishedDownloads   int64
	PublishedCountries   string
	PublishedSource      string
	LastOraclePushAt     *int64
	LastCloudflarePushAt *int64
	LastWebsiteIngestAt  *int64
	UpdatedAt            int64
}

type websitePublishedDataset struct {
	Active    bool
	Source    string
	Downloads int64
	Countries []publicWebsiteCountryCell
}

type websiteOpsControlState struct {
	OneAMFlushEnabled    bool                       `json:"oneAmFlushEnabled"`
	OverrideEnabled      bool                       `json:"overrideEnabled"`
	OverrideDownloads    int64                      `json:"overrideDownloads"`
	OverrideCountries    []publicWebsiteCountryCell `json:"overrideCountries"`
	PublishedDownloads   int64                      `json:"publishedDownloads"`
	PublishedCountries   []publicWebsiteCountryCell `json:"publishedCountries"`
	PublishedSource      string                     `json:"publishedSource"`
	LastOraclePushAt     *int64                     `json:"lastOraclePushAt"`
	LastCloudflarePushAt *int64                     `json:"lastCloudflarePushAt"`
	LastWebsiteIngestAt  *int64                     `json:"lastWebsiteIngestAt"`
	UpdatedAt            int64                      `json:"updatedAt"`
}

type websiteOpsBatch struct {
	ID          int64  `json:"id"`
	Direction   string `json:"direction"`
	BatchID     string `json:"batchId"`
	TriggeredBy string `json:"triggeredBy"`
	Status      string `json:"status"`
	CreatedAt   int64  `json:"createdAt"`
	Details     any    `json:"details"`
}

type websiteOpsStateResponse struct {
	OK          bool                   `json:"ok"`
	GeneratedAt int64                  `json:"generatedAt"`
	Control     websiteOpsControlState `json:"control"`
	Anomaly     *websiteSyncAnomaly    `json:"anomaly,omitempty"`
	LastBatches struct {
		OracleToWebsite     *websiteOpsBatch `json:"oracleToWebsite,omitempty"`
		CloudflareToWebsite *websiteOpsBatch `json:"cloudflareToWebsite,omitempty"`
		WebsiteToOracle     *websiteOpsBatch `json:"websiteToOracle,omitempty"`
	} `json:"lastBatches"`
}

type websiteSyncAnomaly struct {
	Active     bool     `json:"active"`
	Source     string   `json:"source"`
	Message    string   `json:"message"`
	Details    []string `json:"details"`
	DetectedAt int64    `json:"detectedAt"`
}

type websiteOpsOverrideRequest struct {
	Enabled   bool                     `json:"enabled"`
	Downloads int64                    `json:"downloads"`
	Countries []websiteOpsCountryCount `json:"countries"`
}

type websiteOpsOneAMRequest struct {
	Enabled bool `json:"enabled"`
}

type websiteAnalyticsRange struct {
	Name     string
	StartDay string
	StartMS  int64
	DayLimit int
}

type websiteAnalyticsDailyPoint struct {
	DayUTC         string `json:"dayUtc"`
	InstallClicks  int64  `json:"installClicks"`
	DownloadClicks int64  `json:"downloadClicks"`
	MapYes         int64  `json:"mapYes"`
	MapNo          int64  `json:"mapNo"`
	Feedback       int64  `json:"feedbackSubmissions"`
}

type websiteAnalyticsPlacementBreakdown struct {
	Placement string `json:"placement"`
	Action    string `json:"action"`
	Count     int64  `json:"count"`
}

type websiteAnalyticsTrafficSummary struct {
	Visits          int64  `json:"visits"`
	Requests        int64  `json:"requests"`
	LastSyncedAtUTC *int64 `json:"lastSyncedAtUtc"`
	Source          string `json:"source"`
	Status          string `json:"status"`
}

type websiteAnalyticsTrafficDailyPoint struct {
	DayUTC   string `json:"dayUtc"`
	Visits   int64  `json:"visits"`
	Requests int64  `json:"requests"`
}

type websiteAnalyticsResponse struct {
	OK           bool                                 `json:"ok"`
	GeneratedAt  int64                                `json:"generatedAt"`
	Range        string                               `json:"range"`
	Buttons      map[string]int64                     `json:"buttons"`
	Map          map[string]any                       `json:"map"`
	Feedback     map[string]any                       `json:"feedback"`
	Daily        []websiteAnalyticsDailyPoint         `json:"daily"`
	Placements   []websiteAnalyticsPlacementBreakdown `json:"placements"`
	Traffic      websiteAnalyticsTrafficSummary       `json:"traffic"`
	TrafficDaily []websiteAnalyticsTrafficDailyPoint  `json:"trafficDaily"`
}

type cloudflareSiteMetricsPayload struct {
	OK     bool `json:"ok"`
	Totals struct {
		Downloads int64 `json:"downloads"`
	} `json:"totals"`
	Countries     []websiteOpsCountryCount `json:"countries"`
	GeneratedAt   int64                    `json:"generatedAt"`
	SnapshotAtUtc int64                    `json:"snapshotAtUtc"`
}

func ensureWebsiteSyncControlRow(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return errors.New("database not available")
	}
	_, err := db.ExecContext(
		ctx,
		`INSERT OR IGNORE INTO website_sync_control (
			id, one_am_flush_enabled, override_enabled, override_downloads,
			override_countries_json, published_downloads, published_countries_json,
			published_source, last_oracle_push_at, last_cloudflare_push_at,
			last_website_ingest_at, updated_at
		) VALUES (1, 1, 0, 0, '[]', 0, '[]', 'oracle', NULL, NULL, NULL, 0)`,
	) // #nosec G701 -- static SQL with bound values only.
	return err
}

func loadWebsiteSyncControl(ctx context.Context, db *sql.DB) (websiteSyncControlRow, error) {
	if err := ensureWebsiteSyncControlRow(ctx, db); err != nil {
		return websiteSyncControlRow{}, err
	}

	var (
		row             websiteSyncControlRow
		oneAMEnabled    int64
		overrideEnabled int64
		lastOracle      sql.NullInt64
		lastCloudflare  sql.NullInt64
		lastWebsite     sql.NullInt64
	)
	err := db.QueryRowContext(
		ctx,
		`SELECT
			one_am_flush_enabled,
			override_enabled,
			override_downloads,
			override_countries_json,
			published_downloads,
			published_countries_json,
			published_source,
			last_oracle_push_at,
			last_cloudflare_push_at,
			last_website_ingest_at,
			updated_at
		FROM website_sync_control
		WHERE id = 1`,
	).Scan(
		&oneAMEnabled,
		&overrideEnabled,
		&row.OverrideDownloads,
		&row.OverrideCountriesRaw,
		&row.PublishedDownloads,
		&row.PublishedCountries,
		&row.PublishedSource,
		&lastOracle,
		&lastCloudflare,
		&lastWebsite,
		&row.UpdatedAt,
	) // #nosec G701 -- static SQL with bound values only.
	if err != nil {
		return websiteSyncControlRow{}, err
	}

	row.OneAMFlushEnabled = oneAMEnabled != 0
	row.OverrideEnabled = overrideEnabled != 0
	row.LastOraclePushAt = nullInt64Ptr(lastOracle)
	row.LastCloudflarePushAt = nullInt64Ptr(lastCloudflare)
	row.LastWebsiteIngestAt = nullInt64Ptr(lastWebsite)
	row.PublishedSource = trimAndLimit(row.PublishedSource, 32)
	if row.PublishedSource == "" {
		row.PublishedSource = "oracle"
	}

	return row, nil
}

func nullInt64Ptr(v sql.NullInt64) *int64 {
	if !v.Valid || v.Int64 <= 0 {
		return nil
	}
	value := v.Int64
	return &value
}

func decodeWebsiteCountryCounts(raw string) []publicWebsiteCountryCell {
	var input []websiteOpsCountryCount
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &input); err != nil {
		return nil
	}
	out := make([]publicWebsiteCountryCell, 0, len(input))
	for _, item := range input {
		code := strings.ToUpper(strings.TrimSpace(item.CountryCode))
		if !isoCountryCodePattern.MatchString(code) || code == "XX" || code == "ZZ" || code == "UN" || code == "EU" {
			continue
		}
		if item.Count <= 0 {
			continue
		}
		out = append(out, publicWebsiteCountryCell{
			CountryCode: code,
			Count:       item.Count,
		})
	}
	return normalizeWebsiteCountryCells(out, 300)
}

func normalizeWebsiteCountryCells(input []publicWebsiteCountryCell, maxItems int) []publicWebsiteCountryCell {
	if len(input) == 0 || maxItems <= 0 {
		return []publicWebsiteCountryCell{}
	}
	agg := make(map[string]int64, len(input))
	for _, row := range input {
		code := strings.ToUpper(strings.TrimSpace(row.CountryCode))
		if !isoCountryCodePattern.MatchString(code) || code == "XX" || code == "ZZ" || code == "UN" || code == "EU" {
			continue
		}
		if row.Count <= 0 {
			continue
		}
		agg[code] += row.Count
	}
	out := make([]publicWebsiteCountryCell, 0, len(agg))
	for code, count := range agg {
		out = append(out, publicWebsiteCountryCell{
			CountryCode: code,
			Count:       count,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count == out[j].Count {
			return out[i].CountryCode < out[j].CountryCode
		}
		return out[i].Count > out[j].Count
	})
	if len(out) > maxItems {
		out = out[:maxItems]
	}
	return out
}

func encodeWebsiteCountryCells(input []publicWebsiteCountryCell) string {
	normalized := normalizeWebsiteCountryCells(input, 300)
	bytes, err := json.Marshal(normalized)
	if err != nil {
		return "[]"
	}
	return string(bytes)
}

func loadWebsiteLiveDataset(ctx context.Context, db *sql.DB) (int64, []publicWebsiteCountryCell, error) {
	rawTotals, err := loadTotals(ctx, db)
	if err != nil {
		return 0, nil, err
	}
	downloads := rawTotals["totalDownloads"]
	countries := make([]publicWebsiteCountryCell, 0, len(rawTotals))
	for key, value := range rawTotals {
		if !strings.HasPrefix(key, "country:") || value <= 0 {
			continue
		}
		code := strings.ToUpper(strings.TrimSpace(strings.TrimPrefix(key, "country:")))
		if !isoCountryCodePattern.MatchString(code) || code == "XX" || code == "ZZ" || code == "UN" || code == "EU" {
			continue
		}
		countries = append(countries, publicWebsiteCountryCell{
			CountryCode: code,
			Count:       value,
		})
	}
	countries = normalizeWebsiteCountryCells(countries, 300)
	return downloads, countries, nil
}

func loadWebsitePublishedDataset(ctx context.Context, db *sql.DB) (websitePublishedDataset, error) {
	row, err := loadWebsiteSyncControl(ctx, db)
	if err != nil {
		return websitePublishedDataset{}, err
	}

	if row.OverrideEnabled {
		return websitePublishedDataset{
			Active:    true,
			Source:    "override",
			Downloads: maxInt64(row.OverrideDownloads, 0),
			Countries: decodeWebsiteCountryCounts(row.OverrideCountriesRaw),
		}, nil
	}

	if row.LastOraclePushAt != nil || row.LastCloudflarePushAt != nil {
		return websitePublishedDataset{
			Active:    true,
			Source:    row.PublishedSource,
			Downloads: maxInt64(row.PublishedDownloads, 0),
			Countries: decodeWebsiteCountryCounts(row.PublishedCountries),
		}, nil
	}

	return websitePublishedDataset{Active: false}, nil
}

func maxInt64(v, min int64) int64 {
	if v < min {
		return min
	}
	return v
}

func updateWebsiteSyncControlRow(ctx context.Context, db *sql.DB, row websiteSyncControlRow) error {
	if err := ensureWebsiteSyncControlRow(ctx, db); err != nil {
		return err
	}
	_, err := db.ExecContext(
		ctx,
		`UPDATE website_sync_control
		 SET one_am_flush_enabled = ?,
		     override_enabled = ?,
		     override_downloads = ?,
		     override_countries_json = ?,
		     published_downloads = ?,
		     published_countries_json = ?,
		     published_source = ?,
		     last_oracle_push_at = ?,
		     last_cloudflare_push_at = ?,
		     last_website_ingest_at = ?,
		     updated_at = ?
		 WHERE id = 1`,
		boolToInt64(row.OneAMFlushEnabled),
		boolToInt64(row.OverrideEnabled),
		maxInt64(row.OverrideDownloads, 0),
		normalizeJSONListText(row.OverrideCountriesRaw),
		maxInt64(row.PublishedDownloads, 0),
		normalizeJSONListText(row.PublishedCountries),
		trimAndLimit(row.PublishedSource, 32),
		ptrInt64OrNil(row.LastOraclePushAt),
		ptrInt64OrNil(row.LastCloudflarePushAt),
		ptrInt64OrNil(row.LastWebsiteIngestAt),
		row.UpdatedAt,
	) // #nosec G701 -- static SQL with bound values only.
	return err
}

func boolToInt64(v bool) int64 {
	if v {
		return 1
	}
	return 0
}

func ptrInt64OrNil(v *int64) any {
	if v == nil || *v <= 0 {
		return nil
	}
	return *v
}

func normalizeJSONListText(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "[]"
	}
	var out any
	if err := json.Unmarshal([]byte(trimmed), &out); err != nil {
		return "[]"
	}
	bytes, err := json.Marshal(out)
	if err != nil {
		return "[]"
	}
	return string(bytes)
}

func newWebsiteBatchID(direction string) string {
	short := strings.ReplaceAll(direction, "_", "-")
	return fmt.Sprintf("ws-%s-%d", short, time.Now().UTC().UnixMilli())
}

func isWebsiteCloudflarePullHour(hourUTC int) bool {
	for _, item := range websiteCloudflarePullHoursUTC {
		if item == hourUTC {
			return true
		}
	}
	return false
}

func makeWebsiteCloudflareSlotKey(now time.Time) string {
	return now.UTC().Format("2006-01-02T15")
}

func shouldRunWebsiteCloudflarePull(now time.Time) bool {
	now = now.UTC()
	if !isWebsiteCloudflarePullHour(now.Hour()) {
		return false
	}
	// Allow first few minutes in case scheduler tick is slightly delayed.
	return now.Minute() >= 0 && now.Minute() <= 5
}

func insertWebsiteSyncBatch(
	ctx context.Context,
	db *sql.DB,
	direction string,
	batchID string,
	triggeredBy string,
	status string,
	details any,
) error {
	if db == nil {
		return errors.New("database not available")
	}
	if strings.TrimSpace(batchID) == "" {
		batchID = newWebsiteBatchID(direction)
	}
	payload, err := json.Marshal(details)
	if err != nil {
		payload = []byte(`{"error":"failed_to_encode_details"}`)
	}
	if strings.TrimSpace(status) == "" {
		status = "ok"
	}
	_, err = db.ExecContext(
		ctx,
		`INSERT INTO website_sync_batches (
			direction, batch_id, triggered_by, status, details_json, created_at
		) VALUES (?, ?, ?, ?, ?, ?)`,
		trimAndLimit(direction, 64),
		trimAndLimit(batchID, 120),
		trimAndLimit(triggeredBy, 120),
		trimAndLimit(status, 32),
		string(payload),
		time.Now().UTC().UnixMilli(),
	) // #nosec G701 -- static SQL with bound values only.
	return err
}

func loadLatestWebsiteSyncBatch(ctx context.Context, db *sql.DB, direction string) (*websiteOpsBatch, error) {
	var (
		row        websiteOpsBatch
		detailsRaw string
	)
	err := db.QueryRowContext(
		ctx,
		`SELECT id, direction, batch_id, triggered_by, status, details_json, created_at
		 FROM website_sync_batches
		 WHERE direction = ?
		 ORDER BY created_at DESC, id DESC
		 LIMIT 1`,
		direction,
	).Scan(
		&row.ID,
		&row.Direction,
		&row.BatchID,
		&row.TriggeredBy,
		&row.Status,
		&detailsRaw,
		&row.CreatedAt,
	) // #nosec G701 -- static SQL with bound values only.
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	var details any
	if err := json.Unmarshal([]byte(strings.TrimSpace(detailsRaw)), &details); err == nil {
		row.Details = details
	} else {
		row.Details = map[string]any{"raw": detailsRaw}
	}
	return &row, nil
}

func publishWebsiteDataset(
	ctx context.Context,
	db *sql.DB,
	source string,
	downloads int64,
	countries []publicWebsiteCountryCell,
	setOraclePush bool,
	setCloudflarePush bool,
) (websiteSyncControlRow, error) {
	row, err := loadWebsiteSyncControl(ctx, db)
	if err != nil {
		return websiteSyncControlRow{}, err
	}

	now := time.Now().UTC().UnixMilli()
	row.PublishedSource = trimAndLimit(source, 32)
	if row.PublishedSource == "" {
		row.PublishedSource = "oracle"
	}
	row.PublishedDownloads = maxInt64(downloads, 0)
	row.PublishedCountries = encodeWebsiteCountryCells(countries)
	row.UpdatedAt = now
	if setOraclePush {
		row.LastOraclePushAt = &now
	}
	if setCloudflarePush {
		row.LastCloudflarePushAt = &now
	}

	if err := updateWebsiteSyncControlRow(ctx, db, row); err != nil {
		return websiteSyncControlRow{}, err
	}
	return row, nil
}

func PublishWebsiteDatasetFromOracle(
	ctx context.Context,
	db *sql.DB,
	triggeredBy string,
) (websiteSyncControlRow, error) {
	downloads, countries, err := loadWebsiteLiveDataset(ctx, db)
	if err != nil {
		return websiteSyncControlRow{}, err
	}
	row, err := publishWebsiteDataset(ctx, db, "oracle", downloads, countries, true, false)
	if err != nil {
		return websiteSyncControlRow{}, err
	}

	details := map[string]any{
		"downloads": downloads,
		"countries": len(countries),
		"source":    "oracle",
	}
	if err := insertWebsiteSyncBatch(
		ctx,
		db,
		websiteSyncDirectionOracleToWebsite,
		newWebsiteBatchID(websiteSyncDirectionOracleToWebsite),
		triggeredBy,
		"ok",
		details,
	); err != nil {
		logEvent("warn", "website_sync_batch_insert_failed", map[string]interface{}{"error": err.Error()})
	}
	return row, nil
}

func PublishWebsiteDatasetFromOracleIfEnabled(
	ctx context.Context,
	db *sql.DB,
	triggeredBy string,
) (bool, error) {
	row, err := loadWebsiteSyncControl(ctx, db)
	if err != nil {
		return false, err
	}
	if !row.OneAMFlushEnabled {
		return false, nil
	}
	if _, err := PublishWebsiteDatasetFromOracle(ctx, db, triggeredBy); err != nil {
		return false, err
	}
	return true, nil
}

func StartWebsiteOneAMPublisherLoop(ctx context.Context, db *sql.DB) {
	if db == nil {
		return
	}
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	lastProcessedDay := ""
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now().UTC()
			dayKey := now.Format("2006-01-02")
			if now.Hour() != 1 {
				continue
			}
			if lastProcessedDay == dayKey {
				continue
			}
			ran, err := PublishWebsiteDatasetFromOracleIfEnabled(context.Background(), db, "oracle_scheduler_1am")
			if err != nil {
				logEvent("error", "website_scheduler_publish_failed", map[string]interface{}{"error": err.Error()})
			} else if ran {
				logEvent("info", "website_scheduler_publish_ok", map[string]interface{}{"day": dayKey})
			} else {
				logEvent("info", "website_scheduler_publish_skipped", map[string]interface{}{"day": dayKey, "reason": "one_am_disabled"})
			}
			lastProcessedDay = dayKey
		}
	}
}

func StartWebsiteCloudflareSlotPullLoop(ctx context.Context, db *sql.DB, cloudflareMetricsURL string) {
	if db == nil {
		return
	}
	targetURL := strings.TrimSpace(cloudflareMetricsURL)
	if targetURL == "" {
		targetURL = defaultCloudflarePublicSiteMetricsURL
	}
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	lastProcessedSlot := ""
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now().UTC()
			if !shouldRunWebsiteCloudflarePull(now) {
				continue
			}
			slotKey := makeWebsiteCloudflareSlotKey(now)
			if slotKey == lastProcessedSlot {
				continue
			}
			_, metrics, err := PullWebsiteDatasetFromCloudflare(
				context.Background(),
				db,
				targetURL,
				"oracle_scheduler_cloudflare_slot",
			)
			if err != nil {
				logEvent("error", "website_scheduler_cloudflare_pull_failed", map[string]interface{}{
					"error": err.Error(),
					"slot":  slotKey,
				})
			} else {
				logEvent("info", "website_scheduler_cloudflare_pull_ok", map[string]interface{}{
					"slot":      slotKey,
					"downloads": metrics.Totals.Downloads,
					"countries": len(metrics.Countries),
				})
			}
			lastProcessedSlot = slotKey
		}
	}
}

func RecordWebsiteToOracleBatch(
	ctx context.Context,
	db *sql.DB,
	submissionID int64,
	browser string,
	version string,
	source string,
) error {
	if db == nil {
		return errors.New("database not available")
	}
	row, err := loadWebsiteSyncControl(ctx, db)
	if err != nil {
		return err
	}
	now := time.Now().UTC().UnixMilli()
	row.LastWebsiteIngestAt = &now
	row.UpdatedAt = now
	if err := updateWebsiteSyncControlRow(ctx, db, row); err != nil {
		return err
	}
	details := map[string]any{
		"submissionId": submissionID,
		"browser":      trimAndLimit(browser, 64),
		"version":      trimAndLimit(version, 64),
		"source":       trimAndLimit(source, 64),
	}
	return insertWebsiteSyncBatch(
		ctx,
		db,
		websiteSyncDirectionWebsiteToOracle,
		newWebsiteBatchID(websiteSyncDirectionWebsiteToOracle),
		"website_uninstall_feedback",
		"ok",
		details,
	)
}

func WebsiteOpsStateHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if db == nil {
			writeJSONError(w, "database_unavailable", "Database not configured", http.StatusServiceUnavailable)
			return
		}
		controlRow, err := loadWebsiteSyncControl(r.Context(), db)
		if err != nil {
			writeJSONError(w, "state_load_failed", "Failed to load website sync state", http.StatusInternalServerError)
			return
		}
		oracleBatch, err := loadLatestWebsiteSyncBatch(r.Context(), db, websiteSyncDirectionOracleToWebsite)
		if err != nil {
			writeJSONError(w, "state_load_failed", "Failed to load latest website sync batches", http.StatusInternalServerError)
			return
		}
		cloudflareBatch, err := loadLatestWebsiteSyncBatch(r.Context(), db, websiteSyncDirectionCloudflareToWebsite)
		if err != nil {
			writeJSONError(w, "state_load_failed", "Failed to load latest website sync batches", http.StatusInternalServerError)
			return
		}
		websiteBatch, err := loadLatestWebsiteSyncBatch(r.Context(), db, websiteSyncDirectionWebsiteToOracle)
		if err != nil {
			writeJSONError(w, "state_load_failed", "Failed to load latest website sync batches", http.StatusInternalServerError)
			return
		}

		response := websiteOpsStateResponse{
			OK:          true,
			GeneratedAt: time.Now().UTC().UnixMilli(),
			Control: websiteOpsControlState{
				OneAMFlushEnabled:    controlRow.OneAMFlushEnabled,
				OverrideEnabled:      controlRow.OverrideEnabled,
				OverrideDownloads:    maxInt64(controlRow.OverrideDownloads, 0),
				OverrideCountries:    decodeWebsiteCountryCounts(controlRow.OverrideCountriesRaw),
				PublishedDownloads:   maxInt64(controlRow.PublishedDownloads, 0),
				PublishedCountries:   decodeWebsiteCountryCounts(controlRow.PublishedCountries),
				PublishedSource:      controlRow.PublishedSource,
				LastOraclePushAt:     controlRow.LastOraclePushAt,
				LastCloudflarePushAt: controlRow.LastCloudflarePushAt,
				LastWebsiteIngestAt:  controlRow.LastWebsiteIngestAt,
				UpdatedAt:            controlRow.UpdatedAt,
			},
		}
		response.LastBatches.OracleToWebsite = oracleBatch
		response.LastBatches.CloudflareToWebsite = cloudflareBatch
		response.LastBatches.WebsiteToOracle = websiteBatch

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}
}

func WebsiteOpsForcePushHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if db == nil {
			writeJSONError(w, "database_unavailable", "Database not configured", http.StatusServiceUnavailable)
			return
		}

		row, err := PublishWebsiteDatasetFromOracle(r.Context(), db, "oracle_admin_force_push")
		if err != nil {
			writeJSONError(w, "force_push_failed", "Failed to force publish website data", http.StatusInternalServerError)
			return
		}
		_ = AppendAuditLog(
			r.Context(),
			db,
			"website_force_push",
			"website_sync",
			"oracle_to_website",
			"ok",
			map[string]any{
				"publishedSource": row.PublishedSource,
				"downloads":       row.PublishedDownloads,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"published": map[string]any{
				"source":           row.PublishedSource,
				"downloads":        row.PublishedDownloads,
				"countries":        decodeWebsiteCountryCounts(row.PublishedCountries),
				"lastOraclePushAt": row.LastOraclePushAt,
			},
		})
	}
}

func WebsiteOpsPullCloudflareHandler(db *sql.DB, cloudflareMetricsURL string) http.HandlerFunc {
	targetURL := strings.TrimSpace(cloudflareMetricsURL)
	if targetURL == "" {
		targetURL = defaultCloudflarePublicSiteMetricsURL
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if db == nil {
			writeJSONError(w, "database_unavailable", "Database not configured", http.StatusServiceUnavailable)
			return
		}

		row, metrics, err := PullWebsiteDatasetFromCloudflare(
			r.Context(),
			db,
			targetURL,
			"oracle_admin_pull_cloudflare",
		)
		if err != nil {
			statusCode := http.StatusBadGateway
			message := "Failed to fetch Cloudflare website metrics"
			if errors.Is(err, errCloudflareWebsitePublish) {
				statusCode = http.StatusInternalServerError
				message = "Failed to store Cloudflare website metrics"
			}
			writeJSONError(w, "cloudflare_pull_failed", message, statusCode)
			return
		}

		_ = AppendAuditLog(
			r.Context(),
			db,
			"website_pull_cloudflare",
			"website_sync",
			"cloudflare_to_website",
			"ok",
			map[string]any{
				"downloads": metrics.Totals.Downloads,
				"countries": len(metrics.Countries),
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"published": map[string]any{
				"source":               row.PublishedSource,
				"downloads":            row.PublishedDownloads,
				"countries":            decodeWebsiteCountryCounts(row.PublishedCountries),
				"lastCloudflarePushAt": row.LastCloudflarePushAt,
			},
		})
	}
}

func PullWebsiteDatasetFromCloudflare(
	ctx context.Context,
	db *sql.DB,
	cloudflareMetricsURL string,
	triggeredBy string,
) (websiteSyncControlRow, cloudflareSiteMetricsPayload, error) {
	targetURL := strings.TrimSpace(cloudflareMetricsURL)
	if targetURL == "" {
		targetURL = defaultCloudflarePublicSiteMetricsURL
	}
	metrics, err := fetchCloudflareWebsiteMetrics(ctx, targetURL)
	if err != nil {
		return websiteSyncControlRow{}, cloudflareSiteMetricsPayload{}, fmt.Errorf("%w: %v", errCloudflareWebsiteFetch, err)
	}

	countries := make([]publicWebsiteCountryCell, 0, len(metrics.Countries))
	for _, row := range metrics.Countries {
		countries = append(countries, publicWebsiteCountryCell{
			CountryCode: row.CountryCode,
			Count:       row.Count,
		})
	}
	countries = normalizeWebsiteCountryCells(countries, 300)

	row, err := publishWebsiteDataset(
		ctx,
		db,
		"cloudflare",
		metrics.Totals.Downloads,
		countries,
		false,
		true,
	)
	if err != nil {
		return websiteSyncControlRow{}, cloudflareSiteMetricsPayload{}, fmt.Errorf("%w: %v", errCloudflareWebsitePublish, err)
	}

	_ = insertWebsiteSyncBatch(
		ctx,
		db,
		websiteSyncDirectionCloudflareToWebsite,
		newWebsiteBatchID(websiteSyncDirectionCloudflareToWebsite),
		triggeredBy,
		"ok",
		map[string]any{
			"downloads":     metrics.Totals.Downloads,
			"countries":     len(countries),
			"snapshotAtUtc": metrics.SnapshotAtUtc,
			"generatedAt":   metrics.GeneratedAt,
		},
	)

	return row, metrics, nil
}

func fetchCloudflareWebsiteMetrics(ctx context.Context, endpoint string) (cloudflareSiteMetricsPayload, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, endpoint, nil)
	if err != nil {
		return cloudflareSiteMetricsPayload{}, err
	}
	res, err := http.DefaultClient.Do(req) // #nosec G107,G704 -- endpoint is admin-configured for trusted Cloudflare metrics origin.
	if err != nil {
		return cloudflareSiteMetricsPayload{}, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return cloudflareSiteMetricsPayload{}, errors.New("non-2xx response from cloudflare metrics endpoint")
	}
	var payload cloudflareSiteMetricsPayload
	if err := json.NewDecoder(io.LimitReader(res.Body, 512*1024)).Decode(&payload); err != nil {
		return cloudflareSiteMetricsPayload{}, err
	}
	if !payload.OK {
		return cloudflareSiteMetricsPayload{}, errors.New("cloudflare metrics endpoint returned ok=false")
	}
	payload.Countries = normalizeWebsiteOpsCountries(payload.Countries, 300)
	payload.Totals.Downloads = maxInt64(payload.Totals.Downloads, 0)
	return payload, nil
}

func normalizeWebsiteOpsCountries(input []websiteOpsCountryCount, maxItems int) []websiteOpsCountryCount {
	if len(input) == 0 || maxItems <= 0 {
		return []websiteOpsCountryCount{}
	}
	agg := make(map[string]int64, len(input))
	for _, row := range input {
		code := strings.ToUpper(strings.TrimSpace(row.CountryCode))
		if !isoCountryCodePattern.MatchString(code) || code == "XX" || code == "ZZ" || code == "UN" || code == "EU" {
			continue
		}
		if row.Count <= 0 {
			continue
		}
		agg[code] += row.Count
	}
	out := make([]websiteOpsCountryCount, 0, len(agg))
	for code, count := range agg {
		out = append(out, websiteOpsCountryCount{
			CountryCode: code,
			Count:       count,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count == out[j].Count {
			return out[i].CountryCode < out[j].CountryCode
		}
		return out[i].Count > out[j].Count
	})
	if len(out) > maxItems {
		out = out[:maxItems]
	}
	return out
}

func WebsiteOpsOverrideHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if db == nil {
			writeJSONError(w, "database_unavailable", "Database not configured", http.StatusServiceUnavailable)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, websiteOpsBodyLimitBytes)
		var req websiteOpsOverrideRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			writeJSONError(w, "invalid_body", "Invalid request body", http.StatusBadRequest)
			return
		}

		row, err := loadWebsiteSyncControl(r.Context(), db)
		if err != nil {
			writeJSONError(w, "override_failed", "Failed to load website sync state", http.StatusInternalServerError)
			return
		}
		now := time.Now().UTC().UnixMilli()
		row.OverrideEnabled = req.Enabled
		row.UpdatedAt = now
		if req.Enabled {
			row.OverrideDownloads = maxInt64(req.Downloads, 0)
			overrideCountries := make([]publicWebsiteCountryCell, 0, len(req.Countries))
			for _, item := range req.Countries {
				overrideCountries = append(overrideCountries, publicWebsiteCountryCell{
					CountryCode: item.CountryCode,
					Count:       item.Count,
				})
			}
			overrideCountries = normalizeWebsiteCountryCells(overrideCountries, 300)
			row.OverrideCountriesRaw = encodeWebsiteCountryCells(overrideCountries)
			row.PublishedSource = "override"
			row.PublishedDownloads = row.OverrideDownloads
			row.PublishedCountries = row.OverrideCountriesRaw

			if err := insertWebsiteSyncBatch(
				r.Context(),
				db,
				websiteSyncDirectionOracleToWebsite,
				newWebsiteBatchID(websiteSyncDirectionOracleToWebsite),
				"oracle_admin_override",
				"ok",
				map[string]any{
					"downloads": row.OverrideDownloads,
					"countries": len(overrideCountries),
					"enabled":   true,
				},
			); err != nil {
				logEvent("warn", "website_override_batch_insert_failed", map[string]interface{}{"error": err.Error()})
			}
		} else {
			if err := insertWebsiteSyncBatch(
				r.Context(),
				db,
				websiteSyncDirectionOracleToWebsite,
				newWebsiteBatchID(websiteSyncDirectionOracleToWebsite),
				"oracle_admin_override",
				"ok",
				map[string]any{
					"enabled": false,
				},
			); err != nil {
				logEvent("warn", "website_override_batch_insert_failed", map[string]interface{}{"error": err.Error()})
			}
		}

		if err := updateWebsiteSyncControlRow(r.Context(), db, row); err != nil {
			writeJSONError(w, "override_failed", "Failed to update website override", http.StatusInternalServerError)
			return
		}
		_ = AppendAuditLog(
			r.Context(),
			db,
			"website_override_update",
			"website_sync",
			"override",
			"ok",
			map[string]any{
				"enabled":   row.OverrideEnabled,
				"downloads": row.OverrideDownloads,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"override": map[string]any{
				"enabled":   row.OverrideEnabled,
				"downloads": row.OverrideDownloads,
				"countries": decodeWebsiteCountryCounts(row.OverrideCountriesRaw),
			},
		})
	}
}

func WebsiteOpsOneAMToggleHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if db == nil {
			writeJSONError(w, "database_unavailable", "Database not configured", http.StatusServiceUnavailable)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, websiteOpsBodyLimitBytes)
		var req websiteOpsOneAMRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			writeJSONError(w, "invalid_body", "Invalid request body", http.StatusBadRequest)
			return
		}

		row, err := loadWebsiteSyncControl(r.Context(), db)
		if err != nil {
			writeJSONError(w, "toggle_failed", "Failed to load website sync state", http.StatusInternalServerError)
			return
		}
		row.OneAMFlushEnabled = req.Enabled
		row.UpdatedAt = time.Now().UTC().UnixMilli()
		if err := updateWebsiteSyncControlRow(r.Context(), db, row); err != nil {
			writeJSONError(w, "toggle_failed", "Failed to update 1am website flush setting", http.StatusInternalServerError)
			return
		}
		_ = AppendAuditLog(
			r.Context(),
			db,
			"website_one_am_toggle",
			"website_sync",
			"one_am_flush",
			"ok",
			map[string]any{
				"enabled": req.Enabled,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":                true,
			"oneAmFlushEnabled": row.OneAMFlushEnabled,
		})
	}
}
