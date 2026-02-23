package handlers

import (
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

	overrideBody := `{
		"enabled": true,
		"downloads": 777,
		"countries": [
			{"countryCode": "US", "count": 600},
			{"countryCode": "CA", "count": 177},
			{"countryCode": "xx", "count": 1}
		]
	}`
	overrideReq := httptest.NewRequest(http.MethodPost, "/api/admin/website/override", strings.NewReader(overrideBody))
	overrideReq.Header.Set("Content-Type", "application/json")
	overrideRR := httptest.NewRecorder()
	WebsiteOpsOverrideHandler(sqlDB).ServeHTTP(overrideRR, overrideReq)
	if overrideRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from override, got %d: %s", overrideRR.Code, overrideRR.Body.String())
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
	if statePayload.Control.OverrideDownloads != 777 {
		t.Fatalf("expected override downloads=777, got %d", statePayload.Control.OverrideDownloads)
	}
	if len(statePayload.Control.OverrideCountries) != 2 {
		t.Fatalf("expected 2 override countries, got %+v", statePayload.Control.OverrideCountries)
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
