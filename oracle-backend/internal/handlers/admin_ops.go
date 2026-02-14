package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"oracle-backend/internal/observability"
)

type featureFlagRow struct {
	Name        string `json:"name"`
	Enabled     bool   `json:"enabled"`
	Description string `json:"description"`
	UpdatedAt   int64  `json:"updatedAt"`
}

// writeJSONError sends a structured JSON error response without leaking internal details.
func writeJSONError(w http.ResponseWriter, code, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":      false,
		"error":   code,
		"message": message,
	})
}

func FeatureFlagsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		rows, err := db.QueryContext(r.Context(), `SELECT name, enabled, description, updated_at FROM feature_flags ORDER BY name ASC`) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
		if err != nil {
			writeJSONError(w, "list_failed", "Failed to load feature flags", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		out := make([]featureFlagRow, 0, 16)
		for rows.Next() {
			var item featureFlagRow
			var enabled int64
			if err := rows.Scan(&item.Name, &enabled, &item.Description, &item.UpdatedAt); err != nil {
				writeJSONError(w, "parse_failed", "Failed to parse feature flags", http.StatusInternalServerError)
				return
			}
			item.Enabled = enabled != 0
			out = append(out, item)
		}
		if err := rows.Err(); err != nil {
			writeJSONError(w, "iterate_failed", "Failed to iterate feature flags", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":    true,
			"flags": out,
		})
	}
}

type updateFlagRequest struct {
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
}

func UpdateFeatureFlagHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req updateFlagRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			writeJSONError(w, "invalid_body", "Invalid request body", http.StatusBadRequest)
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			writeJSONError(w, "missing_name", "Name is required", http.StatusBadRequest)
			return
		}

		enabled := 0
		if req.Enabled {
			enabled = 1
		}

		res, err := db.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`UPDATE feature_flags SET enabled = ?, updated_at = ? WHERE name = ?`,
			enabled,
			time.Now().UnixMilli(),
			req.Name,
		)
		if err != nil {
			writeJSONError(w, "update_failed", "Failed to update feature flag", http.StatusInternalServerError)
			return
		}
		affected, err := res.RowsAffected()
		if err != nil {
			writeJSONError(w, "update_failed", "Failed to update feature flag", http.StatusInternalServerError)
			return
		}
		if affected == 0 {
			writeJSONError(w, "not_found", "Feature flag not found", http.StatusNotFound)
			return
		}

		if err := AppendAuditLog(
			r.Context(),
			db,
			"feature_flag_update",
			"feature_flag",
			req.Name,
			"ok",
			map[string]any{
				"name":    req.Name,
				"enabled": req.Enabled,
			},
		); err != nil {
			logEvent("warn", "audit_log_write_failed", map[string]interface{}{"error": err.Error()})
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}
}

func IsFeatureEnabled(ctx context.Context, db *sql.DB, name string) (bool, error) {
	var enabled int64
	err := db.QueryRowContext(ctx, `SELECT enabled FROM feature_flags WHERE name = ?`, name).Scan(&enabled) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return enabled != 0, nil
}

type outboxStatusResponse struct {
	OK              bool                          `json:"ok"`
	Source          string                        `json:"source"`
	CountsByStatus  map[string]int64              `json:"countsByStatus"`
	DeadLetterCount int64                         `json:"deadLetterCount"`
	Sources         map[string]outboxSourceStatus `json:"sources"`
}

type outboxSourceStatus struct {
	CountsByStatus  map[string]int64 `json:"countsByStatus"`
	DeadLetterCount int64            `json:"deadLetterCount,omitempty"`
	Backlog         int64            `json:"backlog"`
}

func queryOutboxStatus(ctx context.Context, db *sql.DB, tableName string) (outboxSourceStatus, error) {
	if db == nil {
		return outboxSourceStatus{}, errors.New("database not configured")
	}

	query := fmt.Sprintf(`SELECT status, COUNT(*) FROM %s GROUP BY status`, tableName) // #nosec G201 -- tableName is internal constant.
	rows, err := db.QueryContext(ctx, query)                                           // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
	if err != nil {
		return outboxSourceStatus{}, err
	}
	defer rows.Close()

	counts := map[string]int64{
		"pending":    0,
		"processing": 0,
		"sent":       0,
		"retry":      0,
		"dead":       0,
	}
	var backlog int64
	for rows.Next() {
		var status string
		var cnt int64
		if err := rows.Scan(&status, &cnt); err != nil {
			return outboxSourceStatus{}, err
		}
		counts[status] = cnt
		if status == "pending" || status == "retry" || status == "processing" {
			backlog += cnt
		}
	}
	if err := rows.Err(); err != nil {
		return outboxSourceStatus{}, err
	}

	return outboxSourceStatus{
		CountsByStatus: counts,
		Backlog:        backlog,
	}, nil
}

func OutboxStatusHandler(sqliteDB, postgresDB *sql.DB, metrics *observability.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		source := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("source")))
		if source == "" {
			source = "all"
		}
		if source != "all" && source != "sqlite" && source != "postgres" {
			writeJSONError(w, "invalid_source", "Source must be one of: all, sqlite, postgres", http.StatusBadRequest)
			return
		}

		sources := map[string]outboxSourceStatus{}
		if source == "all" || source == "sqlite" {
			sqliteStatus, err := queryOutboxStatus(r.Context(), sqliteDB, "ingest_outbox")
			if err != nil {
				writeJSONError(w, "query_failed", "Failed to query SQLite outbox status", http.StatusInternalServerError)
				return
			}
			if err := sqliteDB.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM outbox_dead_letter`).Scan(&sqliteStatus.DeadLetterCount); err != nil { // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
				writeJSONError(w, "query_failed", "Failed to query SQLite outbox dead letter status", http.StatusInternalServerError)
				return
			}
			sources["sqlite"] = sqliteStatus
			if metrics != nil {
				metrics.SetGauge("oracle_outbox_backlog_size", map[string]string{"source": "sqlite"}, float64(sqliteStatus.Backlog))
			}
		}
		if source == "all" || source == "postgres" {
			if postgresDB == nil {
				if source == "postgres" {
					writeJSONError(w, "not_configured", "Postgres outbox is not configured", http.StatusServiceUnavailable)
					return
				}
			} else {
				postgresStatus, err := queryOutboxStatus(r.Context(), postgresDB, "pg_outbox")
				if err != nil {
					writeJSONError(w, "query_failed", "Failed to query Postgres outbox status", http.StatusInternalServerError)
					return
				}
				sources["postgres"] = postgresStatus
				if metrics != nil {
					metrics.SetGauge("oracle_outbox_backlog_size", map[string]string{"source": "postgres"}, float64(postgresStatus.Backlog))
				}
			}
		}

		primarySource := source
		if source == "all" {
			primarySource = "sqlite"
			if _, ok := sources["sqlite"]; !ok {
				primarySource = "postgres"
			}
		}
		primaryStatus, ok := sources[primarySource]
		if !ok {
			primaryStatus = outboxSourceStatus{
				CountsByStatus: map[string]int64{},
				Backlog:        0,
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(outboxStatusResponse{
			OK:              true,
			Source:          source,
			CountsByStatus:  primaryStatus.CountsByStatus,
			DeadLetterCount: primaryStatus.DeadLetterCount,
			Sources:         sources,
		})
	}
}

func RetryOutboxHandler(sqliteDB, postgresDB *sql.DB, metrics *observability.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		type reqShape struct {
			Source string  `json:"source"`
			IDs    []int64 `json:"ids"`
		}
		var req reqShape
		if err := decodeJSONBodyStrict(r, &req); err != nil && !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid_body", "Invalid request body", http.StatusBadRequest)
			return
		}
		req.Source = strings.ToLower(strings.TrimSpace(req.Source))
		if req.Source == "" {
			req.Source = "sqlite"
		}
		if req.Source != "sqlite" && req.Source != "postgres" {
			writeJSONError(w, "invalid_source", "Source must be one of: sqlite, postgres", http.StatusBadRequest)
			return
		}

		nowMs := time.Now().UnixMilli()
		var res sql.Result
		var err error
		resourceType := "ingest_outbox"
		if req.Source == "sqlite" {
			if sqliteDB == nil {
				writeJSONError(w, "not_configured", "SQLite outbox is not configured", http.StatusServiceUnavailable)
				return
			}
			if len(req.IDs) == 0 {
				res, err = sqliteDB.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
					r.Context(),
					`UPDATE ingest_outbox
				 SET status = 'pending', next_run_at = ?, last_error = ''
				 WHERE status IN ('retry', 'dead')`,
					nowMs,
				)
			} else {
				placeholders := make([]string, 0, len(req.IDs))
				args := make([]any, 0, len(req.IDs)+1)
				args = append(args, nowMs)
				for _, id := range req.IDs {
					placeholders = append(placeholders, "?")
					args = append(args, id)
				}
				// #nosec G202 -- placeholders are generated in-process and ids are bound parameters.
				q := `UPDATE ingest_outbox
					  SET status = 'pending', next_run_at = ?, last_error = ''
					  WHERE status IN ('retry', 'dead') AND id IN (` + strings.Join(placeholders, ",") + `)`
				res, err = sqliteDB.ExecContext(r.Context(), q, args...) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			}
		} else {
			if postgresDB == nil {
				writeJSONError(w, "not_configured", "Postgres outbox is not configured", http.StatusServiceUnavailable)
				return
			}
			resourceType = "pg_outbox"
			if len(req.IDs) == 0 {
				res, err = postgresDB.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
					r.Context(),
					`UPDATE pg_outbox
					 SET status = 'pending', next_run_at = $1, last_error = ''
					 WHERE status IN ('retry', 'dead')`,
					nowMs,
				)
			} else {
				placeholders := make([]string, 0, len(req.IDs))
				args := make([]any, 0, len(req.IDs)+1)
				args = append(args, nowMs)
				for i, id := range req.IDs {
					placeholders = append(placeholders, fmt.Sprintf("$%d", i+2))
					args = append(args, id)
				}
				// #nosec G202 -- placeholders are generated in-process and ids are bound parameters.
				q := `UPDATE pg_outbox
					  SET status = 'pending', next_run_at = $1, last_error = ''
					  WHERE status IN ('retry', 'dead') AND id IN (` + strings.Join(placeholders, ",") + `)`
				res, err = postgresDB.ExecContext(r.Context(), q, args...) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			}
		}
		if err != nil {
			writeJSONError(w, "retry_failed", "Failed to mark outbox rows for retry", http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()
		if metrics != nil {
			metrics.IncCounter("oracle_outbox_retry_total", map[string]string{"source": req.Source}, float64(affected))
		}

		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			sqliteDB,
			"outbox_retry",
			resourceType,
			"bulk",
			"ok",
			map[string]any{"ids": req.IDs, "affected": affected, "source": req.Source},
		) {
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "affected": affected, "source": req.Source})
	}
}

func ReplayDeadLetterHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		rows, err := db.QueryContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`SELECT id, outbox_id, event_type, payload_json, idempotency_key, attempts
			 FROM outbox_dead_letter
			 ORDER BY id ASC
			 LIMIT 100`,
		)
		if err != nil {
			writeJSONError(w, "load_failed", "Failed to load dead letter rows", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type deadRow struct {
			ID             int64
			OutboxID       sql.NullInt64
			EventType      string
			PayloadJSON    string
			IdempotencyKey string
			Attempts       int64
		}
		items := make([]deadRow, 0, 100)
		for rows.Next() {
			var item deadRow
			if err := rows.Scan(&item.ID, &item.OutboxID, &item.EventType, &item.PayloadJSON, &item.IdempotencyKey, &item.Attempts); err != nil {
				writeJSONError(w, "parse_failed", "Failed to parse dead letter rows", http.StatusInternalServerError)
				return
			}
			items = append(items, item)
		}
		if err := rows.Err(); err != nil {
			writeJSONError(w, "parse_failed", "Failed to parse dead letter rows", http.StatusInternalServerError)
			return
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSONError(w, "replay_failed", "Failed to replay dead letter rows", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback()

		nowMs := time.Now().UnixMilli()
		replayed := int64(0)
		for _, item := range items {
			resetDone := false
			if item.OutboxID.Valid {
				res, err := tx.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
					r.Context(),
					`UPDATE ingest_outbox
					 SET status = 'pending', attempts = 0, last_error = '', next_run_at = ?
					 WHERE id = ? AND idempotency_key = ?`,
					nowMs,
					item.OutboxID.Int64,
					item.IdempotencyKey,
				)
				if err != nil {
					writeJSONError(w, "replay_failed", "Failed to replay dead letter rows", http.StatusInternalServerError)
					return
				}
				affected, _ := res.RowsAffected()
				if affected > 0 {
					resetDone = true
				}
			}

			if !resetDone {
				// Fallback for legacy rows without outbox_id or missing source row.
				if _, err := tx.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
					r.Context(),
					`INSERT INTO ingest_outbox (event_type, payload_json, idempotency_key, status, attempts, last_error, created_at, next_run_at)
					 VALUES (?, ?, ?, 'pending', 0, '', ?, ?)
					 ON CONFLICT(idempotency_key) DO UPDATE SET
					   status = 'pending',
					   attempts = 0,
					   last_error = '',
					   next_run_at = excluded.next_run_at`,
					item.EventType,
					item.PayloadJSON,
					item.IdempotencyKey,
					nowMs,
					nowMs,
				); err != nil {
					writeJSONError(w, "replay_failed", "Failed to replay dead letter rows", http.StatusInternalServerError)
					return
				}
			}
			if _, err := tx.ExecContext(r.Context(), `DELETE FROM outbox_dead_letter WHERE id = ?`, item.ID); err != nil { // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
				writeJSONError(w, "replay_failed", "Failed to replay dead letter rows", http.StatusInternalServerError)
				return
			}
			replayed++
		}

		if err := tx.Commit(); err != nil {
			writeJSONError(w, "replay_failed", "Failed to replay dead letter rows", http.StatusInternalServerError)
			return
		}

		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			db,
			"dead_letter_replay",
			"outbox_dead_letter",
			"bulk",
			"ok",
			map[string]any{"replayed": replayed},
		) {
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "replayed": replayed})
	}
}

func AlertsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		rows, err := db.QueryContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`SELECT id, alert_type, severity, message, status, payload_json, created_at, updated_at
			 FROM system_alerts
			 ORDER BY created_at DESC
			 LIMIT 200`,
		)
		if err != nil {
			writeJSONError(w, "list_failed", "Failed to load alerts", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type alertRow struct {
			ID        int64           `json:"id"`
			AlertType string          `json:"alertType"`
			Severity  string          `json:"severity"`
			Message   string          `json:"message"`
			Status    string          `json:"status"`
			Payload   json.RawMessage `json:"payload"`
			CreatedAt int64           `json:"createdAt"`
			UpdatedAt int64           `json:"updatedAt"`
		}

		out := make([]alertRow, 0, 200)
		for rows.Next() {
			var item alertRow
			var payloadRaw string
			if err := rows.Scan(
				&item.ID,
				&item.AlertType,
				&item.Severity,
				&item.Message,
				&item.Status,
				&payloadRaw,
				&item.CreatedAt,
				&item.UpdatedAt,
			); err != nil {
				writeJSONError(w, "list_failed", "Failed to load alerts", http.StatusInternalServerError)
				return
			}
			payloadRaw = strings.TrimSpace(payloadRaw)
			if payloadRaw == "" {
				payloadRaw = "{}"
			}
			item.Payload = json.RawMessage(payloadRaw)
			out = append(out, item)
		}
		if err := rows.Err(); err != nil {
			writeJSONError(w, "iterate_failed", "Failed to iterate alerts", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "alerts": out})
	}
}

func MigrationsStatusHandler(postgresConfigured bool, postgresLastErr *string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		payload := map[string]any{
			"ok": true,
			"sqlite": map[string]any{
				"enabled": true,
				"status":  "ready",
			},
			"postgres": map[string]any{
				"configured": postgresConfigured,
				"status":     "disabled",
			},
		}
		if postgresConfigured {
			payload["postgres"] = map[string]any{
				"configured": true,
				"status":     "ready",
			}
		}
		if postgresLastErr != nil && *postgresLastErr != "" {
			payload["postgres"] = map[string]any{
				"configured": postgresConfigured,
				"status":     "error",
				"message":    *postgresLastErr,
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(payload)
	}
}

// Audit log functions (AppendAuditLog, AuditVerifyChainHandler, canonicalJSON,
// canonicalizeValue, canonicalizeValueDepth, truncateSQLForAudit) have been
// extracted to admin_audit.go.

// SQL console functions (SQLQueryHandler, SQLExecHandler, ensureFeatureEnabled,
// and all SQL policy/validation helpers) have been extracted to admin_sql.go.

// Backup functions (BackupRunHandler, recordBackupFailure, backupFileNameOrDefault,
// resolveBackupPath) have been extracted to admin_backup.go.

type clearDataRequest struct {
	Scope  string `json:"scope"`
	DryRun bool   `json:"dryRun"`
}

type clearDataTableSQL struct {
	countStmt  string
	deleteStmt string
}

var clearDataSQLByTable = map[string]clearDataTableSQL{
	"pipeline_failure_logs": {
		countStmt:  `SELECT COUNT(*) FROM pipeline_failure_logs`,
		deleteStmt: `DELETE FROM pipeline_failure_logs`,
	},
	"ingest_outbox": {
		countStmt:  `SELECT COUNT(*) FROM ingest_outbox`,
		deleteStmt: `DELETE FROM ingest_outbox`,
	},
	"outbox_dead_letter": {
		countStmt:  `SELECT COUNT(*) FROM outbox_dead_letter`,
		deleteStmt: `DELETE FROM outbox_dead_letter`,
	},
	"system_alerts": {
		countStmt:  `SELECT COUNT(*) FROM system_alerts`,
		deleteStmt: `DELETE FROM system_alerts`,
	},
	"cf_snapshots_raw": {
		countStmt:  `SELECT COUNT(*) FROM cf_snapshots_raw`,
		deleteStmt: `DELETE FROM cf_snapshots_raw`,
	},
	"cf_schema_registry": {
		countStmt:  `SELECT COUNT(*) FROM cf_schema_registry`,
		deleteStmt: `DELETE FROM cf_schema_registry`,
	},
	"oracle_operation_logs": {
		countStmt:  `SELECT COUNT(*) FROM oracle_operation_logs`,
		deleteStmt: `DELETE FROM oracle_operation_logs`,
	},
	"backup_runs": {
		countStmt:  `SELECT COUNT(*) FROM backup_runs`,
		deleteStmt: `DELETE FROM backup_runs`,
	},
}

type recordUpsertRequest struct {
	RecordType string         `json:"recordType"`
	RecordKey  string         `json:"recordKey"`
	Data       map[string]any `json:"data"`
}

type recordDeleteRequest struct {
	RecordType string `json:"recordType"`
	RecordKey  string `json:"recordKey"`
}

func DangerClearDataHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !ensureFeatureEnabled(w, r, db, "feature_clear_data_enabled") {
			return
		}

		var req clearDataRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			writeJSONError(w, "invalid_body", "Invalid request body", http.StatusBadRequest)
			return
		}
		scope := strings.TrimSpace(strings.ToLower(req.Scope))
		if scope == "" {
			scope = "all_non_core"
		}

		tables, ok := clearScopeTables(scope)
		if !ok {
			writeJSONError(w, "invalid_scope", "Invalid scope", http.StatusBadRequest)
			return
		}

		counts := make(map[string]int64, len(tables))
		for _, table := range tables {
			sqlDef, ok := clearDataSQLByTable[table]
			if !ok {
				writeJSONError(w, "invalid_scope", "Invalid scope", http.StatusBadRequest)
				return
			}
			var count int64
			if err := db.QueryRowContext(r.Context(), sqlDef.countStmt).Scan(&count); err != nil { // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
				writeJSONError(w, "count_failed", "Failed to count rows", http.StatusInternalServerError)
				return
			}
			counts[table] = count
		}

		if req.DryRun {
			if !appendAuditLogOrHTTPError(
				w,
				r.Context(),
				db,
				"danger_clear_data_dry_run",
				"danger_zone",
				scope,
				"ok",
				map[string]any{"counts": counts},
			) {
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":      true,
				"dryRun":  true,
				"scope":   scope,
				"counts":  counts,
				"message": "dry run only; no rows removed",
			})
			return
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			writeJSONError(w, "clear_failed", "Failed to clear data", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback()

		removed := make(map[string]int64, len(tables))
		for _, table := range tables {
			sqlDef, ok := clearDataSQLByTable[table]
			if !ok {
				writeJSONError(w, "invalid_scope", "Invalid scope", http.StatusBadRequest)
				return
			}
			res, err := tx.ExecContext(r.Context(), sqlDef.deleteStmt) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			if err != nil {
				writeJSONError(w, "clear_failed", "Failed to clear data", http.StatusInternalServerError)
				return
			}
			n, _ := res.RowsAffected()
			removed[table] = n
		}

		if err := tx.Commit(); err != nil {
			writeJSONError(w, "clear_failed", "Failed to clear data", http.StatusInternalServerError)
			return
		}

		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			db,
			"danger_clear_data",
			"danger_zone",
			scope,
			"ok",
			map[string]any{"removed": removed},
		) {
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"dryRun":  false,
			"scope":   scope,
			"removed": removed,
		})
	}
}

func RecordsListHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		recordType := strings.TrimSpace(r.URL.Query().Get("type"))
		if recordType == "" {
			writeJSONError(w, "missing_type", "Type is required", http.StatusBadRequest)
			return
		}

		limit := 200
		offset := 0
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 2000 {
				limit = n
			}
		}
		if v := r.URL.Query().Get("offset"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n >= 0 {
				offset = n
			}
		}

		rows, err := db.QueryContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`SELECT record_key, data_json, created_at, updated_at
			 FROM admin_records
			 WHERE record_type = ?
			 ORDER BY updated_at DESC, id DESC
			 LIMIT ? OFFSET ?`,
			recordType, limit, offset,
		)
		if err != nil {
			writeJSONError(w, "list_failed", "Failed to list records", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type recordRow struct {
			RecordKey string          `json:"recordKey"`
			Data      json.RawMessage `json:"data"`
			CreatedAt int64           `json:"createdAt"`
			UpdatedAt int64           `json:"updatedAt"`
		}
		out := make([]recordRow, 0, 64)
		for rows.Next() {
			var item recordRow
			var raw sql.NullString
			if err := rows.Scan(&item.RecordKey, &raw, &item.CreatedAt, &item.UpdatedAt); err != nil {
				writeJSONError(w, "parse_failed", "Failed to parse records", http.StatusInternalServerError)
				return
			}
			if raw.Valid && strings.TrimSpace(raw.String) != "" {
				item.Data = json.RawMessage(raw.String)
			} else {
				item.Data = json.RawMessage(`{}`)
			}
			out = append(out, item)
		}
		if err := rows.Err(); err != nil {
			writeJSONError(w, "parse_failed", "Failed to parse records", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"type":    recordType,
			"records": out,
			"limit":   limit,
			"offset":  offset,
			"hasMore": len(out) == limit,
		})
	}
}

func RecordsUpsertHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req recordUpsertRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			writeJSONError(w, "invalid_body", "Invalid request body", http.StatusBadRequest)
			return
		}
		req.RecordType = strings.TrimSpace(req.RecordType)
		req.RecordKey = strings.TrimSpace(req.RecordKey)
		if req.RecordType == "" || req.RecordKey == "" {
			writeJSONError(w, "missing_fields", "recordType and recordKey are required", http.StatusBadRequest)
			return
		}
		if req.Data == nil {
			req.Data = map[string]any{}
		}
		raw, err := json.Marshal(req.Data)
		if err != nil {
			writeJSONError(w, "invalid_payload", "Invalid data payload", http.StatusBadRequest)
			return
		}

		nowMs := time.Now().UnixMilli()
		_, err = db.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`INSERT INTO admin_records (record_type, record_key, data_json, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(record_type, record_key) DO UPDATE SET
			   data_json = excluded.data_json,
			   updated_at = excluded.updated_at`,
			req.RecordType,
			req.RecordKey,
			string(raw),
			nowMs,
			nowMs,
		)
		if err != nil {
			writeJSONError(w, "upsert_failed", "Failed to upsert record", http.StatusInternalServerError)
			return
		}

		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			db,
			"record_upsert",
			req.RecordType,
			req.RecordKey,
			"ok",
			map[string]any{"recordType": req.RecordType, "recordKey": req.RecordKey},
		) {
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}
}

func RecordsDeleteHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req recordDeleteRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			writeJSONError(w, "invalid_body", "Invalid request body", http.StatusBadRequest)
			return
		}
		req.RecordType = strings.TrimSpace(req.RecordType)
		req.RecordKey = strings.TrimSpace(req.RecordKey)
		if req.RecordType == "" || req.RecordKey == "" {
			writeJSONError(w, "missing_fields", "recordType and recordKey are required", http.StatusBadRequest)
			return
		}

		res, err := db.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`DELETE FROM admin_records WHERE record_type = ? AND record_key = ?`,
			req.RecordType,
			req.RecordKey,
		)
		if err != nil {
			writeJSONError(w, "delete_failed", "Failed to delete record", http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()

		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			db,
			"record_delete",
			req.RecordType,
			req.RecordKey,
			"ok",
			map[string]any{"affected": affected},
		) {
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":       true,
			"affected": affected,
		})
	}
}

func clearScopeTables(scope string) ([]string, bool) {
	switch scope {
	case "pipeline_failure_logs":
		return []string{"pipeline_failure_logs"}, true
	case "ingest_outbox":
		return []string{"ingest_outbox"}, true
	case "outbox_dead_letter":
		return []string{"outbox_dead_letter"}, true
	case "system_alerts":
		return []string{"system_alerts"}, true
	case "cf_snapshots_raw":
		return []string{"cf_snapshots_raw"}, true
	case "oracle_operation_logs":
		return []string{"oracle_operation_logs"}, true
	case "all_non_core":
		return []string{
			"pipeline_failure_logs",
			"ingest_outbox",
			"outbox_dead_letter",
			"system_alerts",
			"cf_snapshots_raw",
			"oracle_operation_logs",
			"cf_schema_registry",
			"backup_runs",
		}, true
	default:
		return nil, false
	}
}

func truncateAlertError(v string) string {
	if len(v) <= 240 {
		return v
	}
	return v[:240]
}

func upsertOpenAlert(
	ctx context.Context,
	db *sql.DB,
	alertType string,
	severity string,
	message string,
	payload map[string]any,
) error {
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

	updateRes, err := conn.ExecContext( // #nosec G701 -- SQL text is constant; values are bound parameters.
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
		if _, err := conn.ExecContext( // #nosec G701 -- SQL text is constant; values are bound parameters.
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
