package handlers

import (
	"context"
	"testing"
	"time"

	model "oracle-backend/internal/model"
)

// ──────────────────────────────────────────────────────────────────────────────
// insertDOStateSnapshot — covering Quota/EnvSnapshot branches (was 57.7%)
// ──────────────────────────────────────────────────────────────────────────────

func TestInsertDOStateSnapshot_WithQuota(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx, _ := sqlDB.Begin()
	defer tx.Rollback()

	lastEvent := int64(1700000000000)
	lastFlush := int64(1700000001000)
	batch := &model.OracleBatch{
		GeneratedAt: time.Now().UnixMilli(),
		DOState: model.DOState{
			OK:             true,
			TotalEvents:    100,
			TotalDownloads: 80,
			TotalSuccess:   70,
			TotalFail:      10,
			PendingEvents:  5,
			LastEventAt:    &lastEvent,
			LastFlushAt:    &lastFlush,
			Quota: &model.DOStateQuota{
				RequestsToday:       42,
				QuotaLevel:          "normal",
				ModeLabel:           "standard",
				RemoteEnabled:       true,
				BatchSizeSuggestion: 100,
			},
		},
	}

	err := insertDOStateSnapshot(context.Background(), tx, batch)
	if err != nil {
		t.Fatalf("insertDOStateSnapshot with quota failed: %v", err)
	}
	tx.Commit()

	var count int
	sqlDB.QueryRow("SELECT COUNT(*) FROM do_state_snapshots").Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 snapshot, got %d", count)
	}
}

func TestInsertDOStateSnapshot_WithEnvSnapshot(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx, _ := sqlDB.Begin()
	defer tx.Rollback()

	batch := &model.OracleBatch{
		GeneratedAt: time.Now().UnixMilli(),
		DOState: model.DOState{
			OK:             true,
			TotalEvents:    50,
			TotalDownloads: 40,
			TotalSuccess:   35,
			TotalFail:      5,
			PendingEvents:  2,
			EnvSnapshot: &model.DOStateEnvSnapshot{
				MaxBatchEvents: "500",
			},
		},
	}

	err := insertDOStateSnapshot(context.Background(), tx, batch)
	if err != nil {
		t.Fatalf("insertDOStateSnapshot with env snapshot failed: %v", err)
	}
	tx.Commit()
}

func TestInsertDOStateSnapshot_MinimalNoBranches(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx, _ := sqlDB.Begin()
	defer tx.Rollback()

	batch := &model.OracleBatch{
		GeneratedAt: 0, // Will default to time.Now().UnixMilli()
		DOState: model.DOState{
			OK: true,
		},
	}

	err := insertDOStateSnapshot(context.Background(), tx, batch)
	if err != nil {
		t.Fatalf("insertDOStateSnapshot minimal failed: %v", err)
	}
	tx.Commit()
}

func TestInsertDOStateSnapshot_QuotaRemoteDisabled(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	tx, _ := sqlDB.Begin()
	defer tx.Rollback()

	batch := &model.OracleBatch{
		GeneratedAt: time.Now().UnixMilli(),
		DOState: model.DOState{
			OK: true,
			Quota: &model.DOStateQuota{
				RequestsToday:       10,
				QuotaLevel:          "low",
				ModeLabel:           "conservative",
				RemoteEnabled:       false,
				BatchSizeSuggestion: 50,
			},
		},
	}

	err := insertDOStateSnapshot(context.Background(), tx, batch)
	if err != nil {
		t.Fatalf("insertDOStateSnapshot quota remote disabled failed: %v", err)
	}
	tx.Commit()
}
