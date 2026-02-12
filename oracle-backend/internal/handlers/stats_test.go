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

// ──────────────────────────────────────────────────────────────────────────────
// New expanded tests for SummaryHandler
// ──────────────────────────────────────────────────────────────────────────────

func TestSummaryHandler_ReturnsAggregatedTotals(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	seedHourly(t, sqlDB, "2026-02-01T00:00:00Z", 20, 15, 5, `{"1.0.0":20}`)

	// Seed downloads_totals so SummaryHandler can load them
	_, err := sqlDB.Exec(
		`INSERT INTO downloads_totals (key, value) VALUES
		 ('totalEvents', 20), ('totalDownloads', 20), ('totalSuccess', 15), ('totalFail', 5),
		 ('browser:chrome', 15), ('browser:firefox', 5),
		 ('os:windows', 12), ('os:macos', 8),
		 ('country:us', 10), ('country:gb', 10),
		 ('type:pdf', 14), ('type:docx', 6),
		 ('extVer:1.0.0', 20)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
	)
	if err != nil {
		t.Fatalf("seed totals: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	rr := httptest.NewRecorder()
	SummaryHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp["ok"] != true {
		t.Fatalf("expected ok=true, got %v", resp["ok"])
	}
	if resp["totalDownloads"].(float64) != 20 {
		t.Fatalf("expected totalDownloads=20, got %v", resp["totalDownloads"])
	}
	if resp["topBrowser"].(string) != "chrome" {
		t.Fatalf("expected topBrowser=chrome, got %v", resp["topBrowser"])
	}
}

func TestSummaryHandler_EmptyDB(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	rr := httptest.NewRecorder()
	SummaryHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp["ok"] != true {
		t.Fatalf("expected ok=true even for empty DB")
	}
	if resp["totalDownloads"].(float64) != 0 {
		t.Fatalf("expected totalDownloads=0 for empty DB, got %v", resp["totalDownloads"])
	}
}

func TestSummaryHandler_MethodNotAllowed(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/stats/summary", nil)
	rr := httptest.NewRecorder()
	SummaryHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestBreakdownHandler_DefaultDimension(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	seedHourly(t, sqlDB, "2026-02-01T00:00:00Z", 10, 8, 2, `{"1.0.0":10}`)

	req := httptest.NewRequest(http.MethodGet, "/api/stats/breakdown?from=2026-01-01&to=2026-12-31", nil)
	rr := httptest.NewRecorder()
	BreakdownHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp["ok"] != true {
		t.Fatalf("expected ok=true")
	}
	// Default dimension is "type"
	if resp["dimension"].(string) != "type" {
		t.Fatalf("expected dimension=type, got %v", resp["dimension"])
	}
}

func TestBreakdownHandler_AllDimensions(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	seedHourly(t, sqlDB, "2026-02-01T00:00:00Z", 10, 8, 2, `{"1.0.0":10}`)

	dimensions := []string{"type", "browser", "os", "country", "language", "version", "error"}
	for _, dim := range dimensions {
		t.Run(dim, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/stats/breakdown?dimension="+dim+"&from=2026-01-01&to=2026-12-31", nil)
			rr := httptest.NewRecorder()
			BreakdownHandler(sqlDB).ServeHTTP(rr, req)

			if rr.Code != http.StatusOK {
				t.Fatalf("expected 200 for dimension=%s, got %d: %s", dim, rr.Code, rr.Body.String())
			}
		})
	}
}

func TestBreakdownHandler_InvalidDimension(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/stats/breakdown?dimension=invalid_dim&from=2026-01-01&to=2026-12-31", nil)
	rr := httptest.NewRecorder()
	BreakdownHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid dimension, got %d", rr.Code)
	}
}

func TestBreakdownHandler_MethodNotAllowed(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/stats/breakdown", nil)
	rr := httptest.NewRecorder()
	BreakdownHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestComparisonHandler_PeriodOverPeriod(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	seedHourly(t, sqlDB, "2026-01-15T00:00:00Z", 10, 8, 2, `{"1.0.0":10}`)
	seedHourly(t, sqlDB, "2026-02-15T00:00:00Z", 20, 18, 2, `{"1.0.0":20}`)

	req := httptest.NewRequest(http.MethodGet,
		"/api/stats/comparison?from1=2026-01-01&to1=2026-01-31&from2=2026-02-01&to2=2026-02-28", nil)
	rr := httptest.NewRecorder()
	ComparisonHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp["ok"] != true {
		t.Fatalf("expected ok=true")
	}
}

func TestComparisonHandler_MissingParams(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/stats/comparison?from1=2026-01-01", nil)
	rr := httptest.NewRecorder()
	ComparisonHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing params, got %d", rr.Code)
	}
}

func TestComparisonHandler_MethodNotAllowed(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/stats/comparison", nil)
	rr := httptest.NewRecorder()
	ComparisonHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestExportHandler_CSVFormat(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	seedHourly(t, sqlDB, "2026-02-01T00:00:00Z", 4, 3, 1, `{"1.0.0":4}`)

	req := httptest.NewRequest(http.MethodGet, "/api/stats/export?format=csv&range=all&granularity=day", nil)
	rr := httptest.NewRecorder()
	ExportHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	ct := rr.Header().Get("Content-Type")
	if ct != "text/csv" {
		t.Fatalf("expected text/csv Content-Type, got %q", ct)
	}
}

func TestTimeSeriesHandler_MethodNotAllowed(t *testing.T) {
	sqlDB := newStatsTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/stats/timeseries", nil)
	rr := httptest.NewRecorder()
	TimeSeriesHandler(sqlDB).ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

