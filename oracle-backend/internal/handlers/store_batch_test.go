package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	"oracle-backend/internal/db"
	"oracle-backend/internal/model"

	_ "modernc.org/sqlite"
)

func setupTestDB(t testing.TB) *sql.DB {
	// Use in-memory DB
	dsn := "file::memory:?cache=shared"
	database, err := sql.Open("sqlite", dsn)
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}

	if err := db.Migrate(database); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	return database
}

func TestUpdateTotals(t *testing.T) {
	database := setupTestDB(t)
	defer database.Close()

	batch := &model.OracleBatch{
		BatchID: "test-batch",
		TimeBuckets: []model.TimeBucket{
			{
				Totals: model.BucketTotals{
					TotalEvents:    10,
					TotalDownloads: 5,
					TotalSuccess:   4,
					TotalFail:      1,
				},
				Counters: model.BucketCounters{
					ByStatus: map[string]int64{"ok": 4, "fail": 1},
				},
			},
		},
	}

	ctx := context.Background()
	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}

	if err := updateTotals(ctx, tx, batch); err != nil {
		tx.Rollback()
		t.Fatalf("updateTotals failed: %v", err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("commit failed: %v", err)
	}

	// Verify results
	var val int64
	err = database.QueryRow("SELECT value FROM downloads_totals WHERE key = 'totalEvents'").Scan(&val)
	if err != nil {
		t.Fatalf("failed to query totalEvents: %v", err)
	}
	if val != 10 {
		t.Errorf("expected totalEvents 10, got %d", val)
	}

	err = database.QueryRow("SELECT value FROM downloads_totals WHERE key = 'status:ok'").Scan(&val)
	if err != nil {
		t.Fatalf("failed to query status:ok: %v", err)
	}
	if val != 4 {
		t.Errorf("expected status:ok 4, got %d", val)
	}
}

func BenchmarkUpdateTotals(b *testing.B) {
	database := setupTestDB(b)
	defer database.Close()

	// Create a batch with significant data to exercise the loops
	batch := &model.OracleBatch{
		BatchID: "bench-batch",
		TimeBuckets: []model.TimeBucket{
			{
				Totals: model.BucketTotals{
					TotalEvents:    100,
					TotalDownloads: 50,
					TotalSuccess:   40,
					TotalFail:      10,
				},
				Counters: model.BucketCounters{
					ByStatus:    generateMap("status", 10),
					ByType:      generateMap("type", 5),
					ByBrowser:   generateMap("browser", 10),
					ByOs:        generateMap("os", 5),
					ByExtVer:    generateMap("v", 5),
					ByLanguage:  generateMap("lang", 10),
					ByCountry:   generateMap("country", 20),
					ByErrorType: generateMap("error", 5),
				},
			},
		},
	}

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tx, err := database.BeginTx(ctx, nil)
		if err != nil {
			b.Fatalf("failed to begin tx: %v", err)
		}

		if err := updateTotals(ctx, tx, batch); err != nil {
			tx.Rollback()
			b.Fatalf("updateTotals failed: %v", err)
		}

		if err := tx.Commit(); err != nil {
			b.Fatalf("commit failed: %v", err)
		}
	}
}

func generateMap(prefix string, count int) map[string]int64 {
	m := make(map[string]int64)
	for i := 0; i < count; i++ {
		m[fmt.Sprintf("%s-%d", prefix, i)] = int64(i + 1)
	}
	return m
}
