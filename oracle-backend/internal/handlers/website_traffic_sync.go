package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

const (
	defaultCloudflareAnalyticsGraphQLEndpoint = "https://api.cloudflare.com/client/v4/graphql"
	websiteTrafficSyncDefaultInterval         = 1 * time.Hour
	websiteTrafficSyncDefaultLookback         = 48 * time.Hour
	websiteTrafficSyncMinLookback             = 1 * time.Hour
	websiteTrafficSyncMaxLookback             = 30 * 24 * time.Hour
	websiteTrafficFetchTimeout                = 8 * time.Second
	websiteTrafficFetchMaxAttempts            = 3
	websiteTrafficSourceHTTPAdaptive          = "cloudflare_graphql_http_requests"
	websiteTrafficSourceRUMPageload           = "cloudflare_graphql_rum_pageload"
)

var cloudflareAnalyticsGraphQLEndpoint = defaultCloudflareAnalyticsGraphQLEndpoint

var (
	errWebsiteTrafficSyncDisabled = errors.New("website_traffic_sync_disabled")
	errWebsiteTrafficSyncConfig   = errors.New("website_traffic_sync_invalid_config")
	errWebsiteTrafficSyncFetch    = errors.New("website_traffic_sync_fetch_failed")
	errWebsiteTrafficSyncPersist  = errors.New("website_traffic_sync_persist_failed")
)

type WebsiteTrafficSyncConfig struct {
	Enabled bool
	// #nosec G117 -- configuration secret field by design; loaded from environment and never exposed in responses.
	APIToken   string
	AccountTag string
	Hostname   string
	Interval   time.Duration
	Lookback   time.Duration
}

type WebsiteTrafficSyncResult struct {
	StartAtUTC     int64  `json:"startAtUtc"`
	EndAtUTC       int64  `json:"endAtUtc"`
	FetchedAtUTC   int64  `json:"fetchedAtUtc"`
	HoursUpserted  int    `json:"hoursUpserted"`
	Visits         int64  `json:"visits"`
	Requests       int64  `json:"requests"`
	LastHourUTC    string `json:"lastHourUtc,omitempty"`
	Source         string `json:"source"`
	Hostname       string `json:"hostname"`
	CloudflareAcct string `json:"cloudflareAccountTag"`
}

type websiteTrafficHourlyRow struct {
	HourUTC  string
	Visits   int64
	Requests int64
}

type websiteTrafficHTTPError struct {
	StatusCode int
	Body       string
}

func (e websiteTrafficHTTPError) Error() string {
	if e.Body == "" {
		return fmt.Sprintf("cloudflare_graphql_http_%d", e.StatusCode)
	}
	return fmt.Sprintf("cloudflare_graphql_http_%d: %s", e.StatusCode, trimAndLimit(e.Body, 240))
}

type cloudflareTrafficGraphQLResponse struct {
	Data struct {
		Viewer struct {
			Accounts []struct {
				HTTPRequestsAdaptiveGroups []struct {
					Dimensions struct {
						DatetimeHour string `json:"datetimeHour"`
					} `json:"dimensions"`
					Count int64 `json:"count"`
					Sum   struct {
						Visits   int64 `json:"visits"`
						Requests int64 `json:"requests"`
					} `json:"sum"`
				} `json:"httpRequestsAdaptiveGroups"`
				RUMPageloadEventsAdaptiveGroups []struct {
					Dimensions struct {
						DatetimeHour string `json:"datetimeHour"`
					} `json:"dimensions"`
					Count int64 `json:"count"`
					Sum   struct {
						Visits int64 `json:"visits"`
					} `json:"sum"`
				} `json:"rumPageloadEventsAdaptiveGroups"`
			} `json:"accounts"`
		} `json:"viewer"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func (cfg WebsiteTrafficSyncConfig) normalized() WebsiteTrafficSyncConfig {
	out := cfg
	out.APIToken = strings.TrimSpace(out.APIToken)
	out.AccountTag = strings.TrimSpace(out.AccountTag)
	out.Hostname = normalizeWebsiteTrafficHostname(out.Hostname)
	if out.Interval <= 0 {
		out.Interval = websiteTrafficSyncDefaultInterval
	}
	if out.Lookback <= 0 {
		out.Lookback = websiteTrafficSyncDefaultLookback
	}
	if out.Lookback < websiteTrafficSyncMinLookback {
		out.Lookback = websiteTrafficSyncMinLookback
	}
	if out.Lookback > websiteTrafficSyncMaxLookback {
		out.Lookback = websiteTrafficSyncMaxLookback
	}
	return out
}

func (cfg WebsiteTrafficSyncConfig) validateEnabledConfig() error {
	if !cfg.Enabled {
		return errWebsiteTrafficSyncDisabled
	}
	if strings.TrimSpace(cfg.APIToken) == "" {
		return fmt.Errorf("%w: CLOUDFLARE_ANALYTICS_API_TOKEN is required", errWebsiteTrafficSyncConfig)
	}
	if strings.TrimSpace(cfg.AccountTag) == "" {
		return fmt.Errorf("%w: CLOUDFLARE_ANALYTICS_ACCOUNT_TAG is required", errWebsiteTrafficSyncConfig)
	}
	if strings.TrimSpace(cfg.Hostname) == "" {
		return fmt.Errorf("%w: CLOUDFLARE_ANALYTICS_HOSTNAME is required", errWebsiteTrafficSyncConfig)
	}
	return nil
}

func normalizeWebsiteTrafficHostname(raw string) string {
	trimmed := strings.TrimSpace(strings.ToLower(raw))
	if trimmed == "" {
		return ""
	}

	if strings.Contains(trimmed, "://") {
		if parsed, err := url.Parse(trimmed); err == nil {
			trimmed = strings.ToLower(strings.TrimSpace(parsed.Hostname()))
		}
	}
	trimmed = strings.TrimSuffix(trimmed, ".")
	trimmed = strings.TrimSpace(trimmed)

	if strings.Contains(trimmed, "/") {
		parts := strings.SplitN(trimmed, "/", 2)
		trimmed = strings.TrimSpace(parts[0])
	}
	if strings.Contains(trimmed, ":") {
		host, _, err := netSplitHostPortCompat(trimmed)
		if err == nil && host != "" {
			trimmed = strings.TrimSpace(host)
		}
	}
	return trimmed
}

func netSplitHostPortCompat(input string) (string, string, error) {
	if !strings.Contains(input, ":") {
		return input, "", nil
	}
	if strings.Count(input, ":") > 1 && !strings.HasPrefix(input, "[") {
		return input, "", errors.New("not host:port")
	}
	parts := strings.Split(input, ":")
	if len(parts) != 2 {
		return input, "", errors.New("not host:port")
	}
	if strings.TrimSpace(parts[1]) == "" {
		return input, "", errors.New("missing port")
	}
	return parts[0], parts[1], nil
}

func websiteTrafficSyncWindow(now time.Time, lookback time.Duration) (time.Time, time.Time) {
	utcNow := now.UTC()
	end := utcNow.Truncate(time.Hour).Add(time.Hour)
	if lookback <= 0 {
		lookback = websiteTrafficSyncDefaultLookback
	}
	start := end.Add(-lookback)
	return start, end
}

func StartWebsiteTrafficSyncLoop(ctx context.Context, db *sql.DB, cfg WebsiteTrafficSyncConfig) {
	if db == nil {
		return
	}
	cfg = cfg.normalized()
	if !cfg.Enabled {
		logEvent("info", "website_traffic_sync_disabled", map[string]interface{}{
			"reason": "feature_flag_disabled",
		})
		return
	}
	if err := cfg.validateEnabledConfig(); err != nil {
		logEvent("error", "website_traffic_sync_invalid_config", map[string]interface{}{
			"error": trimAndLimit(err.Error(), 240),
		})
		return
	}

	runOnce := func(triggeredBy string) {
		result, err := SyncWebsiteTrafficFromCloudflare(ctx, db, cfg, triggeredBy)
		if err != nil {
			logEvent("error", "website_traffic_sync_failed", map[string]interface{}{
				"error": trimAndLimit(err.Error(), 240),
			})
			return
		}
		logEvent("info", "website_traffic_sync_ok", map[string]interface{}{
			"hoursUpserted": result.HoursUpserted,
			"visits":        result.Visits,
			"requests":      result.Requests,
			"lastHourUtc":   result.LastHourUTC,
		})
	}

	runOnce("oracle_scheduler_traffic_startup")
	ticker := time.NewTicker(cfg.Interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runOnce("oracle_scheduler_traffic_interval")
		}
	}
}

func SyncWebsiteTrafficFromCloudflare(
	ctx context.Context,
	db *sql.DB,
	cfg WebsiteTrafficSyncConfig,
	triggeredBy string,
) (WebsiteTrafficSyncResult, error) {
	if db == nil {
		return WebsiteTrafficSyncResult{}, errors.New("database not available")
	}
	cfg = cfg.normalized()
	if err := cfg.validateEnabledConfig(); err != nil {
		return WebsiteTrafficSyncResult{}, err
	}

	start, end := websiteTrafficSyncWindow(time.Now().UTC(), cfg.Lookback)
	rows, trafficSource, err := fetchCloudflareTrafficHourlyWithRetry(ctx, cfg, start, end)
	if err != nil {
		recordWebsiteTrafficSyncBatch(ctx, db, triggeredBy, "error", map[string]any{
			"error":      trimAndLimit(err.Error(), 240),
			"startAtUtc": start.UnixMilli(),
			"endAtUtc":   end.UnixMilli(),
		})
		return WebsiteTrafficSyncResult{}, fmt.Errorf("%w: %v", errWebsiteTrafficSyncFetch, err)
	}

	fetchedAt := time.Now().UTC().UnixMilli()
	if err := upsertWebsiteTrafficHourly(ctx, db, rows, fetchedAt, trafficSource); err != nil {
		recordWebsiteTrafficSyncBatch(ctx, db, triggeredBy, "error", map[string]any{
			"error":      trimAndLimit(err.Error(), 240),
			"startAtUtc": start.UnixMilli(),
			"endAtUtc":   end.UnixMilli(),
		})
		return WebsiteTrafficSyncResult{}, fmt.Errorf("%w: %v", errWebsiteTrafficSyncPersist, err)
	}

	result := WebsiteTrafficSyncResult{
		StartAtUTC:     start.UnixMilli(),
		EndAtUTC:       end.UnixMilli(),
		FetchedAtUTC:   fetchedAt,
		HoursUpserted:  len(rows),
		Hostname:       cfg.Hostname,
		CloudflareAcct: cfg.AccountTag,
		Source:         trafficSource,
	}
	for _, row := range rows {
		result.Visits += maxInt64(row.Visits, 0)
		result.Requests += maxInt64(row.Requests, 0)
		result.LastHourUTC = row.HourUTC
	}

	recordWebsiteTrafficSyncBatch(ctx, db, triggeredBy, "ok", map[string]any{
		"startAtUtc":    result.StartAtUTC,
		"endAtUtc":      result.EndAtUTC,
		"fetchedAtUtc":  result.FetchedAtUTC,
		"hoursUpserted": result.HoursUpserted,
		"visits":        result.Visits,
		"requests":      result.Requests,
		"lastHourUtc":   result.LastHourUTC,
		"hostname":      result.Hostname,
		"source":        result.Source,
	})

	return result, nil
}

func recordWebsiteTrafficSyncBatch(ctx context.Context, db *sql.DB, triggeredBy string, status string, details map[string]any) {
	if db == nil {
		return
	}
	if err := insertWebsiteSyncBatch(
		ctx,
		db,
		websiteSyncDirectionCloudflareTrafficToOracle,
		newWebsiteBatchID(websiteSyncDirectionCloudflareTrafficToOracle),
		triggeredBy,
		status,
		details,
	); err != nil {
		logEvent("warn", "website_traffic_sync_batch_insert_failed", map[string]interface{}{
			"error": trimAndLimit(err.Error(), 240),
		})
	}
}

func fetchCloudflareTrafficHourlyWithRetry(
	ctx context.Context,
	cfg WebsiteTrafficSyncConfig,
	start time.Time,
	end time.Time,
) ([]websiteTrafficHourlyRow, string, error) {
	rows, err := fetchCloudflareTrafficHourlyWithRetryMode(ctx, cfg, start, end, false)
	if err == nil {
		return rows, websiteTrafficSourceHTTPAdaptive, nil
	}
	if shouldFallbackToRUMTrafficQuery(err) {
		logEvent("warn", "website_traffic_sync_fallback_to_rum", map[string]interface{}{
			"reason": trimAndLimit(err.Error(), 240),
		})
		rumRows, rumErr := fetchCloudflareTrafficHourlyWithRetryMode(ctx, cfg, start, end, true)
		if rumErr == nil {
			return rumRows, websiteTrafficSourceRUMPageload, nil
		}
		return nil, "", rumErr
	}
	return nil, "", err
}

func fetchCloudflareTrafficHourlyWithRetryMode(
	ctx context.Context,
	cfg WebsiteTrafficSyncConfig,
	start time.Time,
	end time.Time,
	useRUM bool,
) ([]websiteTrafficHourlyRow, error) {
	var lastErr error
	for attempt := 1; attempt <= websiteTrafficFetchMaxAttempts; attempt++ {
		rows, err := fetchCloudflareTrafficHourly(ctx, cfg, start, end, useRUM)
		if err == nil {
			return rows, nil
		}
		lastErr = err
		if !isRetryableWebsiteTrafficError(err) || attempt == websiteTrafficFetchMaxAttempts {
			break
		}
		wait := time.Duration(attempt) * 200 * time.Millisecond
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(wait):
		}
	}
	return nil, lastErr
}

func shouldFallbackToRUMTrafficQuery(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(strings.TrimSpace(err.Error()))
	if lower == "" {
		return false
	}
	if strings.Contains(lower, "does not have access to the path") {
		return true
	}
	if strings.Contains(lower, "httprequestsadaptivegroups") &&
		(strings.Contains(lower, "cannot query field") ||
			strings.Contains(lower, "unknown field") ||
			strings.Contains(lower, "unknown argument")) {
		return true
	}
	return false
}

func isRetryableWebsiteTrafficError(err error) bool {
	if err == nil {
		return false
	}
	var httpErr websiteTrafficHTTPError
	if errors.As(err, &httpErr) {
		return httpErr.StatusCode == http.StatusTooManyRequests || httpErr.StatusCode >= http.StatusInternalServerError
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr)
}

func fetchCloudflareTrafficHourly(
	ctx context.Context,
	cfg WebsiteTrafficSyncConfig,
	start time.Time,
	end time.Time,
	useRUM bool,
) ([]websiteTrafficHourlyRow, error) {
	query := buildCloudflareTrafficQuery(cfg.AccountTag, cfg.Hostname, start, end, useRUM)
	reqPayload, err := json.Marshal(map[string]any{
		"query": query,
	})
	if err != nil {
		return nil, err
	}

	reqCtx, cancel := context.WithTimeout(ctx, websiteTrafficFetchTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, cloudflareAnalyticsGraphQLEndpoint, bytes.NewReader(reqPayload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIToken)

	res, err := http.DefaultClient.Do(req) // #nosec G107,G704 -- endpoint is fixed Cloudflare GraphQL API.
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	rawBody, err := io.ReadAll(io.LimitReader(res.Body, 1024*1024))
	if err != nil {
		return nil, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, websiteTrafficHTTPError{
			StatusCode: res.StatusCode,
			Body:       strings.TrimSpace(string(rawBody)),
		}
	}

	var response cloudflareTrafficGraphQLResponse
	if err := json.Unmarshal(rawBody, &response); err != nil {
		return nil, err
	}
	if len(response.Errors) > 0 {
		message := trimAndLimit(strings.TrimSpace(response.Errors[0].Message), 240)
		if message == "" {
			message = "graphql_error"
		}
		return nil, errors.New(message)
	}

	hourlyMap := make(map[string]websiteTrafficHourlyRow, 256)
	for _, account := range response.Data.Viewer.Accounts {
		if useRUM {
			for _, row := range account.RUMPageloadEventsAdaptiveGroups {
				hourUTC, ok := normalizeWebsiteTrafficHour(row.Dimensions.DatetimeHour)
				if !ok {
					continue
				}
				current := hourlyMap[hourUTC]
				current.HourUTC = hourUTC
				current.Visits += maxInt64(row.Sum.Visits, 0)
				current.Requests += maxInt64(row.Count, 0)
				hourlyMap[hourUTC] = current
			}
			continue
		}

		for _, row := range account.HTTPRequestsAdaptiveGroups {
			hourUTC, ok := normalizeWebsiteTrafficHour(row.Dimensions.DatetimeHour)
			if !ok {
				continue
			}
			current := hourlyMap[hourUTC]
			current.HourUTC = hourUTC
			current.Visits += maxInt64(row.Sum.Visits, 0)
			// Cloudflare GraphQL commonly exposes request volume as `count`.
			// Keep legacy `sum.requests` support for compatibility with older responses/mocks.
			requests := maxInt64(row.Count, 0)
			if requests == 0 {
				requests = maxInt64(row.Sum.Requests, 0)
			}
			current.Requests += requests
			hourlyMap[hourUTC] = current
		}
	}

	out := make([]websiteTrafficHourlyRow, 0, len(hourlyMap))
	for _, row := range hourlyMap {
		out = append(out, row)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].HourUTC < out[j].HourUTC
	})
	return out, nil
}

func buildCloudflareTrafficQuery(accountTag string, hostname string, start time.Time, end time.Time, useRUM bool) string {
	if useRUM {
		return fmt.Sprintf(`query {
  viewer {
    accounts(filter: { accountTag: %s }) {
      rumPageloadEventsAdaptiveGroups(
        limit: 10000
        filter: {
          datetime_geq: %s
          datetime_lt: %s
          requestHost: %s
        }
        orderBy: [datetimeHour_ASC]
      ) {
        dimensions {
          datetimeHour
        }
        count
        sum {
          visits
        }
      }
    }
  }
}`,
			graphQLString(accountTag),
			graphQLString(start.UTC().Format(time.RFC3339)),
			graphQLString(end.UTC().Format(time.RFC3339)),
			graphQLString(hostname),
		)
	}
	return fmt.Sprintf(`query {
  viewer {
    accounts(filter: { accountTag: %s }) {
      httpRequestsAdaptiveGroups(
        limit: 10000
        filter: {
          datetime_geq: %s
          datetime_lt: %s
          clientRequestHTTPHost: %s
          requestSource: "eyeball"
        }
        orderBy: [datetimeHour_ASC]
      ) {
        dimensions {
          datetimeHour
        }
        count
        sum {
          visits
        }
      }
    }
  }
}`,
		graphQLString(accountTag),
		graphQLString(start.UTC().Format(time.RFC3339)),
		graphQLString(end.UTC().Format(time.RFC3339)),
		graphQLString(hostname),
	)
}

func graphQLString(value string) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return `""`
	}
	return string(raw)
}

func normalizeWebsiteTrafficHour(raw string) (string, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", false
	}
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return parsed.UTC().Truncate(time.Hour).Format("2006-01-02T15:00:00Z"), true
		}
	}
	return "", false
}

func upsertWebsiteTrafficHourly(ctx context.Context, db *sql.DB, rows []websiteTrafficHourlyRow, fetchedAtUTC int64, source string) error {
	if db == nil {
		return errors.New("database not available")
	}
	if len(rows) == 0 {
		return nil
	}
	normalizedSource := strings.TrimSpace(source)
	if normalizedSource == "" {
		normalizedSource = websiteTrafficSourceHTTPAdaptive
	}

	tx, err := db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(
		ctx,
		`INSERT INTO website_traffic_hourly (hour_utc, visits, requests, fetched_at, source)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(hour_utc) DO UPDATE SET
		   visits = excluded.visits,
		   requests = excluded.requests,
		   fetched_at = excluded.fetched_at,
		   source = excluded.source`,
	) // #nosec G701 -- static SQL with bound values only.
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, row := range rows {
		if strings.TrimSpace(row.HourUTC) == "" {
			continue
		}
		if _, err := stmt.ExecContext(
			ctx,
			row.HourUTC,
			maxInt64(row.Visits, 0),
			maxInt64(row.Requests, 0),
			fetchedAtUTC,
			normalizedSource,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}
