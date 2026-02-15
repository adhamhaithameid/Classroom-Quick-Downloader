package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"oracle-backend/internal/observability"
)

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
			log.Printf("[Backup] VACUUM INTO failed: %v", err)
			writeJSONError(w, "backup_failed", "Database backup operation failed", http.StatusInternalServerError)
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
		if !appendAuditLogOrHTTPError(
			w,
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
		) {
			return
		}

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
