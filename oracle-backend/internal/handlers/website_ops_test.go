package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestWebsiteOpsStateHandler_DefaultState(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/website/state", nil)
	rr := httptest.NewRecorder()
	WebsiteOpsStateHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool `json:"ok"`
		Control struct {
			OneAMFlushEnabled  bool   `json:"oneAmFlushEnabled"`
			PublishedDownloads int64  `json:"publishedDownloads"`
			PublishedSource    string `json:"publishedSource"`
		} `json:"control"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode payload: %v", err)
	}
	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if !payload.Control.OneAMFlushEnabled {
		t.Fatal("expected oneAmFlushEnabled=true by default")
	}
	if payload.Control.PublishedDownloads != 0 {
		t.Fatalf("expected publishedDownloads=0, got %d", payload.Control.PublishedDownloads)
	}
	if payload.Control.PublishedSource == "" {
		t.Fatal("expected published source to be set")
	}
}

func TestWebsiteAnalyticsHandler_ReturnsAggregates(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	if _, err := sqlDB.Exec(`INSERT INTO website_event_daily
		(day_utc, event_type, action, placement, count, last_seen_at)
		VALUES
		('2026-02-20', 'cta', 'install_click', 'hero_install', 11, 1771600000000),
		('2026-02-20', 'cta', 'download_click', 'footer_download', 9, 1771600000000),
		('2026-02-20', 'map', 'map_yes', 'map_prompt_yes', 7, 1771600000000),
		('2026-02-20', 'map', 'map_no', 'map_prompt_no', 3, 1771600000000),
		('2026-02-19', 'cta', 'install_click', 'nav_install', 4, 1771510000000)
	`); err != nil {
		t.Fatalf("seed website_event_daily failed: %v", err)
	}

	if _, err := sqlDB.Exec(`INSERT INTO website_uninstall_feedback
		(reason, browser, extension_version, source, notes, origin, created_at)
		VALUES
		('Temporary install', 'chrome', '1.3.7', 'website', 'note', 'https://example.com', 1771600000000),
		('Found alternative', 'firefox', '1.3.7', 'website', 'note', 'https://example.com', 1771600000100)
	`); err != nil {
		t.Fatalf("seed website_uninstall_feedback failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/website/analytics?range=all", nil)
	rr := httptest.NewRecorder()
	WebsiteAnalyticsHandler(sqlDB, WebsiteTrafficSyncConfig{}).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool   `json:"ok"`
		Range   string `json:"range"`
		Buttons struct {
			InstallClicks  int64 `json:"installClicks"`
			DownloadClicks int64 `json:"downloadClicks"`
		} `json:"buttons"`
		Map struct {
			Yes       int64   `json:"yes"`
			No        int64   `json:"no"`
			Responses int64   `json:"responses"`
			YesRatio  float64 `json:"yesRatio"`
		} `json:"map"`
		Feedback struct {
			TotalSubmissions int64 `json:"totalSubmissions"`
			TopReasons       []struct {
				Reason string `json:"reason"`
				Count  int64  `json:"count"`
			} `json:"topReasons"`
		} `json:"feedback"`
		Daily []struct {
			DayUTC string `json:"dayUtc"`
		} `json:"daily"`
		Placements []struct {
			Placement string `json:"placement"`
			Action    string `json:"action"`
			Count     int64  `json:"count"`
		} `json:"placements"`
		Traffic struct {
			Visits   int64  `json:"visits"`
			Requests int64  `json:"requests"`
			Status   string `json:"status"`
		} `json:"traffic"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode analytics payload failed: %v", err)
	}
	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if payload.Range != "all" {
		t.Fatalf("expected range=all, got %q", payload.Range)
	}
	if payload.Buttons.InstallClicks != 15 {
		t.Fatalf("expected installClicks=15, got %d", payload.Buttons.InstallClicks)
	}
	if payload.Buttons.DownloadClicks != 9 {
		t.Fatalf("expected downloadClicks=9, got %d", payload.Buttons.DownloadClicks)
	}
	if payload.Map.Yes != 7 || payload.Map.No != 3 || payload.Map.Responses != 10 {
		t.Fatalf("unexpected map payload: %+v", payload.Map)
	}
	if payload.Map.YesRatio <= 0.69 || payload.Map.YesRatio >= 0.71 {
		t.Fatalf("unexpected yesRatio: %f", payload.Map.YesRatio)
	}
	if payload.Feedback.TotalSubmissions != 2 {
		t.Fatalf("expected feedback total=2, got %d", payload.Feedback.TotalSubmissions)
	}
	if len(payload.Daily) == 0 {
		t.Fatal("expected non-empty daily series")
	}
	if len(payload.Placements) == 0 {
		t.Fatal("expected non-empty placements breakdown")
	}
	if payload.Traffic.Visits != 0 || payload.Traffic.Requests != 0 {
		t.Fatalf("expected zero traffic defaults, got %+v", payload.Traffic)
	}
	if payload.Traffic.Status != "disabled" {
		t.Fatalf("expected traffic status disabled when sync config is disabled, got %q", payload.Traffic.Status)
	}
}

func TestWebsiteAnalyticsHandler_IncludesTrafficAggregates(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	nowMs := time.Now().UTC().UnixMilli()

	if _, err := sqlDB.Exec(`INSERT INTO website_traffic_hourly
		(hour_utc, visits, requests, fetched_at, source)
		VALUES
		('2026-02-20T01:00:00Z', 100, 500, ?, 'cloudflare_graphql'),
		('2026-02-20T02:00:00Z', 120, 520, ?, 'cloudflare_graphql'),
		('2026-02-19T23:00:00Z', 90, 410, ?, 'cloudflare_graphql')
	`, nowMs, nowMs, nowMs); err != nil {
		t.Fatalf("seed website_traffic_hourly failed: %v", err)
	}
	if err := insertWebsiteSyncBatch(
		t.Context(),
		sqlDB,
		websiteSyncDirectionCloudflareTrafficToOracle,
		"traffic-sync-ok",
		"test",
		"ok",
		map[string]any{"hoursUpserted": 3},
	); err != nil {
		t.Fatalf("seed website traffic sync batch failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/website/analytics?range=all", nil)
	rr := httptest.NewRecorder()
	cfg := WebsiteTrafficSyncConfig{
		Enabled:  true,
		Interval: time.Hour,
		Lookback: 48 * time.Hour,
	}
	WebsiteAnalyticsHandler(sqlDB, cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool `json:"ok"`
		Traffic struct {
			Visits          int64  `json:"visits"`
			Requests        int64  `json:"requests"`
			LastSyncedAtUTC *int64 `json:"lastSyncedAtUtc"`
			Source          string `json:"source"`
			Status          string `json:"status"`
		} `json:"traffic"`
		TrafficDaily []struct {
			DayUTC   string `json:"dayUtc"`
			Visits   int64  `json:"visits"`
			Requests int64  `json:"requests"`
		} `json:"trafficDaily"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode analytics payload failed: %v", err)
	}
	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if payload.Traffic.Visits != 310 {
		t.Fatalf("expected traffic visits=310, got %d", payload.Traffic.Visits)
	}
	if payload.Traffic.Requests != 1430 {
		t.Fatalf("expected traffic requests=1430, got %d", payload.Traffic.Requests)
	}
	if payload.Traffic.Source != "cloudflare_graphql" {
		t.Fatalf("expected traffic source cloudflare_graphql, got %q", payload.Traffic.Source)
	}
	switch payload.Traffic.Status {
	case "ok", "degraded", "stale":
		// Time-based traffic freshness and latest sync status can produce
		// one of these states while aggregates remain valid.
	default:
		t.Fatalf("expected traffic status in [ok degraded stale], got %q", payload.Traffic.Status)
	}
	if payload.Traffic.LastSyncedAtUTC == nil || *payload.Traffic.LastSyncedAtUTC <= 0 {
		t.Fatalf("expected lastSyncedAtUtc to be present, got %+v", payload.Traffic)
	}
	if len(payload.TrafficDaily) == 0 {
		t.Fatal("expected trafficDaily to be non-empty")
	}
}

func TestWebsiteAnalyticsHandler_DegradesWhenTrafficLoadFails(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	if _, err := sqlDB.Exec(`DROP TABLE IF EXISTS website_traffic_hourly`); err != nil {
		t.Fatalf("drop website_traffic_hourly failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/website/analytics?range=7d", nil)
	rr := httptest.NewRecorder()
	WebsiteAnalyticsHandler(sqlDB, WebsiteTrafficSyncConfig{
		Enabled:  true,
		Interval: time.Hour,
		Lookback: 48 * time.Hour,
	}).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool `json:"ok"`
		Traffic struct {
			Status   string `json:"status"`
			Visits   int64  `json:"visits"`
			Requests int64  `json:"requests"`
		} `json:"traffic"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode analytics payload failed: %v", err)
	}
	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if payload.Traffic.Status != "error" {
		t.Fatalf("expected traffic status error, got %q", payload.Traffic.Status)
	}
	if payload.Traffic.Visits != 0 || payload.Traffic.Requests != 0 {
		t.Fatalf("expected zero traffic payload on degrade, got %+v", payload.Traffic)
	}
}

func TestWebsiteTrafficRefreshHandler_UpsertsGraphQLTraffic(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	mockCF := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST to GraphQL endpoint, got %s", r.Method)
		}
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-token" {
			t.Fatalf("expected bearer token header, got %q", auth)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": {
				"viewer": {
					"accounts": [{
						"httpRequestsAdaptiveGroups": [
							{
								"dimensions": { "datetimeHour": "2026-02-20T01:00:00Z" },
								"sum": { "visits": 42, "requests": 210 }
							},
							{
								"dimensions": { "datetimeHour": "2026-02-20T02:00:00Z" },
								"sum": { "visits": 58, "requests": 240 }
							}
						]
					}]
				}
			}
		}`))
	}))
	defer mockCF.Close()

	originalEndpoint := cloudflareAnalyticsGraphQLEndpoint
	cloudflareAnalyticsGraphQLEndpoint = mockCF.URL
	t.Cleanup(func() {
		cloudflareAnalyticsGraphQLEndpoint = originalEndpoint
	})

	cfg := WebsiteTrafficSyncConfig{
		Enabled:    true,
		APIToken:   "test-token",
		AccountTag: "account-123",
		Hostname:   "example.com",
		Interval:   time.Hour,
		Lookback:   48 * time.Hour,
	}
	req := httptest.NewRequest(http.MethodPost, "/api/admin/website/traffic/refresh", nil)
	rr := httptest.NewRecorder()
	WebsiteTrafficRefreshHandler(sqlDB, cfg).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK   bool `json:"ok"`
		Sync struct {
			HoursUpserted int   `json:"hoursUpserted"`
			Visits        int64 `json:"visits"`
			Requests      int64 `json:"requests"`
		} `json:"sync"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode refresh payload failed: %v", err)
	}
	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if payload.Sync.HoursUpserted != 2 || payload.Sync.Visits != 100 || payload.Sync.Requests != 450 {
		t.Fatalf("unexpected sync payload: %+v", payload.Sync)
	}

	var rows int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM website_traffic_hourly`).Scan(&rows); err != nil {
		t.Fatalf("query website_traffic_hourly failed: %v", err)
	}
	if rows != 2 {
		t.Fatalf("expected 2 traffic rows, got %d", rows)
	}

	batch, err := loadLatestWebsiteSyncBatch(t.Context(), sqlDB, websiteSyncDirectionCloudflareTrafficToOracle)
	if err != nil {
		t.Fatalf("loadLatestWebsiteSyncBatch failed: %v", err)
	}
	if batch == nil {
		t.Fatal("expected cloudflare_traffic_to_oracle sync batch")
	}
	if batch.Status != "ok" {
		t.Fatalf("expected traffic batch status ok, got %q", batch.Status)
	}
}

func TestWebsiteOpsForcePushAndOverrideHandlers(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	if _, err := sqlDB.Exec(`INSERT INTO downloads_totals (key, value) VALUES
		('totalDownloads', 1200),
		('totalSuccess', 1100),
		('totalFail', 100),
		('country:US', 400),
		('country:GB', 250)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`); err != nil {
		t.Fatalf("seed totals failed: %v", err)
	}

	forceReq := httptest.NewRequest(http.MethodPost, "/api/admin/website/force-push", nil)
	forceRR := httptest.NewRecorder()
	WebsiteOpsForcePushHandler(sqlDB).ServeHTTP(forceRR, forceReq)
	if forceRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from force push, got %d: %s", forceRR.Code, forceRR.Body.String())
	}

	invalidOverrideBody := `{
		"enabled": true,
		"downloads": 777,
		"countries": [
			{"countryCode": "US", "count": 600},
			{"countryCode": "CA", "count": 177},
			{"countryCode": "xx", "count": 1}
		]
	}`
	overrideReq := httptest.NewRequest(http.MethodPost, "/api/admin/website/override", strings.NewReader(invalidOverrideBody))
	overrideReq.Header.Set("Content-Type", "application/json")
	overrideRR := httptest.NewRecorder()
	WebsiteOpsOverrideHandler(sqlDB).ServeHTTP(overrideRR, overrideReq)
	if overrideRR.Code != http.StatusConflict {
		t.Fatalf("expected 409 from monotonic guard override, got %d: %s", overrideRR.Code, overrideRR.Body.String())
	}

	validOverrideBody := `{
		"enabled": true,
		"downloads": 1777,
		"countries": [
			{"countryCode": "US", "count": 900},
			{"countryCode": "GB", "count": 500},
			{"countryCode": "CA", "count": 377}
		]
	}`
	validReq := httptest.NewRequest(http.MethodPost, "/api/admin/website/override", strings.NewReader(validOverrideBody))
	validReq.Header.Set("Content-Type", "application/json")
	validRR := httptest.NewRecorder()
	WebsiteOpsOverrideHandler(sqlDB).ServeHTTP(validRR, validReq)
	if validRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from valid override, got %d: %s", validRR.Code, validRR.Body.String())
	}

	stateReq := httptest.NewRequest(http.MethodGet, "/api/admin/website/state", nil)
	stateRR := httptest.NewRecorder()
	WebsiteOpsStateHandler(sqlDB).ServeHTTP(stateRR, stateReq)
	if stateRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from state, got %d: %s", stateRR.Code, stateRR.Body.String())
	}

	var statePayload struct {
		Control struct {
			OverrideEnabled   bool  `json:"overrideEnabled"`
			OverrideDownloads int64 `json:"overrideDownloads"`
			OverrideCountries []struct {
				CountryCode string `json:"countryCode"`
				Count       int64  `json:"count"`
			} `json:"overrideCountries"`
		} `json:"control"`
	}
	if err := json.Unmarshal(stateRR.Body.Bytes(), &statePayload); err != nil {
		t.Fatalf("failed to decode state payload: %v", err)
	}
	if !statePayload.Control.OverrideEnabled {
		t.Fatal("expected override to be enabled")
	}
	if statePayload.Control.OverrideDownloads != 1777 {
		t.Fatalf("expected override downloads=1777, got %d", statePayload.Control.OverrideDownloads)
	}
	if len(statePayload.Control.OverrideCountries) != 3 {
		t.Fatalf("expected 3 override countries, got %+v", statePayload.Control.OverrideCountries)
	}
}

func TestWebsiteOpsReconcileTotalsHandler(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	if _, err := sqlDB.Exec(`
		INSERT INTO batches (batch_id, generated_at, ingested_at, time_zone, events_count, downloads_count, success_count, fail_count)
		VALUES ('batch-reconcile', 1770000000000, 1770000001000, 'UTC', 40, 35, 30, 5)
	`); err != nil {
		t.Fatalf("seed batches failed: %v", err)
	}
	if _, err := sqlDB.Exec(`
		INSERT INTO downloads_hourly (
			bucket_start, bucket_end, total_events, total_downloads, total_success, total_fail,
			by_status_json, by_type_json, by_browser_json, by_os_json, by_ext_ver_json, by_lang_json, by_country_json, by_error_type_json, batch_id
		) VALUES (
			'2026-02-27T00:00:00Z', '2026-02-27T01:00:00Z', 40, 35, 30, 5,
			'{}', '{}', '{}', '{}', '{}', '{}', '{"US":20,"EG":15}', '{}', 'batch-reconcile'
		)
	`); err != nil {
		t.Fatalf("seed downloads_hourly failed: %v", err)
	}
	if _, err := sqlDB.Exec(`
		UPDATE website_sync_control
		SET published_downloads = 10, published_countries_json = '[{"countryCode":"US","count":5}]', published_source = 'oracle', updated_at = ?
		WHERE id = 1
	`, time.Now().UTC().UnixMilli()); err != nil {
		t.Fatalf("seed website_sync_control failed: %v", err)
	}
	_ = AppendAuditLog(
		context.Background(),
		sqlDB,
		"website_dataset_monotonic_violation",
		"website_sync",
		"cloudflare",
		"blocked",
		map[string]any{"violations": []string{"downloads decreased (100 -> 90)"}},
	)

	req := httptest.NewRequest(http.MethodPost, "/api/admin/website/reconcile-totals", nil)
	rr := httptest.NewRecorder()
	WebsiteOpsReconcileTotalsHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 from reconcile totals, got %d: %s", rr.Code, rr.Body.String())
	}

	stateReq := httptest.NewRequest(http.MethodGet, "/api/admin/website/state", nil)
	stateRR := httptest.NewRecorder()
	WebsiteOpsStateHandler(sqlDB).ServeHTTP(stateRR, stateReq)
	if stateRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from state, got %d: %s", stateRR.Code, stateRR.Body.String())
	}
	var payload struct {
		Control struct {
			PublishedSource    string `json:"publishedSource"`
			PublishedDownloads int64  `json:"publishedDownloads"`
		} `json:"control"`
		Anomaly any `json:"anomaly"`
	}
	if err := json.Unmarshal(stateRR.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode state payload failed: %v", err)
	}
	if payload.Control.PublishedSource != "reconcile" {
		t.Fatalf("expected published source 'reconcile', got %q", payload.Control.PublishedSource)
	}
	if payload.Control.PublishedDownloads < 35 {
		t.Fatalf("expected published downloads >= 35, got %d", payload.Control.PublishedDownloads)
	}
	if payload.Anomaly != nil {
		t.Fatalf("expected anomaly to be cleared after reconcile, got %+v", payload.Anomaly)
	}
}

func TestWebsiteOpsPullCloudflareAndToggleOneAM(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	mockCF := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"ok": true,
			"totals": {"downloads": 321},
			"countries": [{"countryCode":"US","count":200},{"countryCode":"GB","count":121}],
			"generatedAt": 1770000000000,
			"snapshotAtUtc": 1770000000000
		}`))
	}))
	defer mockCF.Close()

	pullReq := httptest.NewRequest(http.MethodPost, "/api/admin/website/pull-cloudflare", nil)
	pullRR := httptest.NewRecorder()
	WebsiteOpsPullCloudflareHandler(sqlDB, mockCF.URL).ServeHTTP(pullRR, pullReq)
	if pullRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from cloudflare pull, got %d: %s", pullRR.Code, pullRR.Body.String())
	}

	toggleReq := httptest.NewRequest(http.MethodPost, "/api/admin/website/one-am-toggle", strings.NewReader(`{"enabled":false}`))
	toggleReq.Header.Set("Content-Type", "application/json")
	toggleRR := httptest.NewRecorder()
	WebsiteOpsOneAMToggleHandler(sqlDB).ServeHTTP(toggleRR, toggleReq)
	if toggleRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from toggle, got %d: %s", toggleRR.Code, toggleRR.Body.String())
	}

	stateReq := httptest.NewRequest(http.MethodGet, "/api/admin/website/state", nil)
	stateRR := httptest.NewRecorder()
	WebsiteOpsStateHandler(sqlDB).ServeHTTP(stateRR, stateReq)
	if stateRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from state, got %d: %s", stateRR.Code, stateRR.Body.String())
	}

	var payload struct {
		Control struct {
			OneAMFlushEnabled    bool   `json:"oneAmFlushEnabled"`
			PublishedSource      string `json:"publishedSource"`
			PublishedDownloads   int64  `json:"publishedDownloads"`
			LastCloudflarePushAt *int64 `json:"lastCloudflarePushAt"`
		} `json:"control"`
	}
	if err := json.Unmarshal(stateRR.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode state payload: %v", err)
	}
	if payload.Control.OneAMFlushEnabled {
		t.Fatal("expected oneAmFlushEnabled=false")
	}
	if payload.Control.PublishedSource != "cloudflare" {
		t.Fatalf("expected published source cloudflare, got %q", payload.Control.PublishedSource)
	}
	if payload.Control.PublishedDownloads != 321 {
		t.Fatalf("expected published downloads=321, got %d", payload.Control.PublishedDownloads)
	}
	if payload.Control.LastCloudflarePushAt == nil || *payload.Control.LastCloudflarePushAt <= 0 {
		t.Fatal("expected lastCloudflarePushAt to be set")
	}
}

func TestPullWebsiteDatasetFromCloudflare_Success(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	mockCF := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"ok": true,
			"totals": {"downloads": 987},
			"countries": [{"countryCode":"US","count":500},{"countryCode":"EG","count":487}],
			"generatedAt": 1770000000000,
			"snapshotAtUtc": 1770000000000
		}`))
	}))
	defer mockCF.Close()

	row, metrics, err := PullWebsiteDatasetFromCloudflare(
		t.Context(),
		sqlDB,
		mockCF.URL,
		"test_scheduler_slot",
	)
	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if row.PublishedSource != "cloudflare" {
		t.Fatalf("expected published source cloudflare, got %q", row.PublishedSource)
	}
	if row.PublishedDownloads != 987 {
		t.Fatalf("expected published downloads 987, got %d", row.PublishedDownloads)
	}
	if metrics.Totals.Downloads != 987 {
		t.Fatalf("expected metrics downloads 987, got %d", metrics.Totals.Downloads)
	}

	batch, err := loadLatestWebsiteSyncBatch(t.Context(), sqlDB, websiteSyncDirectionCloudflareToWebsite)
	if err != nil {
		t.Fatalf("loadLatestWebsiteSyncBatch failed: %v", err)
	}
	if batch == nil {
		t.Fatal("expected a cloudflare_to_website batch row")
	}
	if batch.TriggeredBy != "test_scheduler_slot" {
		t.Fatalf("expected triggeredBy test_scheduler_slot, got %q", batch.TriggeredBy)
	}
}

func TestPullWebsiteDatasetFromCloudflare_ErrorClassification(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	// Fetch classification.
	_, _, err := PullWebsiteDatasetFromCloudflare(
		t.Context(),
		sqlDB,
		"http://127.0.0.1:1",
		"test_fetch_error",
	)
	if err == nil || !errors.Is(err, errCloudflareWebsiteFetch) {
		t.Fatalf("expected errCloudflareWebsiteFetch, got: %v", err)
	}

	// Publish classification (nil DB).
	mockCF := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"totals":{"downloads":1},"countries":[{"countryCode":"US","count":1}]}`))
	}))
	defer mockCF.Close()

	_, _, err = PullWebsiteDatasetFromCloudflare(
		t.Context(),
		nil,
		mockCF.URL,
		"test_publish_error",
	)
	if err == nil || !errors.Is(err, errCloudflareWebsitePublish) {
		t.Fatalf("expected errCloudflareWebsitePublish, got: %v", err)
	}
}

func TestWebsiteCloudflareSlotScheduleHelpers(t *testing.T) {
	if !isWebsiteCloudflarePullHour(3) || !isWebsiteCloudflarePullHour(21) {
		t.Fatal("expected 3 and 21 to be valid Cloudflare pull hours")
	}
	if isWebsiteCloudflarePullHour(2) || isWebsiteCloudflarePullHour(22) {
		t.Fatal("expected 2 and 22 to be outside Cloudflare pull hours")
	}

	valid := time.Date(2026, 2, 22, 9, 2, 0, 0, time.UTC)
	if !shouldRunWebsiteCloudflarePull(valid) {
		t.Fatalf("expected slot at %s to be runnable", valid)
	}
	invalidMinute := time.Date(2026, 2, 22, 9, 12, 0, 0, time.UTC)
	if shouldRunWebsiteCloudflarePull(invalidMinute) {
		t.Fatalf("did not expect minute 12 slot to run: %s", invalidMinute)
	}
	invalidHour := time.Date(2026, 2, 22, 8, 1, 0, 0, time.UTC)
	if shouldRunWebsiteCloudflarePull(invalidHour) {
		t.Fatalf("did not expect hour 8 slot to run: %s", invalidHour)
	}

	slotKey := makeWebsiteCloudflareSlotKey(time.Date(2026, 2, 22, 15, 59, 0, 0, time.UTC))
	if slotKey != "2026-02-22T15" {
		t.Fatalf("unexpected slot key: %s", slotKey)
	}
}
