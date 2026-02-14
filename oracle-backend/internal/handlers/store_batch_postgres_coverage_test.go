package handlers

import (
	"context"
	"testing"
	"time"

	model "oracle-backend/internal/model"
)

func TestIngestBatchPostgres_ErrorsWithSQLiteHandle(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	batch := &model.OracleBatch{
		BatchID:     "pg-coverage-batch",
		GeneratedAt: time.Now().UnixMilli(),
		TimeZone:    "UTC",
		Summary: model.BatchSummary{Totals: model.BucketTotals{
			TotalEvents:    1,
			TotalDownloads: 1,
			TotalSuccess:   1,
			TotalFail:      0,
		}},
		TimeBuckets: []model.TimeBucket{},
	}

	err := ingestBatchPostgres(context.Background(), sqlDB, batch, []byte(`{"batchId":"pg-coverage-batch"}`))
	if err == nil {
		t.Fatal("expected postgres ingest to fail on sqlite DB handle")
	}
}
