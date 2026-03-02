package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"
)

var manualSheetsFlushGate = make(chan struct{}, 1)

type sheetsFlushRunSummary struct {
	ID           int64
	FlushedAtUTC int64
	ArchivedDay  string
	Status       string
	SheetID      string
	APIURL       string
	ErrorMessage string
}

func tryAcquireManualSheetsFlush() bool {
	select {
	case manualSheetsFlushGate <- struct{}{}:
		return true
	default:
		return false
	}
}

func releaseManualSheetsFlush() {
	select {
	case <-manualSheetsFlushGate:
	default:
	}
}

func latestSheetsFlushRunID(ctx context.Context, sqlDB *sql.DB) (int64, error) {
	if sqlDB == nil {
		return 0, errors.New("database not available")
	}
	var id int64
	err := sqlDB.QueryRowContext(
		ctx,
		`SELECT id FROM sheets_flush_runs ORDER BY id DESC LIMIT 1`,
	).Scan(&id) // #nosec G701 -- static SQL with no dynamic fragments.
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return id, err
}

func latestSheetsFlushRunAfterID(ctx context.Context, sqlDB *sql.DB, minID int64) (sheetsFlushRunSummary, error) {
	var run sheetsFlushRunSummary
	if sqlDB == nil {
		return run, errors.New("database not available")
	}
	var (
		archivedDay sql.NullString
		status      sql.NullString
		sheetID     sql.NullString
		apiURL      sql.NullString
		errMsg      sql.NullString
	)
	err := sqlDB.QueryRowContext(
		ctx,
		`SELECT
			id,
			flushed_at_utc,
			archived_day,
			status,
			sheet_id,
			api_url,
			error_message
		FROM sheets_flush_runs
		WHERE id > ?
		ORDER BY id DESC
		LIMIT 1`,
		minID,
	).Scan(
		&run.ID,
		&run.FlushedAtUTC,
		&archivedDay,
		&status,
		&sheetID,
		&apiURL,
		&errMsg,
	) // #nosec G701 -- static SQL with bound parameters only.
	if err != nil {
		return run, err
	}
	run.ArchivedDay = strings.TrimSpace(archivedDay.String)
	run.Status = strings.TrimSpace(status.String)
	run.SheetID = strings.TrimSpace(sheetID.String)
	run.APIURL = strings.TrimSpace(apiURL.String)
	run.ErrorMessage = strings.TrimSpace(errMsg.String)
	return run, nil
}

func ManualSheetsFlushHandler(sqlDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")

		sheetsID := resolveSheetsIDFromEnv()
		if sheetsID == "" {
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":      false,
				"error":   "sheets_not_configured",
				"message": "SHEETS_ID is not configured on the server",
			})
			return
		}
		if !tryAcquireManualSheetsFlush() {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":      false,
				"error":   "flush_in_progress",
				"message": "A Google Sheets flush is already running",
			})
			return
		}
		defer releaseManualSheetsFlush()

		credsPath := getenv("GOOGLE_CREDS_PATH", "/run/secrets/google-credentials.json")
		kumaPushURL := os.Getenv("KUMA_PUSH_URL")
		archiverSecret := os.Getenv("ARCHIVER_SHARED_SECRET")
		archiverAPI := resolveArchiverAPIURL(os.Getenv("ARCHIVER_API_URL"), getenv("ADDR", ":8080"))

		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		beforeID, err := latestSheetsFlushRunID(ctx, sqlDB)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":      false,
				"error":   "read_flush_state_failed",
				"message": "Failed to read current sheets flush state",
			})
			return
		}

		startedAtUTC := time.Now().UnixMilli()
		runArchiver(sheetsID, credsPath, kumaPushURL, archiverSecret, archiverAPI)

		afterCtx, afterCancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer afterCancel()
		run, err := latestSheetsFlushRunAfterID(afterCtx, sqlDB, beforeID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"ok":      false,
					"error":   "flush_result_missing",
					"message": "Flush run finished but no run record was written",
				})
				return
			}
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":      false,
				"error":   "flush_result_read_failed",
				"message": "Flush run finished but could not read result",
			})
			return
		}

		ok := strings.EqualFold(run.Status, "ok")
		if !ok {
			w.WriteHeader(http.StatusBadGateway)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          ok,
			"triggeredAt": startedAtUTC,
			"flushRun": map[string]any{
				"id":           run.ID,
				"status":       run.Status,
				"flushedAtUtc": run.FlushedAtUTC,
				"archivedDay":  run.ArchivedDay,
				"sheetId":      run.SheetID,
				"apiUrl":       run.APIURL,
				"error":        run.ErrorMessage,
			},
		})
	}
}
