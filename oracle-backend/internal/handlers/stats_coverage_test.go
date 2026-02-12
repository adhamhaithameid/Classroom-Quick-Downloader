package handlers

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"oracle-backend/internal/db"
)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func openStatsDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := db.Init(t.TempDir() + "/stats.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

func seedHourlyRow(t *testing.T, d *sql.DB, bucket string, downloads, success, fail int64,
	statusJSON, typeJSON, browserJSON, osJSON, countryJSON, langJSON, extVerJSON, errorTypeJSON string) {
	t.Helper()
	// bucket_end = bucket + 1 hour for simplicity
	bucketEnd := bucket
	if parsed, err := time.Parse(time.RFC3339, bucket); err == nil {
		bucketEnd = parsed.Add(time.Hour).UTC().Format(time.RFC3339)
	}
	_, err := d.Exec(`INSERT INTO downloads_hourly
		(batch_id, bucket_start, bucket_end, total_downloads, total_success, total_fail,
		 by_status_json, by_type_json, by_browser_json, by_os_json,
		 by_country_json, by_lang_json, by_ext_ver_json, by_error_type_json)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		"batch-stats-1", bucket, bucketEnd, downloads, success, fail,
		statusJSON, typeJSON, browserJSON, osJSON,
		countryJSON, langJSON, extVerJSON, errorTypeJSON)
	if err != nil {
		t.Fatal(err)
	}
}

// ---------------------------------------------------------------------------
// resolveRange
// ---------------------------------------------------------------------------

func TestResolveRange_Today(t *testing.T) {
	d := openStatsDB(t)
	now := time.Date(2025, 6, 15, 10, 30, 0, 0, time.UTC)
	from, to, err := resolveRange(context.Background(), d, "today", now)
	if err != nil {
		t.Fatal(err)
	}
	if from.Day() != 15 || from.Hour() != 0 {
		t.Fatalf("expected midnight, got %v", from)
	}
	if !to.Equal(from) {
		t.Fatalf("expected to == from for today, got %v != %v", to, from)
	}
}

func TestResolveRange_Week(t *testing.T) {
	d := openStatsDB(t)
	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	from, _, err := resolveRange(context.Background(), d, "week", now)
	if err != nil {
		t.Fatal(err)
	}
	if from.Day() != 9 {
		t.Fatalf("expected June 9, got %v", from)
	}
}

func TestResolveRange_Month(t *testing.T) {
	d := openStatsDB(t)
	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	from, _, err := resolveRange(context.Background(), d, "month", now)
	if err != nil {
		t.Fatal(err)
	}
	if from.Day() != 1 || from.Month() != 6 {
		t.Fatalf("expected June 1, got %v", from)
	}
}

func TestResolveRange_Year(t *testing.T) {
	d := openStatsDB(t)
	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	from, _, err := resolveRange(context.Background(), d, "year", now)
	if err != nil {
		t.Fatal(err)
	}
	if from.Month() != 1 || from.Day() != 1 {
		t.Fatalf("expected Jan 1, got %v", from)
	}
}

func TestResolveRange_AllTime_EmptyDB(t *testing.T) {
	d := openStatsDB(t)
	now := time.Now()
	from, to, err := resolveRange(context.Background(), d, "all", now)
	if err != nil {
		t.Fatal(err)
	}
	if !from.Equal(now) || !to.Equal(now) {
		t.Fatalf("empty DB should return now,now")
	}
}

func TestResolveRange_AllTime_WithData(t *testing.T) {
	d := openStatsDB(t)
	seedHourlyRow(t, d, "2025-01-10T00:00:00Z", 5, 3, 2, "{}", "{}", "{}", "{}", "{}", "{}", "{}", "{}")
	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	from, _, err := resolveRange(context.Background(), d, "all_time", now)
	if err != nil {
		t.Fatal(err)
	}
	if from.Day() != 10 || from.Month() != 1 {
		t.Fatalf("expected Jan 10, got %v", from)
	}
}

func TestResolveRange_AllTimeAlias(t *testing.T) {
	d := openStatsDB(t)
	now := time.Now()
	_, _, err := resolveRange(context.Background(), d, "alltime", now)
	if err != nil {
		t.Fatal(err)
	}
}

func TestResolveRange_Invalid(t *testing.T) {
	d := openStatsDB(t)
	_, _, err := resolveRange(context.Background(), d, "invalid", time.Now())
	if err == nil {
		t.Fatal("expected error for invalid range")
	}
}

// ---------------------------------------------------------------------------
// calcChange
// ---------------------------------------------------------------------------

func TestCalcChange_BothZero(t *testing.T) {
	if r := calcChange(0, 0); r != "0%" {
		t.Fatalf("expected 0%%, got %s", r)
	}
}

func TestCalcChange_OldZero_NewPositive(t *testing.T) {
	if r := calcChange(0, 5); r != "+∞" {
		t.Fatalf("expected +∞, got %s", r)
	}
}

func TestCalcChange_Positive(t *testing.T) {
	r := calcChange(100, 150)
	if !strings.HasPrefix(r, "+") {
		t.Fatalf("expected positive change, got %s", r)
	}
}

func TestCalcChange_Negative(t *testing.T) {
	r := calcChange(100, 50)
	if !strings.HasPrefix(r, "-") {
		t.Fatalf("expected negative change, got %s", r)
	}
}

func TestCalcChange_NoChange(t *testing.T) {
	r := calcChange(100, 100)
	if r != "+0.0%" {
		t.Fatalf("expected +0.0%%, got %s", r)
	}
}

// ---------------------------------------------------------------------------
// proportionalSplit
// ---------------------------------------------------------------------------

func TestProportionalSplit_AllPositive(t *testing.T) {
	r := proportionalSplit(50, 100, 200)
	if r != 100 {
		t.Fatalf("expected 100, got %d", r)
	}
}

func TestProportionalSplit_ZeroVersion(t *testing.T) {
	if proportionalSplit(0, 100, 200) != 0 {
		t.Fatal("expected 0 when versionDownloads=0")
	}
}

func TestProportionalSplit_ZeroTotal(t *testing.T) {
	if proportionalSplit(10, 0, 200) != 0 {
		t.Fatal("expected 0 when totalDownloads=0")
	}
}

func TestProportionalSplit_ZeroCategory(t *testing.T) {
	if proportionalSplit(10, 100, 0) != 0 {
		t.Fatal("expected 0 when totalCategory=0")
	}
}

func TestProportionalSplit_Negative(t *testing.T) {
	if proportionalSplit(-1, 100, 200) != 0 {
		t.Fatal("expected 0 for negative")
	}
}

// ---------------------------------------------------------------------------
// extractVersionCount
// ---------------------------------------------------------------------------

func TestExtractVersionCount_Valid(t *testing.T) {
	raw := `{"1.2.0":42,"1.3.0":10}`
	if extractVersionCount(raw, "1.2.0") != 42 {
		t.Fatal("expected 42")
	}
}

func TestExtractVersionCount_Missing(t *testing.T) {
	raw := `{"1.2.0":42}`
	if extractVersionCount(raw, "9.9.9") != 0 {
		t.Fatal("expected 0 for missing version")
	}
}

func TestExtractVersionCount_EmptyRaw(t *testing.T) {
	if extractVersionCount("", "1.0") != 0 {
		t.Fatal("expected 0 for empty raw")
	}
}

func TestExtractVersionCount_EmptyVersion(t *testing.T) {
	if extractVersionCount(`{"1.0":1}`, "") != 0 {
		t.Fatal("expected 0 for empty version")
	}
}

func TestExtractVersionCount_InvalidJSON(t *testing.T) {
	if extractVersionCount("{bad}", "1.0") != 0 {
		t.Fatal("expected 0 for invalid JSON")
	}
}

// ---------------------------------------------------------------------------
// columnForDimension
// ---------------------------------------------------------------------------

func TestColumnForDimension_AllValid(t *testing.T) {
	cases := map[string]string{
		"status":     "by_status_json",
		"type":       "by_type_json",
		"browser":    "by_browser_json",
		"os":         "by_os_json",
		"country":    "by_country_json",
		"lang":       "by_lang_json",
		"language":   "by_lang_json",
		"ext_version": "by_ext_ver_json",
		"extVersion": "by_ext_ver_json",
		"version":    "by_ext_ver_json",
		"error_type": "by_error_type_json",
		"errorType":  "by_error_type_json",
		"error":      "by_error_type_json",
	}
	for dim, want := range cases {
		col, err := columnForDimension(dim)
		if err != nil {
			t.Fatalf("dim=%s: unexpected error: %v", dim, err)
		}
		if col != want {
			t.Fatalf("dim=%s: got %s, want %s", dim, col, want)
		}
	}
}

func TestColumnForDimension_Invalid(t *testing.T) {
	_, err := columnForDimension("nope")
	if err == nil {
		t.Fatal("expected error for invalid dimension")
	}
}

// ---------------------------------------------------------------------------
// loadTotals edge cases
// ---------------------------------------------------------------------------

func TestLoadTotals_Empty(t *testing.T) {
	d := openStatsDB(t)
	totals, err := loadTotals(context.Background(), d)
	if err != nil {
		t.Fatal(err)
	}
	if len(totals) != 0 {
		t.Fatalf("expected empty totals, got %d entries", len(totals))
	}
}

func TestLoadTotals_WithData(t *testing.T) {
	d := openStatsDB(t)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('totalDownloads', 42)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('totalSuccess', 40)`)
	totals, err := loadTotals(context.Background(), d)
	if err != nil {
		t.Fatal(err)
	}
	if totals["totalDownloads"] != 42 || totals["totalSuccess"] != 40 {
		t.Fatalf("unexpected totals: %v", totals)
	}
}



// ---------------------------------------------------------------------------
// loadLastDOSnapshot
// ---------------------------------------------------------------------------

func TestLoadLastDOSnapshot_Empty(t *testing.T) {
	d := openStatsDB(t)
	snap, err := loadLastDOSnapshot(context.Background(), d)
	// loadLastDOSnapshot returns sql.ErrNoRows for empty DB
	if err == nil {
		t.Fatal("expected error for empty do_state_snapshots table")
	}
	if snap != nil {
		t.Fatal("expected nil snapshot on error")
	}
}

// ---------------------------------------------------------------------------
// deriveStatusAndFlags
// ---------------------------------------------------------------------------

func TestDeriveStatusAndFlags_NilBatch(t *testing.T) {
	status, flags := deriveStatusAndFlags(nil, nil)
	if status != "cold" {
		t.Fatalf("expected cold, got %s", status)
	}
	found := false
	for _, f := range flags {
		if f == "no_batches_yet" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected no_batches_yet flag")
	}
}

func TestDeriveStatusAndFlags_Online(t *testing.T) {
	now := time.Now().UnixMilli()
	batch := &summaryBatchInfo{IngestedAt: now}
	status, _ := deriveStatusAndFlags(batch, nil)
	if status != "online" {
		t.Fatalf("expected online, got %s", status)
	}
}

func TestDeriveStatusAndFlags_StaleStatus(t *testing.T) {
	old := time.Now().Add(-2 * time.Hour).UnixMilli()
	batch := &summaryBatchInfo{IngestedAt: old}
	status, _ := deriveStatusAndFlags(batch, nil)
	if status != "stale" {
		t.Fatalf("expected stale, got %s", status)
	}
}

func TestDeriveStatusAndFlags_Idle(t *testing.T) {
	old := time.Now().Add(-48 * time.Hour).UnixMilli()
	batch := &summaryBatchInfo{IngestedAt: old}
	status, _ := deriveStatusAndFlags(batch, nil)
	if status != "idle" {
		t.Fatalf("expected idle, got %s", status)
	}
}

func TestDeriveStatusAndFlags_WithDOSnapshot(t *testing.T) {
	now := time.Now().UnixMilli()
	batch := &summaryBatchInfo{IngestedAt: now}
	snap := &summaryDOStateInfo{RemoteEnabled: true, PendingEvents: 5}
	status, flags := deriveStatusAndFlags(batch, snap)
	if status != "online" {
		t.Fatalf("expected online, got %s", status)
	}
	hasRemoteEnabled := false
	hasBacklog := false
	for _, f := range flags {
		if f == "remote_enabled" {
			hasRemoteEnabled = true
		}
		if f == "backlog" {
			hasBacklog = true
		}
	}
	if !hasRemoteEnabled {
		t.Fatal("expected remote_enabled flag")
	}
	if !hasBacklog {
		t.Fatal("expected backlog flag")
	}
}

func TestDeriveStatusAndFlags_RemoteDisabled(t *testing.T) {
	now := time.Now().UnixMilli()
	batch := &summaryBatchInfo{IngestedAt: now}
	snap := &summaryDOStateInfo{RemoteEnabled: false, PendingEvents: 0}
	_, flags := deriveStatusAndFlags(batch, snap)
	hasRemoteDisabled := false
	for _, f := range flags {
		if f == "remote_disabled" {
			hasRemoteDisabled = true
		}
	}
	if !hasRemoteDisabled {
		t.Fatal("expected remote_disabled flag")
	}
}

// ---------------------------------------------------------------------------
// SummaryHandler full coverage
// ---------------------------------------------------------------------------

func TestSummaryHandler_WithTotals(t *testing.T) {
	d := openStatsDB(t)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('totalDownloads', 100)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('totalSuccess', 90)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('totalFail', 10)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('totalEvents', 200)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('status:cancelled', 5)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('browser:Chrome', 50)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('os:Windows', 40)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('country:US', 30)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('lang:en', 25)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('extVer:1.0', 20)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('type:pdf', 15)`)
	_, _ = d.Exec(`INSERT INTO downloads_totals (key, value) VALUES ('errorType:timeout', 8)`)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	SummaryHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["totalDownloads"].(float64) != 100 {
		t.Fatalf("expected totalDownloads=100, got %v", resp["totalDownloads"])
	}
	if resp["topBrowser"].(string) != "Chrome" {
		t.Fatalf("expected topBrowser=Chrome, got %v", resp["topBrowser"])
	}
}

func TestSummaryHandler_WithLastBatch(t *testing.T) {
	d := openStatsDB(t)
	now := time.Now().UnixMilli()
	_, _ = d.Exec(`INSERT INTO batches (batch_id, generated_at, ingested_at,
		events_count, downloads_count, success_count, fail_count)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		"batch-s1", now, now, 10, 5, 4, 1)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)
	SummaryHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// TimeSeriesHandler coverage
// ---------------------------------------------------------------------------

func TestTimeSeriesHandler_DefaultRange(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=week", nil)
	TimeSeriesHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["ok"] != true {
		t.Fatal("expected ok=true")
	}
}

func TestTimeSeriesHandler_WithData(t *testing.T) {
	d := openStatsDB(t)
	now := time.Now().UTC().Format("2006-01-02T15:00:00Z")
	seedHourlyRow(t, d, now, 10, 8, 2, `{"ok":8,"fail":2}`, "{}", "{}", "{}", "{}", "{}", "{}", "{}")

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=month", nil)
	TimeSeriesHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestTimeSeriesHandler_WithVersion(t *testing.T) {
	d := openStatsDB(t)
	now := time.Now().UTC().Format("2006-01-02T15:00:00Z")
	seedHourlyRow(t, d, now, 10, 8, 2, "{}", "{}", "{}", "{}", "{}", "{}", `{"1.0":10}`, "{}")

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=month&extVersion=1.0", nil)
	TimeSeriesHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestTimeSeriesHandler_TodayRange(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=today", nil)
	TimeSeriesHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestTimeSeriesHandler_YearRange(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=year", nil)
	TimeSeriesHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestTimeSeriesHandler_AllRange(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=all", nil)
	TimeSeriesHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestTimeSeriesHandler_InvalidRange(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=nope", nil)
	TimeSeriesHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestTimeSeriesHandler_VersionDayGranularity(t *testing.T) {
	d := openStatsDB(t)
	now := time.Now().UTC().Format("2006-01-02T15:00:00Z")
	seedHourlyRow(t, d, now, 10, 8, 2, "{}", "{}", "{}", "{}", "{}", "{}", `{"1.0":10}`, "{}")

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=year&extVersion=1.0", nil)
	TimeSeriesHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// BreakdownHandler coverage - all dimensions
// ---------------------------------------------------------------------------

func TestBreakdownHandler_AllDimensionsCoverage(t *testing.T) {
	d := openStatsDB(t)
	now := time.Now().UTC().Format("2006-01-02T15:00:00Z")
	seedHourlyRow(t, d, now, 10, 8, 2,
		`{"ok":8,"fail":2}`,
		`{"pdf":5,"docx":5}`,
		`{"Chrome":7,"Firefox":3}`,
		`{"Windows":6,"Linux":4}`,
		`{"US":4,"UK":6}`,
		`{"en":5,"fr":5}`,
		`{"1.0":10}`,
		`{"timeout":3,"network":7}`)

	dims := []string{"status", "type", "browser", "os", "country", "lang", "language",
		"ext_version", "extVersion", "version", "error_type", "errorType", "error"}
	for _, dim := range dims {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/stats/breakdown?dimension="+dim+"&range=month", nil)
		BreakdownHandler(d).ServeHTTP(rr, req)
		if rr.Code != 200 {
			t.Fatalf("dim=%s: expected 200, got %d: %s", dim, rr.Code, rr.Body.String())
		}
	}
}

func TestBreakdownHandler_InvalidDimensionCoverage(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/breakdown?dimension=nope&range=week", nil)
	BreakdownHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestBreakdownHandler_MissingDimension(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/breakdown?range=week", nil)
	BreakdownHandler(d).ServeHTTP(rr, req)
	// Missing dimension defaults to "type", so should return 200
	if rr.Code != 200 {
		t.Fatalf("expected 200 (default dimension), got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// ComparisonHandler coverage
// ---------------------------------------------------------------------------

func TestComparisonHandler_ValidPeriods(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet,
		"/api/stats/comparison?from1=2025-01-01&to1=2025-01-07&from2=2025-01-08&to2=2025-01-14", nil)
	ComparisonHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["ok"] != true {
		t.Fatal("expected ok=true")
	}
}

func TestComparisonHandler_MissingParamsCoverage(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/comparison", nil)
	ComparisonHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestComparisonHandler_InvalidDate(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet,
		"/api/stats/comparison?from1=bad&to1=2025-01-07&from2=2025-01-08&to2=2025-01-14", nil)
	ComparisonHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestComparisonHandler_WithData(t *testing.T) {
	d := openStatsDB(t)
	seedHourlyRow(t, d, "2025-01-02T12:00:00Z", 100, 80, 20, "{}", "{}", "{}", "{}", "{}", "{}", "{}", "{}")
	seedHourlyRow(t, d, "2025-01-09T12:00:00Z", 200, 180, 20, "{}", "{}", "{}", "{}", "{}", "{}", "{}", "{}")

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet,
		"/api/stats/comparison?from1=2025-01-01&to1=2025-01-07&from2=2025-01-08&to2=2025-01-14", nil)
	ComparisonHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// ExportHandler coverage
// ---------------------------------------------------------------------------

func TestExportHandler_CSV(t *testing.T) {
	d := openStatsDB(t)
	now := time.Now().UTC().Format("2006-01-02T15:00:00Z")
	seedHourlyRow(t, d, now, 10, 8, 2, "{}", "{}", "{}", "{}", "{}", "{}", "{}", "{}")

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/export?range=month&format=csv", nil)
	ExportHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	ct := rr.Header().Get("Content-Type")
	if !strings.Contains(ct, "text/csv") {
		t.Fatalf("expected text/csv Content-Type, got %s", ct)
	}
	r := csv.NewReader(rr.Body)
	records, err := r.ReadAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(records) < 2 {
		t.Fatal("expected header row + data rows")
	}
}

func TestExportHandler_JSON(t *testing.T) {
	d := openStatsDB(t)
	now := time.Now().UTC().Format("2006-01-02T15:00:00Z")
	seedHourlyRow(t, d, now, 10, 8, 2, "{}", "{}", "{}", "{}", "{}", "{}", "{}", "{}")

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/export?range=month&format=json", nil)
	ExportHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestExportHandler_DefaultFormat(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/export?range=week", nil)
	ExportHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestExportHandler_InvalidRange(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/export?range=invalid", nil)
	ExportHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// granularityForRange
// ---------------------------------------------------------------------------

func TestGranularityForRange(t *testing.T) {
	cases := map[string]string{
		"today": "hour",
		"week":  "day",
		"month": "day",
		"year":  "day",
		"all":   "day",
		"other": "day",
	}
	for input, want := range cases {
		got := granularityForRange(input)
		if got != want {
			t.Fatalf("granularityForRange(%q)=%q, want %q", input, got, want)
		}
	}
}

// ---------------------------------------------------------------------------
// getTopKey
// ---------------------------------------------------------------------------

func TestGetTopKey_Empty(t *testing.T) {
	if getTopKey(map[string]int64{}) != "unknown" {
		t.Fatal("expected 'unknown' for empty map")
	}
}

func TestGetTopKey_WithData(t *testing.T) {
	m := map[string]int64{"a": 10, "b": 20, "c": 5}
	if getTopKey(m) != "b" {
		t.Fatalf("expected b, got %s", getTopKey(m))
	}
}

// ---------------------------------------------------------------------------
// queryTimeSeriesHourByVersion (previously 0% coverage)
// ---------------------------------------------------------------------------

func TestQueryTimeSeriesHourByVersion_Empty(t *testing.T) {
	d := openStatsDB(t)
	pts, err := queryTimeSeriesHourByVersion(context.Background(), d, "2024-01-01T00", "2024-01-02T00", "1.0.0")
	if err != nil {
		t.Fatal(err)
	}
	if len(pts) != 0 {
		t.Fatalf("expected 0 points, got %d", len(pts))
	}
}

func TestQueryTimeSeriesHourByVersion_WithData(t *testing.T) {
	d := openStatsDB(t)
	seedHourlyRow(t, d, "2024-01-01T12:00:00Z", 10, 8, 2,
		`{}`, `{}`, `{}`, `{}`, `{}`, `{}`, `{"1.0.0":7, "0.9.0":3}`, `{}`)
	seedHourlyRow(t, d, "2024-01-01T13:00:00Z", 5, 4, 1,
		`{}`, `{}`, `{}`, `{}`, `{}`, `{}`, `{"1.0.0":5}`, `{}`)
	pts, err := queryTimeSeriesHourByVersion(context.Background(), d, "2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "1.0.0")
	if err != nil {
		t.Fatal(err)
	}
	if len(pts) != 2 {
		t.Fatalf("expected 2 points, got %d", len(pts))
	}
	if pts[0].Downloads <= 0 {
		t.Fatalf("expected positive downloads for version 1.0.0, got %d", pts[0].Downloads)
	}
}

func TestQueryTimeSeriesHourByVersion_NoMatchingVersion(t *testing.T) {
	d := openStatsDB(t)
	seedHourlyRow(t, d, "2024-01-01T12:00:00Z", 10, 8, 2,
		`{}`, `{}`, `{}`, `{}`, `{}`, `{}`, `{"1.0.0":10}`, `{}`)
	pts, err := queryTimeSeriesHourByVersion(context.Background(), d, "2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "9.9.9")
	if err != nil {
		t.Fatal(err)
	}
	if len(pts) != 0 {
		t.Fatalf("expected 0 points for non-matching version, got %d", len(pts))
	}
}

// ---------------------------------------------------------------------------
// ExportHandler edge cases (coverage additions)
// ---------------------------------------------------------------------------

func TestExportHandler_CSVFormatCoverage(t *testing.T) {
	d := openStatsDB(t)
	seedHourlyRow(t, d, "2024-01-01T12:00:00Z", 10, 8, 2,
		`{}`, `{}`, `{}`, `{}`, `{}`, `{}`, `{}`, `{}`)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/export?format=csv&range=all", nil)
	ExportHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	ct := rr.Header().Get("Content-Type")
	if !strings.Contains(ct, "text/csv") {
		t.Fatalf("expected text/csv content type, got %q", ct)
	}
}

func TestExportHandler_MethodNotAllowedCoverage(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/stats/export", nil)
	ExportHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// TimeSeriesHandler edge cases (coverage additions)
// ---------------------------------------------------------------------------

func TestTimeSeriesHandler_WithVersionCoverage(t *testing.T) {
	d := openStatsDB(t)
	seedHourlyRow(t, d, "2024-01-01T12:00:00Z", 10, 8, 2,
		`{}`, `{}`, `{}`, `{}`, `{}`, `{}`, `{"1.0.0":10}`, `{}`)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?range=today&version=1.0.0", nil)
	TimeSeriesHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestTimeSeriesHandler_MethodNotAllowedCoverage(t *testing.T) {
	d := openStatsDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/stats/timeseries", nil)
	TimeSeriesHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}
