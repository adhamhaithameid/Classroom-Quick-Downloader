// oracle-backend/cmd/app/main.go
package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	iofs "io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/handlers"
	"oracle-backend/internal/observability"
	"oracle-backend/internal/relay"
)

var appMetrics = observability.NewRegistry()

const defaultMaxHeaderBytes = 1 << 20

var weakSecretValues = map[string]struct{}{
	"change-me-in-production": {},
	"changeme":                {},
	"change-me":               {},
	"default":                 {},
	"password":                {},
	"secret":                  {},
	"admin":                   {},
}

func isWeakSecretValue(secret string) bool {
	normalized := strings.ToLower(strings.TrimSpace(secret))
	if normalized == "" {
		return false
	}
	_, weak := weakSecretValues[normalized]
	return weak
}

func validateAuditCheckpointSecret(secret string) error {
	trimmed := strings.TrimSpace(secret)
	if trimmed == "" {
		return errors.New("ORACLE_AUDIT_CHECKPOINT_SECRET is required for audit anchoring")
	}
	if isWeakSecretValue(trimmed) {
		return errors.New("ORACLE_AUDIT_CHECKPOINT_SECRET is set to a weak placeholder value")
	}
	return nil
}

func validateProductionSecurityConfig(
	appEnv string,
	allowLoopbackBypass bool,
	allowEmptyDashboardPassword bool,
	allowHTTPStoreURLs bool,
	allowUntrustedStoreURLs bool,
	trustedProxyNets []*net.IPNet,
) error {
	normalizedEnv := strings.ToLower(strings.TrimSpace(appEnv))
	if normalizedEnv != "production" && normalizedEnv != "prod" {
		return nil
	}

	if allowLoopbackBypass {
		return errors.New("ALLOW_LOOPBACK_BYPASS must be false in production")
	}
	if allowEmptyDashboardPassword {
		return errors.New("ALLOW_EMPTY_DASHBOARD_PASSWORD must be false in production")
	}
	if allowHTTPStoreURLs {
		return errors.New("ORACLE_ALLOW_HTTP_STORE_URLS must be false in production")
	}
	if allowUntrustedStoreURLs {
		return errors.New("ORACLE_ALLOW_UNTRUSTED_STORE_URLS must be false in production")
	}
	for _, network := range trustedProxyNets {
		if network == nil {
			continue
		}
		ones, bits := network.Mask.Size()
		if ones == 0 && bits > 0 {
			return errors.New("TRUSTED_PROXY_CIDRS cannot contain wildcard (0.0.0.0/0 or ::/0) in production")
		}
	}

	return nil
}

func main() {
	addr := getenv("ADDR", ":8080")
	dbPath := getenv("DB_PATH", "./data/analytics.db")
	staticDir := getenv("STATIC_DIR", "./static")
	doSecret := os.Getenv("DO_SHARED_SECRET")
	dashboardPassword := os.Getenv("DASHBOARD_PASSWORD")
	superAdminPassword := os.Getenv("SUPER_ADMIN_PASSWORD")
	archiverSecret := os.Getenv("ARCHIVER_SHARED_SECRET")
	auditCheckpointSecret := os.Getenv("ORACLE_AUDIT_CHECKPOINT_SECRET")
	allowLoopbackBypass := os.Getenv("ALLOW_LOOPBACK_BYPASS") == "true"
	allowEmptyDashboardPassword := os.Getenv("ALLOW_EMPTY_DASHBOARD_PASSWORD") == "true"
	trustedProxyNets = parseTrustedProxyCIDRs(os.Getenv("TRUSTED_PROXY_CIDRS"))
	sessionCookieSecureMode = normalizeSessionCookieSecureMode(os.Getenv("SESSION_COOKIE_SECURE"))
	csrfAllowedOrigins = loadCSRFAllowedOrigins(os.Getenv("CSRF_ALLOWED_ORIGINS"), os.Getenv("PUBLIC_BASE_URL"))

	if err := validateProductionSecurityConfig(
		os.Getenv("APP_ENV"),
		allowLoopbackBypass,
		allowEmptyDashboardPassword,
		os.Getenv("ORACLE_ALLOW_HTTP_STORE_URLS") == "true",
		os.Getenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS") == "true",
		trustedProxyNets,
	); err != nil {
		log.Fatalf("[FATAL] %v", err)
	}

	if isWeakSecretValue(doSecret) {
		log.Fatal("[FATAL] DO_SHARED_SECRET is set to a weak placeholder value")
	}
	if isWeakSecretValue(dashboardPassword) {
		log.Fatal("[FATAL] DASHBOARD_PASSWORD is set to a weak placeholder value")
	}
	if isWeakSecretValue(superAdminPassword) {
		log.Fatal("[FATAL] SUPER_ADMIN_PASSWORD is set to a weak placeholder value")
	}
	if archiverSecret != "" && isWeakSecretValue(archiverSecret) {
		log.Fatal("[FATAL] ARCHIVER_SHARED_SECRET is set to a weak placeholder value")
	}
	if err := validateAuditCheckpointSecret(auditCheckpointSecret); err != nil {
		log.Fatalf("[FATAL] %v", err)
	}

	if doSecret == "" {
		log.Println("[WARN] DO_SHARED_SECRET is empty – /ingest-batch will reject requests")
	}
	if dashboardPassword == "" && !allowEmptyDashboardPassword {
		log.Fatal("[FATAL] DASHBOARD_PASSWORD is required for dashboard access")
	}
	if superAdminPassword == "" {
		log.Fatal("[FATAL] SUPER_ADMIN_PASSWORD is required for step-up protected operations")
	}
	if dashboardPassword == "" && allowEmptyDashboardPassword {
		log.Println("[WARN] ALLOW_EMPTY_DASHBOARD_PASSWORD is true – dashboard is PUBLIC (dev only)")
	} else {
		log.Println("[INFO] Dashboard authentication enabled")
	}
	if dashboardPassword != "" && archiverSecret == "" {
		log.Println("[WARN] ARCHIVER_SHARED_SECRET is empty – archiver will fail when auth is enabled")
	}
	if allowLoopbackBypass {
		log.Println("[WARN] ALLOW_LOOPBACK_BYPASS is true – loopback requests can bypass auth (dev only)")
	}
	if sessionCookieSecureMode == "true" {
		log.Println("[INFO] SESSION_COOKIE_SECURE=true forcing Secure cookies")
	}
	log.Println("[INFO] HTTP deployments use non-secure cookies; prefer HTTPS in production")
	if len(trustedProxyNets) > 0 {
		log.Printf("[INFO] Trusted proxy CIDRs loaded: %d", len(trustedProxyNets))
	}
	if len(csrfAllowedOrigins) > 0 {
		log.Printf("[INFO] CSRF allowed origins loaded: %d", len(csrfAllowedOrigins))
	}
	handlers.SetAuditCheckpointSecret(auditCheckpointSecret)

	// Ensure data directory exists.
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o750); err != nil {
		log.Fatalf("failed to create data dir: %v", err)
	}

	sqlDB, err := db.Init(dbPath)
	if err != nil {
		log.Fatalf("failed to init db: %v", err)
	}
	defer sqlDB.Close()
	readOnlySQLDB, roErr := db.InitReadOnly(dbPath)
	if roErr != nil {
		log.Printf("[WARN] failed to init read-only sqlite handle: %v", roErr)
	} else {
		defer readOnlySQLDB.Close()
	}

	postgresDSN := os.Getenv("POSTGRES_DSN")
	var postgresDB *sql.DB
	var postgresMigrationErr string
	if postgresDSN != "" {
		pgDB, pgErr := db.InitPostgres(postgresDSN)
		if pgErr != nil {
			postgresMigrationErr = pgErr.Error()
			log.Printf("[WARN] failed to init postgres: %v", pgErr)
		} else {
			postgresDB = pgDB
			defer postgresDB.Close()
			log.Printf("[INFO] postgres initialized for projection relay")
		}
	}
	storageWatermarks := handlers.NormalizeStorageWatermarks(handlers.StorageWatermarks{
		Warn:      getenvFloat("STORAGE_WATERMARK_WARN", 70),
		Critical:  getenvFloat("STORAGE_WATERMARK_CRITICAL", 85),
		Emergency: getenvFloat("STORAGE_WATERMARK_EMERGENCY", 92),
	})
	storageGuard := handlers.NewStorageGuard(dbPath, storageWatermarks)

	mux := http.NewServeMux()

	// Health endpoints.
	mux.HandleFunc("/health", handlers.APIHealthHandler)
	mux.HandleFunc("/health/api", handlers.APIHealthHandler)
	mux.HandleFunc("/health/ready", handlers.ReadyHandler(sqlDB, postgresDB, storageGuard, postgresDSN != "", &postgresMigrationErr))

	// Updated: Use the local HealthDBHandler for granular SQLite monitoring
	mux.HandleFunc("/health/db", HealthDBHandler(sqlDB))

	// Ingest endpoint (aggregated batches from DO).
	ingestHandler := handlers.IngestBatchHandlerV4(sqlDB, postgresDB, doSecret)
	ingestHandler = handlers.IngestBackpressureMiddleware(ingestHandler, sqlDB, storageGuard).ServeHTTP
	mux.HandleFunc("/ingest-batch", ingestHandler)
	// Backwards-compatible alias, if you ever used /storeBatch naming.
	mux.HandleFunc("/storeBatch", ingestHandler)

	// Public website endpoints (unauthenticated, sanitized, CORS restricted).
	mux.Handle("/api/public/website/overview", handlers.PublicWebsiteOverviewHandler(sqlDB, postgresDB))
	mux.Handle("/api/public/website/map", handlers.PublicWebsiteMapHandler(sqlDB))
	mux.Handle("/api/public/website/status", handlers.PublicWebsiteStatusHandler(sqlDB))
	mux.Handle("/api/public/website/changelog", handlers.PublicWebsiteUserChangelogHandler(sqlDB, postgresDB))
	mux.Handle("/api/public/website/privacy", handlers.PublicWebsiteUserPrivacyHandler(sqlDB, postgresDB))
	mux.Handle("/api/public/website/uninstall", handlers.PublicWebsiteUninstallHandler(sqlDB))

	// Analytics API endpoints (protected by auth when DASHBOARD_PASSWORD is set).
	setAuthStateDB(sqlDB)
	authMiddleware := requireAuth(sqlDB, dashboardPassword, archiverSecret, allowLoopbackBypass)
	criticalMiddleware := requireStepUp(sqlDB, superAdminPassword)
	allowedRecordTypes := map[string]struct{}{
		"deployment_target":            {},
		"deployment_update_sentence":   {},
		"extension_version_note":       {},
		"creative_design":              {},
		"creative_email_template":      {},
		"newsletter_subscriber":        {},
		"newsletter_campaign":          {},
		"website_user_changelog_entry": {},
		"website_user_privacy_section": {},
	}
	mux.Handle("/api/stats/summary", authMiddleware(handlers.SummaryHandler(sqlDB)))
	mux.Handle("/api/stats/timeseries", authMiddleware(handlers.TimeSeriesHandler(sqlDB)))
	mux.Handle("/api/stats/breakdown", authMiddleware(handlers.BreakdownHandler(sqlDB)))
	mux.Handle("/api/stats/comparison", authMiddleware(handlers.ComparisonHandler(sqlDB)))
	mux.Handle("/api/stats/export", authMiddleware(handlers.ExportHandler(sqlDB)))
	mux.Handle("/api/deploy-status", authMiddleware(handlers.DeployStatusHandler()))
	mux.Handle("/api/pipeline/metrics", authMiddleware(handlers.PipelineMetricsHandler(sqlDB)))
	mux.Handle("/api/pipeline/failures", authMiddleware(handlers.PipelineFailuresHandler(sqlDB)))
	mux.Handle("/api/admin/flags", authMiddleware(handlers.FeatureFlagsHandler(sqlDB)))
	mux.Handle("/api/admin/flags/update", authMiddleware(criticalMiddleware(handlers.UpdateFeatureFlagHandler(sqlDB))))
	mux.Handle("/api/admin/outbox/status", authMiddleware(handlers.OutboxStatusHandler(sqlDB, postgresDB, appMetrics)))
	mux.Handle("/api/admin/outbox/retry", authMiddleware(criticalMiddleware(handlers.RetryOutboxHandler(sqlDB, postgresDB, appMetrics))))
	mux.Handle("/api/admin/outbox/replay-dead-letter", authMiddleware(criticalMiddleware(handlers.ReplayDeadLetterHandler(sqlDB))))
	mux.Handle("/api/admin/audit/verify-chain", authMiddleware(handlers.AuditVerifyChainHandler(sqlDB)))
	mux.Handle("/api/admin/alerts", authMiddleware(handlers.AlertsHandler(sqlDB)))
	mux.Handle("/api/admin/migrations/status", authMiddleware(handlers.MigrationsStatusHandler(postgresDSN != "", &postgresMigrationErr)))
	mux.Handle("/api/admin/ha/status", authMiddleware(handlers.HARuntimeStatusHandler(sqlDB, postgresDB, storageGuard, postgresDSN != "", &postgresMigrationErr)))
	mux.Handle("/api/admin/storage/status", authMiddleware(handlers.StorageStatusHandler(sqlDB, storageGuard)))
	mux.Handle("/api/admin/dr/status", authMiddleware(handlers.DRStatusHandler(sqlDB, postgresDB)))
	mux.Handle("/api/admin/dr/drill", authMiddleware(criticalMiddleware(handlers.DRDrillHandler(sqlDB, postgresDB))))
	mux.Handle("/api/admin/retention/run", authMiddleware(criticalMiddleware(handlers.RetentionRunHandler(sqlDB, postgresDB))))
	mux.Handle("/api/admin/sql/query", authMiddleware(criticalMiddleware(handlers.SQLQueryHandler(sqlDB, readOnlySQLDB))))
	mux.Handle("/api/admin/sql/exec", authMiddleware(criticalMiddleware(handlers.SQLExecHandler(sqlDB))))
	mux.Handle("/api/admin/danger/clear-data", authMiddleware(criticalMiddleware(handlers.DangerClearDataHandler(sqlDB))))
	mux.Handle("/api/admin/backup/run", authMiddleware(criticalMiddleware(handlers.BackupRunHandler(sqlDB, appMetrics))))
	mux.Handle("/api/admin/records/list", authMiddleware(handlers.RecordsListHandlerV4(sqlDB, postgresDB, allowedRecordTypes)))
	mux.Handle("/api/admin/records/upsert", authMiddleware(criticalMiddleware(handlers.RecordsUpsertHandlerV4(sqlDB, postgresDB, allowedRecordTypes))))
	mux.Handle("/api/admin/records/delete", authMiddleware(criticalMiddleware(handlers.RecordsDeleteHandlerV4(sqlDB, postgresDB, allowedRecordTypes))))
	mux.Handle("/api/admin/creative/designs", authMiddleware(handlers.CreativeDesignsListHandler(sqlDB, postgresDB)))
	mux.Handle("/api/admin/creative/designs/upsert", authMiddleware(criticalMiddleware(handlers.CreativeDesignsUpsertHandler(sqlDB, postgresDB))))
	mux.Handle("/api/admin/creative/designs/delete", authMiddleware(criticalMiddleware(handlers.CreativeDesignsDeleteHandler(sqlDB, postgresDB))))
	mux.Handle("/api/admin/creative/emails", authMiddleware(handlers.CreativeEmailsListHandler(sqlDB, postgresDB)))
	mux.Handle("/api/admin/creative/emails/upsert", authMiddleware(criticalMiddleware(handlers.CreativeEmailsUpsertHandler(sqlDB, postgresDB))))
	mux.Handle("/api/admin/creative/emails/delete", authMiddleware(criticalMiddleware(handlers.CreativeEmailsDeleteHandler(sqlDB, postgresDB))))
	mux.Handle("/api/admin/newsletter/subscribers", authMiddleware(handlers.NewsletterSubscribersListHandler(sqlDB, postgresDB)))
	mux.Handle("/api/admin/newsletter/subscribers/upsert", authMiddleware(criticalMiddleware(handlers.NewsletterSubscribersUpsertHandler(sqlDB, postgresDB))))
	mux.Handle("/api/admin/newsletter/subscribers/delete", authMiddleware(criticalMiddleware(handlers.NewsletterSubscribersDeleteHandler(sqlDB, postgresDB))))
	mux.Handle("/api/admin/newsletter/campaigns", authMiddleware(handlers.NewsletterCampaignsListHandler(sqlDB, postgresDB)))
	mux.Handle("/api/admin/newsletter/campaigns/upsert", authMiddleware(criticalMiddleware(handlers.NewsletterCampaignsUpsertHandler(sqlDB, postgresDB))))
	mux.Handle("/api/admin/newsletter/campaigns/delete", authMiddleware(criticalMiddleware(handlers.NewsletterCampaignsDeleteHandler(sqlDB, postgresDB))))
	mux.Handle("/api/admin/deployments/targets", authMiddleware(handlers.DeploymentsTargetsHandler(sqlDB, postgresDB)))
	mux.Handle("/api/admin/deployments/sync", authMiddleware(handlers.DeploymentsSyncHandler(sqlDB, postgresDB, appMetrics)))
	mux.Handle("/api/admin/dashboard-links", authMiddleware(handlers.DashboardLinksHandler(
		getenv("CLOUDFLARE_DASHBOARD_URL", "https://cqd-analytics.adhamhaithameid.workers.dev/"),
		getenv("UPTIME_KUMA_URL", "http://129.151.233.229:3001/status/cqd"),
		getenv("GITHUB_REPO_URL", "https://github.com/adhamhaithameid/Classroom-Quick-Downloader"),
		getenv("GOOGLE_SHEETS_URL", "https://docs.google.com/spreadsheets/d/1ptzLKUVnAkyXnT635Zgb1C6Img9aeAZ1se3nRz_QZmI/edit?gid=0#gid=0"),
		getenv("FIGMA_DESIGN_URL", "https://www.figma.com/design/hQLRpncinKnJQRG1lhCdQG/Google-Classroom-Downloade-Icon?node-id=0-1&t=5Eimhfrvp8RwFC19-1"),
	)))
	mux.Handle("/api/admin/github/open-counts", authMiddleware(handlers.GitHubOpenCountsHandler(
		getenv("GITHUB_REPO_SLUG", "adhamhaithameid/Classroom-Quick-Downloader"),
		os.Getenv("GITHUB_API_TOKEN"),
		60*time.Second,
	)))
	mux.Handle("/api/admin/oracle-logs", authMiddleware(handlers.OracleOperationLogsListHandler(sqlDB)))
	mux.Handle("/api/admin/oracle-logs/delete-older", authMiddleware(criticalMiddleware(handlers.OracleOperationLogsDeleteOlderHandler(sqlDB))))
	mux.Handle("/api/admin/oracle-logs/clear-all", authMiddleware(criticalMiddleware(handlers.OracleOperationLogsClearAllHandler(sqlDB))))
	mux.Handle("/api/admin/sheets/last-flush", authMiddleware(handlers.SheetsLastFlushHandler(sqlDB)))
	mux.Handle("/metrics", authMiddleware(metricsHandler(appMetrics, sqlDB)))

	// Auth endpoints
	mux.HandleFunc("/api/auth/login", loginHandler(sqlDB, dashboardPassword))
	mux.HandleFunc("/api/auth/logout", logoutHandler(sqlDB))
	mux.HandleFunc("/api/auth/check", authCheckHandler(sqlDB, dashboardPassword))
	mux.Handle("/api/auth/stepup/start", authMiddleware(stepUpStartHandler(sqlDB)))
	mux.Handle("/api/auth/stepup/verify", authMiddleware(stepUpVerifyHandler(sqlDB, superAdminPassword)))
	mux.Handle("/api/auth/stepup/check", authMiddleware(stepUpCheckHandler(sqlDB)))

	// Serve static dashboard with SPA fallback.
	mux.Handle("/", spaHandler(staticDir))

	serverCtx, stopServerCtx := context.WithCancel(context.Background())
	defer stopServerCtx()
	// =========================================================================
	// SCHEDULED 12:15 AM GOOGLE SHEETS EXPORT
	// Runs daily at 00:15 to archive stats to Google Sheets
	// Configure via SHEETS_ID and GOOGLE_CREDS_PATH env vars
	// =========================================================================
	go scheduleSheetsArchiver()
	if postgresDB != nil {
		go relay.NewSQLiteToPostgresRelay(sqlDB, postgresDB, appMetrics).Start(context.Background())
	}
	if deploymentsAutoSyncEnabled() {
		interval := deploymentsAutoSyncInterval()
		log.Printf("[Scheduler] deployment auto-sync enabled (interval=%s)", interval)
		go handlers.StartDeploymentsAutoSyncLoop(serverCtx, sqlDB, postgresDB, appMetrics, interval)
	}
	go startInMemoryStoreCleanupLoop(serverCtx, 15*time.Minute)
	log.Println("[WARN] Session stores are in-memory. Sessions will NOT survive restarts and are NOT shared " +
		"across multiple replicas. For HA deployments, configure POSTGRES_DSN to enable persisted auth state, " +
		"or deploy behind a sticky-session load balancer.")

	rootHandler := observability.RequestContextMiddleware(mux)
	rootHandler = requestBodyLimitMiddleware(rootHandler)
	rootHandler = csrfHeaderMiddleware(rootHandler)
	rootHandler = securityHeadersMiddleware(rootHandler)

	server := &http.Server{
		Addr:              addr,
		Handler:           loggingMiddleware(sqlDB, rootHandler),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    defaultMaxHeaderBytes,
	}

	log.Printf("oracle-backend listening on %s (db: %s, static: %s)", addr, dbPath, staticDir)
	serverErr := make(chan error, 1)
	go func() {
		serverErr <- server.ListenAndServe()
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(quit)

	select {
	case sig := <-quit:
		log.Printf("shutdown signal received: %s", sig.String())
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("graceful shutdown failed: %v", err)
		}
		stopServerCtx()
		if err := <-serverErr; err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("server error during shutdown: %v", err)
		}
	case err := <-serverErr:
		stopServerCtx()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getenvWithAliases(keys ...string) string {
	for _, key := range keys {
		if v := strings.TrimSpace(os.Getenv(key)); v != "" {
			return v
		}
	}
	return ""
}

func getenvFloat(key string, def float64) float64 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	parsed, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return def
	}
	return parsed
}

const (
	defaultDeploymentsAutoSyncInterval = 15 * time.Minute
	minDeploymentsAutoSyncInterval     = 1 * time.Minute
	maxDeploymentsAutoSyncInterval     = 24 * time.Hour
)

func deploymentsAutoSyncEnabled() bool {
	raw := strings.ToLower(getenvWithAliases("ORACLE_DEPLOYMENTS_AUTO_SYNC_ENABLED", "DEPLOYMENTS_AUTO_SYNC_ENABLED"))
	switch raw {
	case "true", "1", "yes", "on":
		return true
	case "", "false", "0", "no", "off":
		return false
	default:
		log.Printf("[Scheduler] Invalid deployments auto-sync enabled value; defaulting to disabled")
		return false
	}
}

func deploymentsAutoSyncInterval() time.Duration {
	raw := getenvWithAliases("ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS", "DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS")
	if raw == "" {
		return defaultDeploymentsAutoSyncInterval
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		log.Printf("[Scheduler] Invalid ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS value; using default %s", defaultDeploymentsAutoSyncInterval)
		return defaultDeploymentsAutoSyncInterval
	}
	interval := time.Duration(seconds) * time.Second
	if interval < minDeploymentsAutoSyncInterval {
		log.Printf("[Scheduler] ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS below minimum; clamping to %s", minDeploymentsAutoSyncInterval)
		return minDeploymentsAutoSyncInterval
	}
	if interval > maxDeploymentsAutoSyncInterval {
		log.Printf("[Scheduler] ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS above maximum; clamping to %s", maxDeploymentsAutoSyncInterval)
		return maxDeploymentsAutoSyncInterval
	}
	return interval
}

// HealthDBHandler returns a handler that checks the database connection
// by executing a lightweight query.
func HealthDBHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if db == nil {
			http.Error(w, "Database Unhealthy", http.StatusServiceUnavailable)
			return
		}
		var one int
		// Execute a lightweight query to ensure the DB is not locked
		err := db.QueryRowContext(r.Context(), "SELECT 1").Scan(&one) // #nosec G701 -- constant health probe query with no user-controlled input.
		if err != nil {
			log.Printf("Health Check Failed: %v", err)
			http.Error(w, "Database Unhealthy", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		if r.Method == http.MethodHead {
			return
		}
		if _, err := w.Write([]byte("ok")); err != nil {
			log.Printf("failed to write health response: %v", err)
		}
	}
}

type statusWriter struct {
	http.ResponseWriter
	statusCode int
	userID     string
	tokenID    string
	role       string
}

func (w *statusWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) SetActorContext(userID, tokenID, role string) {
	w.userID = strings.TrimSpace(userID)
	w.tokenID = strings.TrimSpace(tokenID)
	w.role = strings.TrimSpace(role)
}

func setActorContextOnWriter(w http.ResponseWriter, userID, tokenID, role string) {
	if carrier, ok := w.(interface{ SetActorContext(string, string, string) }); ok {
		carrier.SetActorContext(userID, tokenID, role)
	}
}

func metricsHandler(reg *observability.Registry, sqliteDB *sql.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		var b strings.Builder
		b.WriteString(reg.RenderPrometheus())
		if sqliteDB != nil {
			var schemaPathCount int64
			if err := sqliteDB.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM cf_schema_registry`).Scan(&schemaPathCount); err == nil { // #nosec G701 -- SQL text is constant and has no untrusted interpolation.
				b.WriteString("oracle_schema_drift_paths_total ")
				b.WriteString(strconv.FormatInt(schemaPathCount, 10))
				b.WriteByte('\n')
			}
		}
		_, _ = w.Write([]byte(b.String()))
	})
}

func actionTypeFromRequest(r *http.Request) string {
	if r == nil {
		return "unknown"
	}
	path := r.URL.Path
	switch {
	case strings.HasPrefix(path, "/api/auth/"):
		return "auth"
	case strings.HasPrefix(path, "/api/admin/"):
		return "admin"
	case strings.HasPrefix(path, "/api/stats/"):
		return "stats"
	case strings.HasPrefix(path, "/ingest-batch"):
		return "ingest"
	case strings.HasPrefix(path, "/metrics"):
		return "metrics"
	default:
		return "request"
	}
}

func resourceTypeFromRequest(r *http.Request) string {
	if r == nil {
		return "unknown"
	}
	path := strings.Trim(r.URL.Path, "/")
	if path == "" {
		return "root"
	}
	parts := strings.Split(path, "/")
	if len(parts) >= 3 && parts[0] == "api" {
		return parts[2]
	}
	return parts[0]
}

func resourceIDFromRequest(r *http.Request) string {
	if r == nil {
		return "-"
	}
	if id := strings.TrimSpace(r.URL.Query().Get("id")); id != "" {
		return id
	}
	return "-"
}

// loggingMiddleware emits structured request logs with correlation context.
func loggingMiddleware(db *sql.DB, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(sw, r)

		duration := time.Since(start)
		statusClass := "ok"
		if sw.statusCode >= 400 {
			statusClass = "error"
		}
		requestID := observability.RequestIDFromContext(r.Context())
		correlationID := observability.CorrelationIDFromContext(r.Context())
		if requestID == "unknown" {
			requestID = strings.TrimSpace(sw.Header().Get("X-Request-ID"))
			if requestID == "" {
				requestID = "unknown"
			}
		}
		if correlationID == "unknown" {
			correlationID = strings.TrimSpace(sw.Header().Get("X-Correlation-ID"))
			if correlationID == "" {
				correlationID = "unknown"
			}
		}
		errorCode := ""
		if sw.statusCode >= 400 {
			errorCode = "http_" + strconv.Itoa(sw.statusCode)
		}
		userID := observability.UserIDFromContext(r.Context())
		tokenID := observability.TokenIDFromContext(r.Context())
		role := observability.RoleFromContext(r.Context())
		if userID == "anonymous" && strings.TrimSpace(sw.userID) != "" {
			userID = sw.userID
		}
		if tokenID == "none" && strings.TrimSpace(sw.tokenID) != "" {
			tokenID = sw.tokenID
		}
		if role == "viewer" && strings.TrimSpace(sw.role) != "" {
			role = sw.role
		}
		payload := map[string]interface{}{
			"level":          "info",
			"message":        "http_request",
			"time":           time.Now().UTC().Format(time.RFC3339),
			"request_id":     requestID,
			"correlation_id": correlationID,
			"user_id":        userID,
			"token_id":       tokenID,
			"role":           role,
			"action_type":    actionTypeFromRequest(r),
			"resource_type":  resourceTypeFromRequest(r),
			"resource_id":    resourceIDFromRequest(r),
			"method":         r.Method,
			"path":           r.URL.Path,
			"status_code":    sw.statusCode,
			"result":         statusClass,
			"latency_ms":     duration.Milliseconds(),
			"error_code":     errorCode,
		}
		encoded, err := json.Marshal(payload)
		if err != nil {
			log.Printf( // #nosec G706 -- method/path are sanitized with sanitizeLogValue before logging.
				"%s %s in %s (%d)",
				sanitizeLogValue(r.Method),
				sanitizeLogValue(r.URL.Path),
				duration,
				sw.statusCode,
			)
			return
		}
		log.Printf("%s", encoded)
		if db == nil || !isOracleOperationPath(r.URL.Path) {
			return
		}
		if err := handlers.InsertOracleOperationLog(
			r.Context(),
			db,
			handlers.OracleOperationLogEntry{
				TSUTC:         time.Now().UnixMilli(),
				RequestID:     requestID,
				CorrelationID: correlationID,
				UserID:        userID,
				TokenID:       tokenID,
				Role:          role,
				ActionType:    actionTypeFromRequest(r),
				ResourceType:  resourceTypeFromRequest(r),
				ResourceID:    resourceIDFromRequest(r),
				Method:        r.Method,
				Path:          r.URL.Path,
				StatusCode:    sw.statusCode,
				Result:        statusClass,
				LatencyMS:     duration.Milliseconds(),
				ErrorCode:     errorCode,
			},
		); err != nil {
			log.Printf("[WARN] failed to write oracle operation log: %v", err)
		}
	})
}

func isOracleOperationPath(requestPath string) bool {
	if requestPath == "" {
		return false
	}
	return strings.HasPrefix(requestPath, "/api/") ||
		strings.HasPrefix(requestPath, "/ingest-batch") ||
		strings.HasPrefix(requestPath, "/storeBatch")
}

// spaHandler serves static files with SPA fallback for client-side routing.
func spaHandler(staticDir string) http.Handler {
	fs := http.FileServer(http.Dir(staticDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Let API routes be handled by mux (defensive, since this handler is last)
		if strings.HasPrefix(r.URL.Path, "/api/") ||
			strings.HasPrefix(r.URL.Path, "/health") ||
			r.URL.Path == "/ingest-batch" ||
			r.URL.Path == "/storeBatch" {
			http.NotFound(w, r)
			return
		}
		for _, segment := range strings.Split(r.URL.Path, "/") {
			if segment == ".." {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
		}

		// PATH TRAVERSAL PROTECTION: Ensure cleaned path stays within staticDir
		// Clean URL path using path (always slash-separated), then make it relative.
		cleanPath := path.Clean("/" + r.URL.Path)
		relPath := strings.TrimPrefix(cleanPath, "/")
		absStaticDir, err := filepath.Abs(staticDir)
		if err != nil {
			http.Error(w, "Server error", http.StatusInternalServerError)
			return
		}
		fullPath := filepath.Join(absStaticDir, relPath)

		// Security check: resolved path must stay within staticDir
		rel, err := filepath.Rel(absStaticDir, fullPath)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		// If file exists, serve it
		// #nosec G703 -- fullPath is validated with filepath.Rel to remain under absStaticDir.
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			if relPath == "index.html" {
				serveIndexWithNonce(w, r, absStaticDir)
				return
			}
			fs.ServeHTTP(w, r)
			return
		}

		// Otherwise serve SPA entry (index.html)
		serveIndexWithNonce(w, r, absStaticDir)
	})
}

func serveIndexWithNonce(w http.ResponseWriter, r *http.Request, staticRoot string) {
	content, err := iofs.ReadFile(os.DirFS(staticRoot), "index.html")
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}
	nonce := cspNonceFromContext(r.Context())
	content = bytes.ReplaceAll(content, []byte("__CSP_NONCE__"), []byte(nonce))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content) // #nosec G705 -- content is trusted local template from static root with nonce substitution only.
}

// scheduleSheetsArchiver runs a scheduled task at 00:15 daily to export stats to Google Sheets.
// Configure with environment variables:
// - SHEETS_ID: Google Sheets spreadsheet ID
// - GOOGLE_CREDS_PATH: Path to service account JSON (default: /run/secrets/google-credentials.json)
// - KUMA_PUSH_URL: Optional Uptime Kuma push URL
func scheduleSheetsArchiver() {
	sheetsID := os.Getenv("SHEETS_ID")
	if sheetsID == "" {
		log.Println("[Scheduler] SHEETS_ID not set, skipping automated Sheets export")
		return
	}

	credsPath := getenv("GOOGLE_CREDS_PATH", "/run/secrets/google-credentials.json")
	kumaPushURL := os.Getenv("KUMA_PUSH_URL")
	archiverSecret := os.Getenv("ARCHIVER_SHARED_SECRET")
	archiverAPI := resolveArchiverAPIURL(os.Getenv("ARCHIVER_API_URL"), getenv("ADDR", ":8080"))

	log.Printf( // #nosec G706 -- sheet/creds are sanitized with sanitizeLogValue before logging.
		"[Scheduler] Sheets archiver enabled: sheet=%s, creds=%s, api=%s",
		sanitizeLogValue(sheetsID),
		sanitizeLogValue(credsPath),
		sanitizeLogValue(archiverAPI),
	)

	for {
		// Calculate time until next 00:15 UTC
		now := time.Now().UTC()
		next := time.Date(now.Year(), now.Month(), now.Day(), 0, 15, 0, 0, time.UTC)
		if now.After(next) {
			next = next.Add(24 * time.Hour)
		}
		sleepDuration := time.Until(next)

		log.Printf("[Scheduler] Next Sheets export at %s (in %s)", next.Format(time.RFC3339), sleepDuration.Round(time.Minute))
		time.Sleep(sleepDuration)

		// Run the archiver
		log.Println("[Scheduler] Running scheduled Sheets export...")
		runArchiver(sheetsID, credsPath, kumaPushURL, archiverSecret, archiverAPI)
	}
}

// runArchiver executes the archiver binary with the given parameters.
// This calls the archiver as a subprocess to maintain separation of concerns.
func runArchiver(sheetsID, credsPath, kumaPushURL, archiverSecret, apiURL string) {
	if strings.TrimSpace(apiURL) == "" {
		apiURL = "http://127.0.0.1:8080/api/stats/summary"
	}
	archivedDay := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")

	metaDir, err := os.MkdirTemp("", "oracle-archiver-meta-")
	if err != nil {
		log.Printf("[Scheduler] Failed to create metadata temp dir: %v", err)
		recordSheetsFlushRunResult(
			context.Background(),
			"error",
			sheetsID,
			apiURL,
			nil,
			nil,
			nil,
			archivedDay,
			err.Error(),
		)
		return
	}
	defer func() {
		_ = os.RemoveAll(metaDir)
	}()

	const metaFileName = "meta.json"
	metaFile := filepath.Join(metaDir, metaFileName)
	args := []string{
		"-sheet", sheetsID,
		"-creds", credsPath,
		"-api", apiURL,
		"-day", "yesterday",
		"-meta-out", metaFile,
	}
	if kumaPushURL != "" {
		args = append(args, "-kuma", kumaPushURL)
	}
	if archiverSecret != "" {
		args = append(args, "-secret", archiverSecret)
	}

	// Note: In production, the archiver binary should be at /app/archiver
	// For development, set ARCHIVER_PATH env var
	archiverPath, err := resolveArchiverPath(getenv("ARCHIVER_PATH", "/app/archiver"))
	if err != nil {
		log.Printf("[Scheduler] Invalid archiver path: %v", err)
		recordSheetsFlushRunResult(
			context.Background(),
			"error",
			sheetsID,
			apiURL,
			nil,
			nil,
			nil,
			archivedDay,
			err.Error(),
		)
		return
	}

	runTimeout := archiverRunTimeout()
	ctx, cancel := context.WithTimeout(context.Background(), runTimeout)
	defer cancel()

	// #nosec G204,G702 -- path is validated via resolveArchiverPath; args are fixed flags from trusted config.
	cmd := exec.CommandContext(ctx, archiverPath, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		recordSheetsFlushRunResult(
			context.Background(),
			"error",
			sheetsID,
			apiURL,
			nil,
			nil,
			nil,
			archivedDay,
			err.Error(),
		)
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			log.Printf("[Scheduler] Archiver timed out after %s", runTimeout)
			return
		}
		log.Printf("[Scheduler] Archiver failed: %v", err)
	} else {
		metaRaw, metaErr := readArchiverMetadataFile(metaDir, metaFileName)
		if metaErr != nil {
			log.Printf("[Scheduler] Failed to read archiver metadata: %v", metaErr)
		}
		archivedDay, rowJSON, summaryJSON := extractArchiverMetadata(metaRaw)
		if archivedDay == "" {
			archivedDay = time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
		}
		recordSheetsFlushRunResult(
			context.Background(),
			"ok",
			sheetsID,
			apiURL,
			rowJSON,
			summaryJSON,
			metaRaw,
			archivedDay,
			"",
		)
		log.Println("[Scheduler] Sheets export completed successfully")
	}
}

func readArchiverMetadataFile(rootDir, fileName string) ([]byte, error) {
	root, err := os.OpenRoot(rootDir)
	if err != nil {
		return nil, err
	}
	defer root.Close()

	metaFile, err := root.Open(fileName)
	if err != nil {
		return nil, err
	}
	defer metaFile.Close()

	return io.ReadAll(io.LimitReader(metaFile, maxArchiverMetaBytes))
}

func extractArchiverMetadata(metaRaw []byte) (string, []byte, []byte) {
	if len(metaRaw) == 0 {
		return "", nil, nil
	}
	var payload map[string]any
	if err := json.Unmarshal(metaRaw, &payload); err != nil {
		return "", nil, nil
	}
	var archivedDay string
	if v, ok := payload["archivedDay"].(string); ok {
		archivedDay = strings.TrimSpace(v)
	}
	var rowJSON []byte
	if v, ok := payload["row"]; ok {
		if b, err := json.Marshal(v); err == nil {
			rowJSON = b
		}
	}
	var summaryJSON []byte
	if v, ok := payload["summary"]; ok {
		if b, err := json.Marshal(v); err == nil {
			summaryJSON = b
		}
	}
	return archivedDay, rowJSON, summaryJSON
}

func recordSheetsFlushRunResult(
	ctx context.Context,
	status,
	sheetID,
	apiURL string,
	rowJSON,
	summaryJSON,
	metaJSON []byte,
	archivedDay,
	errorMessage string,
) {
	db := getAuthStateDB()
	if db == nil {
		return
	}
	recordCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := handlers.RecordSheetsFlushRun(recordCtx, db, handlers.SheetsFlushRunRecordInput{
		FlushedAtUTC: time.Now().UnixMilli(),
		ArchivedDay:  archivedDay,
		Status:       status,
		SheetID:      sheetID,
		APIURL:       apiURL,
		RowJSON:      rowJSON,
		SummaryJSON:  summaryJSON,
		MetaJSON:     metaJSON,
		ErrorMessage: errorMessage,
	}); err != nil {
		log.Printf("[Scheduler] Failed to persist sheets flush run: %v", err)
	}
}

const (
	defaultArchiverRunTimeout = 2 * time.Minute
	minArchiverRunTimeout     = 1 * time.Second
	maxArchiverRunTimeout     = 30 * time.Minute
	maxArchiverMetaBytes      = 1 << 20 // 1 MiB
)

func archiverRunTimeout() time.Duration {
	raw := strings.TrimSpace(os.Getenv("ARCHIVER_RUN_TIMEOUT_SECONDS"))
	if raw == "" {
		return defaultArchiverRunTimeout
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		log.Printf("[Scheduler] Invalid ARCHIVER_RUN_TIMEOUT_SECONDS value, using default %s", defaultArchiverRunTimeout)
		return defaultArchiverRunTimeout
	}

	timeout := time.Duration(seconds) * time.Second
	if timeout < minArchiverRunTimeout {
		log.Printf("[Scheduler] ARCHIVER_RUN_TIMEOUT_SECONDS below minimum, clamping to %s", minArchiverRunTimeout)
		return minArchiverRunTimeout
	}
	if timeout > maxArchiverRunTimeout {
		log.Printf("[Scheduler] ARCHIVER_RUN_TIMEOUT_SECONDS above maximum, clamping to %s", maxArchiverRunTimeout)
		return maxArchiverRunTimeout
	}
	return timeout
}

func resolveArchiverAPIURL(configuredURL, listenAddr string) string {
	const defaultURL = "http://127.0.0.1:8080/api/stats/summary"

	rawURL := strings.TrimSpace(configuredURL)
	if rawURL != "" {
		parsed, err := url.Parse(rawURL)
		if err == nil {
			scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
			if scheme != "" && parsed.Host != "" && (scheme == "http" || scheme == "https") {
				if parsed.Path == "" || parsed.Path == "/" {
					parsed.Path = "/api/stats/summary"
				}
				return parsed.String()
			}
		}
		log.Printf("[Scheduler] Invalid ARCHIVER_API_URL value, falling back to auto URL")
	}

	host := strings.TrimSpace(listenAddr)
	if host == "" {
		return defaultURL
	}
	if strings.HasPrefix(host, ":") {
		host = "127.0.0.1" + host
	}
	if strings.HasPrefix(host, "0.0.0.0:") {
		host = "127.0.0.1:" + strings.TrimPrefix(host, "0.0.0.0:")
	}
	if strings.HasPrefix(host, "[::]:") {
		host = "127.0.0.1:" + strings.TrimPrefix(host, "[::]:")
	}
	if _, _, err := net.SplitHostPort(host); err != nil {
		return defaultURL
	}

	return (&url.URL{
		Scheme: "http",
		Host:   host,
		Path:   "/api/stats/summary",
	}).String()
}

func sanitizeLogValue(v string) string {
	sanitized := strings.ReplaceAll(v, "\n", "_")
	return strings.ReplaceAll(sanitized, "\r", "_")
}

func resolveArchiverPath(configuredPath string) (string, error) {
	p := strings.TrimSpace(configuredPath)
	if p == "" {
		return "", errors.New("empty path")
	}

	absPath, err := filepath.Abs(p)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(absPath)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return "", errors.New("path points to directory")
	}
	if info.Mode()&0o111 == 0 {
		return "", errors.New("binary is not executable")
	}

	return absPath, nil
}
