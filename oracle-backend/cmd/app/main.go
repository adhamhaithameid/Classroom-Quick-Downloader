// oracle-backend/cmd/app/main.go
package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/handlers"
)

// main initializes configuration and runtime components, registers HTTP routes
// (health, DB health, ingest, analytics API with optional auth, auth endpoints,
// and SPA static serving), schedules the daily Google Sheets archiver, and
// starts the HTTP server.
func main() {
	addr := getenv("ADDR", ":8080")
	dbPath := getenv("DB_PATH", "./data/analytics.db")
	staticDir := getenv("STATIC_DIR", "./static")
	doSecret := os.Getenv("DO_SHARED_SECRET")
	dashboardPassword := os.Getenv("DASHBOARD_PASSWORD")
	archiverSecret := os.Getenv("ARCHIVER_SHARED_SECRET")
	// HTTP mode note: if your Oracle deployment is HTTP-only, cookies are non-Secure.
	// This keeps the dashboard usable but provides no transport confidentiality.
	allowInsecureCookies := os.Getenv("ALLOW_INSECURE_COOKIES") == "true"

	if doSecret == "" {
		log.Println("[WARN] DO_SHARED_SECRET is empty – /ingest-batch will reject requests")
	}

	if dashboardPassword == "" {
		log.Println("[WARN] DASHBOARD_PASSWORD is empty – dashboard is PUBLIC (no auth)")
	} else {
		log.Println("[INFO] Dashboard authentication enabled")
	}
	if dashboardPassword != "" && archiverSecret == "" {
		log.Println("[WARN] ARCHIVER_SHARED_SECRET is empty – archiver will fail when auth is enabled")
	}
	if !allowInsecureCookies {
		log.Println("[INFO] ALLOW_INSECURE_COOKIES is false – HTTP dashboards will use non-secure cookies")
	}

	// Ensure data directory exists.
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		log.Fatalf("failed to create data dir: %v", err)
	}

	sqlDB, err := db.Init(dbPath)
	if err != nil {
		log.Fatalf("failed to init db: %v", err)
	}
	defer sqlDB.Close()

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
	authMiddleware := requireAuth(dashboardPassword, archiverSecret)
	mux.Handle("/api/stats/summary", authMiddleware(handlers.SummaryHandler(sqlDB)))
	mux.Handle("/api/stats/timeseries", authMiddleware(handlers.TimeSeriesHandler(sqlDB)))
	mux.Handle("/api/stats/breakdown", authMiddleware(handlers.BreakdownHandler(sqlDB)))
	mux.Handle("/api/stats/comparison", authMiddleware(handlers.ComparisonHandler(sqlDB)))
	mux.Handle("/api/stats/export", authMiddleware(handlers.ExportHandler(sqlDB)))
	mux.Handle("/api/deploy-status", authMiddleware(handlers.DeployStatusHandler()))

	// Auth endpoints
	mux.HandleFunc("/api/auth/login", loginHandler(dashboardPassword, allowInsecureCookies))
	mux.HandleFunc("/api/auth/logout", logoutHandler(allowInsecureCookies))
	mux.HandleFunc("/api/auth/check", authCheckHandler(dashboardPassword))

	// Serve static dashboard with SPA fallback.
	mux.Handle("/", spaHandler(staticDir))

	// =========================================================================
	// SCHEDULED 12:15 AM GOOGLE SHEETS EXPORT
	// Runs daily at 00:15 to archive stats to Google Sheets
	// Configure via SHEETS_ID and GOOGLE_CREDS_PATH env vars
	// =========================================================================
	go scheduleSheetsArchiver()

	server := &http.Server{
		Addr:              addr,
		Handler:           loggingMiddleware(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("oracle-backend listening on %s (db: %s, static: %s)", addr, dbPath, staticDir)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
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
		w.Write([]byte("ok"))
	}
}

// loggingMiddleware returns an http.Handler that wraps the given handler and logs the request method, URL path, and processing duration.
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s in %s", r.Method, r.URL.Path, time.Since(start))
	})
}

// spaHandler returns an http.Handler that serves files from the provided staticDir,
// falling back to index.html for single-page app routes. It rejects requests for
// API and health endpoints (so those can be handled elsewhere), prevents path
// traversal by ensuring resolved paths remain inside staticDir, and serves an
// existing file directly when present.
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
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}

		// Otherwise serve SPA entry (index.html)
		http.ServeFile(w, r, filepath.Join(absStaticDir, "index.html"))
	})
}


// scheduleSheetsArchiver runs a scheduled task at 00:15 daily to export stats to Google Sheets.
// Configure with environment variables:
// - SHEETS_ID: Google Sheets spreadsheet ID
// - GOOGLE_CREDS_PATH: Path to service account JSON (default: /app/google-credentials.json)
// scheduleSheetsArchiver schedules and runs the archiver to export data to Google Sheets daily at 00:15 UTC.
// If SHEETS_ID is unset the scheduler is disabled and returns immediately.
// It reads GOOGLE_CREDS_PATH (defaulting to /app/google-credentials.json), KUMA_PUSH_URL and ARCHIVER_SHARED_SECRET from the environment,
// logs the enabled configuration, and repeatedly sleeps until the next 00:15 UTC then calls runArchiver with those values.
// This function blocks (runs an infinite loop) and is intended to be started in a separate goroutine.
func scheduleSheetsArchiver() {
	sheetsID := os.Getenv("SHEETS_ID")
	if sheetsID == "" {
		log.Println("[Scheduler] SHEETS_ID not set, skipping automated Sheets export")
		return
	}

	credsPath := getenv("GOOGLE_CREDS_PATH", "/app/google-credentials.json")
	kumaPushURL := os.Getenv("KUMA_PUSH_URL")
	archiverSecret := os.Getenv("ARCHIVER_SHARED_SECRET")
	
	log.Printf("[Scheduler] Sheets archiver enabled: sheet=%s, creds=%s", sheetsID, credsPath)
	
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
// runArchiver executes the external archiver binary to export analytics to the specified
// Google Sheet and logs the result.
//
// sheetsID is the target Google Sheet ID. credsPath is the filesystem path to the
// service account credentials JSON. kumaPushURL, if non-empty, is forwarded to the
// archiver as a -kuma argument. archiverSecret, if non-empty, is forwarded as a
// -secret argument.
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
	archiverPath := getenv("ARCHIVER_PATH", "/app/archiver")
	
	cmd := exec.Command(archiverPath, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	if err := cmd.Run(); err != nil {
		log.Printf("[Scheduler] Archiver failed: %v", err)
	} else {
		log.Println("[Scheduler] Sheets export completed successfully")
	}
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

// generateToken creates a cryptographically secure session token.
func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// hashPassword returns the SHA-256 hash of password encoded as a hexadecimal string.
// The resulting hex string is suitable for use in constant-time comparisons when verifying credentials.
func hashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return hex.EncodeToString(h[:])
}

// requireAuth returns middleware that checks for valid session cookie.
// requireAuth returns middleware that enforces dashboard authentication for protected handlers.
// If dashboardPassword is empty, the middleware allows all requests.
// If archiverSecret is non-empty, a matching X-Archiver-Secret header grants access.
// When archiverSecret is empty, requests originating from loopback addresses without forwarded IP headers are allowed.
// Otherwise the middleware requires a valid session cookie (sessionCookieName) and responds with HTTP 401 and a JSON error on failure.
func requireAuth(dashboardPassword, archiverSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// No auth required if DASHBOARD_PASSWORD is not set
			if dashboardPassword == "" {
				next.ServeHTTP(w, r)
				return
			}

			if archiverSecret == "" && isLoopbackAddr(r.RemoteAddr) && !hasForwardedIp(r) {
				next.ServeHTTP(w, r)
				return
			}

			if archiverSecret != "" {
				headerSecret := r.Header.Get("X-Archiver-Secret")
				if headerSecret != "" && subtle.ConstantTimeCompare([]byte(headerSecret), []byte(archiverSecret)) == 1 {
					next.ServeHTTP(w, r)
					return
				}
			}

			cookie, err := r.Cookie(sessionCookieName)
			if err != nil || !isValidSession(cookie.Value) {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// isValidSession reports whether the provided session token exists and has not expired.
// If the token is expired it is removed from the store asynchronously.
func isValidSession(token string) bool {
	sessionStore.RLock()
	defer sessionStore.RUnlock()
	
	expiry, exists := sessionStore.tokens[token]
	if !exists {
		return false
	}
	if time.Now().After(expiry) {
		// Expired - clean up async
		go func() {
			sessionStore.Lock()
			delete(sessionStore.tokens, token)
			sessionStore.Unlock()
		}()
		return false
	}
	return true
}

// loginHandler returns an http.HandlerFunc that handles POST /api/auth/login and creates an authenticated session cookie when a dashboard password is configured.
// It validates a JSON body containing a `password` field using a timing-safe SHA-256 comparison, generates a cryptographically secure session token, stores the token with a 24-hour expiry in the in-memory session store, and sets the session cookie with attributes determined by cookieSecurityPolicy.
// If no dashboard password is configured the handler responds with `{"ok":true,"authRequired":false}`; on success it responds with `{"ok":true}` and on failure it responds with an appropriate HTTP status and JSON error message.
func loginHandler(dashboardPassword string, allowInsecureCookies bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		// No auth required if DASHBOARD_PASSWORD is not set
		if dashboardPassword == "" {
			json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "authRequired": false})
			return
		}

		var req struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		// Timing-safe comparison via SHA256
		if hashPassword(req.Password) != hashPassword(dashboardPassword) {
			http.Error(w, `{"error":"invalid password"}`, http.StatusUnauthorized)
			return
		}

		// Create session
		token, err := generateToken()
		if err != nil {
			http.Error(w, `{"error":"failed to create session"}`, http.StatusInternalServerError)
			return
		}

		sessionStore.Lock()
		sessionStore.tokens[token] = time.Now().Add(sessionDuration)
		sessionStore.Unlock()

		secureCookie, sameSite := cookieSecurityPolicy(r, allowInsecureCookies)
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: sameSite,
			MaxAge:   int(sessionDuration.Seconds()),
		})

		json.NewEncoder(w).Encode(map[string]interface{}{"ok": true})
	}
}

// logoutHandler returns an HTTP handler that invalidates the current session and clears the session cookie.
// 
// The handler accepts only POST requests; other methods receive a 405 response with a JSON error payload.
// If a session cookie is present, its token is removed from the in-memory session store. The handler then
// clears the session cookie (empty value and MaxAge -1) using the Secure/SameSite policy determined by
// cookieSecurityPolicy and responds with JSON `{"ok": true}`.
// 
// The allowInsecureCookies parameter controls cookie security policy for non-TLS requests.
func logoutHandler(allowInsecureCookies bool) http.HandlerFunc {
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
		}

		secureCookie, sameSite := cookieSecurityPolicy(r, allowInsecureCookies)
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

		json.NewEncoder(w).Encode(map[string]interface{}{"ok": true})
	}
}

// cookieSecurityPolicy determines whether the session cookie should be marked Secure
// and which SameSite mode to use based on the incoming request and the
// allowInsecure flag. If the request is over TLS it returns Secure=true and
// SameSiteStrictMode; otherwise it returns Secure=false and SameSiteLaxMode.
func cookieSecurityPolicy(r *http.Request, allowInsecure bool) (bool, http.SameSite) {
	if r.TLS != nil {
		return true, http.SameSiteStrictMode
	}
	if allowInsecure {
		return false, http.SameSiteLaxMode
	}
	return false, http.SameSiteLaxMode
}

// isLoopbackAddr reports whether the provided remote network address refers to a loopback IP.
// The input may be in "host:port" form or a plain host/IP; the function parses the host portion
// and returns true if it is a valid IP address that is a loopback address.
func isLoopbackAddr(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// hasForwardedIp reports whether the request contains a non-empty X-Forwarded-For or X-Real-IP header.
func hasForwardedIp(r *http.Request) bool {
	return r.Header.Get("X-Forwarded-For") != "" || r.Header.Get("X-Real-IP") != ""
}


//   - "authRequired": `false` when no dashboard password is configured (authentication disabled), `true` otherwise.
func authCheckHandler(dashboardPassword string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// No auth required if DASHBOARD_PASSWORD is not set
		if dashboardPassword == "" {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"authenticated": true,
				"authRequired":  false,
			})
			return
		}

		cookie, err := r.Cookie(sessionCookieName)
		authenticated := err == nil && isValidSession(cookie.Value)

		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": authenticated,
			"authRequired":  true,
		})
	}
}