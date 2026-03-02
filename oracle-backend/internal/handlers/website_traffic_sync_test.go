package handlers

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestSyncWebsiteTrafficFromCloudflare_ConfigValidation(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	_, err := SyncWebsiteTrafficFromCloudflare(
		t.Context(),
		sqlDB,
		WebsiteTrafficSyncConfig{
			Enabled:    true,
			APIToken:   "",
			AccountTag: "acct",
			Hostname:   "example.com",
		},
		"test_invalid_config",
	)
	if err == nil {
		t.Fatal("expected config validation error")
	}
	if !containsErr(err, errWebsiteTrafficSyncConfig) {
		t.Fatalf("expected errWebsiteTrafficSyncConfig, got %v", err)
	}
}

func TestSyncWebsiteTrafficFromCloudflare_RecordsErrorBatchOnFetchFailure(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	mockCF := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream failed", http.StatusInternalServerError)
	}))
	defer mockCF.Close()

	originalEndpoint := cloudflareAnalyticsGraphQLEndpoint
	cloudflareAnalyticsGraphQLEndpoint = mockCF.URL
	t.Cleanup(func() {
		cloudflareAnalyticsGraphQLEndpoint = originalEndpoint
	})

	_, err := SyncWebsiteTrafficFromCloudflare(
		t.Context(),
		sqlDB,
		WebsiteTrafficSyncConfig{
			Enabled:    true,
			APIToken:   "token",
			AccountTag: "acct",
			Hostname:   "example.com",
			Interval:   time.Hour,
			Lookback:   48 * time.Hour,
		},
		"test_fetch_failure",
	)
	if err == nil {
		t.Fatal("expected fetch failure error")
	}
	if !containsErr(err, errWebsiteTrafficSyncFetch) {
		t.Fatalf("expected errWebsiteTrafficSyncFetch, got %v", err)
	}

	batch, loadErr := loadLatestWebsiteSyncBatch(t.Context(), sqlDB, websiteSyncDirectionCloudflareTrafficToOracle)
	if loadErr != nil {
		t.Fatalf("loadLatestWebsiteSyncBatch failed: %v", loadErr)
	}
	if batch == nil {
		t.Fatal("expected traffic sync batch row")
	}
	if batch.Status != "error" {
		t.Fatalf("expected error batch status, got %q", batch.Status)
	}
}

func TestSyncWebsiteTrafficFromCloudflare_IsIdempotentByHour(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	var callCount int32
	mockCF := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&callCount, 1)
		w.Header().Set("Content-Type", "application/json")
		if n == 1 {
			_, _ = w.Write([]byte(`{
				"data": {
					"viewer": {
						"accounts": [{
							"httpRequestsAdaptiveGroups": [{
								"dimensions": { "datetimeHour": "2026-02-20T01:00:00Z" },
								"sum": { "visits": 10, "requests": 100 }
							}]
						}]
					}
				}
			}`))
			return
		}
		_, _ = w.Write([]byte(`{
			"data": {
				"viewer": {
					"accounts": [{
						"httpRequestsAdaptiveGroups": [{
							"dimensions": { "datetimeHour": "2026-02-20T01:00:00Z" },
							"sum": { "visits": 15, "requests": 120 }
						}]
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
		APIToken:   "token",
		AccountTag: "acct",
		Hostname:   "example.com",
		Interval:   time.Hour,
		Lookback:   48 * time.Hour,
	}

	if _, err := SyncWebsiteTrafficFromCloudflare(t.Context(), sqlDB, cfg, "first_sync"); err != nil {
		t.Fatalf("first sync failed: %v", err)
	}
	if _, err := SyncWebsiteTrafficFromCloudflare(t.Context(), sqlDB, cfg, "second_sync"); err != nil {
		t.Fatalf("second sync failed: %v", err)
	}

	var rowCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM website_traffic_hourly`).Scan(&rowCount); err != nil {
		t.Fatalf("count website_traffic_hourly failed: %v", err)
	}
	if rowCount != 1 {
		t.Fatalf("expected 1 upserted hour row, got %d", rowCount)
	}

	var visits, requests int64
	if err := sqlDB.QueryRow(`SELECT visits, requests FROM website_traffic_hourly WHERE hour_utc = '2026-02-20T01:00:00Z'`).Scan(&visits, &requests); err != nil {
		t.Fatalf("query upserted row failed: %v", err)
	}
	if visits != 15 || requests != 120 {
		t.Fatalf("expected upserted values (15,120), got (%d,%d)", visits, requests)
	}
}

func TestStartWebsiteTrafficSyncLoop_RunsImmediatelyAndStops(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	mockCF := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": {
				"viewer": {
					"accounts": [{
						"httpRequestsAdaptiveGroups": [{
							"dimensions": { "datetimeHour": "2026-02-20T01:00:00Z" },
							"sum": { "visits": 21, "requests": 90 }
						}]
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

	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan struct{})
	go func() {
		StartWebsiteTrafficSyncLoop(ctx, sqlDB, WebsiteTrafficSyncConfig{
			Enabled:    true,
			APIToken:   "token",
			AccountTag: "acct",
			Hostname:   "example.com",
			Interval:   24 * time.Hour,
			Lookback:   48 * time.Hour,
		})
		close(done)
	}()

	deadline := time.Now().Add(2 * time.Second)
	for {
		var count int64
		if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM website_traffic_hourly`).Scan(&count); err == nil && count > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("expected immediate startup sync to insert traffic rows")
		}
		time.Sleep(20 * time.Millisecond)
	}

	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("traffic sync loop did not stop after cancellation")
	}
}

func TestSyncWebsiteTrafficFromCloudflare_UsesCountForRequestVolume(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	mockCF := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": {
				"viewer": {
					"accounts": [{
						"httpRequestsAdaptiveGroups": [{
							"dimensions": { "datetimeHour": "2026-02-20T03:00:00Z" },
							"count": 77,
							"sum": { "visits": 11 }
						}]
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
		APIToken:   "token",
		AccountTag: "acct",
		Hostname:   "example.com",
		Interval:   time.Hour,
		Lookback:   48 * time.Hour,
	}

	result, err := SyncWebsiteTrafficFromCloudflare(t.Context(), sqlDB, cfg, "count_field_sync")
	if err != nil {
		t.Fatalf("sync failed: %v", err)
	}
	if result.Visits != 11 || result.Requests != 77 {
		t.Fatalf("expected result visits=11 and requests=77, got %+v", result)
	}

	var visits, requests int64
	if err := sqlDB.QueryRow(`SELECT visits, requests FROM website_traffic_hourly WHERE hour_utc = '2026-02-20T03:00:00Z'`).Scan(&visits, &requests); err != nil {
		t.Fatalf("query upserted row failed: %v", err)
	}
	if visits != 11 || requests != 77 {
		t.Fatalf("expected persisted values (11,77), got (%d,%d)", visits, requests)
	}
}

func TestSyncWebsiteTrafficFromCloudflare_FallsBackToRUMWhenHTTPPathUnavailable(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)

	mockCF := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawBody, _ := io.ReadAll(r.Body)
		body := string(rawBody)
		w.Header().Set("Content-Type", "application/json")

		switch {
		case strings.Contains(body, "httpRequestsAdaptiveGroups"):
			_, _ = w.Write([]byte(`{
				"data": null,
				"errors": [{ "message": "account \"acct\" does not have access to the path" }]
			}`))
		case strings.Contains(body, "rumPageloadEventsAdaptiveGroups"):
			_, _ = w.Write([]byte(`{
				"data": {
					"viewer": {
						"accounts": [{
							"rumPageloadEventsAdaptiveGroups": [{
								"dimensions": { "datetimeHour": "2026-02-20T04:00:00Z" },
								"count": 33,
								"sum": { "visits": 12 }
							}]
						}]
					}
				}
			}`))
		default:
			t.Fatalf("unexpected query body: %s", body)
		}
	}))
	defer mockCF.Close()

	originalEndpoint := cloudflareAnalyticsGraphQLEndpoint
	cloudflareAnalyticsGraphQLEndpoint = mockCF.URL
	t.Cleanup(func() {
		cloudflareAnalyticsGraphQLEndpoint = originalEndpoint
	})

	cfg := WebsiteTrafficSyncConfig{
		Enabled:    true,
		APIToken:   "token",
		AccountTag: "acct",
		Hostname:   "example.com",
		Interval:   time.Hour,
		Lookback:   48 * time.Hour,
	}

	result, err := SyncWebsiteTrafficFromCloudflare(t.Context(), sqlDB, cfg, "rum_fallback_sync")
	if err != nil {
		t.Fatalf("sync failed: %v", err)
	}
	if result.Visits != 12 || result.Requests != 33 {
		t.Fatalf("expected result visits=12 and requests=33, got %+v", result)
	}
	if result.Source != websiteTrafficSourceRUMPageload {
		t.Fatalf("expected result source %q, got %q", websiteTrafficSourceRUMPageload, result.Source)
	}

	var visits, requests int64
	var source string
	if err := sqlDB.QueryRow(`SELECT visits, requests, source FROM website_traffic_hourly WHERE hour_utc = '2026-02-20T04:00:00Z'`).Scan(&visits, &requests, &source); err != nil {
		t.Fatalf("query upserted row failed: %v", err)
	}
	if visits != 12 || requests != 33 {
		t.Fatalf("expected persisted values (12,33), got (%d,%d)", visits, requests)
	}
	if source != websiteTrafficSourceRUMPageload {
		t.Fatalf("expected persisted source %q, got %q", websiteTrafficSourceRUMPageload, source)
	}
}

func TestIsRetryableWebsiteTrafficError(t *testing.T) {
	if isRetryableWebsiteTrafficError(nil) {
		t.Fatal("nil error must not be retryable")
	}
	if !isRetryableWebsiteTrafficError(websiteTrafficHTTPError{StatusCode: http.StatusTooManyRequests}) {
		t.Fatal("429 should be retryable")
	}
	if !isRetryableWebsiteTrafficError(websiteTrafficHTTPError{StatusCode: http.StatusInternalServerError}) {
		t.Fatal("5xx should be retryable")
	}
	if isRetryableWebsiteTrafficError(websiteTrafficHTTPError{StatusCode: http.StatusBadRequest}) {
		t.Fatal("4xx should not be retryable")
	}
	if !isRetryableWebsiteTrafficError(context.DeadlineExceeded) {
		t.Fatal("deadline exceeded should be retryable")
	}
	if !isRetryableWebsiteTrafficError(&net.DNSError{IsTimeout: true}) {
		t.Fatal("network timeout should be retryable")
	}
	if isRetryableWebsiteTrafficError(errors.New("graphql validation failed")) {
		t.Fatal("non-network generic errors should not be retryable")
	}
}

func TestShouldFallbackToRUMTrafficQuery(t *testing.T) {
	if !shouldFallbackToRUMTrafficQuery(errors.New(`account "acct" does not have access to the path`)) {
		t.Fatal("path access errors must fallback to rum")
	}
	if !shouldFallbackToRUMTrafficQuery(errors.New(`Cannot query field "httpRequestsAdaptiveGroups" on type "Account"`)) {
		t.Fatal("schema errors for httpRequestsAdaptiveGroups must fallback to rum")
	}
	if shouldFallbackToRUMTrafficQuery(errors.New("timeout contacting cloudflare")) {
		t.Fatal("generic transport errors must not trigger rum fallback")
	}
}

func containsErr(err error, target error) bool {
	return errors.Is(err, target)
}
