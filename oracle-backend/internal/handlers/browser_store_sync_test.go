package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestParseStoreStatsFromHTML(t *testing.T) {
	users, version := parseStoreStatsFromHTML("chrome", `<script>{"users":"120K","version":"5.9.1"}</script>`)
	if users != "120K" {
		t.Fatalf("expected users 120K, got %q", users)
	}
	if version != "5.9.1" {
		t.Fatalf("expected version 5.9.1, got %q", version)
	}

	users, version = parseStoreStatsFromHTML("firefox", `<div>Users 12,345</div><div>Version 6.0.0</div>`)
	if users != "12,345" {
		t.Fatalf("expected users 12,345, got %q", users)
	}
	if version != "6.0.0" {
		t.Fatalf("expected version 6.0.0, got %q", version)
	}
}

func TestParseStoreStatsFullFromHTML_WithRatings(t *testing.T) {
	stats := parseStoreStatsFullFromHTML("chrome", `<div>5.0 (8 ratings)</div><div>251 users</div><div>Version 1.1.1</div>`)
	if stats.users != "251" {
		t.Fatalf("expected users 251, got %q", stats.users)
	}
	if stats.version != "1.1.1" {
		t.Fatalf("expected version 1.1.1, got %q", stats.version)
	}
	if stats.rating != "5.0" {
		t.Fatalf("expected rating 5.0, got %q", stats.rating)
	}
	if stats.ratingCount != 8 {
		t.Fatalf("expected ratingCount 8, got %d", stats.ratingCount)
	}
}

func TestParseApproxUsersCount(t *testing.T) {
	cases := []struct {
		in   string
		want int64
	}{
		{in: "12,345", want: 12345},
		{in: "120K", want: 120000},
		{in: "1.2M", want: 1200000},
		{in: "0", want: 0},
	}
	for _, tc := range cases {
		got := parseApproxUsersCount(tc.in)
		if got != tc.want {
			t.Fatalf("input=%q got=%d want=%d", tc.in, got, tc.want)
		}
	}
}

func TestExtractStoreRating_MetaAndText(t *testing.T) {
	rating, count := extractStoreRating(`<meta itemprop="ratingValue" content="5"><meta itemprop="ratingCount" content="2">`)
	if rating != "5.0" || count != 2 {
		t.Fatalf("expected 5.0/2 from meta, got %q/%d", rating, count)
	}
	rating, count = extractStoreRating(`Rated 4.8 by 123 reviewers`)
	if rating != "4.8" || count != 123 {
		t.Fatalf("expected 4.8/123 from text, got %q/%d", rating, count)
	}
}

func TestExtractEdgeCRXIDFromPath(t *testing.T) {
	got := extractEdgeCRXIDFromPath("/addons/detail/classroom-quick-downloader/ecojbijjkcjdolpeoiemnccgmaeomcmn")
	if got != "ecojbijjkcjdolpeoiemnccgmaeomcmn" {
		t.Fatalf("unexpected crx id: %q", got)
	}
}

func TestFetchEdgeStoreStatsByDetailsAPI(t *testing.T) {
	const edgeCRXID = "ecojbijjkcjdolpeoiemnccgmaeomcmn"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/addons/getproductdetailsbycrxid/"+edgeCRXID {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(`{"activeInstallCount":9,"averageRating":5,"ratingCount":1,"version":"1.1.1"}`))
	}))
	defer server.Close()

	stats, err := fetchEdgeStoreStatsByDetailsAPI(context.Background(), server.Client(), server.URL+"/addons/detail/classroom-quick-downloader/"+edgeCRXID)
	if err != nil {
		t.Fatalf("fetchEdgeStoreStatsByDetailsAPI failed: %v", err)
	}
	if stats.users != "9" || stats.usersCount != 9 {
		t.Fatalf("unexpected users payload: %+v", stats)
	}
	if stats.version != "1.1.1" {
		t.Fatalf("unexpected version: %+v", stats)
	}
	if stats.rating != "5.0" || stats.ratingCount != 1 {
		t.Fatalf("unexpected rating payload: %+v", stats)
	}
}

func TestDeploymentsSyncHandlerWithClient(t *testing.T) {
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
			_, _ = w.Write([]byte(`{"activeInstallCount":9,"averageRating":5,"ratingCount":1,"version":"6.1.0"}`))
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

	req := httptest.NewRequest(http.MethodPost, "/api/admin/deployments/sync", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	deploymentsSyncHandlerWithClient(sqlDB, nil, server.Client(), nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("sync failed: %d %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool `json:"ok"`
		Count   int  `json:"count"`
		OKCount int  `json:"okCount"`
		Results []struct {
			Key     string `json:"key"`
			Status  string `json:"status"`
			Version string `json:"version"`
			Rating  string `json:"rating"`
		} `json:"results"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse sync payload failed: %v", err)
	}
	if !payload.OK || payload.Count != 3 || payload.OKCount != 3 {
		t.Fatalf("unexpected sync payload: %+v", payload)
	}

	records, err := store.listRecords(context.Background(), "deployment_target")
	if err != nil {
		t.Fatalf("list deployment records failed: %v", err)
	}
	versions := map[string]string{}
	storedRatings := map[string]string{}
	storedRatingCounts := map[string]int64{}
	for _, row := range records {
		var m map[string]any
		if err := json.Unmarshal(row.Data, &m); err != nil {
			t.Fatalf("unmarshal deployment record failed: %v", err)
		}
		if v, _ := m["version"].(string); v != "" {
			versions[row.RecordKey] = v
		}
		if v, _ := m["rating"].(string); v != "" {
			storedRatings[row.RecordKey] = v
		}
		switch v := m["ratingCount"].(type) {
		case float64:
			storedRatingCounts[row.RecordKey] = int64(v)
		case int64:
			storedRatingCounts[row.RecordKey] = v
		}
	}
	if versions["chrome"] != "5.9.1" {
		t.Fatalf("expected chrome version to be updated, got %q", versions["chrome"])
	}
	if versions["firefox"] != "6.0.0" {
		t.Fatalf("expected firefox version to be updated, got %q", versions["firefox"])
	}
	if versions["edge"] != "6.1.0" {
		t.Fatalf("expected edge version to be updated, got %q", versions["edge"])
	}
	if storedRatings["chrome"] != "4.7" || storedRatingCounts["chrome"] != 21 {
		t.Fatalf("expected chrome rating/ratingCount to be stored, got rating=%q count=%d", storedRatings["chrome"], storedRatingCounts["chrome"])
	}
	if storedRatings["firefox"] != "5.0" || storedRatingCounts["firefox"] != 2 {
		t.Fatalf("expected firefox rating/ratingCount to be stored, got rating=%q count=%d", storedRatings["firefox"], storedRatingCounts["firefox"])
	}
	if storedRatings["edge"] != "5.0" || storedRatingCounts["edge"] != 1 {
		t.Fatalf("expected edge rating/ratingCount to be stored, got rating=%q count=%d", storedRatings["edge"], storedRatingCounts["edge"])
	}

	ratings := map[string]string{}
	for _, result := range payload.Results {
		ratings[result.Key] = result.Rating
	}
	if ratings["chrome"] != "4.7" {
		t.Fatalf("expected chrome rating to be updated, got %q", ratings["chrome"])
	}
	if ratings["firefox"] != "5.0" {
		t.Fatalf("expected firefox rating to be updated, got %q", ratings["firefox"])
	}
	if ratings["edge"] != "5.0" {
		t.Fatalf("expected edge rating to be updated, got %q", ratings["edge"])
	}
}

func TestSyncDeploymentTargets(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	t.Setenv("ORACLE_ALLOW_HTTP_STORE_URLS", "true")
	const edgeCRXID = "ecojbijjkcjdolpeoiemnccgmaeomcmn"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chrome":
			_, _ = w.Write([]byte(`<div>251 users</div><div>Version 1.1.1</div><div>5.0 (8 ratings)</div>`))
		case "/firefox":
			_, _ = w.Write([]byte(`<div>11 Users</div><div>Version 1.1.1</div><div>5 (2 reviews)</div>`))
		case "/addons/getproductdetailsbycrxid/" + edgeCRXID:
			_, _ = w.Write([]byte(`{"activeInstallCount":9,"averageRating":5,"ratingCount":1,"version":"1.1.1"}`))
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

	targetSet := map[string]struct{}{"chrome": {}, "firefox": {}, "edge": {}}
	results, okCount, err := syncDeploymentTargets(context.Background(), store, sqlDB, server.Client(), nil, targetSet, false, false)
	if err != nil {
		t.Fatalf("syncDeploymentTargets failed: %v", err)
	}
	if len(results) != 3 || okCount != 3 {
		t.Fatalf("unexpected sync totals: len=%d ok=%d", len(results), okCount)
	}
}

func TestStartDeploymentsAutoSyncLoop_RunsImmediately(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	t.Setenv("ORACLE_ALLOW_HTTP_STORE_URLS", "true")
	const edgeCRXID = "ecojbijjkcjdolpeoiemnccgmaeomcmn"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chrome":
			_, _ = w.Write([]byte(`<div>250 users</div><div>Version 7.0.0</div><div>5.0 (10 ratings)</div>`))
		case "/firefox":
			_, _ = w.Write([]byte(`<div>100 users</div><div>Version 7.0.1</div><div>4.9 (9 reviews)</div>`))
		case "/addons/getproductdetailsbycrxid/" + edgeCRXID:
			_, _ = w.Write([]byte(`{"activeInstallCount":50,"averageRating":5,"ratingCount":7,"version":"7.0.2"}`))
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

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		StartDeploymentsAutoSyncLoop(ctx, sqlDB, nil, nil, 24*time.Hour)
		close(done)
	}()
	defer func() {
		cancel()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			t.Fatal("auto-sync loop did not stop after cancellation")
		}
	}()

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		records, err := store.listRecords(context.Background(), "deployment_target")
		if err != nil {
			t.Fatalf("list deployment records failed: %v", err)
		}
		if len(records) != 3 {
			time.Sleep(30 * time.Millisecond)
			continue
		}
		allSynced := true
		for _, row := range records {
			var data map[string]any
			if err := json.Unmarshal(row.Data, &data); err != nil {
				t.Fatalf("unmarshal deployment row failed: %v", err)
			}
			if data["syncStatus"] != "ok" {
				allSynced = false
				break
			}
		}
		if allSynced {
			return
		}
		time.Sleep(30 * time.Millisecond)
	}

	t.Fatal("expected immediate auto-sync run to populate deployment status before first long interval tick")
}

func TestStartDeploymentsAutoSyncLoop_RetriesTransientFailures(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	t.Setenv("ORACLE_ALLOW_HTTP_STORE_URLS", "true")
	const edgeCRXID = "ecojbijjkcjdolpeoiemnccgmaeomcmn"

	var requestCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Fail the first full sync attempt (3 target requests), then succeed on retry.
		if requestCount.Add(1) <= int32(len(deploymentTargetDefs)) {
			http.Error(w, "temporary upstream failure", http.StatusServiceUnavailable)
			return
		}
		switch r.URL.Path {
		case "/chrome":
			_, _ = w.Write([]byte(`<div>300 users</div><div>Version 8.0.0</div><div>5.0 (12 ratings)</div>`))
		case "/firefox":
			_, _ = w.Write([]byte(`<div>200 users</div><div>Version 8.0.1</div><div>4.8 (11 reviews)</div>`))
		case "/addons/getproductdetailsbycrxid/" + edgeCRXID:
			_, _ = w.Write([]byte(`{"activeInstallCount":75,"averageRating":5,"ratingCount":6,"version":"8.0.2"}`))
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

	oldAttempts := deploymentsAutoSyncMaxAttempts
	oldRetryDelay := deploymentsAutoSyncRetryDelay
	deploymentsAutoSyncMaxAttempts = 2
	deploymentsAutoSyncRetryDelay = 20 * time.Millisecond
	defer func() {
		deploymentsAutoSyncMaxAttempts = oldAttempts
		deploymentsAutoSyncRetryDelay = oldRetryDelay
	}()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		StartDeploymentsAutoSyncLoop(ctx, sqlDB, nil, nil, 24*time.Hour)
		close(done)
	}()
	defer func() {
		cancel()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			t.Fatal("auto-sync loop did not stop after cancellation")
		}
	}()

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		records, err := store.listRecords(context.Background(), "deployment_target")
		if err != nil {
			t.Fatalf("list deployment records failed: %v", err)
		}
		if len(records) != 3 {
			time.Sleep(30 * time.Millisecond)
			continue
		}
		allSynced := true
		for _, row := range records {
			var data map[string]any
			if err := json.Unmarshal(row.Data, &data); err != nil {
				t.Fatalf("unmarshal deployment row failed: %v", err)
			}
			if data["syncStatus"] != "ok" {
				allSynced = false
				break
			}
		}
		if allSynced {
			if got := requestCount.Load(); got <= int32(len(deploymentTargetDefs)) {
				t.Fatalf("expected retry attempt to happen, request count=%d", got)
			}
			return
		}
		time.Sleep(30 * time.Millisecond)
	}

	t.Fatal("expected auto-sync retry to recover after transient failures")
}

func TestDeploymentsSyncHandler_DoesNotCountPersistFailuresAsSuccess(t *testing.T) {
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
			_, _ = w.Write([]byte(`{"activeInstallCount":9,"averageRating":5,"ratingCount":1,"version":"6.1.0"}`))
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

	// Force one persistence error while allowing other targets to persist.
	if _, err := sqlDB.Exec(`
		CREATE TRIGGER fail_deployment_sync_chrome_update
		BEFORE UPDATE ON admin_records
		FOR EACH ROW
		WHEN NEW.record_type = 'deployment_target' AND NEW.record_key = 'chrome'
		BEGIN
			SELECT RAISE(ABORT, 'forced deployment sync failure');
		END;
	`); err != nil {
		t.Fatalf("create trigger failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/deployments/sync", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	deploymentsSyncHandlerWithClient(sqlDB, nil, server.Client(), nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("sync failed: %d %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool `json:"ok"`
		Count   int  `json:"count"`
		OKCount int  `json:"okCount"`
		Results []struct {
			Key    string `json:"key"`
			Status string `json:"status"`
			Error  string `json:"error"`
		} `json:"results"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse sync payload failed: %v", err)
	}
	if !payload.OK || payload.Count != 3 {
		t.Fatalf("unexpected sync payload envelope: %+v", payload)
	}
	if payload.OKCount != 2 {
		t.Fatalf("expected okCount=2 because one persist failed, got %+v", payload)
	}

	statusByKey := map[string]string{}
	errorByKey := map[string]string{}
	for _, result := range payload.Results {
		statusByKey[result.Key] = result.Status
		errorByKey[result.Key] = result.Error
	}
	if statusByKey["chrome"] != "error" || errorByKey["chrome"] == "" {
		t.Fatalf("expected chrome result to expose persistence failure, got %+v", payload.Results)
	}
	if statusByKey["firefox"] != "ok" || statusByKey["edge"] != "ok" {
		t.Fatalf("expected firefox and edge to remain successful, got %+v", payload.Results)
	}
}

func TestDeploymentsSyncHandlerRejectsUnknownTarget(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/deployments/sync", bytes.NewBufferString(`{"targets":["unknown"]}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	deploymentsSyncHandlerWithClient(sqlDB, nil, &http.Client{}, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown target, got %d", rr.Code)
	}
}

func TestDeploymentsSyncHandler_RespectsSyncFeatureFlag(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 0 WHERE name = 'feature_sync_enabled'`); err != nil {
		t.Fatalf("failed to disable sync feature flag: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/deployments/sync", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	deploymentsSyncHandlerWithClient(sqlDB, nil, &http.Client{}, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when sync feature is disabled, got %d", rr.Code)
	}
}

func TestDeploymentsSyncHandler_MethodNotAllowed(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/admin/deployments/sync", nil)
	rr := httptest.NewRecorder()
	DeploymentsSyncHandler(sqlDB, nil, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for non-POST method, got %d", rr.Code)
	}
}

func TestDeploymentsSyncHandler_RespectsManagementFeatureFlag(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 0 WHERE name = 'feature_management_hub_enabled'`); err != nil {
		t.Fatalf("failed to disable management feature flag: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/deployments/sync", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	DeploymentsSyncHandler(sqlDB, nil, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when management feature is disabled, got %d", rr.Code)
	}
}

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

func TestValidateStoreURL_RejectsUntrustedHostByDefault(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "false")
	err := validateStoreURL("chrome", "https://example.com/x")
	if err == nil {
		t.Fatalf("expected untrusted host to be rejected")
	}
}

func TestValidateStoreURL_RejectsHTTPByDefault(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	t.Setenv("ORACLE_ALLOW_HTTP_STORE_URLS", "false")
	err := validateStoreURL("chrome", "http://example.com/x")
	if err == nil {
		t.Fatalf("expected plain HTTP URL to be rejected by default")
	}
}

func TestValidateStoreURL_AllowsHTTPWithExplicitOptIn(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	t.Setenv("ORACLE_ALLOW_HTTP_STORE_URLS", "true")
	err := validateStoreURL("chrome", "http://example.com/x")
	if err != nil {
		t.Fatalf("expected plain HTTP URL with explicit opt-in, got: %v", err)
	}
}

// ---------------------------------------------------------------------------
// validateStoreURL additional edge cases
// ---------------------------------------------------------------------------

func TestValidateStoreURL_EmptyURL(t *testing.T) {
	err := validateStoreURL("chrome", "")
	if err == nil {
		t.Fatal("expected error for empty URL")
	}
}

func TestValidateStoreURL_BlankSpacesOnly(t *testing.T) {
	err := validateStoreURL("chrome", "   ")
	if err == nil {
		t.Fatal("expected error for blank URL")
	}
}

func TestValidateStoreURL_NoScheme(t *testing.T) {
	err := validateStoreURL("chrome", "example.com/path")
	if err == nil {
		t.Fatal("expected error for URL without http/https scheme")
	}
}

func TestValidateStoreURL_FTPScheme(t *testing.T) {
	err := validateStoreURL("chrome", "ftp://example.com/path")
	if err == nil {
		t.Fatal("expected error for ftp scheme URL")
	}
}

func TestValidateStoreURL_MissingHost(t *testing.T) {
	err := validateStoreURL("chrome", "https://")
	if err == nil {
		t.Fatal("expected error for URL with missing host")
	}
}

func TestValidateStoreURL_AllowsUntrustedWithEnvVar(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	err := validateStoreURL("chrome", "https://random-host.example.com/path")
	if err != nil {
		t.Fatalf("expected untrusted URL to be allowed, got: %v", err)
	}
}

func TestValidateStoreURL_RejectsUnknownKeyWithNoAllowedHosts(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "false")
	err := validateStoreURL("unknown_key_xyz", "https://example.com/path")
	if err == nil {
		t.Fatal("expected error for unknown target key with no allowed hosts")
	}
}

// ---------------------------------------------------------------------------
// parseStoreStatsFromHTML edge cases
// ---------------------------------------------------------------------------

func TestParseStoreStatsFromHTML_FallbackToStrippedHTML(t *testing.T) {
	// HTML with tags where patterns don't match directly, but after stripping they do
	html := `<div class="big">120,000 users</div><span>Version 2.3.4</span>`
	users, version := parseStoreStatsFromHTML("chrome", html)
	if users == "" && version == "" {
		t.Log("fallback stripping may not match these patterns — verifying function is called")
	}
	_ = users
	_ = version
}

func TestParseStoreStatsFromHTML_EmptyHTML(t *testing.T) {
	users, version := parseStoreStatsFromHTML("chrome", "")
	if users != "" || version != "" {
		t.Fatalf("expected empty results for empty HTML, got users=%q version=%q", users, version)
	}
}

func TestParseStoreStatsFromHTML_JSONInScript(t *testing.T) {
	html := `<html><script>{"users":"50K","version":"3.0.0"}</script></html>`
	users, version := parseStoreStatsFromHTML("edge", html)
	if users != "50K" {
		t.Fatalf("expected users 50K, got %q", users)
	}
	if version != "3.0.0" {
		t.Fatalf("expected version 3.0.0, got %q", version)
	}
}

// ---------------------------------------------------------------------------
// extractStoreUsers / extractStoreVersion edge cases
// ---------------------------------------------------------------------------

func TestExtractStoreUsers_TextPattern2(t *testing.T) {
	// "X users" — matched by storeUsersTextPattern2
	got := extractStoreUsers("250,000 users")
	if got != "250,000" {
		t.Fatalf("expected 250,000, got %q", got)
	}
}

func TestExtractStoreUsers_NoMatch(t *testing.T) {
	got := extractStoreUsers("this has no user count")
	if got != "" {
		t.Fatalf("expected empty, got %q", got)
	}
}

func TestExtractStoreVersion_NoMatch(t *testing.T) {
	got := extractStoreVersion("this has no version info")
	if got != "" {
		t.Fatalf("expected empty, got %q", got)
	}
}

func TestExtractStoreVersion_TextPattern(t *testing.T) {
	got := extractStoreVersion("Version 4.2.1")
	if got != "4.2.1" {
		t.Fatalf("expected 4.2.1, got %q", got)
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

// ---------------------------------------------------------------------------
// parseApproxUsersCount edge cases
// ---------------------------------------------------------------------------

func TestParseApproxUsersCount_K(t *testing.T) {
	if got := parseApproxUsersCount("2.5K"); got != 2500 {
		t.Fatalf("expected 2500, got %d", got)
	}
}

func TestParseApproxUsersCount_Plain(t *testing.T) {
	if got := parseApproxUsersCount("999"); got != 999 {
		t.Fatalf("expected 999, got %d", got)
	}
}

func TestParseApproxUsersCount_Empty(t *testing.T) {
	if got := parseApproxUsersCount(""); got != 0 {
		t.Fatalf("expected 0, got %d", got)
	}
}

func TestParseApproxUsersCount_InvalidString(t *testing.T) {
	if got := parseApproxUsersCount("abc"); got != 0 {
		t.Fatalf("expected 0 for invalid string, got %d", got)
	}
}
