package handlers

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"oracle-backend/internal/observability"
)

type controlPlaneStore struct {
	sqlite   *sql.DB
	postgres *sql.DB
}

func newControlPlaneStore(sqliteDB, postgresDB *sql.DB) *controlPlaneStore {
	return &controlPlaneStore{
		sqlite:   sqliteDB,
		postgres: postgresDB,
	}
}

func (s *controlPlaneStore) shouldUsePostgresPrimary(ctx context.Context) bool {
	if s == nil || s.postgres == nil {
		return false
	}
	if s.sqlite == nil {
		return true
	}
	enabled, err := IsFeatureEnabled(ctx, s.sqlite, "feature_postgres_primary_control_plane")
	if err != nil {
		return false
	}
	return enabled
}

func (s *controlPlaneStore) shouldAllowSQLiteReadFallback(ctx context.Context) bool {
	if s == nil || s.sqlite == nil {
		return false
	}
	enabled, err := IsFeatureEnabled(ctx, s.sqlite, "feature_sqlite_fallback_readonly")
	if err != nil {
		return true
	}
	return enabled
}

type controlPlaneRecordRow struct {
	RecordKey string          `json:"recordKey"`
	Data      json.RawMessage `json:"data"`
	CreatedAt int64           `json:"createdAt"`
	UpdatedAt int64           `json:"updatedAt"`
}

func (s *controlPlaneStore) listRecords(ctx context.Context, recordType string) ([]controlPlaneRecordRow, error) {
	if s == nil {
		return nil, errors.New("control plane store is not configured")
	}
	if s.shouldUsePostgresPrimary(ctx) {
		records, err := s.listRecordsPostgres(ctx, recordType)
		if err == nil || !s.shouldAllowSQLiteReadFallback(ctx) {
			return records, err
		}
		if s.sqlite != nil {
			return s.listRecordsSQLite(ctx, recordType)
		}
		return records, err
	}
	if s.sqlite == nil {
		if s.postgres != nil {
			return s.listRecordsPostgres(ctx, recordType)
		}
		return nil, errors.New("no control plane database configured")
	}
	return s.listRecordsSQLite(ctx, recordType)
}

func (s *controlPlaneStore) listRecordsSQLite(ctx context.Context, recordType string) ([]controlPlaneRecordRow, error) {
	rows, err := s.sqlite.QueryContext(
		ctx,
		`SELECT record_key, data_json, created_at, updated_at
		 FROM admin_records
		 WHERE record_type = ?
		 ORDER BY updated_at DESC, id DESC`,
		recordType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]controlPlaneRecordRow, 0, 64)
	for rows.Next() {
		var row controlPlaneRecordRow
		var raw sql.NullString
		if err := rows.Scan(&row.RecordKey, &raw, &row.CreatedAt, &row.UpdatedAt); err != nil {
			return nil, err
		}
		if raw.Valid && strings.TrimSpace(raw.String) != "" {
			row.Data = json.RawMessage(raw.String)
		} else {
			row.Data = json.RawMessage(`{}`)
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *controlPlaneStore) listRecordsPostgres(ctx context.Context, recordType string) ([]controlPlaneRecordRow, error) {
	rows, err := s.postgres.QueryContext(
		ctx,
		`SELECT record_key, data_json::text, created_at, updated_at
		 FROM pg_admin_records
		 WHERE record_type = $1
		 ORDER BY updated_at DESC, id DESC`,
		recordType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]controlPlaneRecordRow, 0, 64)
	for rows.Next() {
		var row controlPlaneRecordRow
		var raw string
		if err := rows.Scan(&row.RecordKey, &raw, &row.CreatedAt, &row.UpdatedAt); err != nil {
			return nil, err
		}
		if strings.TrimSpace(raw) != "" {
			row.Data = json.RawMessage(raw)
		} else {
			row.Data = json.RawMessage(`{}`)
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *controlPlaneStore) upsertRecord(ctx context.Context, recordType, recordKey string, data map[string]any) error {
	if s == nil {
		return errors.New("control plane store is not configured")
	}
	if s.shouldUsePostgresPrimary(ctx) {
		return s.upsertRecordPostgres(ctx, recordType, recordKey, data)
	}
	if s.sqlite == nil {
		if s.postgres != nil {
			return s.upsertRecordPostgres(ctx, recordType, recordKey, data)
		}
		return errors.New("no control plane database configured")
	}
	return s.upsertRecordSQLite(ctx, recordType, recordKey, data)
}

func (s *controlPlaneStore) upsertRecordSQLite(ctx context.Context, recordType, recordKey string, data map[string]any) error {
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	nowMs := time.Now().UnixMilli()
	// #nosec G701 -- statement is static SQL; values are bound parameters.
	_, err = s.sqlite.ExecContext(
		ctx,
		`INSERT INTO admin_records (record_type, record_key, data_json, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(record_type, record_key) DO UPDATE SET
		   data_json = excluded.data_json,
		   updated_at = excluded.updated_at`,
		recordType,
		recordKey,
		string(raw),
		nowMs,
		nowMs,
	)
	return err
}

func (s *controlPlaneStore) upsertRecordPostgres(ctx context.Context, recordType, recordKey string, data map[string]any) error {
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	nowMs := time.Now().UnixMilli()
	requestID := observability.RequestIDFromContext(ctx)
	if strings.TrimSpace(requestID) == "" {
		requestID = "unknown"
	}
	idempotencyKey := controlPlaneOutboxKey("upsert", recordType, recordKey, requestID, raw)

	tx, err := s.postgres.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// #nosec G701 -- statement is static SQL; values are bound parameters.
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO pg_admin_records (record_type, record_key, data_json, created_at, updated_at)
		 VALUES ($1, $2, $3::jsonb, $4, $5)
		 ON CONFLICT(record_type, record_key) DO UPDATE SET
		   data_json = EXCLUDED.data_json,
		   updated_at = EXCLUDED.updated_at`,
		recordType,
		recordKey,
		string(raw),
		nowMs,
		nowMs,
	)
	if err != nil {
		return err
	}

	payloadRaw, err := json.Marshal(map[string]any{
		"action":     "upsert",
		"recordType": recordType,
		"recordKey":  recordKey,
		"data":       data,
		"tsUtc":      nowMs,
	})
	if err != nil {
		return err
	}
	// #nosec G701 -- statement is static SQL; values are bound parameters.
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO pg_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		 VALUES ($1, $2::jsonb, $3, 'pending', 0, '', $4, $4)
		 ON CONFLICT(idempotency_key) DO NOTHING`,
		"control_plane_upsert",
		string(payloadRaw),
		idempotencyKey,
		nowMs,
	)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *controlPlaneStore) deleteRecord(ctx context.Context, recordType, recordKey string) (int64, error) {
	if s == nil {
		return 0, errors.New("control plane store is not configured")
	}
	if s.shouldUsePostgresPrimary(ctx) {
		return s.deleteRecordPostgres(ctx, recordType, recordKey)
	}
	if s.sqlite == nil {
		if s.postgres != nil {
			return s.deleteRecordPostgres(ctx, recordType, recordKey)
		}
		return 0, errors.New("no control plane database configured")
	}
	return s.deleteRecordSQLite(ctx, recordType, recordKey)
}

func (s *controlPlaneStore) deleteRecordSQLite(ctx context.Context, recordType, recordKey string) (int64, error) {
	res, err := s.sqlite.ExecContext(
		ctx,
		`DELETE FROM admin_records WHERE record_type = ? AND record_key = ?`,
		recordType,
		recordKey,
	)
	if err != nil {
		return 0, err
	}
	affected, _ := res.RowsAffected()
	return affected, nil
}

func (s *controlPlaneStore) deleteRecordPostgres(ctx context.Context, recordType, recordKey string) (int64, error) {
	nowMs := time.Now().UnixMilli()
	requestID := observability.RequestIDFromContext(ctx)
	if strings.TrimSpace(requestID) == "" {
		requestID = "unknown"
	}
	idempotencyKey := controlPlaneOutboxKey("delete", recordType, recordKey, requestID, nil)

	tx, err := s.postgres.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(
		ctx,
		`DELETE FROM pg_admin_records WHERE record_type = $1 AND record_key = $2`,
		recordType,
		recordKey,
	)
	if err != nil {
		return 0, err
	}
	affected, _ := res.RowsAffected()

	payloadRaw, err := json.Marshal(map[string]any{
		"action":     "delete",
		"recordType": recordType,
		"recordKey":  recordKey,
		"affected":   affected,
		"tsUtc":      nowMs,
	})
	if err != nil {
		return 0, err
	}
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO pg_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
		 VALUES ($1, $2::jsonb, $3, 'pending', 0, '', $4, $4)
		 ON CONFLICT(idempotency_key) DO NOTHING`,
		"control_plane_delete",
		string(payloadRaw),
		idempotencyKey,
		nowMs,
	)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return affected, nil
}

func controlPlaneOutboxKey(action, recordType, recordKey, requestID string, payload []byte) string {
	sum := sha256.New()
	sum.Write([]byte(action))
	sum.Write([]byte(":"))
	sum.Write([]byte(recordType))
	sum.Write([]byte(":"))
	sum.Write([]byte(recordKey))
	sum.Write([]byte(":"))
	sum.Write([]byte(requestID))
	if len(payload) > 0 {
		sum.Write([]byte(":"))
		sum.Write(payload)
	}
	return "cp:" + hex.EncodeToString(sum.Sum(nil))
}

func isRecordTypeAllowed(recordType string, allowed map[string]struct{}) bool {
	if len(allowed) == 0 {
		return true
	}
	_, ok := allowed[recordType]
	return ok
}

func shouldRefreshPublicWebsiteSnapshotForRecordType(recordType string) bool {
	switch strings.TrimSpace(recordType) {
	case publicWebsiteUserChangelogRecordType,
		publicWebsiteUserChangelogConfigType,
		publicWebsitePrivacyRecordType,
		"deployment_target":
		return true
	default:
		return false
	}
}

func refreshPublicWebsiteSnapshotAfterRecordMutation(
	ctx context.Context,
	sqliteDB, postgresDB *sql.DB,
	recordType string,
) {
	if !shouldRefreshPublicWebsiteSnapshotForRecordType(recordType) || sqliteDB == nil {
		return
	}
	snapshot, err := loadOrRefreshPublicWebsiteSnapshot(ctx, sqliteDB, postgresDB, true)
	if err != nil {
		logEvent("warn", "public_website_snapshot_refresh_after_record_mutation_failed", map[string]interface{}{
			"recordType": trimAndLimit(recordType, 120),
			"error":      trimAndLimit(err.Error(), 240),
		})
		return
	}
	logEvent("info", "public_website_snapshot_refreshed_after_record_mutation", map[string]interface{}{
		"recordType": trimAndLimit(recordType, 120),
		"snapshotId": trimAndLimit(snapshot.SnapshotID, 120),
	})
}

func RecordsListHandlerV4(sqliteDB, postgresDB *sql.DB, allowedRecordTypes map[string]struct{}) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		recordType := strings.TrimSpace(r.URL.Query().Get("type"))
		if recordType == "" {
			http.Error(w, "type is required", http.StatusBadRequest)
			return
		}
		if !isRecordTypeAllowed(recordType, allowedRecordTypes) {
			http.Error(w, "record type not allowed", http.StatusBadRequest)
			return
		}

		out, err := store.listRecords(r.Context(), recordType)
		if err != nil {
			http.Error(w, "failed to list records", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"type":    recordType,
			"records": out,
		})
	}
}

func RecordsUpsertHandlerV4(sqliteDB, postgresDB *sql.DB, allowedRecordTypes map[string]struct{}) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req recordUpsertRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.RecordType = strings.TrimSpace(req.RecordType)
		req.RecordKey = strings.TrimSpace(req.RecordKey)
		if req.RecordType == "" || req.RecordKey == "" {
			http.Error(w, "recordType and recordKey are required", http.StatusBadRequest)
			return
		}
		if !isRecordTypeAllowed(req.RecordType, allowedRecordTypes) {
			http.Error(w, "record type not allowed", http.StatusBadRequest)
			return
		}
		if req.Data == nil {
			req.Data = map[string]any{}
		}

		if err := store.upsertRecord(r.Context(), req.RecordType, req.RecordKey, req.Data); err != nil {
			http.Error(w, "failed to upsert record", http.StatusInternalServerError)
			return
		}

		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			sqliteDB,
			"record_upsert",
			req.RecordType,
			req.RecordKey,
			"ok",
			map[string]any{"recordType": req.RecordType, "recordKey": req.RecordKey},
		) {
			return
		}
		refreshPublicWebsiteSnapshotAfterRecordMutation(r.Context(), sqliteDB, postgresDB, req.RecordType)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}
}

func RecordsDeleteHandlerV4(sqliteDB, postgresDB *sql.DB, allowedRecordTypes map[string]struct{}) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req recordDeleteRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.RecordType = strings.TrimSpace(req.RecordType)
		req.RecordKey = strings.TrimSpace(req.RecordKey)
		if req.RecordType == "" || req.RecordKey == "" {
			http.Error(w, "recordType and recordKey are required", http.StatusBadRequest)
			return
		}
		if !isRecordTypeAllowed(req.RecordType, allowedRecordTypes) {
			http.Error(w, "record type not allowed", http.StatusBadRequest)
			return
		}

		affected, err := store.deleteRecord(r.Context(), req.RecordType, req.RecordKey)
		if err != nil {
			http.Error(w, "failed to delete record", http.StatusInternalServerError)
			return
		}

		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			sqliteDB,
			"record_delete",
			req.RecordType,
			req.RecordKey,
			"ok",
			map[string]any{"affected": affected},
		) {
			return
		}
		refreshPublicWebsiteSnapshotAfterRecordMutation(r.Context(), sqliteDB, postgresDB, req.RecordType)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":       true,
			"affected": affected,
		})
	}
}

func controlPlaneStoreFromDBs(sqliteDB, postgresDB *sql.DB) (*controlPlaneStore, error) {
	if sqliteDB == nil && postgresDB == nil {
		return nil, errors.New("no database configured")
	}
	return newControlPlaneStore(sqliteDB, postgresDB), nil
}
