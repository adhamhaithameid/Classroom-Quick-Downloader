package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"testing"
	"time"

	model "oracle-backend/internal/model"
)

func TestUpdateTotalsAggregation(t *testing.T) {
	// 1. Setup DB
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	// 2. Prepare Batch with known counters
	now := time.Now().UnixMilli()
	batch := model.OracleBatch{
		BatchID:     "batch-agg-test-1",
		GeneratedAt: now,
		TimeZone:    "UTC",
		Summary: model.BatchSummary{
			Totals: model.BucketTotals{
				TotalEvents:    10,
				TotalDownloads: 10,
				TotalSuccess:   8,
				TotalFail:      2,
			},
		},
		TimeBuckets: []model.TimeBucket{
			{
				BucketStart: "2025-01-01T10:00:00Z",
				BucketEnd:   "2025-01-01T11:00:00Z",
				Totals: model.BucketTotals{
					TotalEvents:    5,
					TotalDownloads: 5,
					TotalSuccess:   4,
					TotalFail:      1,
				},
				Counters: model.BucketCounters{
					ByStatus:    map[string]int64{"ok": 4, "error": 1},
					ByType:      map[string]int64{"zip": 3, "crx": 2},
					ByBrowser:   map[string]int64{"chrome": 5},
					ByOs:        map[string]int64{"mac": 2, "win": 3},
					ByExtVer:    map[string]int64{"1.0": 5},
					ByLanguage:  map[string]int64{"en": 5},
					ByCountry:   map[string]int64{"US": 5},
					ByErrorType: map[string]int64{"net": 1},
				},
			},
			{
				BucketStart: "2025-01-01T11:00:00Z",
				BucketEnd:   "2025-01-01T12:00:00Z",
				Totals: model.BucketTotals{
					TotalEvents:    5,
					TotalDownloads: 5,
					TotalSuccess:   4,
					TotalFail:      1,
				},
				Counters: model.BucketCounters{
					ByStatus:    map[string]int64{"ok": 4, "error": 1},
					ByType:      map[string]int64{"zip": 2, "crx": 3}, // Total zip=5, crx=5
					ByBrowser:   map[string]int64{"firefox": 5},
					ByOs:        map[string]int64{"mac": 3, "linux": 2}, // Total mac=5, win=3, linux=2
					ByExtVer:    map[string]int64{"1.1": 5},
					ByLanguage:  map[string]int64{"fr": 5},
					ByCountry:   map[string]int64{"FR": 5},
					ByErrorType: map[string]int64{"auth": 1},
				},
			},
		},
		DOState: model.DOState{OK: true},
	}

	// 3. Ingest Batch
	ingest := IngestBatchHandler(sqlDB, "secret")
	rr := postBatch(t, ingest, batch, "secret")
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 from ingest, got %d (%s)", rr.Code, rr.Body.String())
	}

	// 4. Verify downloads_totals
	ctx := context.Background()
	checkTotal(t, ctx, sqlDB, "totalDownloads", 10)
	checkTotal(t, ctx, sqlDB, "totalSuccess", 8)
	checkTotal(t, ctx, sqlDB, "totalFail", 2)

	// Check aggregated dimensions
	checkTotal(t, ctx, sqlDB, "status:ok", 8)
	checkTotal(t, ctx, sqlDB, "status:error", 2)
	checkTotal(t, ctx, sqlDB, "type:zip", 5)
	checkTotal(t, ctx, sqlDB, "type:crx", 5)
	checkTotal(t, ctx, sqlDB, "browser:chrome", 5)
	checkTotal(t, ctx, sqlDB, "browser:firefox", 5)
	checkTotal(t, ctx, sqlDB, "os:mac", 5)
	checkTotal(t, ctx, sqlDB, "os:win", 3)
	checkTotal(t, ctx, sqlDB, "os:linux", 2)
	checkTotal(t, ctx, sqlDB, "extVer:1.0", 5)
	checkTotal(t, ctx, sqlDB, "extVer:1.1", 5)
	checkTotal(t, ctx, sqlDB, "lang:en", 5)
	checkTotal(t, ctx, sqlDB, "lang:fr", 5)
	checkTotal(t, ctx, sqlDB, "country:US", 5)
	checkTotal(t, ctx, sqlDB, "country:FR", 5)
	checkTotal(t, ctx, sqlDB, "errorType:net", 1)
	checkTotal(t, ctx, sqlDB, "errorType:auth", 1)
}

func checkTotal(t *testing.T, ctx context.Context, db *sql.DB, key string, expected int64) {
	t.Helper()
	var val int64
	err := db.QueryRowContext(ctx, "SELECT value FROM downloads_totals WHERE key = ?", key).Scan(&val)
	if err != nil {
		t.Fatalf("failed to query total for key %q: %v", key, err)
	}
	if val != expected {
		t.Errorf("expected total for key %q to be %d, got %d", key, expected, val)
	}
}
