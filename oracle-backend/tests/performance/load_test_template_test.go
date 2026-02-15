package performance

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/handlers"
	model "oracle-backend/internal/model"
)

// ──────────────────────────────────────────────────────────────────────────────
// Performance / Load test templates
//
// Run with: go test -bench=. -benchmem ./tests/performance/...
// ──────────────────────────────────────────────────────────────────────────────

func BenchmarkHealthHandler(b *testing.B) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	for b.Loop() {
		rr := httptest.NewRecorder()
		handlers.APIHealthHandler(rr, req)
	}
}

func BenchmarkSummaryHandler_EmptyDB(b *testing.B) {
	dbPath := b.TempDir() + "/bench.db"
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		b.Fatalf("db.Init: %v", err)
	}
	defer sqlDB.Close()
	handler := handlers.SummaryHandler(sqlDB)
	req := httptest.NewRequest(http.MethodGet, "/api/stats/summary", nil)

	b.ResetTimer()
	for b.Loop() {
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
	}
}

func BenchmarkIngestBatchHandler(b *testing.B) {
	dbPath := b.TempDir() + "/bench-ingest.db"
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		b.Fatalf("db.Init: %v", err)
	}
	defer sqlDB.Close()
	handler := handlers.IngestBatchHandler(sqlDB, "secret")
	now := time.Now().UnixMilli()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		batch := model.OracleBatch{
			BatchID:     "bench-" + time.Now().Format("150405.000") + "-" + string(rune('a'+i%26)),
			GeneratedAt: now + int64(i),
			TimeZone:    "UTC",
			Summary: model.BatchSummary{
				Totals: model.BucketTotals{
					TotalEvents: 10, TotalDownloads: 10,
					TotalSuccess: 8, TotalFail: 2,
				},
			},
			TimeBuckets: []model.TimeBucket{},
			DOState:     model.DOState{OK: true},
		}
		bodyBytes, _ := json.Marshal(batch)
		req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
		req.Header.Set("X-DO-SECRET", "secret")
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			b.Fatalf("expected 200, got %d", rr.Code)
		}
	}
}

func BenchmarkTimeSeriesHandler(b *testing.B) {
	dbPath := b.TempDir() + "/bench-ts.db"
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		b.Fatalf("db.Init: %v", err)
	}
	defer sqlDB.Close()

	// Seed some data
	now := time.Now().UnixMilli()
	bucketStart := time.Now().UTC().Truncate(time.Hour).Format(time.RFC3339)
	bucketEnd := time.Now().UTC().Truncate(time.Hour).Add(time.Hour).Format(time.RFC3339)
	batch := model.OracleBatch{
		BatchID: "bench-ts-seed", GeneratedAt: now, TimeZone: "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{TotalEvents: 100, TotalDownloads: 100, TotalSuccess: 90, TotalFail: 10},
		},
		TimeBuckets: []model.TimeBucket{{
			BucketStart: bucketStart, BucketEnd: bucketEnd,
			Totals: model.BucketTotals{TotalEvents: 100, TotalDownloads: 100, TotalSuccess: 90, TotalFail: 10},
			Counters: model.BucketCounters{
				ByStatus: map[string]int64{"success": 90, "fail": 10}, ByType: map[string]int64{"pdf": 100},
				ByBrowser: map[string]int64{"chrome": 100}, ByOs: map[string]int64{"windows": 100},
				ByExtVer: map[string]int64{"1.0.0": 100}, ByLanguage: map[string]int64{"en": 100},
				ByCountry: map[string]int64{"us": 100}, ByErrorType: map[string]int64{},
			},
		}},
		DOState: model.DOState{OK: true},
	}
	bodyBytes, _ := json.Marshal(batch)
	ingestHandler := handlers.IngestBatchHandler(sqlDB, "secret")
	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(string(bodyBytes)))
	req.Header.Set("X-DO-SECRET", "secret")
	rr := httptest.NewRecorder()
	ingestHandler.ServeHTTP(rr, req)

	handler := handlers.TimeSeriesHandler(sqlDB)
	today := time.Now().UTC().Format("2006-01-02")
	tsReq := httptest.NewRequest(http.MethodGet, "/api/stats/timeseries?from="+today+"&to="+today, nil)

	b.ResetTimer()
	for b.Loop() {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, tsReq)
	}
}

func BenchmarkBreakdownHandler(b *testing.B) {
	dbPath := b.TempDir() + "/bench-bd.db"
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		b.Fatalf("db.Init: %v", err)
	}
	defer sqlDB.Close()

	handler := handlers.BreakdownHandler(sqlDB)
	today := time.Now().UTC().Format("2006-01-02")
	req := httptest.NewRequest(http.MethodGet, "/api/stats/breakdown?dimension=type&from="+today+"&to="+today, nil)

	b.ResetTimer()
	for b.Loop() {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
	}
}
