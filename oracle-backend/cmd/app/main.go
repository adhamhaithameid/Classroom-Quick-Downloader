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
	"strconv"
	"strings"
	"sync"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/handlers"
)

func main() {
	addr := getenv("ADDR", ":8080")
	dbPath := getenv("DB_PATH", "./data/analytics.db")
	staticDir := getenv("STATIC_DIR", "./static")
	doSecret := os.Getenv("DO_SHARED_SECRET")
	dashboardPassword := os.Getenv("DASHBOARD_PASSWORD")
	archiverSecret := os.Getenv("ARCHIVER_SHARED_SECRET")
	allowLoopbackBypass := os.Getenv("ALLOW_LOOPBACK_BYPASS") == "true"
	allowEmptyDashboardPassword := os.Getenv("ALLOW_EMPTY_DASHBOARD_PASSWORD") == "true"
	// HTTP mode note: if your Oracle deployment is HTTP-only, cookies are non-Secure.
	// This keeps the dashboard usable but provides no transport confidentiality.
	allowInsecureCookies := os.Getenv("ALLOW_INSECURE_COOKIES") == "true"

	if doSecret == "" {
		log.Println("[WARN] DO_SHARED_SECRET is empty – /ingest-batch will reject requests")
	}

	if dashboardPassword == "" && !allowEmptyDashboardPassword {
		log.Fatal("[FATAL] DASHBOARD_PASSWORD is required for dashboard access")
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
	authMiddleware := requireAuth(dashboardPassword, archiverSecret, allowLoopbackBypass)
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

// loggingMiddleware logs basic request info.
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s in %s", r.Method, r.URL.Path, time.Since(start))
	})
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
// - KUMA_PUSH_URL: Optional Uptime Kuma push URL
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

// generateToken creates a cryptographically secure session token.
func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// hashPassword creates a SHA256 hash for timing-safe comparison.
func hashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return hex.EncodeToString(h[:])
}

// requireAuth returns middleware that checks for valid session cookie.
// If dashboardPassword is empty, all requests are allowed (no auth).
func requireAuth(dashboardPassword, archiverSecret string, allowLoopbackBypass bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// No auth required if DASHBOARD_PASSWORD is not set
			if dashboardPassword == "" {
				next.ServeHTTP(w, r)
				return
			}

			if allowLoopbackBypass && archiverSecret == "" && isLoopbackAddr(r.RemoteAddr) && isLoopbackHost(r.Host) && !hasForwardedIp(r) {
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

// isValidSession checks if token is in store and not expired.
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

func getClientIP(r *http.Request) string {
	if r == nil {
		return "unknown"
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		parts := strings.Split(fwd, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func allowLoginAttempt(ip string) (bool, int, int) {
	now := time.Now()
	loginRateStore.Lock()
	defer loginRateStore.Unlock()

	rec := loginRateStore.attempts[ip]
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
		return true, retryAfter
	}

	return false, 0
}

func clearLoginFailures(ip string) {
	loginRateStore.Lock()
	defer loginRateStore.Unlock()
	delete(loginRateStore.attempts, ip)
}

// loginHandler handles POST /api/auth/login
func loginHandler(dashboardPassword string, allowInsecureCookies bool) http.HandlerFunc {
	storedHash := ""
	if dashboardPassword != "" {
		storedHash = hashPassword(dashboardPassword)
	}
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

		clientIP := getClientIP(r)
		allowed, _, retryAfter := allowLoginAttempt(clientIP)
		if !allowed {
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			http.Error(w, `{"error":"too many attempts"}`, http.StatusTooManyRequests)
			return
		}

		var req struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		// Timing-safe comparison via SHA256 (stored hash precomputed)
		hashedInput := hashPassword(req.Password)
		if subtle.ConstantTimeCompare([]byte(hashedInput), []byte(storedHash)) != 1 {
			blocked, retryAfter := recordLoginFailure(clientIP)
			if blocked {
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

// logoutHandler handles POST /api/auth/logout
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

func cookieSecurityPolicy(r *http.Request, allowInsecure bool) (bool, http.SameSite) {
	if r.TLS != nil {
		return true, http.SameSiteStrictMode
	}
	if allowInsecure {
		return false, http.SameSiteLaxMode
	}
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
