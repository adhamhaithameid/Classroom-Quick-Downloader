package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDeploymentsTargetsHandler_ReturnsAllDefaultTargets(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/admin/deployments/targets", nil)
	rr := httptest.NewRecorder()
	DeploymentsTargetsHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool `json:"ok"`
		Targets []struct {
			RecordKey string         `json:"recordKey"`
			Data      map[string]any `json:"data"`
		} `json:"targets"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse payload failed: %v", err)
	}
	if !payload.OK || len(payload.Targets) != 3 {
		t.Fatalf("expected three default targets, got %+v", payload)
	}
}

func TestDeploymentsTargetsHandler_ReturnsAggregates(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	store := newControlPlaneStore(sqlDB, nil)
	if err := store.upsertRecord(context.Background(), "deployment_target", "chrome", map[string]any{
		"name":        "Chrome",
		"usersCount":  120000,
		"ratingCount": 250,
		"version":     "9.0.0",
		"syncedAt":    111,
	}); err != nil {
		t.Fatalf("seed chrome record failed: %v", err)
	}
	if err := store.upsertRecord(context.Background(), "deployment_target", "firefox", map[string]any{
		"name":        "Firefox",
		"users":       "12,345",
		"ratingCount": 17,
		"version":     "9.0.1",
		"syncedAt":    222,
	}); err != nil {
		t.Fatalf("seed firefox record failed: %v", err)
	}
	if err := store.upsertRecord(context.Background(), "deployment_target", "edge", map[string]any{
		"name":        "Edge",
		"usersCount":  9000,
		"ratingCount": 0,
		"version":     "9.0.2",
		"syncedAt":    333,
	}); err != nil {
		t.Fatalf("seed edge record failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/deployments/targets", nil)
	rr := httptest.NewRecorder()
	DeploymentsTargetsHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool `json:"ok"`
		Targets []struct {
			RecordKey string         `json:"recordKey"`
			Data      map[string]any `json:"data"`
		} `json:"targets"`
		Aggregates struct {
			UsersTotal      int64 `json:"usersTotal"`
			ReviewsTotal    int64 `json:"reviewsTotal"`
			LastSyncedAtUTC int64 `json:"lastSyncedAtUtc"`
			Browsers        []struct {
				Key        string `json:"key"`
				Name       string `json:"name"`
				UsersCount int64  `json:"usersCount"`
				Reviews    int64  `json:"reviews"`
			} `json:"browsers"`
		} `json:"aggregates"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse payload failed: %v", err)
	}
	if !payload.OK || len(payload.Targets) != 3 {
		t.Fatalf("expected three deployment targets, got %+v", payload)
	}
	if payload.Aggregates.UsersTotal != 141345 {
		t.Fatalf("expected usersTotal=141345, got %d", payload.Aggregates.UsersTotal)
	}
	if payload.Aggregates.ReviewsTotal != 267 {
		t.Fatalf("expected reviewsTotal=267, got %d", payload.Aggregates.ReviewsTotal)
	}
	if payload.Aggregates.LastSyncedAtUTC != 333 {
		t.Fatalf("expected lastSyncedAtUtc=333, got %d", payload.Aggregates.LastSyncedAtUTC)
	}
	if len(payload.Aggregates.Browsers) != 3 {
		t.Fatalf("expected 3 browser aggregate rows, got %+v", payload.Aggregates.Browsers)
	}
	if payload.Aggregates.Browsers[0].Key != "chrome" || payload.Aggregates.Browsers[0].UsersCount != 120000 {
		t.Fatalf("expected chrome to lead aggregate ordering, got %+v", payload.Aggregates.Browsers[0])
	}
}

func TestDeploymentsTargetsHandler_AggregatesReflectSyncedTargets(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	t.Setenv("ORACLE_ALLOW_HTTP_STORE_URLS", "true")

	const edgeCRXID = "ecojbijjkcjdolpeoiemnccgmaeomcmn"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chrome":
			_, _ = w.Write([]byte(`<script>{"users":"120K","version":"5.9.1"}</script><div>4.7 (21 ratings)</div>`))
		case "/firefox":
			_, _ = w.Write([]byte(`<div>Users 12,345</div><div>Version 6.0.0</div><div>5 (2 reviews)</div>`))
		case "/addons/getproductdetailsbycrxid/" + edgeCRXID:
			_, _ = w.Write([]byte(`{"activeInstallCount":75,"averageRating":5,"ratingCount":6,"version":"6.1.0"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	store := newControlPlaneStore(sqlDB, nil)
	if err := store.upsertRecord(context.Background(), "deployment_target", "chrome", map[string]any{"url": server.URL + "/chrome"}); err != nil {
		t.Fatalf("seed chrome record failed: %v", err)
	}
	if err := store.upsertRecord(context.Background(), "deployment_target", "firefox", map[string]any{"url": server.URL + "/firefox"}); err != nil {
		t.Fatalf("seed firefox record failed: %v", err)
	}
	if err := store.upsertRecord(context.Background(), "deployment_target", "edge", map[string]any{"url": server.URL + "/addons/detail/classroom-quick-downloader/" + edgeCRXID}); err != nil {
		t.Fatalf("seed edge record failed: %v", err)
	}

	syncReq := httptest.NewRequest(http.MethodPost, "/api/admin/deployments/sync", bytes.NewBufferString(`{}`))
	syncReq.Header.Set("Content-Type", "application/json")
	syncRR := httptest.NewRecorder()
	deploymentsSyncHandlerWithClient(sqlDB, nil, server.Client(), nil).ServeHTTP(syncRR, syncReq)
	if syncRR.Code != http.StatusOK {
		t.Fatalf("sync failed: %d %s", syncRR.Code, syncRR.Body.String())
	}

	targetsReq := httptest.NewRequest(http.MethodGet, "/api/admin/deployments/targets", nil)
	targetsRR := httptest.NewRecorder()
	DeploymentsTargetsHandler(sqlDB, nil).ServeHTTP(targetsRR, targetsReq)
	if targetsRR.Code != http.StatusOK {
		t.Fatalf("targets read failed: %d %s", targetsRR.Code, targetsRR.Body.String())
	}

	var payload struct {
		Aggregates struct {
			UsersTotal   int64 `json:"usersTotal"`
			ReviewsTotal int64 `json:"reviewsTotal"`
		} `json:"aggregates"`
	}
	if err := json.Unmarshal(targetsRR.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal targets payload failed: %v", err)
	}
	if payload.Aggregates.UsersTotal != 132420 {
		t.Fatalf("expected usersTotal=132420 after sync, got %d", payload.Aggregates.UsersTotal)
	}
	if payload.Aggregates.ReviewsTotal != 29 {
		t.Fatalf("expected reviewsTotal=29 after sync, got %d", payload.Aggregates.ReviewsTotal)
	}
}

func TestSummarizeDeploymentTargets_UsesFallbackAndSortsByUsers(t *testing.T) {
	input := []deploymentTargetResponse{
		{
			RecordKey: "firefox",
			Data: map[string]any{
				"name":        "Firefox",
				"users":       "12,345",
				"ratingCount": 7,
			},
			UpdatedAt: 200,
		},
		{
			RecordKey: "chrome",
			Data: map[string]any{
				"name":        "Chrome",
				"usersCount":  120000,
				"ratingCount": 20,
				"syncedAt":    300,
			},
			UpdatedAt: 100,
		},
		{
			RecordKey: "edge",
			Data: map[string]any{
				"name":        "Edge",
				"usersCount":  75,
				"ratingCount": 1,
			},
			UpdatedAt: 400,
		},
	}

	summary := summarizeDeploymentTargets(input)
	if summary.UsersTotal != 132420 {
		t.Fatalf("expected usersTotal=132420, got %d", summary.UsersTotal)
	}
	if summary.ReviewsTotal != 28 {
		t.Fatalf("expected reviewsTotal=28, got %d", summary.ReviewsTotal)
	}
	if summary.LastSyncedAtUTC != 400 {
		t.Fatalf("expected lastSyncedAtUtc=400, got %d", summary.LastSyncedAtUTC)
	}
	if len(summary.Browsers) != 3 {
		t.Fatalf("expected 3 browsers in aggregate, got %+v", summary.Browsers)
	}
	if summary.Browsers[0].Key != "chrome" || summary.Browsers[1].Key != "firefox" || summary.Browsers[2].Key != "edge" {
		t.Fatalf("expected browser rows sorted by users desc, got %+v", summary.Browsers)
	}
}

// ---------------------------------------------------------------------------
// DeploymentsTargetsHandler edge cases
// ---------------------------------------------------------------------------

func TestDeploymentsTargetsHandler_MethodNotAllowed(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/deployments/targets", nil)
	DeploymentsTargetsHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestDeploymentsTargetsHandler_WithManagementDisabled(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 0 WHERE name = 'feature_management_hub_enabled'`); err != nil {
		t.Fatalf("failed to disable flag: %v", err)
	}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/deployments/targets", nil)
	DeploymentsTargetsHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rr.Code)
	}
}
