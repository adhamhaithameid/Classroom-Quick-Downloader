package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	defaultStorageSampleInterval  = 10 * time.Second
	defaultRetentionFailureDays   = 30
	defaultRetentionOutboxDays    = 30
	defaultRetentionLogsDays      = 90
	defaultRetentionBackupDays    = 180
	defaultRetentionStorageDays   = 90
	defaultRetentionAuthStaleDays = 7
	defaultDRPromotionLagSeconds  = 300
	defaultBackpressureRetrySec   = 30
)

type StorageWatermarks struct {
	Warn      float64 `json:"warn"`
	Critical  float64 `json:"critical"`
	Emergency float64 `json:"emergency"`
}

type StorageTableGrowth struct {
	Table    string `json:"table"`
	RowCount int64  `json:"rowCount"`
}

type StorageStatus struct {
	CapturedAt         int64                `json:"capturedAt"`
	DBPath             string               `json:"dbPath"`
	DiskTotalBytes     int64                `json:"diskTotalBytes"`
	DiskAvailableBytes int64                `json:"diskAvailableBytes"`
	DiskUsedPercent    float64              `json:"diskUsedPercent"`
	SQLiteDBSizeBytes  int64                `json:"sqliteDbSizeBytes"`
	Severity           string               `json:"severity"`
	Backpressure       bool                 `json:"backpressure"`
	Watermarks         StorageWatermarks    `json:"watermarks"`
	TopGrowthTables    []StorageTableGrowth `json:"topGrowthTables"`
}

type StorageGuard struct {
	dbPath      string
	watermarks  StorageWatermarks
	sampleEvery time.Duration
	mu          sync.Mutex
	cached      StorageStatus
	cachedErr   error
	cachedAt    time.Time
}

func NormalizeStorageWatermarks(input StorageWatermarks) StorageWatermarks {
	w := input
	if w.Warn <= 0 || w.Warn >= 100 {
		w.Warn = 70
	}
	if w.Critical <= 0 || w.Critical >= 100 {
		w.Critical = 85
	}
	if w.Emergency <= 0 || w.Emergency >= 100 {
		w.Emergency = 92
	}
	if w.Warn > w.Critical {
		w.Warn = w.Critical - 1
	}
	if w.Critical > w.Emergency {
		w.Critical = w.Emergency - 1
	}
	if w.Warn < 1 {
		w.Warn = 1
	}
	if w.Critical <= w.Warn {
		w.Critical = w.Warn + 1
	}
	if w.Emergency <= w.Critical {
		w.Emergency = w.Critical + 1
	}
	if w.Emergency > 99.9 {
		w.Emergency = 99.9
	}
	return w
}

func NewStorageGuard(dbPath string, watermarks StorageWatermarks) *StorageGuard {
	if strings.TrimSpace(dbPath) == "" {
		dbPath = "./data/analytics.db"
	}
	return &StorageGuard{
		dbPath:      dbPath,
		watermarks:  NormalizeStorageWatermarks(watermarks),
		sampleEvery: defaultStorageSampleInterval,
	}
}

func (g *StorageGuard) Snapshot(ctx context.Context, sqliteDB *sql.DB) (StorageStatus, error) {
	if g == nil {
		return StorageStatus{}, errors.New("storage guard is not configured")
	}
	g.mu.Lock()
	defer g.mu.Unlock()

	if !g.cachedAt.IsZero() && time.Since(g.cachedAt) < g.sampleEvery {
		return g.cached, g.cachedErr
	}

	status, err := collectStorageStatus(g.dbPath, g.watermarks, sqliteDB)
	if err == nil && sqliteDB != nil {
		_ = persistStorageStatusSample(ctx, sqliteDB, status)
		_ = upsertStoragePressureAlert(ctx, sqliteDB, status)
	}
	g.cached = status
	g.cachedErr = err
	g.cachedAt = time.Now()
	return status, err
}

func collectStorageStatus(dbPath string, watermarks StorageWatermarks, sqliteDB *sql.DB) (StorageStatus, error) {
	absPath, err := filepath.Abs(dbPath)
	if err != nil {
		return StorageStatus{}, err
	}
	dir := filepath.Dir(absPath)

	var fs syscall.Statfs_t
	if err := syscall.Statfs(dir, &fs); err != nil {
		return StorageStatus{}, err
	}

	total := uint64(fs.Blocks) * uint64(fs.Bsize)
	available := uint64(fs.Bavail) * uint64(fs.Bsize)
	used := uint64(0)
	if total > available {
		used = total - available
	}

	usedPercent := float64(0)
	if total > 0 {
		usedPercent = (float64(used) / float64(total)) * 100
	}

	dbSizeBytes := int64(0)
	if info, statErr := os.Stat(absPath); statErr == nil && !info.IsDir() { // #nosec G703 -- absPath is canonicalized by filepath.Abs from operator-controlled DB_PATH.
		dbSizeBytes = info.Size()
	}

	status := StorageStatus{
		CapturedAt:         time.Now().UnixMilli(),
		DBPath:             absPath,
		DiskTotalBytes:     safeUint64ToInt64(total),
		DiskAvailableBytes: safeUint64ToInt64(available),
		DiskUsedPercent:    usedPercent,
		SQLiteDBSizeBytes:  dbSizeBytes,
		Severity:           storageSeverity(usedPercent, watermarks),
		Backpressure:       usedPercent >= watermarks.Emergency,
		Watermarks:         watermarks,
	}

	if sqliteDB != nil {
		status.TopGrowthTables = queryTopGrowthTables(context.Background(), sqliteDB)
	}
	return status, nil
}

func safeUint64ToInt64(v uint64) int64 {
	if v > math.MaxInt64 {
		return math.MaxInt64
	}
	return int64(v)
}

func storageSeverity(usedPercent float64, watermarks StorageWatermarks) string {
	if usedPercent >= watermarks.Emergency {
		return "emergency"
	}
	if usedPercent >= watermarks.Critical {
		return "critical"
	}
	if usedPercent >= watermarks.Warn {
		return "warn"
	}
	return "healthy"
}

func queryTopGrowthTables(ctx context.Context, sqliteDB *sql.DB) []StorageTableGrowth {
	tables := []string{
		"cf_snapshots_raw",
		"downloads_hourly",
		"oracle_operation_logs",
		"pipeline_failure_logs",
		"ingest_outbox",
		"outbox_dead_letter",
		"admin_audit_log",
	}
	out := make([]StorageTableGrowth, 0, len(tables))
	for _, table := range tables {
		count := int64(0)
		q := fmt.Sprintf("SELECT COUNT(*) FROM %s", table) // #nosec G201 -- table is from a fixed internal allowlist.
		if err := sqliteDB.QueryRowContext(ctx, q).Scan(&count); err != nil {
			continue
		}
		out = append(out, StorageTableGrowth{Table: table, RowCount: count})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].RowCount > out[j].RowCount })
	if len(out) > 5 {
		out = out[:5]
	}
	return out
}

func persistStorageStatusSample(ctx context.Context, db *sql.DB, status StorageStatus) error {
	_, err := db.ExecContext(
		ctx,
		`INSERT INTO storage_status_samples (captured_at, disk_used_percent, disk_total_bytes, disk_available_bytes, sqlite_db_size_bytes, severity)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		status.CapturedAt,
		status.DiskUsedPercent,
		status.DiskTotalBytes,
		status.DiskAvailableBytes,
		status.SQLiteDBSizeBytes,
		status.Severity,
	)
	return err
}

func upsertStoragePressureAlert(ctx context.Context, db *sql.DB, status StorageStatus) error {
	severity := status.Severity
	if severity == "healthy" {
		return nil
	}
	alertSeverity := "warning"
	if severity == "critical" {
		alertSeverity = "critical"
	}
	if severity == "emergency" {
		alertSeverity = "critical"
	}
	msg := fmt.Sprintf("host disk usage is %.2f%% (%s)", status.DiskUsedPercent, severity)
	return upsertOpenAlert(
		ctx,
		db,
		"disk_pressure",
		alertSeverity,
		msg,
		map[string]any{
			"severity":           severity,
			"diskUsedPercent":    status.DiskUsedPercent,
			"diskTotalBytes":     status.DiskTotalBytes,
			"diskAvailableBytes": status.DiskAvailableBytes,
		},
	)
}

func IngestBackpressureMiddleware(next http.Handler, sqliteDB *sql.DB, guard *StorageGuard) http.Handler {
	if next == nil || guard == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			next.ServeHTTP(w, r)
			return
		}
		status, err := guard.Snapshot(r.Context(), sqliteDB)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}
		if status.Backpressure {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", strconv.Itoa(defaultBackpressureRetrySec))
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":          false,
				"error":       "storage_backpressure",
				"retryAfter":  defaultBackpressureRetrySec,
				"diskUsedPct": status.DiskUsedPercent,
				"severity":    status.Severity,
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func ReadyHandler(sqliteDB, postgresDB *sql.DB, guard *StorageGuard, postgresConfigured bool, postgresLastErr *string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		reasons := make([]string, 0, 8)
		ready := true

		if sqliteDB == nil {
			ready = false
			reasons = append(reasons, "sqlite_not_configured")
		} else if err := sqliteDB.PingContext(r.Context()); err != nil {
			ready = false
			reasons = append(reasons, "sqlite_unreachable")
		}

		if sqliteDB != nil {
			if _, err := querySQLiteOutboxBacklog(r.Context(), sqliteDB); err != nil {
				ready = false
				reasons = append(reasons, "sqlite_outbox_unhealthy")
			}
		}

		if postgresConfigured {
			if postgresLastErr != nil && strings.TrimSpace(*postgresLastErr) != "" {
				ready = false
				reasons = append(reasons, "postgres_migration_error")
			}
			if postgresDB == nil {
				ready = false
				reasons = append(reasons, "postgres_not_initialized")
			} else {
				if err := postgresDB.PingContext(r.Context()); err != nil {
					ready = false
					reasons = append(reasons, "postgres_unreachable")
				}
				if _, err := queryPostgresOutboxBacklog(r.Context(), postgresDB); err != nil {
					ready = false
					reasons = append(reasons, "postgres_outbox_unhealthy")
				}
			}
		}

		if guard != nil && sqliteDB != nil {
			status, err := guard.Snapshot(r.Context(), sqliteDB)
			if err != nil {
				ready = false
				reasons = append(reasons, "storage_status_failed")
			} else if status.Backpressure {
				ready = false
				reasons = append(reasons, "storage_emergency_backpressure")
			}
		}

		payload := map[string]any{
			"ok":      ready,
			"reasons": reasons,
		}

		w.Header().Set("Content-Type", "application/json")
		if !ready {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		_ = json.NewEncoder(w).Encode(payload)
	}
}

func StorageStatusHandler(sqliteDB *sql.DB, guard *StorageGuard) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if guard == nil {
			http.Error(w, "storage guard is not configured", http.StatusServiceUnavailable)
			return
		}
		status, err := guard.Snapshot(r.Context(), sqliteDB)
		if err != nil {
			http.Error(w, "failed to collect storage status", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"storage": status,
		})
	}
}

func HARuntimeStatusHandler(sqliteDB, postgresDB *sql.DB, guard *StorageGuard, postgresConfigured bool, postgresLastErr *string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		flags := map[string]bool{}
		if sqliteDB != nil {
			for _, flag := range []string{
				"feature_postgres_primary_ingest",
				"feature_postgres_primary_control_plane",
				"feature_sqlite_fallback_readonly",
				"feature_sync_enabled",
			} {
				enabled, err := IsFeatureEnabled(r.Context(), sqliteDB, flag)
				if err == nil {
					flags[flag] = enabled
				}
			}
		}

		writeMode := "sqlite_primary"
		if flags["feature_postgres_primary_ingest"] || flags["feature_postgres_primary_control_plane"] {
			writeMode = "postgres_primary"
		}

		sqliteBacklog, sqliteBacklogErr := querySQLiteOutboxBacklog(r.Context(), sqliteDB)
		postgresBacklog, postgresBacklogErr := queryPostgresOutboxBacklog(r.Context(), postgresDB)

		storagePayload := map[string]any{"configured": guard != nil}
		if guard != nil && sqliteDB != nil {
			if storageStatus, err := guard.Snapshot(r.Context(), sqliteDB); err == nil {
				storagePayload = map[string]any{
					"configured": true,
					"status":     storageStatus,
				}
			}
		}

		backupPayload := map[string]any{}
		if sqliteDB != nil {
			var backupPath, backupStatus string
			var startedAt, finishedAt int64
			err := sqliteDB.QueryRowContext( // #nosec G701 -- SQL text is constant and uses no untrusted interpolation.
				r.Context(),
				`SELECT backup_path, status, started_at, finished_at FROM backup_runs ORDER BY id DESC LIMIT 1`,
			).Scan(&backupPath, &backupStatus, &startedAt, &finishedAt)
			if err == nil {
				backupPayload = map[string]any{
					"path":       backupPath,
					"status":     backupStatus,
					"startedAt":  startedAt,
					"finishedAt": finishedAt,
				}
			}
		}

		postgresStatus := map[string]any{
			"configured": postgresConfigured,
			"reachable":  postgresBacklogErr == nil,
			"outboxBacklog": map[string]any{
				"value": postgresBacklog,
				"error": errorString(postgresBacklogErr),
			},
		}
		if postgresLastErr != nil && strings.TrimSpace(*postgresLastErr) != "" {
			postgresStatus["migrationError"] = strings.TrimSpace(*postgresLastErr)
		}

		payload := map[string]any{
			"ok":        true,
			"writeMode": writeMode,
			"flags":     flags,
			"sqlite": map[string]any{
				"configured": sqliteDB != nil,
				"reachable":  sqliteBacklogErr == nil,
				"outboxBacklog": map[string]any{
					"value": sqliteBacklog,
					"error": errorString(sqliteBacklogErr),
				},
			},
			"postgres": postgresStatus,
			"storage":  storagePayload,
			"backup":   backupPayload,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(payload)
	}
}

func DRStatusHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		primaryRegion := getenvWithDefault("ORACLE_PRIMARY_REGION", "primary")
		drRegion := getenvWithDefault("ORACLE_DR_REGION", "warm-dr")
		lagSeconds := getenvIntWithDefault("ORACLE_DR_REPLICA_LAG_SECONDS", -1)
		maxLag := getenvIntWithDefault("ORACLE_DR_PROMOTION_MAX_LAG_SECONDS", defaultDRPromotionLagSeconds)

		lastDrill, err := loadLatestDRDrill(r.Context(), sqliteDB, postgresDB)
		if err != nil {
			http.Error(w, "failed to load dr status", http.StatusInternalServerError)
			return
		}

		promotionEligible := lagSeconds >= 0 && lagSeconds <= maxLag
		if lastDrill != nil && strings.ToLower(lastDrill.Status) == "failed" {
			promotionEligible = false
		}

		payload := map[string]any{
			"ok": true,
			"primary": map[string]any{
				"region": primaryRegion,
			},
			"dr": map[string]any{
				"region":                 drRegion,
				"replicationLagSeconds":  lagSeconds,
				"promotionMaxLagSeconds": maxLag,
				"promotionEligible":      promotionEligible,
			},
			"lastDrill": lastDrill,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(payload)
	}
}

type drDrillRecord struct {
	DrillID      string          `json:"drillId"`
	TargetRegion string          `json:"targetRegion"`
	Status       string          `json:"status"`
	Result       json.RawMessage `json:"result"`
	StartedAt    int64           `json:"startedAt"`
	FinishedAt   int64           `json:"finishedAt"`
}

func DRDrillHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			DryRun           bool   `json:"dryRun"`
			TargetRegion     string `json:"targetRegion"`
			SimulatedOutcome string `json:"simulatedOutcome"`
			Notes            string `json:"notes"`
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		targetRegion := strings.TrimSpace(req.TargetRegion)
		if targetRegion == "" {
			targetRegion = getenvWithDefault("ORACLE_DR_REGION", "warm-dr")
		}

		status := "passed"
		if req.DryRun {
			status = "dry_run"
		}
		if outcome := strings.ToLower(strings.TrimSpace(req.SimulatedOutcome)); outcome == "failed" {
			status = "failed"
		}

		startedAt := time.Now().UnixMilli()
		finishedAt := startedAt
		resultPayload, _ := json.Marshal(map[string]any{
			"dryRun": req.DryRun,
			"notes":  strings.TrimSpace(req.Notes),
			"steps": []string{
				"validate replica lag",
				"validate app readiness in DR",
				"simulate promote and route cutover",
				"validate API + dashboard health",
			},
		})

		drillID := "drill-" + randomHex(8)
		record := drDrillRecord{
			DrillID:      drillID,
			TargetRegion: targetRegion,
			Status:       status,
			Result:       resultPayload,
			StartedAt:    startedAt,
			FinishedAt:   finishedAt,
		}
		if err := persistDRDrill(r.Context(), sqliteDB, postgresDB, record); err != nil {
			http.Error(w, "failed to persist dr drill", http.StatusInternalServerError)
			return
		}

		if sqliteDB != nil {
			_ = AppendAuditLog(
				r.Context(),
				sqliteDB,
				"dr_drill",
				"disaster_recovery",
				drillID,
				"ok",
				map[string]any{"targetRegion": targetRegion, "status": status, "dryRun": req.DryRun},
			)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"drillId": drillID,
			"status":  status,
			"dryRun":  req.DryRun,
		})
	}
}

func RetentionRunHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			DryRun   bool     `json:"dryRun"`
			Policies []string `json:"policies"`
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		selected := make(map[string]struct{}, len(req.Policies))
		for _, p := range req.Policies {
			p = strings.TrimSpace(strings.ToLower(p))
			if p == "" {
				continue
			}
			selected[p] = struct{}{}
		}
		isSelected := func(name string) bool {
			if len(selected) == 0 {
				return true
			}
			_, ok := selected[name]
			return ok
		}

		nowMs := time.Now().UnixMilli()
		actions := make([]map[string]any, 0, 12)

		runSQLite := func(name, countStmt, deleteStmt string, cutoff int64) error {
			if sqliteDB == nil {
				return nil
			}
			var count int64
			if err := sqliteDB.QueryRowContext(r.Context(), countStmt, cutoff).Scan(&count); err != nil { // #nosec G701 -- countStmt is selected from fixed internal constants.
				return err
			}
			removed := count
			if !req.DryRun {
				res, err := sqliteDB.ExecContext(r.Context(), deleteStmt, cutoff) // #nosec G701 -- deleteStmt is selected from fixed internal constants.
				if err != nil {
					return err
				}
				removed, _ = res.RowsAffected()
			}
			actions = append(actions, map[string]any{"name": name, "db": "sqlite", "count": count, "removed": removed, "cutoff": cutoff})
			return nil
		}

		runPostgres := func(name, countStmt, deleteStmt string, cutoff int64) error {
			if postgresDB == nil {
				return nil
			}
			var count int64
			if err := postgresDB.QueryRowContext(r.Context(), countStmt, cutoff).Scan(&count); err != nil { // #nosec G701 -- countStmt is selected from fixed internal constants.
				return err
			}
			removed := count
			if !req.DryRun {
				res, err := postgresDB.ExecContext(r.Context(), deleteStmt, cutoff) // #nosec G701 -- deleteStmt is selected from fixed internal constants.
				if err != nil {
					return err
				}
				removed, _ = res.RowsAffected()
			}
			actions = append(actions, map[string]any{"name": name, "db": "postgres", "count": count, "removed": removed, "cutoff": cutoff})
			return nil
		}

		if isSelected("pipeline_failure_logs") {
			cutoff := time.Now().UTC().AddDate(0, 0, -getenvIntWithDefault("ORACLE_RETENTION_PIPELINE_FAILURE_DAYS", defaultRetentionFailureDays)).UnixMilli()
			if err := runSQLite("pipeline_failure_logs", `SELECT COUNT(*) FROM pipeline_failure_logs WHERE ts_utc < ?`, `DELETE FROM pipeline_failure_logs WHERE ts_utc < ?`, cutoff); err != nil {
				http.Error(w, "retention failed", http.StatusInternalServerError)
				return
			}
		}
		if isSelected("oracle_operation_logs") {
			cutoff := time.Now().UTC().AddDate(0, 0, -getenvIntWithDefault("ORACLE_RETENTION_OPERATION_LOGS_DAYS", defaultRetentionLogsDays)).UnixMilli()
			if err := runSQLite("oracle_operation_logs", `SELECT COUNT(*) FROM oracle_operation_logs WHERE ts_utc < ?`, `DELETE FROM oracle_operation_logs WHERE ts_utc < ?`, cutoff); err != nil {
				http.Error(w, "retention failed", http.StatusInternalServerError)
				return
			}
		}
		if isSelected("ingest_outbox_sent") {
			cutoff := time.Now().UTC().AddDate(0, 0, -getenvIntWithDefault("ORACLE_RETENTION_OUTBOX_SENT_DAYS", defaultRetentionOutboxDays)).UnixMilli()
			if err := runSQLite("ingest_outbox_sent", `SELECT COUNT(*) FROM ingest_outbox WHERE status = 'sent' AND created_at < ?`, `DELETE FROM ingest_outbox WHERE status = 'sent' AND created_at < ?`, cutoff); err != nil {
				http.Error(w, "retention failed", http.StatusInternalServerError)
				return
			}
		}
		if isSelected("outbox_dead_letter") {
			cutoff := time.Now().UTC().AddDate(0, 0, -getenvIntWithDefault("ORACLE_RETENTION_OUTBOX_DEAD_DAYS", defaultRetentionFailureDays)).UnixMilli()
			if err := runSQLite("outbox_dead_letter", `SELECT COUNT(*) FROM outbox_dead_letter WHERE failed_at < ?`, `DELETE FROM outbox_dead_letter WHERE failed_at < ?`, cutoff); err != nil {
				http.Error(w, "retention failed", http.StatusInternalServerError)
				return
			}
		}
		if isSelected("backup_runs") {
			cutoff := time.Now().UTC().AddDate(0, 0, -getenvIntWithDefault("ORACLE_RETENTION_BACKUP_RUNS_DAYS", defaultRetentionBackupDays)).UnixMilli()
			if err := runSQLite("backup_runs", `SELECT COUNT(*) FROM backup_runs WHERE finished_at < ?`, `DELETE FROM backup_runs WHERE finished_at < ?`, cutoff); err != nil {
				http.Error(w, "retention failed", http.StatusInternalServerError)
				return
			}
		}
		if isSelected("storage_status_samples") {
			cutoff := time.Now().UTC().AddDate(0, 0, -getenvIntWithDefault("ORACLE_RETENTION_STORAGE_SAMPLES_DAYS", defaultRetentionStorageDays)).UnixMilli()
			if err := runSQLite("storage_status_samples", `SELECT COUNT(*) FROM storage_status_samples WHERE captured_at < ?`, `DELETE FROM storage_status_samples WHERE captured_at < ?`, cutoff); err != nil {
				http.Error(w, "retention failed", http.StatusInternalServerError)
				return
			}
		}
		if isSelected("auth_sessions_expired") {
			cutoff := nowMs - int64(24*time.Hour/time.Millisecond)
			if err := runSQLite("auth_sessions_expired", `SELECT COUNT(*) FROM auth_sessions WHERE expires_at > 0 AND expires_at < ?`, `DELETE FROM auth_sessions WHERE expires_at > 0 AND expires_at < ?`, cutoff); err != nil {
				http.Error(w, "retention failed", http.StatusInternalServerError)
				return
			}
		}
		if isSelected("auth_stepup_challenges_expired") {
			if err := runSQLite("auth_stepup_challenges_expired", `SELECT COUNT(*) FROM auth_stepup_challenges WHERE expires_at < ?`, `DELETE FROM auth_stepup_challenges WHERE expires_at < ?`, nowMs); err != nil {
				http.Error(w, "retention failed", http.StatusInternalServerError)
				return
			}
		}
		if isSelected("auth_rate_limits_stale") {
			cutoff := time.Now().UTC().AddDate(0, 0, -getenvIntWithDefault("ORACLE_RETENTION_RATE_LIMIT_DAYS", defaultRetentionAuthStaleDays)).UnixMilli()
			if err := runSQLite("auth_rate_limits_stale", `SELECT COUNT(*) FROM auth_rate_limits WHERE updated_at < ?`, `DELETE FROM auth_rate_limits WHERE updated_at < ?`, cutoff); err != nil {
				http.Error(w, "retention failed", http.StatusInternalServerError)
				return
			}
		}
		if isSelected("pg_outbox_sent") {
			cutoff := time.Now().UTC().AddDate(0, 0, -getenvIntWithDefault("ORACLE_RETENTION_PG_OUTBOX_SENT_DAYS", defaultRetentionOutboxDays)).UnixMilli()
			if err := runPostgres("pg_outbox_sent", `SELECT COUNT(*) FROM pg_outbox WHERE status = 'sent' AND created_at < $1`, `DELETE FROM pg_outbox WHERE status = 'sent' AND created_at < $1`, cutoff); err != nil {
				http.Error(w, "retention failed", http.StatusInternalServerError)
				return
			}
		}

		if sqliteDB != nil {
			action := "retention_run"
			if req.DryRun {
				action = "retention_dry_run"
			}
			_ = AppendAuditLog(
				r.Context(),
				sqliteDB,
				action,
				"retention",
				"policy_set",
				"ok",
				map[string]any{"dryRun": req.DryRun, "actions": actions},
			)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"dryRun":  req.DryRun,
			"actions": actions,
		})
	}
}

func querySQLiteOutboxBacklog(ctx context.Context, sqliteDB *sql.DB) (int64, error) {
	if sqliteDB == nil {
		return 0, errors.New("sqlite not configured")
	}
	var backlog int64
	err := sqliteDB.QueryRowContext( // #nosec G701 -- SQL text is constant and uses no untrusted interpolation.
		ctx,
		`SELECT COUNT(*) FROM ingest_outbox WHERE status IN ('pending', 'retry', 'processing')`,
	).Scan(&backlog)
	return backlog, err
}

func queryPostgresOutboxBacklog(ctx context.Context, postgresDB *sql.DB) (int64, error) {
	if postgresDB == nil {
		return 0, errors.New("postgres not configured")
	}
	var backlog int64
	err := postgresDB.QueryRowContext( // #nosec G701 -- SQL text is constant and uses no untrusted interpolation.
		ctx,
		`SELECT COUNT(*) FROM pg_outbox WHERE status IN ('pending', 'retry', 'processing')`,
	).Scan(&backlog)
	return backlog, err
}

func loadLatestDRDrill(ctx context.Context, sqliteDB, postgresDB *sql.DB) (*drDrillRecord, error) {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	usePostgres := store.shouldUsePostgresPrimary(ctx)
	if usePostgres && postgresDB != nil {
		row := postgresDB.QueryRowContext( // #nosec G701 -- SQL text is constant and uses no untrusted interpolation.
			ctx,
			`SELECT drill_id, target_region, status, result_json::text, started_at, finished_at
			 FROM pg_dr_drills
			 ORDER BY started_at DESC
			 LIMIT 1`,
		)
		return scanDRDrillRow(row)
	}
	if sqliteDB == nil {
		return nil, nil
	}
	row := sqliteDB.QueryRowContext( // #nosec G701 -- SQL text is constant and uses no untrusted interpolation.
		ctx,
		`SELECT drill_id, target_region, status, result_json, started_at, finished_at
		 FROM dr_drills
		 ORDER BY started_at DESC
		 LIMIT 1`,
	)
	return scanDRDrillRow(row)
}

func scanDRDrillRow(row *sql.Row) (*drDrillRecord, error) {
	if row == nil {
		return nil, nil
	}
	var rec drDrillRecord
	var resultRaw string
	err := row.Scan(&rec.DrillID, &rec.TargetRegion, &rec.Status, &resultRaw, &rec.StartedAt, &rec.FinishedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(resultRaw) == "" {
		resultRaw = "{}"
	}
	rec.Result = json.RawMessage(resultRaw)
	return &rec, nil
}

func persistDRDrill(ctx context.Context, sqliteDB, postgresDB *sql.DB, rec drDrillRecord) error {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	usePostgres := store.shouldUsePostgresPrimary(ctx)
	if usePostgres && postgresDB != nil {
		_, err := postgresDB.ExecContext( // #nosec G701 -- SQL text is constant and values are bound parameters.
			ctx,
			`INSERT INTO pg_dr_drills (drill_id, target_region, status, result_json, started_at, finished_at)
			 VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
			rec.DrillID,
			rec.TargetRegion,
			rec.Status,
			string(rec.Result),
			rec.StartedAt,
			rec.FinishedAt,
		)
		return err
	}
	if sqliteDB == nil {
		return errors.New("sqlite is not configured")
	}
	_, err := sqliteDB.ExecContext( // #nosec G701 -- SQL text is constant and values are bound parameters.
		ctx,
		`INSERT INTO dr_drills (drill_id, target_region, status, result_json, started_at, finished_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		rec.DrillID,
		rec.TargetRegion,
		rec.Status,
		string(rec.Result),
		rec.StartedAt,
		rec.FinishedAt,
	)
	return err
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func randomHex(size int) string {
	if size <= 0 {
		size = 8
	}
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}

func getenvWithDefault(name, def string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return def
	}
	return value
}

func getenvIntWithDefault(name string, def int) int {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return def
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return def
	}
	return parsed
}
