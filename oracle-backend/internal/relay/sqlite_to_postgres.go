package relay

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"oracle-backend/internal/observability"
)

const (
	maxRelayAttempts      = 10
	relayBatchSize        = 50
	backlogAlertThreshold = 500
	noSyncAlertAfter      = 15 * time.Minute
	relayLeaseKey         = "sqlite_to_postgres"
	relayLeaseDuration    = 15 * time.Second
)

type SQLiteToPostgresRelay struct {
	sqlite      *sql.DB
	postgres    *sql.DB
	metrics     *observability.Registry
	lastSuccess time.Time
	startedAt   time.Time
	ownerID     string
	writeFn     func(context.Context, string, string, string) error
}

func NewSQLiteToPostgresRelay(sqlite *sql.DB, postgres *sql.DB, metrics *observability.Registry) *SQLiteToPostgresRelay {
	relay := &SQLiteToPostgresRelay{
		sqlite:    sqlite,
		postgres:  postgres,
		metrics:   metrics,
		startedAt: time.Now(),
		ownerID:   fmt.Sprintf("relay-%d", time.Now().UnixNano()),
	}
	relay.writeFn = relay.writeToPostgres
	return relay
}

func (r *SQLiteToPostgresRelay) Start(ctx context.Context) {
	if r == nil || r.sqlite == nil || r.postgres == nil {
		return
	}

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = r.runOnce(ctx)
		}
	}
}

func (r *SQLiteToPostgresRelay) runOnce(ctx context.Context) error {
	syncEnabled, err := isFeatureEnabled(ctx, r.sqlite, "feature_sync_enabled")
	if err != nil {
		return err
	}
	if !syncEnabled {
		return nil
	}

	enabled, err := isFeatureEnabled(ctx, r.sqlite, "feature_postgres_projection_enabled")
	if err != nil {
		return err
	}
	if !enabled {
		return nil
	}
	acquired, err := r.acquireLease(ctx)
	if err != nil {
		return err
	}
	if !acquired {
		return nil
	}

	start := time.Now()
	rows, err := r.sqlite.QueryContext(
		ctx,
		`SELECT id, event_type, payload_json, idempotency_key, attempts
		 FROM ingest_outbox
		 WHERE status IN ('pending', 'retry', 'processing') AND next_run_at <= ?
		 ORDER BY id ASC
		 LIMIT ?`,
		time.Now().UnixMilli(),
		relayBatchSize,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	type rowItem struct {
		ID             int64
		EventType      string
		PayloadJSON    string
		IdempotencyKey string
		Attempts       int64
	}
	items := make([]rowItem, 0, relayBatchSize)
	for rows.Next() {
		var item rowItem
		if err := rows.Scan(&item.ID, &item.EventType, &item.PayloadJSON, &item.IdempotencyKey, &item.Attempts); err != nil {
			return err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	var maxSuccessID int64
	for _, item := range items {
		sent, err := r.processItem(ctx, item)
		if err != nil {
			continue
		}
		if sent {
			r.lastSuccess = time.Now()
			if item.ID > maxSuccessID {
				maxSuccessID = item.ID
			}
		}
	}
	if maxSuccessID > 0 {
		_ = r.updateOffset(ctx, maxSuccessID)
	}

	duration := time.Since(start).Seconds()
	r.setGauge("oracle_sync_duration_seconds", map[string]string{"endpoint": "ingest_outbox"}, duration)
	if !r.lastSuccess.IsZero() {
		r.setGauge(
			"oracle_sync_last_success_timestamp_seconds",
			map[string]string{"endpoint": "ingest_outbox"},
			float64(r.lastSuccess.Unix()),
		)
	}

	if err := r.updateBacklogMetrics(ctx); err != nil {
		return err
	}
	r.checkNoSyncAlert(ctx)
	return nil
}

func (r *SQLiteToPostgresRelay) processItem(ctx context.Context, item struct {
	ID             int64
	EventType      string
	PayloadJSON    string
	IdempotencyKey string
	Attempts       int64
}) (bool, error) {
	tx, err := r.sqlite.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(
		ctx,
		`UPDATE ingest_outbox
		 SET status = 'processing', next_run_at = ?
		 WHERE id = ? AND status IN ('pending', 'retry', 'processing')`,
		time.Now().Add(relayLeaseDuration).UnixMilli(),
		item.ID,
	)
	if err != nil {
		return false, err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return false, tx.Commit()
	}

	writeFn := r.writeFn
	if writeFn == nil {
		writeFn = r.writeToPostgres
	}
	if err := writeFn(ctx, item.EventType, item.PayloadJSON, item.IdempotencyKey); err != nil {
		nextAttempts := item.Attempts + 1
		nextRunAt := time.Now().Add(backoffForAttempts(nextAttempts)).UnixMilli()
		status := "retry"
		if nextAttempts >= maxRelayAttempts {
			status = "dead"
			if _, dlErr := tx.ExecContext(
				ctx,
				`INSERT INTO outbox_dead_letter (outbox_id, event_type, payload_json, idempotency_key, attempts, last_error, failed_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				item.ID,
				item.EventType,
				item.PayloadJSON,
				item.IdempotencyKey,
				nextAttempts,
				truncateErr(err.Error(), 240),
				time.Now().UnixMilli(),
			); dlErr != nil {
				return false, dlErr
			}
		}
		if _, upErr := tx.ExecContext(
			ctx,
			`UPDATE ingest_outbox
			 SET status = ?, attempts = ?, last_error = ?, next_run_at = ?
			 WHERE id = ?`,
			status,
			nextAttempts,
			truncateErr(err.Error(), 240),
			nextRunAt,
			item.ID,
		); upErr != nil {
			return false, upErr
		}
		r.incCounter("oracle_outbox_retry_total", nil, 1)
		return false, tx.Commit()
	}

	if _, err := tx.ExecContext(
		ctx,
		`UPDATE ingest_outbox
		 SET status = 'sent', attempts = attempts + 1, last_error = ''
		 WHERE id = ?`,
		item.ID,
	); err != nil {
		return false, err
	}

	return true, tx.Commit()
}

func (r *SQLiteToPostgresRelay) writeToPostgres(ctx context.Context, eventType, payloadJSON, idempotencyKey string) error {
	if !json.Valid([]byte(payloadJSON)) {
		return fmt.Errorf("invalid_payload_json")
	}
	_, err := r.postgres.ExecContext(
		ctx,
		`INSERT INTO raw_ingest_events (event_type, payload_json, idempotency_key, created_at)
		 VALUES ($1, $2::jsonb, $3, $4)
		 ON CONFLICT (idempotency_key) DO NOTHING`,
		eventType,
		payloadJSON,
		idempotencyKey,
		time.Now().UnixMilli(),
	)
	return err
}

func (r *SQLiteToPostgresRelay) updateBacklogMetrics(ctx context.Context) error {
	var backlog int64
	if err := r.sqlite.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM ingest_outbox WHERE status IN ('pending', 'retry', 'processing')`,
	).Scan(&backlog); err != nil {
		return err
	}
	r.setGauge("oracle_outbox_backlog_size", map[string]string{"source": "sqlite"}, float64(backlog))
	if backlog > backlogAlertThreshold {
		return upsertOpenAlert(
			ctx,
			r.sqlite,
			"outbox_backlog_high",
			"warning",
			fmt.Sprintf("sqlite outbox backlog is %d", backlog),
			map[string]any{"backlog": backlog},
		)
	}
	return nil
}

func (r *SQLiteToPostgresRelay) setGauge(name string, labels map[string]string, value float64) {
	if r == nil || r.metrics == nil {
		return
	}
	r.metrics.SetGauge(name, labels, value)
}

func (r *SQLiteToPostgresRelay) incCounter(name string, labels map[string]string, delta float64) {
	if r == nil || r.metrics == nil {
		return
	}
	r.metrics.IncCounter(name, labels, delta)
}

func (r *SQLiteToPostgresRelay) checkNoSyncAlert(ctx context.Context) {
	if r.lastSuccess.IsZero() {
		if time.Since(r.startedAt) <= noSyncAlertAfter {
			return
		}
		_ = upsertOpenAlert(
			ctx,
			r.sqlite,
			"no_sync_success",
			"critical",
			"no successful sqlite->postgres sync since relay startup",
			map[string]any{
				"thresholdMinutes": int(noSyncAlertAfter.Minutes()),
				"startedAt":        r.startedAt.UnixMilli(),
			},
		)
		return
	}
	if time.Since(r.lastSuccess) <= noSyncAlertAfter {
		return
	}
	_ = upsertOpenAlert(
		ctx,
		r.sqlite,
		"no_sync_success",
		"critical",
		"no successful sqlite->postgres sync in configured threshold",
		map[string]any{
			"thresholdMinutes": int(noSyncAlertAfter.Minutes()),
			"lastSuccessAt":    r.lastSuccess.UnixMilli(),
		},
	)
}

func (r *SQLiteToPostgresRelay) acquireLease(ctx context.Context) (bool, error) {
	nowMs := time.Now().UnixMilli()
	expiresAt := time.Now().Add(relayLeaseDuration).UnixMilli()
	_, err := r.sqlite.ExecContext(
		ctx,
		`INSERT INTO relay_leases (lease_key, owner, expires_at, updated_at)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(lease_key) DO UPDATE SET
		   owner = excluded.owner,
		   expires_at = excluded.expires_at,
		   updated_at = excluded.updated_at
		 WHERE relay_leases.owner = excluded.owner OR relay_leases.expires_at < excluded.updated_at`,
		relayLeaseKey,
		r.ownerID,
		expiresAt,
		nowMs,
	)
	if err != nil {
		return false, err
	}

	var owner string
	if err := r.sqlite.QueryRowContext(ctx, `SELECT owner FROM relay_leases WHERE lease_key = ?`, relayLeaseKey).Scan(&owner); err != nil {
		return false, err
	}
	return owner == r.ownerID, nil
}

func (r *SQLiteToPostgresRelay) updateOffset(ctx context.Context, lastID int64) error {
	if lastID <= 0 {
		return nil
	}
	nowMs := time.Now().UnixMilli()
	_, err := r.sqlite.ExecContext(
		ctx,
		`INSERT INTO relay_offsets (source, last_id, updated_at)
		 VALUES ('sqlite_to_postgres', ?, ?)
		 ON CONFLICT(source) DO UPDATE SET
		   last_id = CASE
		     WHEN excluded.last_id > relay_offsets.last_id THEN excluded.last_id
		     ELSE relay_offsets.last_id
		   END,
		   updated_at = excluded.updated_at`,
		lastID,
		nowMs,
	)
	return err
}

func backoffForAttempts(attempts int64) time.Duration {
	switch {
	case attempts <= 1:
		return 5 * time.Second
	case attempts <= 3:
		return 30 * time.Second
	case attempts <= 6:
		return 2 * time.Minute
	default:
		return 5 * time.Minute
	}
}

func truncateErr(v string, max int) string {
	if max <= 0 || len(v) <= max {
		return v
	}
	return v[:max]
}

func isFeatureEnabled(ctx context.Context, db *sql.DB, name string) (bool, error) {
	var enabled int64
	err := db.QueryRowContext(ctx, `SELECT enabled FROM feature_flags WHERE name = ?`, name).Scan(&enabled)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return enabled != 0, nil
}

func upsertOpenAlert(ctx context.Context, db *sql.DB, alertType, severity, message string, payload map[string]any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	nowMs := time.Now().UnixMilli()
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `BEGIN IMMEDIATE`); err != nil {
		return err
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		_, _ = conn.ExecContext(context.Background(), `ROLLBACK`)
	}()

	updateRes, err := conn.ExecContext(
		ctx,
		`UPDATE system_alerts
		 SET severity = ?, message = ?, payload_json = ?, updated_at = ?
		 WHERE alert_type = ? AND status = 'open'`,
		severity,
		message,
		string(raw),
		nowMs,
		alertType,
	)
	if err != nil {
		return err
	}
	updatedRows, err := updateRes.RowsAffected()
	if err != nil {
		return err
	}

	if updatedRows == 0 {
		if _, err := conn.ExecContext(
			ctx,
			`INSERT INTO system_alerts (alert_type, severity, message, status, payload_json, created_at, updated_at)
			 VALUES (?, ?, ?, 'open', ?, ?, ?)`,
			alertType,
			severity,
			message,
			string(raw),
			nowMs,
			nowMs,
		); err != nil {
			return err
		}
	}

	if _, err := conn.ExecContext(ctx, `COMMIT`); err != nil {
		return err
	}
	committed = true
	return nil
}
