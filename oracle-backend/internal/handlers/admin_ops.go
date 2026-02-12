package handlers

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
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

func FeatureFlagsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		rows, err := db.QueryContext(r.Context(), `SELECT name, enabled, description, updated_at FROM feature_flags ORDER BY name ASC`) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
		if err != nil {
			http.Error(w, "failed to load feature flags", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		out := make([]featureFlagRow, 0, 16)
		for rows.Next() {
			var item featureFlagRow
			var enabled int64
			if err := rows.Scan(&item.Name, &enabled, &item.Description, &item.UpdatedAt); err != nil {
				http.Error(w, "failed to parse feature flags", http.StatusInternalServerError)
				return
			}
			item.Enabled = enabled != 0
			out = append(out, item)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "failed to iterate feature flags", http.StatusInternalServerError)
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
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
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
			http.Error(w, "failed to update feature flag", http.StatusInternalServerError)
			return
		}
		affected, err := res.RowsAffected()
		if err != nil {
			http.Error(w, "failed to update feature flag", http.StatusInternalServerError)
			return
		}
		if affected == 0 {
			http.Error(w, "feature flag not found", http.StatusNotFound)
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
			http.Error(w, "source must be one of: all, sqlite, postgres", http.StatusBadRequest)
			return
		}

		sources := map[string]outboxSourceStatus{}
		if source == "all" || source == "sqlite" {
			sqliteStatus, err := queryOutboxStatus(r.Context(), sqliteDB, "ingest_outbox")
			if err != nil {
				http.Error(w, "failed to query sqlite outbox status", http.StatusInternalServerError)
				return
			}
			if err := sqliteDB.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM outbox_dead_letter`).Scan(&sqliteStatus.DeadLetterCount); err != nil { // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
				http.Error(w, "failed to query sqlite outbox dead letter status", http.StatusInternalServerError)
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
					http.Error(w, "postgres outbox is not configured", http.StatusServiceUnavailable)
					return
				}
			} else {
				postgresStatus, err := queryOutboxStatus(r.Context(), postgresDB, "pg_outbox")
				if err != nil {
					http.Error(w, "failed to query postgres outbox status", http.StatusInternalServerError)
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
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Source = strings.ToLower(strings.TrimSpace(req.Source))
		if req.Source == "" {
			req.Source = "sqlite"
		}
		if req.Source != "sqlite" && req.Source != "postgres" {
			http.Error(w, "source must be one of: sqlite, postgres", http.StatusBadRequest)
			return
		}

		nowMs := time.Now().UnixMilli()
		var res sql.Result
		var err error
		resourceType := "ingest_outbox"
		if req.Source == "sqlite" {
			if sqliteDB == nil {
				http.Error(w, "sqlite outbox is not configured", http.StatusServiceUnavailable)
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
				http.Error(w, "postgres outbox is not configured", http.StatusServiceUnavailable)
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
			http.Error(w, "failed to mark outbox rows for retry", http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()
		if metrics != nil {
			metrics.IncCounter("oracle_outbox_retry_total", map[string]string{"source": req.Source}, float64(affected))
		}

		if sqliteDB != nil {
			_ = AppendAuditLog(
				r.Context(),
				sqliteDB,
				"outbox_retry",
				resourceType,
				"bulk",
				"ok",
				map[string]any{"ids": req.IDs, "affected": affected, "source": req.Source},
			)
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
			http.Error(w, "failed to load dead letter rows", http.StatusInternalServerError)
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
				http.Error(w, "failed to parse dead letter rows", http.StatusInternalServerError)
				return
			}
			items = append(items, item)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "failed to parse dead letter rows", http.StatusInternalServerError)
			return
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			http.Error(w, "failed to replay dead letter rows", http.StatusInternalServerError)
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
					http.Error(w, "failed to replay dead letter rows", http.StatusInternalServerError)
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
					http.Error(w, "failed to replay dead letter rows", http.StatusInternalServerError)
					return
				}
			}
			if _, err := tx.ExecContext(r.Context(), `DELETE FROM outbox_dead_letter WHERE id = ?`, item.ID); err != nil { // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
				http.Error(w, "failed to replay dead letter rows", http.StatusInternalServerError)
				return
			}
			replayed++
		}

		if err := tx.Commit(); err != nil {
			http.Error(w, "failed to replay dead letter rows", http.StatusInternalServerError)
			return
		}

		_ = AppendAuditLog(
			r.Context(),
			db,
			"dead_letter_replay",
			"outbox_dead_letter",
			"bulk",
			"ok",
			map[string]any{"replayed": replayed},
		)

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
			http.Error(w, "failed to load alerts", http.StatusInternalServerError)
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
				http.Error(w, "failed to load alerts", http.StatusInternalServerError)
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
			http.Error(w, "failed to iterate alerts", http.StatusInternalServerError)
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

func AppendAuditLog(
	ctx context.Context,
	db *sql.DB,
	actionType string,
	resourceType string,
	resourceID string,
	result string,
	payload map[string]any,
) error {
	requestID := observability.RequestIDFromContext(ctx)
	correlationID := observability.CorrelationIDFromContext(ctx)
	userID := observability.UserIDFromContext(ctx)
	tokenID := observability.TokenIDFromContext(ctx)
	role := observability.RoleFromContext(ctx)

	canonicalPayload, err := canonicalJSON(payload)
	if err != nil {
		return err
	}
	payloadHash := sha256.Sum256([]byte(canonicalPayload))
	payloadHashHex := hex.EncodeToString(payloadHash[:])

	// Serialize append operations on a dedicated connection so two concurrent
	// writers cannot fork the hash chain by reading the same predecessor.
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

	var prevHash string
	err = conn.QueryRowContext(ctx, `SELECT row_hash FROM admin_audit_log ORDER BY id DESC LIMIT 1`).Scan(&prevHash)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if errors.Is(err, sql.ErrNoRows) {
		prevHash = strings.Repeat("0", 64)
	}

	rowPreimage := canonicalPayload + ":" + prevHash
	rowHash := sha256.Sum256([]byte(rowPreimage))
	rowHashHex := hex.EncodeToString(rowHash[:])

	if _, err := conn.ExecContext(
		ctx,
		`INSERT INTO admin_audit_log (
			ts_utc, request_id, correlation_id, user_id, token_id, role,
			action_type, resource_type, resource_id, result, error_code,
			payload_json, prev_hash, payload_hash, row_hash
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		time.Now().UnixMilli(),
		requestID,
		correlationID,
		userID,
		tokenID,
		role,
		actionType,
		resourceType,
		resourceID,
		result,
		"",
		canonicalPayload,
		prevHash,
		payloadHashHex,
		rowHashHex,
	); err != nil {
		return err
	}

	if _, err := conn.ExecContext(ctx, `COMMIT`); err != nil {
		return err
	}
	committed = true
	return nil
}

func AuditVerifyChainHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		rows, err := db.QueryContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`SELECT id, payload_json, prev_hash, payload_hash, row_hash FROM admin_audit_log ORDER BY id ASC`,
		)
		if err != nil {
			http.Error(w, "failed to verify audit chain", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type rowData struct {
			ID          int64
			Payload     string
			PrevHash    string
			PayloadHash string
			RowHash     string
			Recomputed  string
		}
		chain := make([]rowData, 0, 256)
		prev := strings.Repeat("0", 64)
		ok := true
		var breakAt int64
		var breakReason string

		for rows.Next() {
			var item rowData
			if err := rows.Scan(&item.ID, &item.Payload, &item.PrevHash, &item.PayloadHash, &item.RowHash); err != nil {
				http.Error(w, "failed to verify audit chain", http.StatusInternalServerError)
				return
			}
			payloadSum := sha256.Sum256([]byte(item.Payload))
			recomputedPayloadHash := hex.EncodeToString(payloadSum[:])
			sum := sha256.Sum256([]byte(item.Payload + ":" + item.PrevHash))
			item.Recomputed = hex.EncodeToString(sum[:])
			chain = append(chain, item)

			if item.PrevHash != prev && ok {
				ok = false
				breakAt = item.ID
				breakReason = "prev_hash_mismatch"
			}
			if item.RowHash != item.Recomputed && ok {
				ok = false
				breakAt = item.ID
				breakReason = "row_hash_mismatch"
			}
			if item.PayloadHash != recomputedPayloadHash && ok {
				ok = false
				breakAt = item.ID
				breakReason = "payload_hash_mismatch"
			}
			prev = item.RowHash
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "failed to verify audit chain", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		resp := map[string]any{
			"ok":        true,
			"valid":     ok,
			"totalRows": len(chain),
		}
		if !ok {
			resp["breakAt"] = breakAt
			resp["reason"] = breakReason
		}
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func canonicalJSON(payload map[string]any) (string, error) {
	if payload == nil {
		return "{}", nil
	}
	canonicalized := canonicalizeValue(payload)
	raw, err := json.Marshal(canonicalized)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func canonicalizeValue(v any) any {
	switch typed := v.(type) {
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for k := range typed {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		ordered := make(map[string]any, len(typed))
		for _, k := range keys {
			ordered[k] = canonicalizeValue(typed[k])
		}
		return ordered
	case []any:
		out := make([]any, len(typed))
		for i := range typed {
			out[i] = canonicalizeValue(typed[i])
		}
		return out
	default:
		return v
	}
}

type sqlQueryRequest struct {
	SQL   string `json:"sql"`
	Limit int    `json:"limit"`
}

type sqlExecRequest struct {
	SQL    string `json:"sql"`
	DryRun bool   `json:"dryRun"`
}

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
	"backup_runs": {
		countStmt:  `SELECT COUNT(*) FROM backup_runs`,
		deleteStmt: `DELETE FROM backup_runs`,
	},
}

var backupFileNamePattern = regexp.MustCompile(`^[a-zA-Z0-9._-]+\.db$`)

func backupFileNameOrDefault(input string, now time.Time) (string, error) {
	name := strings.TrimSpace(input)
	if name == "" {
		name = fmt.Sprintf("oracle-backup-%d.db", now.UTC().Unix())
	}
	if strings.ContainsAny(name, `/\`) {
		return "", errors.New("invalid file name")
	}
	if filepath.Base(name) != name {
		return "", errors.New("invalid file name")
	}
	if strings.Contains(name, "..") {
		return "", errors.New("invalid file name")
	}
	if !backupFileNamePattern.MatchString(name) {
		return "", errors.New("invalid file name")
	}
	return name, nil
}

func resolveBackupPath(baseDir string, fileName string) (string, string, error) {
	absDir, err := filepath.Abs(baseDir)
	if err != nil {
		return "", "", err
	}
	joined := filepath.Join(absDir, fileName)
	cleaned := filepath.Clean(joined)
	rel, err := filepath.Rel(absDir, cleaned)
	if err != nil {
		return "", "", err
	}
	if rel == "." || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return "", "", errors.New("invalid backup path")
	}
	return absDir, cleaned, nil
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

func SQLQueryHandler(db *sql.DB, readOnlyDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !ensureFeatureEnabled(w, r, db, "feature_sql_console_enabled") {
			return
		}

		var req sqlQueryRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		stmt, err := normalizeSingleStatement(req.SQL)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if !isReadOnlySQL(stmt) {
			http.Error(w, "only read-only SQL is allowed on query endpoint", http.StatusBadRequest)
			return
		}
		if hasForbiddenSQLTerms(stmt) {
			http.Error(w, "statement is not allowed by safety policy", http.StatusBadRequest)
			return
		}
		if !isAllowedReadOnlyQuery(stmt) {
			http.Error(w, "query references restricted tables", http.StatusBadRequest)
			return
		}

		limit := req.Limit
		if limit <= 0 {
			limit = 200
		}
		if limit > 2000 {
			limit = 2000
		}

		queryDB := readOnlyDB
		if queryDB == nil {
			queryDB = db
		}
		rows, err := queryDB.QueryContext(r.Context(), stmt) // #nosec G701 -- SQL text is validated by strict single-statement read-only guards and restricted table policy.
		if err != nil {
			http.Error(w, "query failed: "+err.Error(), http.StatusBadRequest)
			return
		}
		defer rows.Close()

		cols, err := rows.Columns()
		if err != nil {
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}

		out := make([]map[string]any, 0, limit)
		for rows.Next() {
			if len(out) >= limit {
				break
			}
			values := make([]any, len(cols))
			ptrs := make([]any, len(cols))
			for i := range values {
				ptrs[i] = &values[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				http.Error(w, "query scan failed", http.StatusInternalServerError)
				return
			}
			row := make(map[string]any, len(cols))
			for i, col := range cols {
				v := values[i]
				switch t := v.(type) {
				case []byte:
					row[col] = string(t)
				default:
					row[col] = t
				}
			}
			out = append(out, row)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}

		_ = AppendAuditLog(
			r.Context(),
			db,
			"sql_query",
			"sql_console",
			"query",
			"ok",
			map[string]any{
				"rows":    len(out),
				"limited": limit,
				"sql":     truncateSQLForAudit(stmt),
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":     true,
			"limit":  limit,
			"count":  len(out),
			"rows":   out,
			"dryRun": true,
		})
	}
}

func SQLExecHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !ensureFeatureEnabled(w, r, db, "feature_sql_console_enabled") {
			return
		}

		var req sqlExecRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		stmt, err := normalizeSingleStatement(req.SQL)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if !isMutatingSQL(stmt) {
			http.Error(w, "exec endpoint only supports insert/update/delete statements", http.StatusBadRequest)
			return
		}
		if hasForbiddenSQLTerms(stmt) {
			http.Error(w, "statement is not allowed by safety policy", http.StatusBadRequest)
			return
		}
		tableName, ok := mutatingTargetTable(stmt)
		if !ok {
			http.Error(w, "unable to determine target table", http.StatusBadRequest)
			return
		}
		if _, allowed := sqlExecAllowedTables[tableName]; !allowed {
			http.Error(w, "mutations on this table are not allowed by safety policy", http.StatusBadRequest)
			return
		}

		affected := int64(0)
		if req.DryRun {
			tx, err := db.BeginTx(r.Context(), nil)
			if err != nil {
				http.Error(w, "failed to execute dry run", http.StatusInternalServerError)
				return
			}
			res, err := tx.ExecContext(r.Context(), stmt) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			if err == nil {
				affected, _ = res.RowsAffected()
			}
			_ = tx.Rollback()
			if err != nil {
				http.Error(w, "dry run failed: "+err.Error(), http.StatusBadRequest)
				return
			}
		} else {
			res, err := db.ExecContext(r.Context(), stmt) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			if err != nil {
				http.Error(w, "exec failed: "+err.Error(), http.StatusBadRequest)
				return
			}
			affected, _ = res.RowsAffected()
		}

		action := "sql_exec"
		if req.DryRun {
			action = "sql_exec_dry_run"
		}
		_ = AppendAuditLog(
			r.Context(),
			db,
			action,
			"sql_console",
			"exec",
			"ok",
			map[string]any{
				"affected": affected,
				"dryRun":   req.DryRun,
				"table":    tableName,
				"sql":      truncateSQLForAudit(stmt),
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":       true,
			"dryRun":   req.DryRun,
			"affected": affected,
		})
	}
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
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		scope := strings.TrimSpace(strings.ToLower(req.Scope))
		if scope == "" {
			scope = "all_non_core"
		}

		tables, ok := clearScopeTables(scope)
		if !ok {
			http.Error(w, "invalid scope", http.StatusBadRequest)
			return
		}

		counts := make(map[string]int64, len(tables))
		for _, table := range tables {
			sqlDef, ok := clearDataSQLByTable[table]
			if !ok {
				http.Error(w, "invalid scope", http.StatusBadRequest)
				return
			}
			var count int64
			if err := db.QueryRowContext(r.Context(), sqlDef.countStmt).Scan(&count); err != nil { // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
				http.Error(w, "failed to count rows", http.StatusInternalServerError)
				return
			}
			counts[table] = count
		}

		if req.DryRun {
			_ = AppendAuditLog(
				r.Context(),
				db,
				"danger_clear_data_dry_run",
				"danger_zone",
				scope,
				"ok",
				map[string]any{"counts": counts},
			)
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
			http.Error(w, "failed to clear data", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback()

		removed := make(map[string]int64, len(tables))
		for _, table := range tables {
			sqlDef, ok := clearDataSQLByTable[table]
			if !ok {
				http.Error(w, "invalid scope", http.StatusBadRequest)
				return
			}
			res, err := tx.ExecContext(r.Context(), sqlDef.deleteStmt) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			if err != nil {
				http.Error(w, "failed to clear data", http.StatusInternalServerError)
				return
			}
			n, _ := res.RowsAffected()
			removed[table] = n
		}

		if err := tx.Commit(); err != nil {
			http.Error(w, "failed to clear data", http.StatusInternalServerError)
			return
		}

		_ = AppendAuditLog(
			r.Context(),
			db,
			"danger_clear_data",
			"danger_zone",
			scope,
			"ok",
			map[string]any{"removed": removed},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"dryRun":  false,
			"scope":   scope,
			"removed": removed,
		})
	}
}

func BackupRunHandler(db *sql.DB, metrics *observability.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		type reqShape struct {
			FileName string `json:"fileName"`
		}
		var req reqShape
		if err := decodeJSONBodyStrict(r, &req); err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		baseName, err := backupFileNameOrDefault(req.FileName, time.Now())
		if err != nil {
			http.Error(w, "invalid file name", http.StatusBadRequest)
			return
		}

		backupDir := os.Getenv("BACKUP_DIR")
		if backupDir == "" {
			backupDir = "./data/backups"
		}
		absBackupDir, backupPath, err := resolveBackupPath(backupDir, baseName)
		if err != nil {
			recordBackupFailure(r.Context(), db, metrics, filepath.Join(backupDir, baseName), 0, 0, err)
			http.Error(w, "failed to resolve backup path", http.StatusInternalServerError)
			return
		}
		if err := os.MkdirAll(absBackupDir, 0o750); err != nil { // #nosec G703 -- absBackupDir is canonicalized and constrained by resolveBackupPath.
			recordBackupFailure(r.Context(), db, metrics, backupPath, 0, 0, err)
			http.Error(w, "failed to create backup directory", http.StatusInternalServerError)
			return
		}

		startedAt := time.Now().UnixMilli()
		// SQLite VACUUM INTO only accepts a literal target path (no bind parameters).
		// Defense layers: strict filename regex, canonical path validation under backup dir,
		// and explicit single-quote escaping before interpolation.
		vacuumStmt := "VACUUM INTO '" + strings.ReplaceAll(backupPath, "'", "''") + "'" // #nosec G202 -- literal path is required by SQLite for VACUUM INTO.
		_, err = db.ExecContext(r.Context(), vacuumStmt)                                // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
		finishedAt := time.Now().UnixMilli()

		if err != nil {
			recordBackupFailure(r.Context(), db, metrics, backupPath, startedAt, finishedAt, err)
			http.Error(w, "backup failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		_, _ = db.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`INSERT INTO backup_runs (backup_path, status, error_message, started_at, finished_at)
			 VALUES (?, 'ok', '', ?, ?)`,
			backupPath,
			startedAt,
			finishedAt,
		)
		_ = AppendAuditLog(
			r.Context(),
			db,
			"backup_run",
			"backup",
			backupPath,
			"ok",
			map[string]any{
				"path":       backupPath,
				"startedAt":  startedAt,
				"finishedAt": finishedAt,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":         true,
			"backupPath": backupPath,
			"startedAt":  startedAt,
			"finishedAt": finishedAt,
		})
	}
}

func recordBackupFailure(
	ctx context.Context,
	db *sql.DB,
	metrics *observability.Registry,
	backupPath string,
	startedAt int64,
	finishedAt int64,
	err error,
) {
	if startedAt == 0 {
		startedAt = time.Now().UnixMilli()
	}
	if finishedAt == 0 {
		finishedAt = startedAt
	}
	if metrics != nil {
		metrics.IncCounter("oracle_backup_failures_total", nil, 1)
	}
	_ = upsertOpenAlert(
		ctx,
		db,
		"backup_failed",
		"critical",
		"backup job failed",
		map[string]any{"error": truncateAlertError(err.Error()), "path": backupPath},
	)
	_, _ = db.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
		ctx,
		`INSERT INTO backup_runs (backup_path, status, error_message, started_at, finished_at)
		 VALUES (?, 'error', ?, ?, ?)`,
		backupPath,
		truncateAlertError(err.Error()),
		startedAt,
		finishedAt,
	)
}

func RecordsListHandler(db *sql.DB) http.HandlerFunc {
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

		rows, err := db.QueryContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`SELECT record_key, data_json, created_at, updated_at
			 FROM admin_records
			 WHERE record_type = ?
			 ORDER BY updated_at DESC, id DESC`,
			recordType,
		)
		if err != nil {
			http.Error(w, "failed to list records", http.StatusInternalServerError)
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
				http.Error(w, "failed to parse records", http.StatusInternalServerError)
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
			http.Error(w, "failed to parse records", http.StatusInternalServerError)
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

func RecordsUpsertHandler(db *sql.DB) http.HandlerFunc {
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
		if req.Data == nil {
			req.Data = map[string]any{}
		}
		raw, err := json.Marshal(req.Data)
		if err != nil {
			http.Error(w, "invalid data payload", http.StatusBadRequest)
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
			http.Error(w, "failed to upsert record", http.StatusInternalServerError)
			return
		}

		_ = AppendAuditLog(
			r.Context(),
			db,
			"record_upsert",
			req.RecordType,
			req.RecordKey,
			"ok",
			map[string]any{"recordType": req.RecordType, "recordKey": req.RecordKey},
		)

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
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.RecordType = strings.TrimSpace(req.RecordType)
		req.RecordKey = strings.TrimSpace(req.RecordKey)
		if req.RecordType == "" || req.RecordKey == "" {
			http.Error(w, "recordType and recordKey are required", http.StatusBadRequest)
			return
		}

		res, err := db.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`DELETE FROM admin_records WHERE record_type = ? AND record_key = ?`,
			req.RecordType,
			req.RecordKey,
		)
		if err != nil {
			http.Error(w, "failed to delete record", http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()

		_ = AppendAuditLog(
			r.Context(),
			db,
			"record_delete",
			req.RecordType,
			req.RecordKey,
			"ok",
			map[string]any{"affected": affected},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":       true,
			"affected": affected,
		})
	}
}

func ensureFeatureEnabled(w http.ResponseWriter, r *http.Request, db *sql.DB, flagName string) bool {
	enabled, err := IsFeatureEnabled(r.Context(), db, flagName)
	if err != nil {
		http.Error(w, "failed to evaluate feature flag", http.StatusInternalServerError)
		return false
	}
	if !enabled {
		http.Error(w, "feature disabled", http.StatusForbidden)
		return false
	}
	return true
}

func normalizeSingleStatement(sqlText string) (string, error) {
	stmt := strings.TrimSpace(sqlText)
	if stmt == "" {
		return "", errors.New("sql is required")
	}
	if strings.Count(stmt, ";") > 1 {
		return "", errors.New("multiple SQL statements are not allowed")
	}
	stmt = strings.TrimSuffix(stmt, ";")
	if strings.Contains(stmt, ";") {
		return "", errors.New("multiple SQL statements are not allowed")
	}
	return stmt, nil
}

func isReadOnlySQL(stmt string) bool {
	lower := strings.ToLower(strings.TrimSpace(stmt))
	return strings.HasPrefix(lower, "select ")
}

func isMutatingSQL(stmt string) bool {
	lower := strings.ToLower(strings.TrimSpace(stmt))
	return strings.HasPrefix(lower, "insert ") ||
		strings.HasPrefix(lower, "update ") ||
		strings.HasPrefix(lower, "delete ")
}

var sqlForbiddenTermsRegexp = regexp.MustCompile(`(?i)\b(drop|alter|pragma|vacuum|attach|detach|reindex|create|trigger|load_extension|replace)\b`)

var sqlReadOnlyRestrictedTables = map[string]struct{}{
	"admin_audit_log": {},
	"feature_flags":   {},
	"sqlite_master":   {},
	"sqlite_schema":   {},
}

var sqlExecAllowedTables = map[string]struct{}{
	"pipeline_failure_logs": {},
	"ingest_outbox":         {},
	"outbox_dead_letter":    {},
	"system_alerts":         {},
	"cf_snapshots_raw":      {},
	"oracle_operation_logs": {},
	"cf_schema_registry":    {},
	"backup_runs":           {},
}

var sqlTargetTableRegexp = regexp.MustCompile(`(?i)^\s*(?:insert\s+into|update|delete\s+from)\s+([a-zA-Z_][a-zA-Z0-9_]*)`)
var sqlReadOnlyTableRegexp = regexp.MustCompile(`(?i)\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)`)

func hasForbiddenSQLTerms(stmt string) bool {
	return sqlForbiddenTermsRegexp.MatchString(stmt)
}

func mutatingTargetTable(stmt string) (string, bool) {
	match := sqlTargetTableRegexp.FindStringSubmatch(stmt)
	if len(match) < 2 {
		return "", false
	}
	return strings.ToLower(strings.TrimSpace(match[1])), true
}

func isAllowedReadOnlyQuery(stmt string) bool {
	matches := sqlReadOnlyTableRegexp.FindAllStringSubmatch(stmt, -1)
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		table := strings.ToLower(strings.TrimSpace(match[1]))
		if _, blocked := sqlReadOnlyRestrictedTables[table]; blocked {
			return false
		}
	}
	return true
}

func truncateSQLForAudit(stmt string) string {
	const maxLen = 512
	normalized := strings.TrimSpace(stmt)
	if len(normalized) <= maxLen {
		return normalized
	}
	return normalized[:maxLen] + "...(truncated)"
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

	var existingID int64
	queryErr := db.QueryRowContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
		ctx,
		`SELECT id FROM system_alerts WHERE alert_type = ? AND status = 'open' ORDER BY id DESC LIMIT 1`,
		alertType,
	).Scan(&existingID)
	if queryErr == nil {
		_, err = db.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			ctx,
			`UPDATE system_alerts
			 SET severity = ?, message = ?, payload_json = ?, updated_at = ?
			 WHERE id = ?`,
			severity,
			message,
			string(raw),
			nowMs,
			existingID,
		)
		return err
	}
	if !errors.Is(queryErr, sql.ErrNoRows) {
		return queryErr
	}

	_, err = db.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
		ctx,
		`INSERT INTO system_alerts (alert_type, severity, message, status, payload_json, created_at, updated_at)
		 VALUES (?, ?, ?, 'open', ?, ?, ?)`,
		alertType,
		severity,
		message,
		string(raw),
		nowMs,
		nowMs,
	)
	return err
}
