package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	model "oracle-backend/internal/model"
)

func newIntegrationBatch(batchID string, downloads int64) model.OracleBatch {
	now := time.Now().UTC()
	bucketStart := now.Truncate(time.Hour)
	bucketEnd := bucketStart.Add(time.Hour)
	return model.OracleBatch{
		BatchID:     batchID,
		GeneratedAt: now.UnixMilli(),
		TimeZone:    "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{
				TotalEvents:    downloads,
				TotalDownloads: downloads,
				TotalSuccess:   downloads - 1,
				TotalFail:      1,
			},
		},
		TimeBuckets: []model.TimeBucket{
			{
				BucketStart: bucketStart.Format(time.RFC3339),
				BucketEnd:   bucketEnd.Format(time.RFC3339),
				Totals: model.BucketTotals{
					TotalEvents:    downloads,
					TotalDownloads: downloads,
					TotalSuccess:   downloads - 1,
					TotalFail:      1,
				},
				Counters: model.BucketCounters{
					ByStatus:    map[string]int64{"success": downloads - 1, "fail": 1},
					ByType:      map[string]int64{"pdf": downloads},
					ByBrowser:   map[string]int64{"chrome": downloads},
					ByOs:        map[string]int64{"windows": downloads},
					ByExtVer:    map[string]int64{"1.0.0": downloads},
					ByLanguage:  map[string]int64{"en": downloads},
					ByCountry:   map[string]int64{"us": downloads},
					ByErrorType: map[string]int64{"timeout": 1},
				},
			},
		},
		DOState: model.DOState{OK: true},
	}
}

func TestIntegrationAPIFlow_IngestBatchPersistsAndLoadsSummary(t *testing.T) {
	// Arrange
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	batch := newIntegrationBatch("integration-flow-1", 12)
	body, err := json.Marshal(batch)
	if err != nil {
		t.Fatalf("marshal batch failed: %v", err)
	}

	// Act: ingest
	ingestReq := httptest.NewRequest(http.MethodPost, "/ingest-batch", bytes.NewReader(body))
	ingestReq.Header.Set("Content-Type", "application/json")
	ingestReq.Header.Set("X-DO-SECRET", "test-secret")
	ingestRR := httptest.NewRecorder()
	mux.ServeHTTP(ingestRR, ingestReq)

	// Assert: ingest response
	if ingestRR.Code != http.StatusOK {
		t.Fatalf("expected ingest status 200, got %d: %s", ingestRR.Code, ingestRR.Body.String())
	}

	// Assert: row persisted
	var batchCount int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM batches WHERE batch_id = ?`, batch.BatchID).Scan(&batchCount); err != nil {
		t.Fatalf("query batches count failed: %v", err)
	}
	if batchCount != 1 {
		t.Fatalf("expected 1 batch row, got %d", batchCount)
	}

	// Act: read summary
	summaryReq := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	summaryRR := httptest.NewRecorder()
	mux.ServeHTTP(summaryRR, summaryReq)

	// Assert: summary response
	if summaryRR.Code != http.StatusOK {
		t.Fatalf("expected summary status 200, got %d: %s", summaryRR.Code, summaryRR.Body.String())
	}
	var summary map[string]any
	if err := json.Unmarshal(summaryRR.Body.Bytes(), &summary); err != nil {
		t.Fatalf("unmarshal summary failed: %v", err)
	}
	if ok, _ := summary["ok"].(bool); !ok {
		t.Fatalf("expected summary ok=true, got %v", summary["ok"])
	}
	if got, _ := summary["totalDownloads"].(float64); got < 12 {
		t.Fatalf("expected totalDownloads >= 12, got %v", summary["totalDownloads"])
	}
}

func TestIntegrationAPIFlow_CreativeEmailCRUDRoundTrip(t *testing.T) {
	// Arrange
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	upsertBody := `{"recordKey":"welcome-v1","data":{"subject":"Welcome","html":"<p>Hello</p>"}}`

	// Act: upsert
	upsertReq := httptest.NewRequest(http.MethodPost, "/api/admin/creative/emails/upsert", strings.NewReader(upsertBody))
	upsertReq.Header.Set("Content-Type", "application/json")
	upsertRR := httptest.NewRecorder()
	mux.ServeHTTP(upsertRR, upsertReq)

	// Assert: upsert response
	if upsertRR.Code != http.StatusOK {
		t.Fatalf("expected upsert status 200, got %d: %s", upsertRR.Code, upsertRR.Body.String())
	}

	// Act: list
	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/creative/emails", nil)
	listRR := httptest.NewRecorder()
	mux.ServeHTTP(listRR, listReq)

	// Assert: list contains the inserted record
	if listRR.Code != http.StatusOK {
		t.Fatalf("expected list status 200, got %d: %s", listRR.Code, listRR.Body.String())
	}
	var listPayload struct {
		OK      bool `json:"ok"`
		Records []struct {
			RecordKey string `json:"recordKey"`
		} `json:"records"`
	}
	if err := json.Unmarshal(listRR.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("unmarshal list payload failed: %v", err)
	}
	if !listPayload.OK || len(listPayload.Records) != 1 || listPayload.Records[0].RecordKey != "welcome-v1" {
		t.Fatalf("unexpected list payload: %s", listRR.Body.String())
	}

	// Act: delete
	deleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/creative/emails/delete", strings.NewReader(`{"recordKey":"welcome-v1"}`))
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	mux.ServeHTTP(deleteRR, deleteReq)

	// Assert: delete response
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("expected delete status 200, got %d: %s", deleteRR.Code, deleteRR.Body.String())
	}
	var deletePayload map[string]any
	if err := json.Unmarshal(deleteRR.Body.Bytes(), &deletePayload); err != nil {
		t.Fatalf("unmarshal delete payload failed: %v", err)
	}
	if affected, _ := deletePayload["affected"].(float64); affected != 1 {
		t.Fatalf("expected affected=1, got %v", deletePayload["affected"])
	}

	// Assert: row actually removed in SQLite
	var remaining int
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM admin_records WHERE record_type = 'creative_email_template' AND record_key = 'welcome-v1'`).Scan(&remaining); err != nil {
		t.Fatalf("query remaining records failed: %v", err)
	}
	if remaining != 0 {
		t.Fatalf("expected remaining records=0, got %d", remaining)
	}
}

func TestIntegrationAPIFlow_DeploymentSyncUpdatesOverviewAggregates(t *testing.T) {
	// Arrange
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	t.Setenv("ORACLE_ALLOW_HTTP_STORE_URLS", "true")

	const edgeCRXID = "ecojbijjkcjdolpeoiemnccgmaeomcmn"
	storeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	defer storeServer.Close()

	upserts := []struct {
		key string
		url string
	}{
		{key: "chrome", url: storeServer.URL + "/chrome"},
		{key: "firefox", url: storeServer.URL + "/firefox"},
		{key: "edge", url: storeServer.URL + "/addons/detail/classroom-quick-downloader/" + edgeCRXID},
	}
	for _, item := range upserts {
		body, err := json.Marshal(map[string]any{
			"recordType": "deployment_target",
			"recordKey":  item.key,
			"data": map[string]any{
				"url": item.url,
			},
		})
		if err != nil {
			t.Fatalf("marshal deployment upsert body failed: %v", err)
		}
		req := httptest.NewRequest(http.MethodPost, "/api/admin/records/upsert", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("seed deployment target upsert failed for %s: %d %s", item.key, rr.Code, rr.Body.String())
		}
	}

	// Act: run browser stores sync.
	syncReq := httptest.NewRequest(http.MethodPost, "/api/admin/deployments/sync", strings.NewReader(`{}`))
	syncReq.Header.Set("Content-Type", "application/json")
	syncRR := httptest.NewRecorder()
	mux.ServeHTTP(syncRR, syncReq)
	if syncRR.Code != http.StatusOK {
		t.Fatalf("deployment sync failed: %d %s", syncRR.Code, syncRR.Body.String())
	}

	// Act: read deployment targets aggregate payload that overview/charts consume.
	targetsReq := httptest.NewRequest(http.MethodGet, "/api/admin/deployments/targets", nil)
	targetsRR := httptest.NewRecorder()
	mux.ServeHTTP(targetsRR, targetsReq)
	if targetsRR.Code != http.StatusOK {
		t.Fatalf("deployment targets read failed: %d %s", targetsRR.Code, targetsRR.Body.String())
	}

	// Assert
	var payload struct {
		OK         bool `json:"ok"`
		Aggregates struct {
			UsersTotal   float64 `json:"usersTotal"`
			ReviewsTotal float64 `json:"reviewsTotal"`
		} `json:"aggregates"`
	}
	if err := json.Unmarshal(targetsRR.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal deployment targets payload failed: %v", err)
	}
	if !payload.OK {
		t.Fatalf("expected ok=true in deployment targets payload")
	}
	if int64(payload.Aggregates.UsersTotal) != 132420 {
		t.Fatalf("expected usersTotal=132420, got %v", payload.Aggregates.UsersTotal)
	}
	if int64(payload.Aggregates.ReviewsTotal) != 29 {
		t.Fatalf("expected reviewsTotal=29, got %v", payload.Aggregates.ReviewsTotal)
	}
}

func TestIntegrationAPIFlow_TimeSeriesAndBreakdownRespectVersionData(t *testing.T) {
	// Arrange
	mux, sqlDB := newIntegrationMux(t)
	defer sqlDB.Close()

	batchV1 := newIntegrationBatch("integration-flow-version-v1", 10)
	batchV2 := newIntegrationBatch("integration-flow-version-v2", 5)
	batchV2.TimeBuckets[0].Counters.ByExtVer = map[string]int64{"2.0.0": 5}

	for _, batch := range []model.OracleBatch{batchV1, batchV2} {
		body, err := json.Marshal(batch)
		if err != nil {
			t.Fatalf("marshal batch failed: %v", err)
		}
		req := httptest.NewRequest(http.MethodPost, "/ingest-batch", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-DO-SECRET", "test-secret")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("ingest failed for %s: %d %s", batch.BatchID, rr.Code, rr.Body.String())
		}
	}

	// Act: query extVersion-filtered timeseries.
	tsReq := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=all&granularity=day&extVersion=2.0.0", nil)
	tsRR := httptest.NewRecorder()
	mux.ServeHTTP(tsRR, tsReq)
	if tsRR.Code != http.StatusOK {
		t.Fatalf("timeseries query failed: %d %s", tsRR.Code, tsRR.Body.String())
	}

	// Assert: filtered series sums to version-specific downloads.
	var tsPayload struct {
		OK     bool `json:"ok"`
		Points []struct {
			Downloads int64 `json:"downloads"`
		} `json:"points"`
	}
	if err := json.Unmarshal(tsRR.Body.Bytes(), &tsPayload); err != nil {
		t.Fatalf("unmarshal timeseries payload failed: %v", err)
	}
	if !tsPayload.OK {
		t.Fatalf("expected timeseries ok=true")
	}
	var filteredDownloads int64
	for _, point := range tsPayload.Points {
		filteredDownloads += point.Downloads
	}
	if filteredDownloads != 5 {
		t.Fatalf("expected extVersion=2.0.0 downloads=5, got %d", filteredDownloads)
	}

	// Act: query version breakdown over all time.
	breakdownReq := httptest.NewRequest(http.MethodGet, "/api/stats/breakdown?dimension=version&range=all", nil)
	breakdownRR := httptest.NewRecorder()
	mux.ServeHTTP(breakdownRR, breakdownReq)
	if breakdownRR.Code != http.StatusOK {
		t.Fatalf("breakdown query failed: %d %s", breakdownRR.Code, breakdownRR.Body.String())
	}

	// Assert: both versions appear with expected counts.
	var breakdownPayload struct {
		OK     bool `json:"ok"`
		Values []struct {
			Value string `json:"value"`
			Count int64  `json:"count"`
		} `json:"values"`
	}
	if err := json.Unmarshal(breakdownRR.Body.Bytes(), &breakdownPayload); err != nil {
		t.Fatalf("unmarshal breakdown payload failed: %v", err)
	}
	if !breakdownPayload.OK {
		t.Fatalf("expected breakdown ok=true")
	}

	counts := make(map[string]int64, len(breakdownPayload.Values))
	for _, item := range breakdownPayload.Values {
		counts[item.Value] = item.Count
	}
	if counts["1.0.0"] != 10 {
		t.Fatalf("expected version 1.0.0 count=10, got %d", counts["1.0.0"])
	}
	if counts["2.0.0"] != 5 {
		t.Fatalf("expected version 2.0.0 count=5, got %d", counts["2.0.0"])
	}
}
