package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"oracle-backend/internal/db"
)

func newStatsTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "stats-test.db")
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		t.Fatalf("db.Init failed: %v", err)
	}
	return sqlDB
}

func seedHourly(t *testing.T, sqlDB *sql.DB, bucketStart string, downloads, success, fail int64, versions string) {
	t.Helper()
	_, err := sqlDB.Exec(
		`INSERT INTO downloads_hourly (
			bucket_start, bucket_end, total_events, total_downloads, total_success, total_fail,
			by_status_json, by_type_json, by_browser_json, by_os_json, by_ext_ver_json,
			by_lang_json, by_country_json, by_error_type_json, batch_id
		) VALUES (?, ?, ?, ?, ?, ?, '{}', '{}', '{}', '{}', ?, '{}', '{}', '{}', 'b1')`,
		bucketStart,
		bucketStart,
		downloads,
		downloads,
		success,
		fail,
		versions,
	)
	if err != nil {
		t.Fatalf("seed hourly failed: %v", err)
	}
}

func TestTimeSeriesHandler_ExtVersionFilter(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	seedHourly(t, sqlDB, "2026-02-01T00:00:00Z", 10, 8, 2, `{"1.0.0":5,"2.0.0":5}`)

	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=all&granularity=day&extVersion=1.0.0", nil)
	rr := httptest.NewRecorder()
	TimeSeriesHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		OK     bool `json:"ok"`
		Points []struct {
			Downloads int64 `json:"downloads"`
			Success   int64 `json:"success"`
			Fail      int64 `json:"fail"`
		} `json:"points"`
		ExtVersion string `json:"extVersion"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if !resp.OK || resp.ExtVersion != "1.0.0" {
		t.Fatalf("unexpected response payload: %+v", resp)
	}
	if len(resp.Points) != 1 {
		t.Fatalf("expected one point, got %d", len(resp.Points))
	}
	if resp.Points[0].Downloads != 5 || resp.Points[0].Success != 4 || resp.Points[0].Fail != 1 {
		t.Fatalf("unexpected filtered point: %+v", resp.Points[0])
	}
}

func TestTimeSeriesHandler_RangeTodayHourly(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	now := time.Now().UTC().Format("2006-01-02T15:04:05Z07:00")
	seedHourly(t, sqlDB, now, 3, 2, 1, `{"1.0.0":3}`)

	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=today", nil)
	rr := httptest.NewRecorder()
	TimeSeriesHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if gran, _ := resp["granularity"].(string); gran != "hour" {
		t.Fatalf("expected hour granularity for range=today, got %v", resp["granularity"])
	}
}

func TestExportHandler_AcceptsRangeParam(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	seedHourly(t, sqlDB, "2026-02-01T00:00:00Z", 4, 3, 1, `{"1.0.0":4}`)

	req := httptest.NewRequest(http.MethodGet, "/api/stats/export?format=json&range=all&granularity=day", nil)
	rr := httptest.NewRecorder()
	ExportHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}
