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
	iofs "io/fs"
	"log"
	"net"
	"net/http"
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
	log.Println("[INFO] HTTP deployments use non-secure cookies; prefer HTTPS in production")
	if len(trustedProxyNets) > 0 {
		log.Printf("[INFO] Trusted proxy CIDRs loaded: %d", len(trustedProxyNets))
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

	mux := http.NewServeMux()

	// Health endpoints.
	mux.HandleFunc("/health", handlers.APIHealthHandler)
	mux.HandleFunc("/health/api", handlers.APIHealthHandler)

	// Updated: Use the local HealthDBHandler for granular SQLite monitoring
	mux.HandleFunc("/health/db", HealthDBHandler(sqlDB))

	// Ingest endpoint (aggregated batches from DO).
	mux.HandleFunc("/ingest-batch", handlers.IngestBatchHandler(sqlDB, doSecret))
	// Backwards-compatible alias, if you ever used /storeBatch naming.
	mux.HandleFunc("/storeBatch", handlers.IngestBatchHandler(sqlDB, doSecret))

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
	mux.Handle("/api/admin/deployments/sync", authMiddleware(criticalMiddleware(handlers.DeploymentsSyncHandler(sqlDB, postgresDB, appMetrics))))
	mux.Handle("/api/admin/dashboard-links", authMiddleware(handlers.DashboardLinksHandler(
		getenv("CLOUDFLARE_DASHBOARD_URL", "https://cqd-analytics.adhamhaithameid.workers.dev/"),
		getenv("UPTIME_KUMA_URL", ""),
		getenv("GITHUB_REPO_URL", "https://github.com/adhamhaithameid/Classroom-Quick-Downloader"),
		getenv("GOOGLE_SHEETS_URL", "https://docs.google.com/spreadsheets/"),
	)))
	mux.Handle("/api/admin/github/open-counts", authMiddleware(handlers.GitHubOpenCountsHandler(
		getenv("GITHUB_REPO_SLUG", "adhamhaithameid/Classroom-Quick-Downloader"),
		os.Getenv("GITHUB_API_TOKEN"),
		60*time.Second,
	)))
	mux.Handle("/api/admin/oracle-logs", authMiddleware(handlers.OracleOperationLogsListHandler(sqlDB)))
	mux.Handle("/api/admin/oracle-logs/delete-older", authMiddleware(criticalMiddleware(handlers.OracleOperationLogsDeleteOlderHandler(sqlDB))))
	mux.Handle("/api/admin/oracle-logs/clear-all", authMiddleware(criticalMiddleware(handlers.OracleOperationLogsClearAllHandler(sqlDB))))
	mux.Handle("/metrics", authMiddleware(metricsHandler(appMetrics)))

	// Auth endpoints
	mux.HandleFunc("/api/auth/login", loginHandler(sqlDB, dashboardPassword))
	mux.HandleFunc("/api/auth/logout", logoutHandler(sqlDB))
	mux.HandleFunc("/api/auth/check", authCheckHandler(sqlDB, dashboardPassword))
	mux.Handle("/api/auth/stepup/start", authMiddleware(stepUpStartHandler(sqlDB)))
	mux.Handle("/api/auth/stepup/verify", authMiddleware(stepUpVerifyHandler(sqlDB, superAdminPassword)))
	mux.Handle("/api/auth/stepup/check", authMiddleware(stepUpCheckHandler(sqlDB)))

	// Serve static dashboard with SPA fallback.
	mux.Handle("/", spaHandler(staticDir))

	// =========================================================================
	// SCHEDULED 12:15 AM GOOGLE SHEETS EXPORT
	// Runs daily at 00:15 to archive stats to Google Sheets
	// Configure via SHEETS_ID and GOOGLE_CREDS_PATH env vars
	// =========================================================================
	go scheduleSheetsArchiver()
	if postgresDB != nil {
		go relay.NewSQLiteToPostgresRelay(sqlDB, postgresDB, appMetrics).Start(context.Background())
	}
	serverCtx, stopServerCtx := context.WithCancel(context.Background())
	defer stopServerCtx()
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

// HealthDBHandler returns a handler that checks the database connection
// by executing a lightweight query.
func HealthDBHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var one int
		// Execute a lightweight query to ensure the DB is not locked
		err := db.QueryRow("SELECT 1").Scan(&one)
		if err != nil {
			log.Printf("Health Check Failed: %v", err)
			http.Error(w, "Database Unhealthy", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
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
			}
		}
		next.ServeHTTP(w, r)
	})
}

type cspNonceContextKey struct{}

func generateCSPNonce() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "nonce-unavailable"
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
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set(
			"Content-Security-Policy",
			"default-src 'self' https:; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'nonce-"+nonce+"'; frame-ancestors 'none'; base-uri 'self'",
		)
		ctx := context.WithValue(r.Context(), cspNonceContextKey{}, nonce)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func metricsHandler(reg *observability.Registry) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		_, _ = w.Write([]byte(reg.RenderPrometheus()))
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
		strings.HasPrefix(requestPath, "/storeBatch") ||
		strings.HasPrefix(requestPath, "/health") ||
		strings.HasPrefix(requestPath, "/metrics")
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
	if nonce != "" {
		content = bytes.ReplaceAll(content, []byte("__CSP_NONCE__"), []byte(nonce))
	}
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

	log.Printf( // #nosec G706 -- sheet/creds are sanitized with sanitizeLogValue before logging.
		"[Scheduler] Sheets archiver enabled: sheet=%s, creds=%s",
		sanitizeLogValue(sheetsID),
		sanitizeLogValue(credsPath),
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
		runArchiver(sheetsID, credsPath, kumaPushURL, archiverSecret)
	}
}

// runArchiver executes the archiver binary with the given parameters.
// This calls the archiver as a subprocess to maintain separation of concerns.
func runArchiver(sheetsID, credsPath, kumaPushURL, archiverSecret string) {
	args := []string{"-sheet", sheetsID, "-creds", credsPath, "-api", "http://localhost:8080/api/stats/summary"}
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
		return
	}

	// #nosec G204,G702 -- path is validated via resolveArchiverPath; args are fixed flags from trusted config.
	cmd := exec.Command(archiverPath, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		log.Printf("[Scheduler] Archiver failed: %v", err)
	} else {
		log.Println("[Scheduler] Sheets export completed successfully")
	}
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
				if headerSecret != "" && subtle.ConstantTimeCompare([]byte(headerSecret), []byte(archiverSecret)) == 1 {
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
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
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

	var existingID int64
	err = db.QueryRowContext(
		ctx,
		`SELECT id FROM system_alerts WHERE alert_type = ? AND status = 'open' ORDER BY id DESC LIMIT 1`,
		alertType,
	).Scan(&existingID)
	if err == nil {
		_, err = db.ExecContext(
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
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	_, err = db.ExecContext(
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
		if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
			return ip
		}
		if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
			parts := strings.Split(fwd, ",")
			if len(parts) > 0 {
				return strings.TrimSpace(parts[0])
			}
		}
	}
	if remoteIP != "" {
		return remoteIP
	}
	return r.RemoteAddr
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
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
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
	if r.TLS != nil {
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
	return r.Header.Get("X-Forwarded-For") != "" || r.Header.Get("X-Real-IP") != ""
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
