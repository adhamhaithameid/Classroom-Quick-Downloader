package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type SheetsFlushRunRecordInput struct {
	FlushedAtUTC int64
	ArchivedDay  string
	Status       string
	SheetID      string
	APIURL       string
	RowJSON      []byte
	SummaryJSON  []byte
	MetaJSON     []byte
	ErrorMessage string
}

func RecordSheetsFlushRun(ctx context.Context, db *sql.DB, in SheetsFlushRunRecordInput) error {
	if db == nil {
		return nil
	}
	ts := in.FlushedAtUTC
	if ts <= 0 {
		ts = time.Now().UnixMilli()
	}
	status := strings.TrimSpace(strings.ToLower(in.Status))
	if status == "" {
		status = "unknown"
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO sheets_flush_runs (
			flushed_at_utc, archived_day, status, sheet_id, api_url,
			row_json, summary_json, meta_json, error_message, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		ts,
		nullableTrimmedString(in.ArchivedDay),
		status,
		nullableTrimmedString(in.SheetID),
		nullableTrimmedString(in.APIURL),
		nullableJSONBlob(in.RowJSON),
		nullableJSONBlob(in.SummaryJSON),
		nullableJSONBlob(in.MetaJSON),
		nullableTrimmedString(in.ErrorMessage),
		time.Now().UnixMilli(),
	) // #nosec G701 -- static SQL with bound parameters only.
	return err
}

func nullableTrimmedString(v string) any {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return v
}

func nullableJSONBlob(v []byte) any {
	if len(v) == 0 {
		return nil
	}
	s := strings.TrimSpace(string(v))
	if s == "" {
		return nil
	}
	return s
}

func SheetsLastFlushHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if db == nil {
			http.Error(w, "database not available", http.StatusServiceUnavailable)
			return
		}

		var (
			id           int64
			flushedAtUTC int64
			archivedDay  sql.NullString
			status       sql.NullString
			sheetID      sql.NullString
			apiURL       sql.NullString
			rowJSON      sql.NullString
			summaryJSON  sql.NullString
			metaJSON     sql.NullString
			errorMessage sql.NullString
			createdAt    int64
		)

		err := db.QueryRowContext(
			r.Context(),
			`SELECT
				id,
				flushed_at_utc,
				archived_day,
				status,
				sheet_id,
				api_url,
				row_json,
				summary_json,
				meta_json,
				error_message,
				created_at
			FROM sheets_flush_runs
			ORDER BY flushed_at_utc DESC, id DESC
			LIMIT 1`,
		).Scan(
			&id,
			&flushedAtUTC,
			&archivedDay,
			&status,
			&sheetID,
			&apiURL,
			&rowJSON,
			&summaryJSON,
			&metaJSON,
			&errorMessage,
			&createdAt,
		) // #nosec G701 -- static SQL with no dynamic fragments.

		if err != nil {
			if err == sql.ErrNoRows {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]any{
					"ok":     true,
					"exists": false,
					"run":    nil,
				})
				return
			}
			http.Error(w, "failed to load last sheets flush", http.StatusInternalServerError)
			return
		}

		run := map[string]any{
			"id":           id,
			"flushedAtUtc": flushedAtUTC,
			"archivedDay":  strings.TrimSpace(archivedDay.String),
			"status":       strings.TrimSpace(status.String),
			"sheetId":      strings.TrimSpace(sheetID.String),
			"apiUrl":       strings.TrimSpace(apiURL.String),
			"error":        strings.TrimSpace(errorMessage.String),
			"createdAt":    createdAt,
		}

		if parsed := decodeJSONToAny(rowJSON.String); parsed != nil {
			run["row"] = parsed
		}
		if parsed := decodeJSONToAny(summaryJSON.String); parsed != nil {
			run["summary"] = parsed
		}
		if parsed := decodeJSONToAny(metaJSON.String); parsed != nil {
			run["meta"] = parsed
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":     true,
			"exists": true,
			"run":    run,
		})
	}
}

func decodeJSONToAny(raw string) any {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var out any
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return nil
	}
	return out
}
