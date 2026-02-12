package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type OracleOperationLogEntry struct {
	TSUTC         int64
	RequestID     string
	CorrelationID string
	UserID        string
	TokenID       string
	Role          string
	ActionType    string
	ResourceType  string
	ResourceID    string
	Method        string
	Path          string
	StatusCode    int
	Result        string
	LatencyMS     int64
	ErrorCode     string
}

func InsertOracleOperationLog(ctx context.Context, db *sql.DB, entry OracleOperationLogEntry) error {
	if db == nil {
		return errors.New("nil db")
	}
	_, err := db.ExecContext(
		ctx,
		`INSERT INTO oracle_operation_logs (
			ts_utc, request_id, correlation_id, user_id, token_id, role,
			action_type, resource_type, resource_id, method, path,
			status_code, result, latency_ms, error_code
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		entry.TSUTC,
		entry.RequestID,
		entry.CorrelationID,
		entry.UserID,
		entry.TokenID,
		entry.Role,
		entry.ActionType,
		entry.ResourceType,
		entry.ResourceID,
		entry.Method,
		entry.Path,
		entry.StatusCode,
		entry.Result,
		entry.LatencyMS,
		entry.ErrorCode,
	)
	return err
}

type oracleOperationLogRow struct {
	ID            int64  `json:"id"`
	TSUTC         int64  `json:"tsUtc"`
	RequestID     string `json:"requestId"`
	CorrelationID string `json:"correlationId"`
	UserID        string `json:"userId"`
	TokenID       string `json:"tokenId"`
	Role          string `json:"role"`
	ActionType    string `json:"actionType"`
	ResourceType  string `json:"resourceType"`
	ResourceID    string `json:"resourceId"`
	Method        string `json:"method"`
	Path          string `json:"path"`
	StatusCode    int64  `json:"statusCode"`
	Result        string `json:"result"`
	LatencyMS     int64  `json:"latencyMs"`
	ErrorCode     string `json:"errorCode"`
}

func OracleOperationLogsListHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		limit, err := queryIntParam(r, "limit", 200, 1, 2000)
		if err != nil {
			http.Error(w, "invalid limit", http.StatusBadRequest)
			return
		}
		offset, err := queryIntParam(r, "offset", 0, 0, 1_000_000)
		if err != nil {
			http.Error(w, "invalid offset", http.StatusBadRequest)
			return
		}

		rows, err := db.QueryContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`SELECT
				id, ts_utc, request_id, correlation_id, user_id, token_id, role,
				action_type, resource_type, resource_id, method, path,
				status_code, result, latency_ms, error_code
			 FROM oracle_operation_logs
			 ORDER BY ts_utc DESC, id DESC
			 LIMIT ? OFFSET ?`,
			limit,
			offset,
		)
		if err != nil {
			http.Error(w, "failed to load oracle logs", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		out := make([]oracleOperationLogRow, 0, limit)
		for rows.Next() {
			var row oracleOperationLogRow
			if err := rows.Scan(
				&row.ID,
				&row.TSUTC,
				&row.RequestID,
				&row.CorrelationID,
				&row.UserID,
				&row.TokenID,
				&row.Role,
				&row.ActionType,
				&row.ResourceType,
				&row.ResourceID,
				&row.Method,
				&row.Path,
				&row.StatusCode,
				&row.Result,
				&row.LatencyMS,
				&row.ErrorCode,
			); err != nil {
				http.Error(w, "failed to parse oracle logs", http.StatusInternalServerError)
				return
			}
			out = append(out, row)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "failed to parse oracle logs", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":     true,
			"limit":  limit,
			"offset": offset,
			"logs":   out,
		})
	}
}

func OracleOperationLogsDeleteOlderHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Days   int  `json:"days"`
			DryRun bool `json:"dryRun"`
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Days < 1 || req.Days > 36500 {
			http.Error(w, "days must be between 1 and 36500", http.StatusBadRequest)
			return
		}

		cutoffMs := time.Now().Add(-time.Duration(req.Days) * 24 * time.Hour).UnixMilli()
		var count int64
		if err := db.QueryRowContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`SELECT COUNT(*) FROM oracle_operation_logs WHERE ts_utc < ?`,
			cutoffMs,
		).Scan(&count); err != nil {
			http.Error(w, "failed to count oracle logs", http.StatusInternalServerError)
			return
		}

		if req.DryRun {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":          true,
				"dryRun":      true,
				"days":        req.Days,
				"cutoffTsMs":  cutoffMs,
				"wouldDelete": count,
			})
			return
		}

		res, err := db.ExecContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`DELETE FROM oracle_operation_logs WHERE ts_utc < ?`,
			cutoffMs,
		)
		if err != nil {
			http.Error(w, "failed to delete oracle logs", http.StatusInternalServerError)
			return
		}
		deleted, _ := res.RowsAffected()

		_ = AppendAuditLog(
			r.Context(),
			db,
			"oracle_logs_delete_older",
			"oracle_operation_logs",
			strconv.Itoa(req.Days)+"_days",
			"ok",
			map[string]any{
				"days":       req.Days,
				"cutoffTsMs": cutoffMs,
				"deleted":    deleted,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":         true,
			"dryRun":     false,
			"days":       req.Days,
			"cutoffTsMs": cutoffMs,
			"deleted":    deleted,
		})
	}
}

func OracleOperationLogsClearAllHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Confirm string `json:"confirm"`
			DryRun  bool   `json:"dryRun"`
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.Confirm) != "CLEAR_ALL_LOGS" {
			http.Error(w, "confirm must be CLEAR_ALL_LOGS", http.StatusBadRequest)
			return
		}

		var count int64
		if err := db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM oracle_operation_logs`).Scan(&count); err != nil { // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			http.Error(w, "failed to count oracle logs", http.StatusInternalServerError)
			return
		}

		if req.DryRun {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":          true,
				"dryRun":      true,
				"wouldDelete": count,
			})
			return
		}

		res, err := db.ExecContext(r.Context(), `DELETE FROM oracle_operation_logs`) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
		if err != nil {
			http.Error(w, "failed to clear oracle logs", http.StatusInternalServerError)
			return
		}
		deleted, _ := res.RowsAffected()

		_ = AppendAuditLog(
			r.Context(),
			db,
			"oracle_logs_clear_all",
			"oracle_operation_logs",
			"all",
			"ok",
			map[string]any{
				"deleted": deleted,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"dryRun":  false,
			"deleted": deleted,
		})
	}
}

func queryIntParam(r *http.Request, name string, def int64, min int64, max int64) (int64, error) {
	raw := strings.TrimSpace(r.URL.Query().Get(name))
	if raw == "" {
		return def, nil
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, err
	}
	if v < min || v > max {
		return 0, errors.New("out of range")
	}
	return v, nil
}
