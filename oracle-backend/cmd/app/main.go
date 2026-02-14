// oracle-backend/cmd/app/main.go
package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	iofs "io/fs"
	"log"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/crypto/bcrypt"

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

func main() {
	addr := getenv("ADDR", ":8080")
	dbPath := getenv("DB_PATH", "./data/analytics.db")
	staticDir := getenv("STATIC_DIR", "./static")
	doSecret := os.Getenv("DO_SHARED_SECRET")
	dashboardPassword := os.Getenv("DASHBOARD_PASSWORD")
	superAdminPassword := os.Getenv("SUPER_ADMIN_PASSWORD")
	archiverSecret := os.Getenv("ARCHIVER_SHARED_SECRET")
	allowLoopbackBypass := os.Getenv("ALLOW_LOOPBACK_BYPASS") == "true"
	allowEmptyDashboardPassword := os.Getenv("ALLOW_EMPTY_DASHBOARD_PASSWORD") == "true"
	trustedProxyNets = parseTrustedProxyCIDRs(os.Getenv("TRUSTED_PROXY_CIDRS"))
	sessionCookieSecureMode = normalizeSessionCookieSecureMode(os.Getenv("SESSION_COOKIE_SECURE"))
	csrfAllowedOrigins = loadCSRFAllowedOrigins(os.Getenv("CSRF_ALLOWED_ORIGINS"), os.Getenv("PUBLIC_BASE_URL"))

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

	// Analytics API endpoints (protected by auth when DASHBOARD_PASSWORD is set).
	setAuthStateDB(sqlDB)
	authMiddleware := requireAuth(sqlDB, dashboardPassword, archiverSecret, allowLoopbackBypass)
	criticalMiddleware := requireStepUp(sqlDB, superAdminPassword)
	allowedRecordTypes := map[string]struct{}{
		"deployment_target":          {},
		"deployment_update_sentence": {},
		"extension_version_note":     {},
		"creative_design":            {},
		"creative_email_template":    {},
		"newsletter_subscriber":      {},
		"newsletter_campaign":        {},
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
	case "", "true", "1", "yes", "on":
		return true
	case "false", "0", "no", "off":
		return false
	default:
		log.Printf("[Scheduler] Invalid deployments auto-sync enabled value; defaulting to enabled")
		return true
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

const adminRequestBodyLimit = 1 << 20  // 1 MiB
const authRequestBodyLimit = 256 << 10 // 256 KiB

func requestBodyLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			switch {
			case strings.HasPrefix(r.URL.Path, "/api/admin/"):
				r.Body = http.MaxBytesReader(w, r.Body, adminRequestBodyLimit)
			case strings.HasPrefix(r.URL.Path, "/api/auth/"):
				r.Body = http.MaxBytesReader(w, r.Body, authRequestBodyLimit)
			}
		}
		next.ServeHTTP(w, r)
	})
}

func csrfHeaderMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			switch r.Method {
			case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
				if r.Header.Get("X-Requested-With") != "XMLHttpRequest" {
					http.Error(w, `{"error":"missing_csrf_header"}`, http.StatusBadRequest)
					return
				}
				origin := strings.TrimSpace(r.Header.Get("Origin"))
				if origin != "" {
					if !isAllowedCSRFOrigin(r, origin) {
						http.Error(w, `{"error":"invalid_origin"}`, http.StatusForbidden)
						return
					}
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}

func loadCSRFAllowedOrigins(rawList, publicBaseURL string) map[string]struct{} {
	origins := make(map[string]struct{})
	candidates := make([]string, 0, 8)
	if strings.TrimSpace(rawList) != "" {
		candidates = append(candidates, strings.Split(rawList, ",")...)
	}
	if strings.TrimSpace(publicBaseURL) != "" {
		candidates = append(candidates, publicBaseURL)
	}
	for _, candidate := range candidates {
		normalized, err := normalizeOriginValue(candidate)
		if err != nil {
			log.Printf("[WARN] ignoring invalid CSRF origin entry")
			continue
		}
		origins[normalized] = struct{}{}
	}
	if len(origins) == 0 {
		return nil
	}
	return origins
}

func isAllowedCSRFOrigin(r *http.Request, originValue string) bool {
	normalizedOrigin, err := normalizeOriginValue(originValue)
	if err != nil {
		return false
	}
	if len(csrfAllowedOrigins) > 0 {
		_, ok := csrfAllowedOrigins[normalizedOrigin]
		return ok
	}
	return normalizedOrigin == requestOriginForCSRF(r)
}

func requestOriginForCSRF(r *http.Request) string {
	if r == nil {
		return ""
	}
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if proto := trustedProxyProto(r); proto != "" {
		scheme = proto
	} else {
		// Fallback for TLS-terminating proxy deployments where TRUSTED_PROXY_CIDRS
		// is not explicitly configured. This preserves same-origin CSRF checks based
		// on forwarded protocol headers commonly set by reverse proxies.
		if proto := parseForwardedProtoHeaderValue(r.Header.Get("Forwarded")); proto != "" {
			scheme = proto
		} else if proto := parseXForwardedProtoHeaderValue(r.Header.Get("X-Forwarded-Proto")); proto != "" {
			scheme = proto
		}
	}
	host := strings.TrimSpace(r.Host)
	if host == "" {
		return ""
	}
	normalized, err := normalizeOriginValue(scheme + "://" + host)
	if err != nil {
		return ""
	}
	return normalized
}

func normalizeOriginValue(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("origin is empty")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "http" && scheme != "https" {
		return "", errors.New("origin scheme must be http or https")
	}
	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	if host == "" {
		return "", errors.New("origin host is required")
	}
	if strings.Contains(host, "%") {
		return "", errors.New("origin host must not contain zone identifiers")
	}
	port := strings.TrimSpace(parsed.Port())
	switch {
	case scheme == "http" && port == "80":
		port = ""
	case scheme == "https" && port == "443":
		port = ""
	}
	var hostPort string
	if port == "" {
		if strings.Contains(host, ":") {
			hostPort = "[" + host + "]"
		} else {
			hostPort = host
		}
	} else {
		if _, err := strconv.Atoi(port); err != nil {
			return "", errors.New("origin port must be numeric")
		}
		hostPort = net.JoinHostPort(host, port)
	}
	return scheme + "://" + hostPort, nil
}

func decodeJSONBodyStrict(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		if err == nil {
			return errors.New("request body must contain only one JSON object")
		}
		return err
	}
	return nil
}

type cspNonceContextKey struct{}

func generateCSPNonce() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return base64.RawStdEncoding.EncodeToString(b)
}

func cspNonceFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	nonce, _ := ctx.Value(cspNonceContextKey{}).(string)
	return strings.TrimSpace(nonce)
}

func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nonce := generateCSPNonce()
		scriptSrc := "script-src 'self'"
		styleSrc := "style-src 'self' https://fonts.googleapis.com"
		if nonce != "" {
			scriptSrc += " 'nonce-" + nonce + "'"
			styleSrc += " 'nonce-" + nonce + "'"
		}
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set(
			"Content-Security-Policy",
			"default-src 'self' https:; img-src 'self' data: https:; "+styleSrc+"; "+scriptSrc+"; frame-ancestors 'none'; base-uri 'self'",
		)
		if strings.HasPrefix(r.URL.Path, "/api/auth/") || strings.HasPrefix(r.URL.Path, "/api/admin/") || strings.HasPrefix(r.URL.Path, "/metrics") {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Pragma", "no-cache")
		}
		ctx := context.WithValue(r.Context(), cspNonceContextKey{}, nonce)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
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

// =============================================================================
// AUTHENTICATION SYSTEM
// =============================================================================

// sessionStore holds active session tokens. In production, consider Redis.
var sessionStore = struct {
	sync.RWMutex
	tokens map[string]time.Time // token -> expiry
}{tokens: make(map[string]time.Time)}

const sessionDuration = 24 * time.Hour
const sessionCookieName = "oracle_session"
const stepUpSessionDuration = 15 * time.Minute
const stepUpChallengeDuration = 5 * time.Minute
const stepUpSessionCookieName = "oracle_stepup"

type loginAttempt struct {
	attempts       int
	firstAttemptAt time.Time
	blockedUntil   time.Time
}

var loginRateStore = struct {
	sync.Mutex
	attempts map[string]*loginAttempt
}{attempts: make(map[string]*loginAttempt)}

const loginMaxAttempts = 5
const loginLockout = 15 * time.Minute

type stepUpChallenge struct {
	clientIP  string
	expiresAt time.Time
}

type stepUpSession struct {
	expiresAt          time.Time
	parentSessionToken string
}

type stepUpAttempt struct {
	attempts       int
	firstAttemptAt time.Time
	blockedUntil   time.Time
}

var stepUpChallengeStore = struct {
	sync.Mutex
	items map[string]stepUpChallenge
}{items: make(map[string]stepUpChallenge)}

var stepUpSessionStore = struct {
	sync.RWMutex
	tokens map[string]stepUpSession
}{tokens: make(map[string]stepUpSession)}

var stepUpRateStore = struct {
	sync.Mutex
	attempts map[string]*stepUpAttempt
}{attempts: make(map[string]*stepUpAttempt)}

const stepUpMaxAttempts = 8
const stepUpLockout = 10 * time.Minute
const stepUpAbuseThreshold = 5
const inMemoryCleanupHorizon = 24 * time.Hour

var trustedProxyNets []*net.IPNet
var sessionCookieSecureMode = "auto"
var csrfAllowedOrigins map[string]struct{}

var authStateStore = struct {
	sync.RWMutex
	db *sql.DB
}{}

const (
	authSessionKindViewer = "viewer"
	authSessionKindStepUp = "stepup"
	authRateScopeLogin    = "login"
	authRateScopeStepUp   = "stepup"
)

func setTrustedProxyNets(nets []*net.IPNet) {
	trustedProxyNets = nets
}

func setAuthStateDB(database *sql.DB) {
	authStateStore.Lock()
	authStateStore.db = database
	authStateStore.Unlock()
}

func getAuthStateDB() *sql.DB {
	authStateStore.RLock()
	defer authStateStore.RUnlock()
	return authStateStore.db
}

func startInMemoryStoreCleanupLoop(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 15 * time.Minute
	}
	cleanupExpiredInMemoryStores(time.Now())
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cleanupExpiredInMemoryStores(time.Now())
		}
	}
}

func cleanupExpiredInMemoryStores(now time.Time) {
	cleanupExpiredViewerSessions(now)
	cleanupExpiredStepUpChallenges(now)
	cleanupExpiredStepUpSessions(now)
	cleanupExpiredLoginRateEntries(now)
	cleanupExpiredStepUpRateEntries(now)
	cleanupPersistedAuthState(now)
}

func cleanupExpiredViewerSessions(now time.Time) {
	sessionStore.Lock()
	defer sessionStore.Unlock()
	for token, expiry := range sessionStore.tokens {
		if now.After(expiry) {
			delete(sessionStore.tokens, token)
		}
	}
}

func cleanupExpiredStepUpChallenges(now time.Time) {
	stepUpChallengeStore.Lock()
	defer stepUpChallengeStore.Unlock()
	cleanupExpiredStepUpChallengesLocked(now)
}

func cleanupExpiredStepUpSessions(now time.Time) {
	stepUpSessionStore.Lock()
	defer stepUpSessionStore.Unlock()
	for token, session := range stepUpSessionStore.tokens {
		if now.After(session.expiresAt) {
			delete(stepUpSessionStore.tokens, token)
		}
	}
}

func cleanupExpiredLoginRateEntries(now time.Time) {
	loginRateStore.Lock()
	defer loginRateStore.Unlock()
	for ip, rec := range loginRateStore.attempts {
		if rec == nil {
			delete(loginRateStore.attempts, ip)
			continue
		}
		if !rec.blockedUntil.IsZero() && now.Before(rec.blockedUntil) {
			continue
		}
		if now.Sub(rec.firstAttemptAt) > loginLockout+inMemoryCleanupHorizon {
			delete(loginRateStore.attempts, ip)
		}
	}
}

func cleanupExpiredStepUpRateEntries(now time.Time) {
	stepUpRateStore.Lock()
	defer stepUpRateStore.Unlock()
	for ip, rec := range stepUpRateStore.attempts {
		if rec == nil {
			delete(stepUpRateStore.attempts, ip)
			continue
		}
		if !rec.blockedUntil.IsZero() && now.Before(rec.blockedUntil) {
			continue
		}
		if now.Sub(rec.firstAttemptAt) > stepUpLockout+inMemoryCleanupHorizon {
			delete(stepUpRateStore.attempts, ip)
		}
	}
}

func cleanupPersistedAuthState(now time.Time) {
	database := getAuthStateDB()
	if database == nil {
		return
	}

	nowUnix := now.Unix()
	pruneBefore := now.Add(-(inMemoryCleanupHorizon + loginLockout)).Unix()
	if stepUpLockout > loginLockout {
		pruneBefore = now.Add(-(inMemoryCleanupHorizon + stepUpLockout)).Unix()
	}

	_, _ = database.Exec(
		`DELETE FROM auth_sessions WHERE expires_at <= ?`,
		nowUnix,
	)
	_, _ = database.Exec(
		`DELETE FROM auth_stepup_challenges WHERE expires_at <= ?`,
		nowUnix,
	)
	_, _ = database.Exec(
		`DELETE FROM auth_rate_limits
		  WHERE ((blocked_until > 0 AND blocked_until <= ?) OR first_attempt_at <= ?)`,
		nowUnix,
		pruneBefore,
	)
}

func parseTrustedProxyCIDRs(input string) []*net.IPNet {
	if input == "" {
		return nil
	}
	var nets []*net.IPNet
	for _, part := range strings.Split(input, ",") {
		entry := strings.TrimSpace(part)
		if entry == "" {
			continue
		}
		if strings.Contains(entry, "/") {
			_, network, err := net.ParseCIDR(entry)
			if err != nil {
				log.Printf("[WARN] invalid trusted proxy CIDR: %s", sanitizeLogValue(entry)) // #nosec G706 -- value is sanitized before logging.
				continue
			}
			nets = append(nets, network)
			continue
		}
		ip := net.ParseIP(entry)
		if ip == nil {
			log.Printf("[WARN] invalid trusted proxy IP: %s", sanitizeLogValue(entry)) // #nosec G706 -- value is sanitized before logging.
			continue
		}
		bits := 32
		if ip.To4() == nil {
			bits = 128
		}
		mask := net.CIDRMask(bits, bits)
		nets = append(nets, &net.IPNet{IP: ip, Mask: mask})
	}
	return nets
}

func normalizeSessionCookieSecureMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "true", "1", "yes", "always":
		return "true"
	case "false", "0", "no", "never":
		return "false"
	default:
		return "auto"
	}
}

func isTrustedProxy(remoteIP string) bool {
	if remoteIP == "" || len(trustedProxyNets) == 0 {
		return false
	}
	ip := net.ParseIP(remoteIP)
	if ip == nil {
		return false
	}
	for _, network := range trustedProxyNets {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

func extractRemoteIP(addr string) string {
	if addr == "" {
		return ""
	}
	host, _, err := net.SplitHostPort(addr)
	if err == nil && host != "" {
		return host
	}
	return addr
}

func persistAuthSession(token, kind, parentToken string, expiresAt time.Time) error {
	database := getAuthStateDB()
	if database == nil {
		return nil
	}
	nowUnix := time.Now().Unix()
	_, err := database.Exec(
		`INSERT INTO auth_sessions (token, session_kind, parent_token, expires_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(token) DO UPDATE SET
		   session_kind = excluded.session_kind,
		   parent_token = excluded.parent_token,
		   expires_at = excluded.expires_at,
		   updated_at = excluded.updated_at`,
		token,
		kind,
		parentToken,
		expiresAt.Unix(),
		nowUnix,
		nowUnix,
	)
	return err
}

func loadAuthSession(token, kind string) (time.Time, string, bool, error) {
	database := getAuthStateDB()
	if database == nil {
		return time.Time{}, "", false, nil
	}

	var expiresAtUnix int64
	var parent sql.NullString
	err := database.QueryRow(
		`SELECT expires_at, parent_token
		   FROM auth_sessions
		  WHERE token = ? AND session_kind = ?`,
		token,
		kind,
	).Scan(&expiresAtUnix, &parent)
	if errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, "", false, nil
	}
	if err != nil {
		return time.Time{}, "", false, err
	}
	return time.Unix(expiresAtUnix, 0), parent.String, true, nil
}

func deleteAuthSession(token string) {
	database := getAuthStateDB()
	if database == nil {
		return
	}
	_, _ = database.Exec(`DELETE FROM auth_sessions WHERE token = ?`, token)
}

func persistAuthRateAttempt(scope, ip string, attempts int, firstAttemptAt time.Time, blockedUntil time.Time) {
	database := getAuthStateDB()
	if database == nil {
		return
	}
	blockedUntilUnix := int64(0)
	if !blockedUntil.IsZero() {
		blockedUntilUnix = blockedUntil.Unix()
	}
	nowUnix := time.Now().Unix()
	_, _ = database.Exec(
		`INSERT INTO auth_rate_limits (scope, client_ip, attempts, first_attempt_at, blocked_until, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(scope, client_ip) DO UPDATE SET
		   attempts = excluded.attempts,
		   first_attempt_at = excluded.first_attempt_at,
		   blocked_until = excluded.blocked_until,
		   updated_at = excluded.updated_at`,
		scope,
		ip,
		attempts,
		firstAttemptAt.Unix(),
		blockedUntilUnix,
		nowUnix,
	)
}

func loadAuthRateAttempt(scope, ip string) (attempts int, firstAttemptAt time.Time, blockedUntil time.Time, ok bool) {
	database := getAuthStateDB()
	if database == nil {
		return 0, time.Time{}, time.Time{}, false
	}
	var firstAttemptUnix int64
	var blockedUntilUnix int64
	err := database.QueryRow(
		`SELECT attempts, first_attempt_at, blocked_until
		   FROM auth_rate_limits
		  WHERE scope = ? AND client_ip = ?`,
		scope,
		ip,
	).Scan(&attempts, &firstAttemptUnix, &blockedUntilUnix)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, time.Time{}, time.Time{}, false
	}
	if err != nil {
		return 0, time.Time{}, time.Time{}, false
	}
	firstAttemptAt = time.Unix(firstAttemptUnix, 0)
	if blockedUntilUnix > 0 {
		blockedUntil = time.Unix(blockedUntilUnix, 0)
	}
	return attempts, firstAttemptAt, blockedUntil, true
}

func deleteAuthRateAttempt(scope, ip string) {
	database := getAuthStateDB()
	if database == nil {
		return
	}
	_, _ = database.Exec(`DELETE FROM auth_rate_limits WHERE scope = ? AND client_ip = ?`, scope, ip)
}

func persistStepUpChallenge(challengeID, clientIP string, expiresAt time.Time) error {
	database := getAuthStateDB()
	if database == nil {
		return nil
	}
	nowUnix := time.Now().Unix()
	_, err := database.Exec(
		`INSERT INTO auth_stepup_challenges (challenge_id, client_ip, expires_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(challenge_id) DO UPDATE SET
		   client_ip = excluded.client_ip,
		   expires_at = excluded.expires_at,
		   updated_at = excluded.updated_at`,
		challengeID,
		clientIP,
		expiresAt.Unix(),
		nowUnix,
		nowUnix,
	)
	return err
}

func consumePersistedStepUpChallenge(challengeID, clientIP string) bool {
	database := getAuthStateDB()
	if database == nil {
		return false
	}
	nowUnix := time.Now().Unix()
	res, err := database.Exec(
		`DELETE FROM auth_stepup_challenges
		  WHERE challenge_id = ?
		    AND client_ip = ?
		    AND expires_at >= ?`,
		challengeID,
		clientIP,
		nowUnix,
	)
	if err != nil {
		return false
	}
	rows, err := res.RowsAffected()
	return err == nil && rows > 0
}

func deletePersistedStepUpChallenge(challengeID string) {
	database := getAuthStateDB()
	if database == nil {
		return
	}
	_, _ = database.Exec(`DELETE FROM auth_stepup_challenges WHERE challenge_id = ?`, challengeID)
}

// generateToken creates a cryptographically secure session token.
func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// hashPassword creates a bcrypt hash for password verification.
func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func mustHashPassword(password string) string {
	hashed, err := hashPassword(password)
	if err != nil {
		log.Fatalf("failed to hash password: %v", err)
	}
	return hashed
}

func verifyPasswordHash(hashedPassword, password string) bool {
	if strings.TrimSpace(hashedPassword) == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)) == nil
}

// requireAuth returns middleware that checks for valid session cookie.
// If dashboardPassword is empty, all requests are allowed (no auth).
func requireAuth(db *sql.DB, dashboardPassword, archiverSecret string, allowLoopbackBypass bool) func(http.Handler) http.Handler {
	archiverAllowedPaths := map[string]struct{}{
		"/api/stats/summary": {},
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// No auth required if DASHBOARD_PASSWORD is not set
			if dashboardPassword == "" {
				next.ServeHTTP(w, r)
				return
			}

			if allowLoopbackBypass && archiverSecret == "" && isLoopbackAddr(r.RemoteAddr) && isLoopbackHost(r.Host) && !hasForwardedIp(r) {
				ctx := observability.WithActorContext(r.Context(), "loopback-bypass", "loopback", "system")
				setActorContextOnWriter(w, "loopback-bypass", "loopback", "system")
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			if archiverSecret != "" {
				headerSecret := r.Header.Get("X-Archiver-Secret")
				_, pathAllowed := archiverAllowedPaths[r.URL.Path]
				if pathAllowed &&
					r.Method == http.MethodGet &&
					headerSecret != "" &&
					subtle.ConstantTimeCompare([]byte(headerSecret), []byte(archiverSecret)) == 1 {
					ctx := observability.WithActorContext(r.Context(), "archiver", "archiver-secret", "system")
					setActorContextOnWriter(w, "archiver", "archiver-secret", "system")
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}

			cookie, err := r.Cookie(sessionCookieName)
			if err != nil || !isValidSession(cookie.Value) {
				appMetrics.IncCounter("oracle_auth_failures_total", map[string]string{"reason": "session_invalid"}, 1)
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			tokenID := cookie.Value
			if len(tokenID) > 12 {
				tokenID = tokenID[:12]
			}
			ctx := observability.WithActorContext(r.Context(), "viewer", tokenID, "viewer")
			setActorContextOnWriter(w, "viewer", tokenID, "viewer")
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// requireStepUp enforces super-admin step-up for critical routes when enabled by feature flag.
func requireStepUp(db *sql.DB, superAdminPassword string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			enabled, err := handlers.IsFeatureEnabled(r.Context(), db, "feature_stepup_enforced")
			if err != nil {
				http.Error(w, `{"error":"stepup_flag_unavailable"}`, http.StatusInternalServerError)
				return
			}
			if !enabled {
				next.ServeHTTP(w, r)
				return
			}
			if superAdminPassword == "" {
				http.Error(w, `{"error":"stepup_misconfigured"}`, http.StatusInternalServerError)
				return
			}

			cookie, err := r.Cookie(stepUpSessionCookieName)
			parentSession := ""
			if mainCookie, mainErr := r.Cookie(sessionCookieName); mainErr == nil {
				parentSession = mainCookie.Value
			}
			if err != nil || !isValidStepUpSession(cookie.Value, parentSession) {
				appMetrics.IncCounter("oracle_auth_failures_total", map[string]string{"reason": "stepup_required"}, 1)
				http.Error(w, `{"error":"step_up_required"}`, http.StatusForbidden)
				return
			}

			tokenID := cookie.Value
			if len(tokenID) > 12 {
				tokenID = tokenID[:12]
			}
			ctx := observability.WithActorContext(r.Context(), "super-admin", tokenID, "super_admin")
			setActorContextOnWriter(w, "super-admin", tokenID, "super_admin")
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func stepUpStartHandler(db *sql.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		enabled, err := handlers.IsFeatureEnabled(r.Context(), db, "feature_stepup_enforced")
		if err != nil {
			http.Error(w, `{"error":"stepup_flag_unavailable"}`, http.StatusInternalServerError)
			return
		}
		if !enabled {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"ok":       true,
				"required": false,
			})
			return
		}

		challengeID, err := generateToken()
		if err != nil {
			http.Error(w, `{"error":"failed_to_create_challenge"}`, http.StatusInternalServerError)
			return
		}
		clientIP := getClientIP(r)

		now := time.Now()
		expiresAt := now.Add(stepUpChallengeDuration)
		if err := persistStepUpChallenge(challengeID, clientIP, expiresAt); err != nil {
			http.Error(w, `{"error":"failed_to_persist_challenge"}`, http.StatusInternalServerError)
			return
		}

		stepUpChallengeStore.Lock()
		cleanupExpiredStepUpChallengesLocked(now)
		stepUpChallengeStore.items[challengeID] = stepUpChallenge{
			clientIP:  clientIP,
			expiresAt: expiresAt,
		}
		stepUpChallengeStore.Unlock()

		appMetrics.IncCounter("oracle_stepup_start_total", nil, 1)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":           true,
			"required":     true,
			"challengeId":  challengeID,
			"expiresInSec": int(stepUpChallengeDuration.Seconds()),
		})
	})
}

func stepUpVerifyHandler(db *sql.DB, superAdminPassword string) http.Handler {
	storedHash := mustHashPassword(superAdminPassword)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		enabled, err := handlers.IsFeatureEnabled(r.Context(), db, "feature_stepup_enforced")
		if err != nil {
			http.Error(w, `{"error":"stepup_flag_unavailable"}`, http.StatusInternalServerError)
			return
		}
		if !enabled {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"ok":       true,
				"required": false,
			})
			return
		}

		clientIP := getClientIP(r)
		allowed, retryAfter := allowStepUpAttempt(clientIP)
		if !allowed {
			appMetrics.IncCounter("oracle_rate_limit_hits_total", map[string]string{"scope": "stepup"}, 1)
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			http.Error(w, `{"error":"too many attempts"}`, http.StatusTooManyRequests)
			return
		}

		var req struct {
			ChallengeID string `json:"challengeId"`
			Password    string `json:"password"` // #nosec G117 -- required request field for step-up verify API contract.
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.ChallengeID = strings.TrimSpace(req.ChallengeID)
		if req.ChallengeID == "" || strings.TrimSpace(req.Password) == "" {
			http.Error(w, `{"error":"challengeId and password are required"}`, http.StatusBadRequest)
			return
		}

		if !consumeStepUpChallenge(req.ChallengeID, clientIP) {
			appMetrics.IncCounter("oracle_stepup_verify_total", map[string]string{"result": "invalid_challenge"}, 1)
			http.Error(w, `{"error":"invalid_or_expired_challenge"}`, http.StatusUnauthorized)
			return
		}

		mainSessionCookie, mainSessionErr := r.Cookie(sessionCookieName)
		if mainSessionErr != nil || strings.TrimSpace(mainSessionCookie.Value) == "" {
			http.Error(w, `{"error":"missing_parent_session"}`, http.StatusUnauthorized)
			return
		}

		if !verifyPasswordHash(storedHash, req.Password) {
			appMetrics.IncCounter("oracle_stepup_verify_total", map[string]string{"result": "invalid_password"}, 1)
			appMetrics.IncCounter("oracle_auth_failures_total", map[string]string{"reason": "stepup_invalid_password"}, 1)
			blocked, retryAfter := recordStepUpFailure(db, clientIP)
			if blocked {
				appMetrics.IncCounter("oracle_rate_limit_hits_total", map[string]string{"scope": "stepup"}, 1)
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				http.Error(w, `{"error":"too many attempts"}`, http.StatusTooManyRequests)
				return
			}
			http.Error(w, `{"error":"invalid password"}`, http.StatusUnauthorized)
			return
		}

		clearStepUpFailures(clientIP)
		token, err := generateToken()
		if err != nil {
			http.Error(w, `{"error":"failed to create stepup session"}`, http.StatusInternalServerError)
			return
		}
		expiresAt := time.Now().Add(stepUpSessionDuration)
		if err := persistAuthSession(token, authSessionKindStepUp, mainSessionCookie.Value, expiresAt); err != nil {
			http.Error(w, `{"error":"failed to persist stepup session"}`, http.StatusInternalServerError)
			return
		}

		stepUpSessionStore.Lock()
		stepUpSessionStore.tokens[token] = stepUpSession{
			expiresAt:          expiresAt,
			parentSessionToken: mainSessionCookie.Value,
		}
		stepUpSessionStore.Unlock()

		secureCookie, sameSite := cookieSecurityPolicy(r)
		http.SetCookie(w, &http.Cookie{
			Name:     stepUpSessionCookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: sameSite,
			MaxAge:   int(stepUpSessionDuration.Seconds()),
		})

		appMetrics.IncCounter("oracle_stepup_verify_total", map[string]string{"result": "success"}, 1)
		_ = handlers.AppendAuditLog(
			r.Context(),
			db,
			"stepup_verify",
			"auth",
			"stepup",
			"ok",
			map[string]any{
				"clientIp": clientIP,
			},
		)

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":           true,
			"expiresInSec": int(stepUpSessionDuration.Seconds()),
		})
	})
}

func stepUpCheckHandler(db *sql.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodGet {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}
		enabled, err := handlers.IsFeatureEnabled(r.Context(), db, "feature_stepup_enforced")
		if err != nil {
			http.Error(w, `{"error":"stepup_flag_unavailable"}`, http.StatusInternalServerError)
			return
		}
		active := false
		if cookie, err := r.Cookie(stepUpSessionCookieName); err == nil {
			parent := ""
			if mainCookie, mainErr := r.Cookie(sessionCookieName); mainErr == nil {
				parent = mainCookie.Value
			}
			active = isValidStepUpSession(cookie.Value, parent)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":       true,
			"required": enabled,
			"active":   active,
		})
	})
}

func consumeStepUpChallenge(challengeID string, clientIP string) bool {
	if consumePersistedStepUpChallenge(challengeID, clientIP) {
		stepUpChallengeStore.Lock()
		delete(stepUpChallengeStore.items, challengeID)
		stepUpChallengeStore.Unlock()
		return true
	}

	now := time.Now()
	stepUpChallengeStore.Lock()
	defer stepUpChallengeStore.Unlock()

	cleanupExpiredStepUpChallengesLocked(now)
	item, exists := stepUpChallengeStore.items[challengeID]
	if !exists {
		return false
	}
	if item.expiresAt.Before(now) || item.clientIP != clientIP {
		delete(stepUpChallengeStore.items, challengeID)
		deletePersistedStepUpChallenge(challengeID)
		return false
	}
	delete(stepUpChallengeStore.items, challengeID)
	deletePersistedStepUpChallenge(challengeID)
	return true
}

func cleanupExpiredStepUpChallengesLocked(now time.Time) {
	for key, item := range stepUpChallengeStore.items {
		if now.After(item.expiresAt) {
			delete(stepUpChallengeStore.items, key)
		}
	}
}

func isValidStepUpSession(token string, parentSessionToken string) bool {
	now := time.Now()
	stepUpSessionStore.RLock()
	session, exists := stepUpSessionStore.tokens[token]
	stepUpSessionStore.RUnlock()
	if !exists {
		expiry, persistedParent, ok, err := loadAuthSession(token, authSessionKindStepUp)
		if err != nil || !ok {
			return false
		}
		session = stepUpSession{
			expiresAt:          expiry,
			parentSessionToken: persistedParent,
		}
		stepUpSessionStore.Lock()
		stepUpSessionStore.tokens[token] = session
		stepUpSessionStore.Unlock()
		exists = true
	}
	if !exists {
		return false
	}
	if parentSessionToken != "" && parentSessionToken != session.parentSessionToken {
		return false
	}
	if now.After(session.expiresAt) {
		stepUpSessionStore.Lock()
		if latest, ok := stepUpSessionStore.tokens[token]; ok && now.After(latest.expiresAt) {
			delete(stepUpSessionStore.tokens, token)
		}
		stepUpSessionStore.Unlock()
		deleteAuthSession(token)
		return false
	}
	return true
}

func allowStepUpAttempt(ip string) (bool, int) {
	now := time.Now()
	stepUpRateStore.Lock()
	defer stepUpRateStore.Unlock()

	rec := stepUpRateStore.attempts[ip]
	if rec == nil {
		attempts, firstAttemptAt, blockedUntil, ok := loadAuthRateAttempt(authRateScopeStepUp, ip)
		if ok {
			rec = &stepUpAttempt{
				attempts:       attempts,
				firstAttemptAt: firstAttemptAt,
				blockedUntil:   blockedUntil,
			}
			stepUpRateStore.attempts[ip] = rec
		}
	}
	if rec == nil {
		return true, 0
	}
	if !rec.blockedUntil.IsZero() && now.Before(rec.blockedUntil) {
		retryAfter := int(time.Until(rec.blockedUntil).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, retryAfter
	}
	if now.Sub(rec.firstAttemptAt) > stepUpLockout {
		delete(stepUpRateStore.attempts, ip)
		deleteAuthRateAttempt(authRateScopeStepUp, ip)
		return true, 0
	}
	return true, 0
}

func recordStepUpFailure(db *sql.DB, ip string) (blocked bool, retryAfter int) {
	now := time.Now()
	stepUpRateStore.Lock()
	rec := stepUpRateStore.attempts[ip]
	if rec == nil || now.Sub(rec.firstAttemptAt) > stepUpLockout {
		rec = &stepUpAttempt{attempts: 0, firstAttemptAt: now}
		stepUpRateStore.attempts[ip] = rec
	}
	rec.attempts++
	attempts := rec.attempts
	if rec.attempts >= stepUpMaxAttempts {
		rec.blockedUntil = now.Add(stepUpLockout)
		retryAfter = int(time.Until(rec.blockedUntil).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		blocked = true
	}
	persistAuthRateAttempt(authRateScopeStepUp, ip, rec.attempts, rec.firstAttemptAt, rec.blockedUntil)
	stepUpRateStore.Unlock()

	if attempts >= stepUpAbuseThreshold {
		_ = upsertSystemAlert(
			context.Background(),
			db,
			"stepup_abuse_spike",
			"warning",
			"high volume of failed step-up verification attempts",
			map[string]any{
				"ip":            ip,
				"attempts":      attempts,
				"threshold":     stepUpAbuseThreshold,
				"windowMinutes": int(stepUpLockout.Minutes()),
			},
		)
	}
	return blocked, retryAfter
}

func clearStepUpFailures(ip string) {
	stepUpRateStore.Lock()
	defer stepUpRateStore.Unlock()
	delete(stepUpRateStore.attempts, ip)
	deleteAuthRateAttempt(authRateScopeStepUp, ip)
}

func upsertSystemAlert(
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

// isValidSession checks if token is in store and not expired.
func isValidSession(token string) bool {
	now := time.Now()
	sessionStore.RLock()
	expiry, exists := sessionStore.tokens[token]
	sessionStore.RUnlock()
	if !exists {
		persistedExpiry, _, ok, err := loadAuthSession(token, authSessionKindViewer)
		if err != nil || !ok {
			return false
		}
		expiry = persistedExpiry
		sessionStore.Lock()
		sessionStore.tokens[token] = expiry
		sessionStore.Unlock()
		exists = true
	}
	if !exists {
		return false
	}
	if now.After(expiry) {
		sessionStore.Lock()
		if latest, ok := sessionStore.tokens[token]; ok && now.After(latest) {
			delete(sessionStore.tokens, token)
		}
		sessionStore.Unlock()
		deleteAuthSession(token)
		return false
	}
	return true
}

func getClientIP(r *http.Request) string {
	if r == nil {
		return "unknown"
	}
	remoteIP := extractRemoteIP(r.RemoteAddr)
	if isTrustedProxy(remoteIP) {
		if ip := parseForwardedForHeaderValue(r.Header.Get("Forwarded")); ip != "" {
			return ip
		}
		if ip := parseIPHeaderValue(r.Header.Get("X-Real-IP")); ip != "" {
			return ip
		}
		if ip := parseIPHeaderValue(firstHeaderListValue(r.Header.Get("X-Forwarded-For"))); ip != "" {
			return ip
		}
	}
	if remoteIP != "" {
		return remoteIP
	}
	return r.RemoteAddr
}

func parseIPHeaderValue(raw string) string {
	candidate := strings.Trim(strings.TrimSpace(raw), `"`)
	if candidate == "" {
		return ""
	}
	if strings.EqualFold(candidate, "unknown") {
		return ""
	}
	// Reject scoped identifiers and RFC 7239 obfuscated identifiers.
	if strings.Contains(candidate, "%") {
		return ""
	}
	if strings.HasPrefix(candidate, "_") {
		return ""
	}
	// RFC 7239 "for=" may include host:port. Accept only when host portion is an IP.
	if host, _, err := net.SplitHostPort(candidate); err == nil {
		candidate = host
	}
	// RFC 7239 IPv6 values may be wrapped in brackets.
	if strings.HasPrefix(candidate, "[") && strings.HasSuffix(candidate, "]") && len(candidate) > 2 {
		candidate = candidate[1 : len(candidate)-1]
	}
	addr, err := netip.ParseAddr(candidate)
	if err != nil {
		return ""
	}
	return addr.Unmap().String()
}

func firstHeaderListValue(raw string) string {
	for _, part := range strings.Split(raw, ",") {
		if token := strings.TrimSpace(part); token != "" {
			return token
		}
	}
	return ""
}

func parseForwardedForHeaderValue(raw string) string {
	entry := firstHeaderListValue(raw)
	if entry == "" {
		return ""
	}
	for _, part := range strings.Split(entry, ";") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(kv[0]), "for") {
			return parseIPHeaderValue(kv[1])
		}
	}
	return ""
}

func parseForwardedProtoHeaderValue(raw string) string {
	entry := firstHeaderListValue(raw)
	if entry == "" {
		return ""
	}
	for _, part := range strings.Split(entry, ";") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(kv[0]), "proto") {
			proto := strings.ToLower(strings.Trim(strings.TrimSpace(kv[1]), `"`))
			if proto == "https" || proto == "http" {
				return proto
			}
			return ""
		}
	}
	return ""
}

func parseXForwardedProtoHeaderValue(raw string) string {
	proto := strings.ToLower(strings.TrimSpace(firstHeaderListValue(raw)))
	if proto == "https" || proto == "http" {
		return proto
	}
	return ""
}

func trustedProxyProto(r *http.Request) string {
	if r == nil {
		return ""
	}
	if !isTrustedProxy(extractRemoteIP(r.RemoteAddr)) {
		return ""
	}
	if proto := parseForwardedProtoHeaderValue(r.Header.Get("Forwarded")); proto != "" {
		return proto
	}
	return parseXForwardedProtoHeaderValue(r.Header.Get("X-Forwarded-Proto"))
}

func allowLoginAttempt(ip string) (bool, int, int) {
	now := time.Now()
	loginRateStore.Lock()
	defer loginRateStore.Unlock()

	rec := loginRateStore.attempts[ip]
	if rec == nil {
		attempts, firstAttemptAt, blockedUntil, ok := loadAuthRateAttempt(authRateScopeLogin, ip)
		if ok {
			rec = &loginAttempt{
				attempts:       attempts,
				firstAttemptAt: firstAttemptAt,
				blockedUntil:   blockedUntil,
			}
			loginRateStore.attempts[ip] = rec
		}
	}
	if rec == nil {
		return true, loginMaxAttempts, 0
	}

	if !rec.blockedUntil.IsZero() && now.Before(rec.blockedUntil) {
		retryAfter := int(time.Until(rec.blockedUntil).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, 0, retryAfter
	}

	if now.Sub(rec.firstAttemptAt) > loginLockout {
		delete(loginRateStore.attempts, ip)
		deleteAuthRateAttempt(authRateScopeLogin, ip)
		return true, loginMaxAttempts, 0
	}

	remaining := loginMaxAttempts - rec.attempts
	if remaining < 0 {
		remaining = 0
	}
	return true, remaining, 0
}

func recordLoginFailure(ip string) (blocked bool, retryAfter int) {
	now := time.Now()
	loginRateStore.Lock()
	defer loginRateStore.Unlock()

	rec := loginRateStore.attempts[ip]
	if rec == nil || now.Sub(rec.firstAttemptAt) > loginLockout {
		rec = &loginAttempt{attempts: 0, firstAttemptAt: now}
		loginRateStore.attempts[ip] = rec
	}

	rec.attempts++
	if rec.attempts >= loginMaxAttempts {
		rec.blockedUntil = now.Add(loginLockout)
		retryAfter = int(time.Until(rec.blockedUntil).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		persistAuthRateAttempt(authRateScopeLogin, ip, rec.attempts, rec.firstAttemptAt, rec.blockedUntil)
		return true, retryAfter
	}
	persistAuthRateAttempt(authRateScopeLogin, ip, rec.attempts, rec.firstAttemptAt, rec.blockedUntil)

	return false, 0
}

func clearLoginFailures(ip string) {
	loginRateStore.Lock()
	defer loginRateStore.Unlock()
	delete(loginRateStore.attempts, ip)
	deleteAuthRateAttempt(authRateScopeLogin, ip)
}

// loginHandler handles POST /api/auth/login
func loginHandler(db *sql.DB, dashboardPassword string) http.HandlerFunc {
	storedHash := ""
	if dashboardPassword != "" {
		storedHash = mustHashPassword(dashboardPassword)
	}
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		// No auth required if DASHBOARD_PASSWORD is not set
		if dashboardPassword == "" {
			if err := json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "authRequired": false}); err != nil {
				log.Printf("failed to encode login response: %v", err)
			}
			return
		}

		clientIP := getClientIP(r)
		allowed, _, retryAfter := allowLoginAttempt(clientIP)
		if !allowed {
			appMetrics.IncCounter("oracle_rate_limit_hits_total", map[string]string{"scope": "login"}, 1)
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			http.Error(w, `{"error":"too many attempts"}`, http.StatusTooManyRequests)
			return
		}

		var req struct {
			Password string `json:"password"` // #nosec G117 -- required request field for login API contract.
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		if !verifyPasswordHash(storedHash, req.Password) {
			appMetrics.IncCounter("oracle_auth_failures_total", map[string]string{"reason": "invalid_password"}, 1)
			blocked, retryAfter := recordLoginFailure(clientIP)
			if blocked {
				appMetrics.IncCounter("oracle_rate_limit_hits_total", map[string]string{"scope": "login"}, 1)
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				http.Error(w, `{"error":"too many attempts"}`, http.StatusTooManyRequests)
				return
			}
			http.Error(w, `{"error":"invalid password"}`, http.StatusUnauthorized)
			return
		}

		clearLoginFailures(clientIP)

		// Create session
		token, err := generateToken()
		if err != nil {
			http.Error(w, `{"error":"failed to create session"}`, http.StatusInternalServerError)
			return
		}

		expiresAt := time.Now().Add(sessionDuration)
		if err := persistAuthSession(token, authSessionKindViewer, "", expiresAt); err != nil {
			http.Error(w, `{"error":"failed to persist session"}`, http.StatusInternalServerError)
			return
		}

		sessionStore.Lock()
		sessionStore.tokens[token] = expiresAt
		sessionStore.Unlock()

		secureCookie, sameSite := cookieSecurityPolicy(r)
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: sameSite,
			MaxAge:   int(sessionDuration.Seconds()),
		})

		if err := json.NewEncoder(w).Encode(map[string]interface{}{"ok": true}); err != nil {
			log.Printf("failed to encode login success response: %v", err)
		}
	}
}

// logoutHandler handles POST /api/auth/logout
func logoutHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		cookie, err := r.Cookie(sessionCookieName)
		if err == nil && cookie.Value != "" {
			sessionStore.Lock()
			delete(sessionStore.tokens, cookie.Value)
			sessionStore.Unlock()
			deleteAuthSession(cookie.Value)
		}
		stepUpCookie, stepErr := r.Cookie(stepUpSessionCookieName)
		if stepErr == nil && stepUpCookie.Value != "" {
			stepUpSessionStore.Lock()
			delete(stepUpSessionStore.tokens, stepUpCookie.Value)
			stepUpSessionStore.Unlock()
			deleteAuthSession(stepUpCookie.Value)
		}

		secureCookie, sameSite := cookieSecurityPolicy(r)
		// Clear cookie
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: sameSite,
			MaxAge:   -1,
		})
		http.SetCookie(w, &http.Cookie{
			Name:     stepUpSessionCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: sameSite,
			MaxAge:   -1,
		})

		if err := json.NewEncoder(w).Encode(map[string]interface{}{"ok": true}); err != nil {
			log.Printf("failed to encode logout response: %v", err)
		}
	}
}

func cookieSecurityPolicy(r *http.Request) (bool, http.SameSite) {
	switch sessionCookieSecureMode {
	case "true":
		return true, http.SameSiteStrictMode
	case "false":
		return false, http.SameSiteLaxMode
	}
	if r != nil && r.TLS != nil {
		return true, http.SameSiteStrictMode
	}
	if trustedProxyProto(r) == "https" {
		return true, http.SameSiteStrictMode
	}
	// HTTP deployments require non-secure cookies or browsers will drop the session.
	return false, http.SameSiteLaxMode
}

func isLoopbackAddr(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func hasForwardedIp(r *http.Request) bool {
	return r.Header.Get("X-Forwarded-For") != "" || r.Header.Get("X-Real-IP") != "" || r.Header.Get("Forwarded") != ""
}

func isLoopbackHost(hostport string) bool {
	host := hostport
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		host = h
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// authCheckHandler handles GET /api/auth/check
func authCheckHandler(db *sql.DB, dashboardPassword string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// No auth required if DASHBOARD_PASSWORD is not set
		if dashboardPassword == "" {
			if err := json.NewEncoder(w).Encode(map[string]interface{}{
				"authenticated": true,
				"authRequired":  false,
			}); err != nil {
				log.Printf("failed to encode auth-check response: %v", err)
			}
			return
		}

		cookie, err := r.Cookie(sessionCookieName)
		authenticated := err == nil && isValidSession(cookie.Value)

		if err := json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": authenticated,
			"authRequired":  true,
		}); err != nil {
			log.Printf("failed to encode auth-check response: %v", err)
		}
	}
}
