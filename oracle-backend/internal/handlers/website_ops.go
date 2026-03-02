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
	return insertWebsiteSyncBatchWithRunner(ctx, db, direction, batchID, triggeredBy, status, details, time.Now().UTC().UnixMilli())
}

type websiteSyncExecRunner interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func insertWebsiteSyncBatchWithRunner(
	ctx context.Context,
	runner websiteSyncExecRunner,
	direction string,
	batchID string,
	triggeredBy string,
	status string,
	details any,
	createdAt int64,
) error {
	if runner == nil {
		return errors.New("exec runner not available")
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
	_, err = runner.ExecContext(
		ctx,
		`INSERT INTO website_sync_batches (
			direction, batch_id, triggered_by, status, details_json, created_at
		) VALUES (?, ?, ?, ?, ?, ?)`,
		trimAndLimit(direction, 64),
		trimAndLimit(batchID, 120),
		trimAndLimit(triggeredBy, 120),
		trimAndLimit(status, 32),
		string(payload),
		createdAt,
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

	prevDownloads := maxInt64(row.PublishedDownloads, 0)
	prevCountries := decodeWebsiteCountryCounts(row.PublishedCountries)
	nextDownloads := maxInt64(downloads, 0)
	nextCountries := normalizeWebsiteCountryCells(countries, 300)
	violations := detectWebsiteDatasetMonotonicViolations(prevDownloads, prevCountries, nextDownloads, nextCountries)
	if len(violations) > 0 {
		_ = AppendAuditLog(
			ctx,
			db,
			"website_dataset_monotonic_violation",
			"website_sync",
			trimAndLimit(source, 32),
			"blocked",
			map[string]any{
				"source":        trimAndLimit(source, 32),
				"prevDownloads": prevDownloads,
				"nextDownloads": nextDownloads,
				"violations":    violations,
			},
		)
		return websiteSyncControlRow{}, fmt.Errorf("%w: %s", errWebsiteMonotonicViolation, strings.Join(violations, "; "))
	}

	now := time.Now().UTC().UnixMilli()
	row.PublishedSource = trimAndLimit(source, 32)
	if row.PublishedSource == "" {
		row.PublishedSource = "oracle"
	}
	row.PublishedDownloads = nextDownloads
	row.PublishedCountries = encodeWebsiteCountryCells(nextCountries)
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

func detectWebsiteDatasetMonotonicViolations(
	prevDownloads int64,
	prevCountries []publicWebsiteCountryCell,
	nextDownloads int64,
	nextCountries []publicWebsiteCountryCell,
) []string {
	violations := make([]string, 0, 32)
	if prevDownloads > 0 && nextDownloads < prevDownloads {
		violations = append(violations, fmt.Sprintf("downloads decreased (%d -> %d)", prevDownloads, nextDownloads))
	}

	prevMap := make(map[string]int64, len(prevCountries))
	for _, row := range prevCountries {
		code := strings.ToUpper(strings.TrimSpace(row.CountryCode))
		if code == "" || row.Count <= 0 {
			continue
		}
		prevMap[code] = row.Count
	}
	nextMap := make(map[string]int64, len(nextCountries))
	for _, row := range nextCountries {
		code := strings.ToUpper(strings.TrimSpace(row.CountryCode))
		if code == "" || row.Count <= 0 {
			continue
		}
		nextMap[code] = row.Count
	}

	for code, prev := range prevMap {
		next := nextMap[code]
		if next < prev {
			violations = append(violations, fmt.Sprintf("country %s decreased (%d -> %d)", code, prev, next))
		}
	}

	if len(violations) > 25 {
		return violations[:25]
	}
	return violations
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
	now := time.Now().UTC().UnixMilli()
	if err := markWebsiteIngestTimestamp(ctx, db, now); err != nil {
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

func RecordWebsiteEventsIngestBatch(
	ctx context.Context,
	db *sql.DB,
	acceptedCount int,
	rejectedCount int,
	sessionID string,
	pagePath string,
) error {
	if db == nil {
		return errors.New("database not available")
	}
	now := time.Now().UTC().UnixMilli()
	if err := markWebsiteIngestTimestamp(ctx, db, now); err != nil {
		return err
	}

	details := map[string]any{
		"acceptedCount": acceptedCount,
		"rejectedCount": rejectedCount,
		"sessionId":     trimAndLimit(sessionID, 96),
		"pagePath":      trimAndLimit(pagePath, 200),
	}
	return insertWebsiteSyncBatch(
		ctx,
		db,
		websiteSyncDirectionWebsiteToOracle,
		newWebsiteBatchID(websiteSyncDirectionWebsiteToOracle),
		"website_events_ingest",
		"ok",
		details,
	)
}

func RecordWebsiteEventsBatchIngest(
	ctx context.Context,
	db *sql.DB,
	batchID string,
	acceptedCount int,
	rejectedCount int,
	attempt int,
	sessionID string,
	pagePath string,
	generatedAtUTC int64,
) error {
	if db == nil {
		return errors.New("database not available")
	}
	now := time.Now().UTC().UnixMilli()
	if err := markWebsiteIngestTimestamp(ctx, db, now); err != nil {
		return err
	}

	details := map[string]any{
		"acceptedCount":  acceptedCount,
		"rejectedCount":  rejectedCount,
		"attempt":        attempt,
		"sessionId":      trimAndLimit(sessionID, 96),
		"pagePath":       trimAndLimit(pagePath, 200),
		"generatedAtUtc": generatedAtUTC,
	}
	return insertWebsiteSyncBatch(
		ctx,
		db,
		websiteSyncDirectionWebsiteToOracle,
		trimAndLimit(batchID, 160),
		"worker_website_events_batch",
		"ok",
		details,
	)
}

func markWebsiteIngestTimestamp(ctx context.Context, db *sql.DB, now int64) error {
	row, err := loadWebsiteSyncControl(ctx, db)
	if err != nil {
		return err
	}
	row.LastWebsiteIngestAt = &now
	row.UpdatedAt = now
	if err := updateWebsiteSyncControlRow(ctx, db, row); err != nil {
		return err
	}
	return nil
}

func markWebsiteIngestTimestampTx(ctx context.Context, tx *sql.Tx, now int64) error {
	if tx == nil {
		return errors.New("transaction not available")
	}
	_, err := tx.ExecContext(
		ctx,
		`UPDATE website_sync_control
		 SET last_website_ingest_at = ?, updated_at = ?
		 WHERE id = 1`,
		now,
		now,
	) // #nosec G701 -- static SQL with bound values only.
	return err
}

func loadLatestWebsiteMonotonicAnomaly(ctx context.Context, db *sql.DB) (*websiteSyncAnomaly, error) {
	var tsUTC sql.NullInt64
	var resourceID sql.NullString
	var payloadRaw sql.NullString
	err := db.QueryRowContext(
		ctx,
		`SELECT ts_utc, resource_id, payload_json
		 FROM admin_audit_log
		 WHERE action_type = 'website_dataset_monotonic_violation'
		 ORDER BY ts_utc DESC
		 LIMIT 1`,
	).Scan(&tsUTC, &resourceID, &payloadRaw) // #nosec G701 -- static SQL with no dynamic fragments.
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if !tsUTC.Valid || tsUTC.Int64 <= 0 {
		return nil, nil
	}
	var latestResolvedAt sql.NullInt64
	// #nosec G701 -- static SQL with no user-controlled fragments.
	if err := db.QueryRowContext(
		ctx,
		`SELECT MAX(created_at)
		 FROM website_sync_batches
		 WHERE status = 'ok'`,
	).Scan(&latestResolvedAt); err == nil { // #nosec G701 -- static query with no user-controlled SQL fragments.
		if latestResolvedAt.Valid && latestResolvedAt.Int64 >= tsUTC.Int64 {
			return nil, nil
		}
	}
	payload := map[string]any{}
	if payloadRaw.Valid {
		_ = json.Unmarshal([]byte(payloadRaw.String), &payload)
	}
	details := normalizeWebsiteAnomalyDetails(payload["violations"], 8, 200)
	msg := "Published totals decrease guard blocked a dataset update."
	if len(details) > 0 {
		msg = details[0]
	}
	return &websiteSyncAnomaly{
		Active:     true,
		Source:     trimAndLimit(resourceID.String, 48),
		Message:    msg,
		Details:    details,
		DetectedAt: tsUTC.Int64,
	}, nil
}

func normalizeWebsiteAnomalyDetails(value any, maxItems int, maxLen int) []string {
	out := make([]string, 0, maxItems)
	switch typed := value.(type) {
	case []string:
		for _, row := range typed {
			item := trimAndLimit(row, maxLen)
			if item == "" {
				continue
			}
			out = append(out, item)
			if len(out) >= maxItems {
				break
			}
		}
	case []any:
		for _, raw := range typed {
			item := trimAndLimit(stringFromAny(raw), maxLen)
			if item == "" {
				continue
			}
			out = append(out, item)
			if len(out) >= maxItems {
				break
			}
		}
	}
	return out
}

func mergeWebsiteCountryByMax(
	base []publicWebsiteCountryCell,
	additional []publicWebsiteCountryCell,
	maxItems int,
) []publicWebsiteCountryCell {
	agg := make(map[string]int64, len(base)+len(additional))
	for _, row := range base {
		code := strings.ToUpper(strings.TrimSpace(row.CountryCode))
		if !isoCountryCodePattern.MatchString(code) || row.Count <= 0 {
			continue
		}
		agg[code] = maxInt64(agg[code], row.Count)
	}
	for _, row := range additional {
		code := strings.ToUpper(strings.TrimSpace(row.CountryCode))
		if !isoCountryCodePattern.MatchString(code) || row.Count <= 0 {
			continue
		}
		agg[code] = maxInt64(agg[code], row.Count)
	}
	merged := make([]publicWebsiteCountryCell, 0, len(agg))
	for code, count := range agg {
		merged = append(merged, publicWebsiteCountryCell{
			CountryCode: code,
			Count:       maxInt64(count, 0),
		})
	}
	return normalizeWebsiteCountryCells(merged, maxItems)
}

func rebuildWebsiteDatasetFromTrustedHistory(
	ctx context.Context,
	db *sql.DB,
) (int64, []publicWebsiteCountryCell, error) {
	if db == nil {
		return 0, nil, errors.New("database not available")
	}

	var downloads sql.NullInt64
	// #nosec G701 -- static SQL with no user-controlled fragments.
	if err := db.QueryRowContext(
		ctx,
		`SELECT COALESCE(SUM(total_downloads), 0) FROM downloads_hourly`,
	).Scan(&downloads); err != nil { // #nosec G701 -- static query with no user-controlled SQL fragments.
		return 0, nil, err
	}

	rows, err := db.QueryContext(
		ctx,
		`SELECT by_country_json FROM downloads_hourly`,
	) // #nosec G701 -- static query with no user-controlled SQL fragments.
	if err != nil {
		return 0, nil, err
	}
	defer rows.Close()

	agg := make(map[string]int64, 256)
	for rows.Next() {
		var raw sql.NullString
		if scanErr := rows.Scan(&raw); scanErr != nil {
			return 0, nil, scanErr
		}
		for code, count := range decodeCounterMap(raw.String) {
			normalized := strings.ToUpper(strings.TrimSpace(code))
			if !isoCountryCodePattern.MatchString(normalized) || normalized == "XX" || normalized == "ZZ" || normalized == "UN" || normalized == "EU" {
				continue
			}
			if count <= 0 {
				continue
			}
			agg[normalized] += count
		}
	}
	if err := rows.Err(); err != nil {
		return 0, nil, err
	}

	countries := make([]publicWebsiteCountryCell, 0, len(agg))
	for code, count := range agg {
		countries = append(countries, publicWebsiteCountryCell{
			CountryCode: code,
			Count:       maxInt64(count, 0),
		})
	}
	countries = normalizeWebsiteCountryCells(countries, 300)
	return maxInt64(downloads.Int64, 0), countries, nil
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
		anomaly, anomalyErr := loadLatestWebsiteMonotonicAnomaly(r.Context(), db)
		if anomalyErr == nil {
			response.Anomaly = anomaly
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}
}

func WebsiteAnalyticsHandler(db *sql.DB, trafficCfg WebsiteTrafficSyncConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if db == nil {
			writeJSONError(w, "database_unavailable", "Database not configured", http.StatusServiceUnavailable)
			return
		}

		rng := resolveWebsiteAnalyticsRange(r.URL.Query().Get("range"), time.Now().UTC())
		ctx := r.Context()

		actions := map[string]int64{
			"install_click":  0,
			"download_click": 0,
			"map_yes":        0,
			"map_no":         0,
		}

		actionQuery := `SELECT action, SUM(count) AS total
			FROM website_event_daily`
		actionArgs := []any{}
		if rng.StartDay != "" {
			actionQuery += ` WHERE day_utc >= ?`
			actionArgs = append(actionArgs, rng.StartDay)
		}
		actionQuery += ` GROUP BY action`
		actionRows, err := db.QueryContext(ctx, actionQuery, actionArgs...) // #nosec G701 -- query is assembled from fixed clauses only; values stay parameterized.
		if err != nil {
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		for actionRows.Next() {
			var action string
			var total int64
			if scanErr := actionRows.Scan(&action, &total); scanErr != nil {
				_ = actionRows.Close()
				writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
				return
			}
			if _, ok := actions[action]; ok {
				actions[action] = maxInt64(total, 0)
			}
		}
		if err := actionRows.Err(); err != nil {
			_ = actionRows.Close()
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		_ = actionRows.Close()

		dailyCap := rng.DayLimit
		if dailyCap < 1 {
			dailyCap = 1
		}
		dailyByDay := make(map[string]*websiteAnalyticsDailyPoint, dailyCap)
		daily := make([]websiteAnalyticsDailyPoint, 0, dailyCap)
		dailyQuery := `SELECT
				day_utc,
				SUM(CASE WHEN action = 'install_click' THEN count ELSE 0 END) AS install_clicks,
				SUM(CASE WHEN action = 'download_click' THEN count ELSE 0 END) AS download_clicks,
				SUM(CASE WHEN action = 'map_yes' THEN count ELSE 0 END) AS map_yes,
				SUM(CASE WHEN action = 'map_no' THEN count ELSE 0 END) AS map_no
			FROM website_event_daily`
		dailyArgs := []any{}
		if rng.StartDay != "" {
			dailyQuery += ` WHERE day_utc >= ?`
			dailyArgs = append(dailyArgs, rng.StartDay)
		}
		dailyQuery += ` GROUP BY day_utc ORDER BY day_utc DESC LIMIT ?`
		dailyArgs = append(dailyArgs, rng.DayLimit)
		dailyRows, err := db.QueryContext(ctx, dailyQuery, dailyArgs...) // #nosec G701 -- query is assembled from fixed clauses only; values stay parameterized.
		if err != nil {
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		for dailyRows.Next() {
			var row websiteAnalyticsDailyPoint
			if scanErr := dailyRows.Scan(&row.DayUTC, &row.InstallClicks, &row.DownloadClicks, &row.MapYes, &row.MapNo); scanErr != nil {
				_ = dailyRows.Close()
				writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
				return
			}
			row.DayUTC = trimAndLimit(strings.TrimSpace(row.DayUTC), 16)
			if row.DayUTC == "" {
				continue
			}
			row.InstallClicks = maxInt64(row.InstallClicks, 0)
			row.DownloadClicks = maxInt64(row.DownloadClicks, 0)
			row.MapYes = maxInt64(row.MapYes, 0)
			row.MapNo = maxInt64(row.MapNo, 0)
			row.Feedback = 0
			copyRow := row
			dailyByDay[row.DayUTC] = &copyRow
		}
		if err := dailyRows.Err(); err != nil {
			_ = dailyRows.Close()
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		_ = dailyRows.Close()

		placements := make([]websiteAnalyticsPlacementBreakdown, 0, websiteAnalyticsMaxPlacements)
		placementsQuery := `SELECT placement, action, SUM(count) AS total
			FROM website_event_daily`
		placementsArgs := []any{}
		if rng.StartDay != "" {
			placementsQuery += ` WHERE day_utc >= ?`
			placementsArgs = append(placementsArgs, rng.StartDay)
		}
		placementsQuery += ` GROUP BY placement, action ORDER BY total DESC, placement ASC LIMIT ?`
		placementsArgs = append(placementsArgs, websiteAnalyticsMaxPlacements)
		placementsRows, err := db.QueryContext(ctx, placementsQuery, placementsArgs...) // #nosec G701 -- query is assembled from fixed clauses only; values stay parameterized.
		if err != nil {
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		for placementsRows.Next() {
			var row websiteAnalyticsPlacementBreakdown
			if scanErr := placementsRows.Scan(&row.Placement, &row.Action, &row.Count); scanErr != nil {
				_ = placementsRows.Close()
				writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
				return
			}
			row.Placement = trimAndLimit(row.Placement, 80)
			row.Action = trimAndLimit(row.Action, 40)
			row.Count = maxInt64(row.Count, 0)
			placements = append(placements, row)
		}
		if err := placementsRows.Err(); err != nil {
			_ = placementsRows.Close()
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		_ = placementsRows.Close()

		feedbackQuery := `SELECT COUNT(*), MAX(created_at) FROM website_uninstall_feedback`
		feedbackArgs := []any{}
		if rng.StartMS > 0 {
			feedbackQuery += ` WHERE created_at >= ?`
			feedbackArgs = append(feedbackArgs, rng.StartMS)
		}

		var feedbackTotal int64
		var feedbackLast sql.NullInt64
		if err := db.QueryRowContext(ctx, feedbackQuery, feedbackArgs...).Scan(&feedbackTotal, &feedbackLast); err != nil { // #nosec G701 -- query is assembled from fixed clauses only; values stay parameterized.
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}

		reasonsQuery := `SELECT reason, COUNT(*) AS c
			FROM website_uninstall_feedback`
		reasonsArgs := []any{}
		if rng.StartMS > 0 {
			reasonsQuery += ` WHERE created_at >= ?`
			reasonsArgs = append(reasonsArgs, rng.StartMS)
		}
		reasonsQuery += ` GROUP BY reason ORDER BY c DESC, reason ASC LIMIT 8`
		reasonRows, err := db.QueryContext(ctx, reasonsQuery, reasonsArgs...) // #nosec G701 -- query is assembled from fixed clauses only; values stay parameterized.
		if err != nil {
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		topReasons := make([]publicWebsiteReasonCount, 0, 8)
		for reasonRows.Next() {
			var row publicWebsiteReasonCount
			if scanErr := reasonRows.Scan(&row.Reason, &row.Count); scanErr != nil {
				_ = reasonRows.Close()
				writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
				return
			}
			row.Reason = trimAndLimit(row.Reason, 120)
			row.Count = maxInt64(row.Count, 0)
			topReasons = append(topReasons, row)
		}
		if err := reasonRows.Err(); err != nil {
			_ = reasonRows.Close()
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		_ = reasonRows.Close()

		feedbackDailyQuery := `SELECT
				strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day_utc,
				COUNT(*) AS total
			FROM website_uninstall_feedback`
		feedbackDailyArgs := []any{}
		if rng.StartMS > 0 {
			feedbackDailyQuery += ` WHERE created_at >= ?`
			feedbackDailyArgs = append(feedbackDailyArgs, rng.StartMS)
		}
		feedbackDailyQuery += ` GROUP BY day_utc ORDER BY day_utc DESC LIMIT ?`
		feedbackDailyArgs = append(feedbackDailyArgs, dailyCap)
		feedbackDailyRows, err := db.QueryContext(ctx, feedbackDailyQuery, feedbackDailyArgs...) // #nosec G701 -- query is assembled from fixed clauses only; values stay parameterized.
		if err != nil {
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		feedbackDaily := make([]map[string]any, 0, dailyCap)
		for feedbackDailyRows.Next() {
			var dayUTC string
			var total int64
			if scanErr := feedbackDailyRows.Scan(&dayUTC, &total); scanErr != nil {
				_ = feedbackDailyRows.Close()
				writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
				return
			}
			dayUTC = trimAndLimit(strings.TrimSpace(dayUTC), 16)
			if dayUTC == "" {
				continue
			}
			total = maxInt64(total, 0)
			feedbackDaily = append(feedbackDaily, map[string]any{
				"dayUtc":      dayUTC,
				"submissions": total,
			})
			if current, ok := dailyByDay[dayUTC]; ok {
				current.Feedback = total
			} else {
				dailyByDay[dayUTC] = &websiteAnalyticsDailyPoint{
					DayUTC:         dayUTC,
					InstallClicks:  0,
					DownloadClicks: 0,
					MapYes:         0,
					MapNo:          0,
					Feedback:       total,
				}
			}
		}
		if err := feedbackDailyRows.Err(); err != nil {
			_ = feedbackDailyRows.Close()
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		_ = feedbackDailyRows.Close()

		feedbackBrowsersQuery := `SELECT browser, COUNT(*) AS c
			FROM website_uninstall_feedback`
		feedbackBrowsersArgs := []any{}
		if rng.StartMS > 0 {
			feedbackBrowsersQuery += ` WHERE created_at >= ?`
			feedbackBrowsersArgs = append(feedbackBrowsersArgs, rng.StartMS)
		}
		feedbackBrowsersQuery += ` GROUP BY browser ORDER BY c DESC, browser ASC LIMIT 8`
		feedbackBrowsersRows, err := db.QueryContext(ctx, feedbackBrowsersQuery, feedbackBrowsersArgs...) // #nosec G701 -- query is assembled from fixed clauses only; values stay parameterized.
		if err != nil {
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		feedbackByBrowser := make([]publicWebsiteReasonCount, 0, 8)
		for feedbackBrowsersRows.Next() {
			var browser string
			var count int64
			if scanErr := feedbackBrowsersRows.Scan(&browser, &count); scanErr != nil {
				_ = feedbackBrowsersRows.Close()
				writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
				return
			}
			browser = trimAndLimit(strings.TrimSpace(browser), 40)
			if browser == "" {
				browser = "unknown"
			}
			feedbackByBrowser = append(feedbackByBrowser, publicWebsiteReasonCount{
				Reason: browser,
				Count:  maxInt64(count, 0),
			})
		}
		if err := feedbackBrowsersRows.Err(); err != nil {
			_ = feedbackBrowsersRows.Close()
			writeJSONError(w, "analytics_load_failed", "Failed to load website analytics", http.StatusInternalServerError)
			return
		}
		_ = feedbackBrowsersRows.Close()

		for _, row := range dailyByDay {
			if row == nil {
				continue
			}
			daily = append(daily, *row)
		}
		sort.Slice(daily, func(i, j int) bool {
			if daily[i].DayUTC == daily[j].DayUTC {
				if daily[i].InstallClicks == daily[j].InstallClicks {
					return daily[i].DownloadClicks > daily[j].DownloadClicks
				}
				return daily[i].InstallClicks > daily[j].InstallClicks
			}
			return daily[i].DayUTC > daily[j].DayUTC
		})
		if len(daily) > dailyCap {
			daily = daily[:dailyCap]
		}

		trafficSummary, trafficDaily, err := loadWebsiteTrafficAnalytics(ctx, db, rng, trafficCfg)
		if err != nil {
			logEvent("warn", "website_traffic_analytics_load_failed", map[string]interface{}{
				"error": trimAndLimit(err.Error(), 240),
				"range": rng.Name,
			})
			trafficSummary = websiteAnalyticsTrafficSummary{
				Visits:          0,
				Requests:        0,
				LastSyncedAtUTC: nil,
				Source:          websiteTrafficSourceHTTPAdaptive,
				Status:          "error",
			}
			if !trafficCfg.normalized().Enabled {
				trafficSummary.Status = "disabled"
			}
			trafficDaily = []websiteAnalyticsTrafficDailyPoint{}
		}

		mapYes := actions["map_yes"]
		mapNo := actions["map_no"]
		mapResponses := mapYes + mapNo
		yesRatio := 0.0
		if mapResponses > 0 {
			yesRatio = float64(mapYes) / float64(mapResponses)
		}

		var feedbackLastPtr *int64
		if feedbackLast.Valid && feedbackLast.Int64 > 0 {
			value := feedbackLast.Int64
			feedbackLastPtr = &value
		}

		payload := websiteAnalyticsResponse{
			OK:          true,
			GeneratedAt: time.Now().UTC().UnixMilli(),
			Range:       rng.Name,
			Buttons: map[string]int64{
				"installClicks":  actions["install_click"],
				"downloadClicks": actions["download_click"],
			},
			Map: map[string]any{
				"yes":          mapYes,
				"no":           mapNo,
				"responses":    mapResponses,
				"yesRatio":     yesRatio,
				"yesPercent":   yesRatio * 100,
				"responseRate": mapResponses,
			},
			Feedback: map[string]any{
				"totalSubmissions":    maxInt64(feedbackTotal, 0),
				"lastSubmissionAtUtc": feedbackLastPtr,
				"topReasons":          topReasons,
				"dailySubmissions":    feedbackDaily,
				"byBrowser":           feedbackByBrowser,
			},
			Daily:        daily,
			Placements:   placements,
			Traffic:      trafficSummary,
			TrafficDaily: trafficDaily,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(payload)
	}
}

func loadWebsiteTrafficAnalytics(
	ctx context.Context,
	db *sql.DB,
	rng websiteAnalyticsRange,
	trafficCfg WebsiteTrafficSyncConfig,
) (websiteAnalyticsTrafficSummary, []websiteAnalyticsTrafficDailyPoint, error) {
	cfg := trafficCfg.normalized()
	summary := websiteAnalyticsTrafficSummary{
		Visits:          0,
		Requests:        0,
		LastSyncedAtUTC: nil,
		Source:          websiteTrafficSourceHTTPAdaptive,
		Status:          "no_data",
	}

	startHour := ""
	if rng.StartDay != "" {
		startHour = rng.StartDay + "T00:00:00Z"
	}

	totalQuery := `SELECT COALESCE(SUM(visits), 0), COALESCE(SUM(requests), 0)
		FROM website_traffic_hourly`
	totalArgs := []any{}
	if startHour != "" {
		totalQuery += ` WHERE hour_utc >= ?`
		totalArgs = append(totalArgs, startHour)
	}
	if err := db.QueryRowContext(ctx, totalQuery, totalArgs...).Scan(&summary.Visits, &summary.Requests); err != nil { // #nosec G701 -- query is assembled from fixed clauses only; values stay parameterized.
		return websiteAnalyticsTrafficSummary{}, nil, err
	}
	summary.Visits = maxInt64(summary.Visits, 0)
	summary.Requests = maxInt64(summary.Requests, 0)

	dailyLimit := int(maxInt64(int64(rng.DayLimit), 1))
	daily := make([]websiteAnalyticsTrafficDailyPoint, 0, dailyLimit)
	dailyQuery := `SELECT
			substr(hour_utc, 1, 10) AS day_utc,
			COALESCE(SUM(visits), 0) AS visits,
			COALESCE(SUM(requests), 0) AS requests
		FROM website_traffic_hourly`
	dailyArgs := []any{}
	if startHour != "" {
		dailyQuery += ` WHERE hour_utc >= ?`
		dailyArgs = append(dailyArgs, startHour)
	}
	dailyQuery += ` GROUP BY day_utc ORDER BY day_utc DESC LIMIT ?`
	dailyArgs = append(dailyArgs, dailyLimit)
	dailyRows, err := db.QueryContext(ctx, dailyQuery, dailyArgs...) // #nosec G701 -- query is assembled from fixed clauses only; values stay parameterized.
	if err != nil {
		return websiteAnalyticsTrafficSummary{}, nil, err
	}
	for dailyRows.Next() {
		var row websiteAnalyticsTrafficDailyPoint
		if scanErr := dailyRows.Scan(&row.DayUTC, &row.Visits, &row.Requests); scanErr != nil {
			_ = dailyRows.Close()
			return websiteAnalyticsTrafficSummary{}, nil, scanErr
		}
		row.DayUTC = trimAndLimit(strings.TrimSpace(row.DayUTC), 16)
		row.Visits = maxInt64(row.Visits, 0)
		row.Requests = maxInt64(row.Requests, 0)
		daily = append(daily, row)
	}
	if err := dailyRows.Err(); err != nil {
		_ = dailyRows.Close()
		return websiteAnalyticsTrafficSummary{}, nil, err
	}
	_ = dailyRows.Close()

	var latestFetched sql.NullInt64
	var latestSource sql.NullString
	// #nosec G701 -- static SQL with no user-controlled fragments.
	if err := db.QueryRowContext(
		ctx,
		`SELECT fetched_at, source
		 FROM website_traffic_hourly
		 ORDER BY fetched_at DESC, hour_utc DESC
		 LIMIT 1`,
	).Scan(&latestFetched, &latestSource); err != nil && !errors.Is(err, sql.ErrNoRows) { // #nosec G701 -- static query with no user-controlled SQL fragments.
		return websiteAnalyticsTrafficSummary{}, nil, err
	}
	if latestFetched.Valid && latestFetched.Int64 > 0 {
		value := latestFetched.Int64
		summary.LastSyncedAtUTC = &value
	}
	if latestSource.Valid {
		source := trimAndLimit(strings.TrimSpace(latestSource.String), 64)
		if source != "" {
			summary.Source = source
		}
	}

	latestBatch, err := loadLatestWebsiteSyncBatch(ctx, db, websiteSyncDirectionCloudflareTrafficToOracle)
	if err != nil {
		return websiteAnalyticsTrafficSummary{}, nil, err
	}

	switch {
	case !cfg.Enabled:
		summary.Status = "disabled"
	case summary.LastSyncedAtUTC == nil && latestBatch != nil && strings.EqualFold(latestBatch.Status, "error"):
		summary.Status = "error"
	case summary.LastSyncedAtUTC == nil:
		summary.Status = "no_data"
	default:
		staleAfter := 2 * cfg.Interval
		if staleAfter < 2*time.Hour {
			staleAfter = 2 * time.Hour
		}
		if staleAfter > 24*time.Hour {
			staleAfter = 24 * time.Hour
		}
		lagMs := time.Now().UTC().UnixMilli() - *summary.LastSyncedAtUTC
		if lagMs > staleAfter.Milliseconds() {
			summary.Status = "stale"
		} else {
			summary.Status = "ok"
		}
		if latestBatch != nil && strings.EqualFold(latestBatch.Status, "error") && summary.Status == "ok" {
			summary.Status = "degraded"
		}
	}

	return summary, daily, nil
}

func resolveWebsiteAnalyticsRange(raw string, nowUTC time.Time) websiteAnalyticsRange {
	todayStart := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC)
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "today":
		return websiteAnalyticsRange{
			Name:     "today",
			StartDay: todayStart.Format("2006-01-02"),
			StartMS:  todayStart.UnixMilli(),
			DayLimit: 1,
		}
	case "30d":
		start := todayStart.AddDate(0, 0, -29)
		return websiteAnalyticsRange{
			Name:     "30d",
			StartDay: start.Format("2006-01-02"),
			StartMS:  start.UnixMilli(),
			DayLimit: 30,
		}
	case "all":
		return websiteAnalyticsRange{
			Name:     "all",
			StartDay: "",
			StartMS:  0,
			DayLimit: websiteAnalyticsMaxSeriesDays,
		}
	default:
		start := todayStart.AddDate(0, 0, -6)
		return websiteAnalyticsRange{
			Name:     "7d",
			StartDay: start.Format("2006-01-02"),
			StartMS:  start.UnixMilli(),
			DayLimit: 7,
		}
	}
}

func WebsiteTrafficRefreshHandler(db *sql.DB, trafficCfg WebsiteTrafficSyncConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if db == nil {
			writeJSONError(w, "database_unavailable", "Database not configured", http.StatusServiceUnavailable)
			return
		}

		result, err := SyncWebsiteTrafficFromCloudflare(r.Context(), db, trafficCfg, "oracle_admin_traffic_refresh")
		if err != nil {
			statusCode := http.StatusBadGateway
			code := "traffic_refresh_failed"
			message := "Failed to refresh Cloudflare traffic analytics"
			switch {
			case errors.Is(err, errWebsiteTrafficSyncDisabled):
				statusCode = http.StatusConflict
				code = "traffic_sync_disabled"
				message = "Website traffic sync is disabled"
			case errors.Is(err, errWebsiteTrafficSyncConfig):
				statusCode = http.StatusBadRequest
				code = "traffic_sync_invalid_config"
				message = "Website traffic sync is misconfigured"
			case errors.Is(err, errWebsiteTrafficSyncPersist):
				statusCode = http.StatusInternalServerError
				code = "traffic_refresh_store_failed"
				message = "Failed to store Cloudflare traffic analytics"
			}
			writeJSONError(w, code, message, statusCode)
			return
		}

		_ = AppendAuditLog(
			r.Context(),
			db,
			"website_traffic_refresh",
			"website_sync",
			"cloudflare_traffic_to_oracle",
			"ok",
			map[string]any{
				"hoursUpserted": result.HoursUpserted,
				"visits":        result.Visits,
				"requests":      result.Requests,
				"lastHourUtc":   result.LastHourUTC,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":   true,
			"sync": result,
		})
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
			if errors.Is(err, errWebsiteMonotonicViolation) {
				writeJSONError(w, "monotonic_guard_blocked", "Publish blocked: incoming totals would decrease existing published values.", http.StatusConflict)
				return
			}
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
			if errors.Is(err, errWebsiteMonotonicViolation) {
				writeJSONError(w, "monotonic_guard_blocked", "Cloudflare pull blocked: incoming totals would decrease existing published values.", http.StatusConflict)
				return
			}
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

func WebsiteOpsReconcileTotalsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if db == nil {
			writeJSONError(w, "database_unavailable", "Database not configured", http.StatusServiceUnavailable)
			return
		}

		controlRow, err := loadWebsiteSyncControl(r.Context(), db)
		if err != nil {
			writeJSONError(w, "reconcile_failed", "Failed to load current website sync state", http.StatusInternalServerError)
			return
		}
		trustedDownloads, trustedCountries, err := rebuildWebsiteDatasetFromTrustedHistory(r.Context(), db)
		if err != nil {
			writeJSONError(w, "reconcile_failed", "Failed to rebuild totals from trusted history", http.StatusInternalServerError)
			return
		}

		currentDownloads := maxInt64(controlRow.PublishedDownloads, 0)
		currentCountries := decodeWebsiteCountryCounts(controlRow.PublishedCountries)
		reconciledDownloads := maxInt64(currentDownloads, trustedDownloads)
		reconciledCountries := mergeWebsiteCountryByMax(currentCountries, trustedCountries, 300)

		row, err := publishWebsiteDataset(
			r.Context(),
			db,
			"reconcile",
			reconciledDownloads,
			reconciledCountries,
			true,
			false,
		)
		if err != nil {
			if errors.Is(err, errWebsiteMonotonicViolation) {
				writeJSONError(w, "monotonic_guard_blocked", "Reconcile blocked: incoming totals would decrease existing published values.", http.StatusConflict)
				return
			}
			writeJSONError(w, "reconcile_failed", "Failed to publish reconciled totals", http.StatusInternalServerError)
			return
		}

		_ = insertWebsiteSyncBatch(
			r.Context(),
			db,
			websiteSyncDirectionOracleToWebsite,
			newWebsiteBatchID(websiteSyncDirectionOracleToWebsite),
			"oracle_admin_reconcile_totals",
			"ok",
			map[string]any{
				"source":              "reconcile",
				"trustedDownloads":    trustedDownloads,
				"trustedCountries":    len(trustedCountries),
				"previousDownloads":   currentDownloads,
				"reconciledDownloads": reconciledDownloads,
				"reconciledCountries": len(reconciledCountries),
			},
		)

		_ = AppendAuditLog(
			r.Context(),
			db,
			"website_reconcile_totals",
			"website_sync",
			"reconcile",
			"ok",
			map[string]any{
				"trustedDownloads":    trustedDownloads,
				"trustedCountries":    len(trustedCountries),
				"previousDownloads":   currentDownloads,
				"reconciledDownloads": reconciledDownloads,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"trusted": map[string]any{
				"downloads": trustedDownloads,
				"countries": trustedCountries,
			},
			"published": map[string]any{
				"source":           row.PublishedSource,
				"downloads":        row.PublishedDownloads,
				"countries":        decodeWebsiteCountryCounts(row.PublishedCountries),
				"lastOraclePushAt": row.LastOraclePushAt,
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
		if errors.Is(err, errWebsiteMonotonicViolation) {
			return websiteSyncControlRow{}, cloudflareSiteMetricsPayload{}, err
		}
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
			violations := detectWebsiteDatasetMonotonicViolations(
				maxInt64(row.PublishedDownloads, 0),
				decodeWebsiteCountryCounts(row.PublishedCountries),
				row.OverrideDownloads,
				overrideCountries,
			)
			if len(violations) > 0 {
				_ = AppendAuditLog(
					r.Context(),
					db,
					"website_dataset_monotonic_violation",
					"website_sync",
					"override",
					"blocked",
					map[string]any{
						"source":        "override",
						"prevDownloads": maxInt64(row.PublishedDownloads, 0),
						"nextDownloads": row.OverrideDownloads,
						"violations":    violations,
					},
				)
				writeJSONError(w, "monotonic_guard_blocked", "Override blocked: incoming totals would decrease existing published values.", http.StatusConflict)
				return
			}
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
