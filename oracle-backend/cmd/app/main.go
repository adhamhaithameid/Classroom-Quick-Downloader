// oracle-backend/cmd/app/main.go
package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"oracle-backend/internal/db"
	"oracle-backend/internal/handlers"
)

func main() {
	addr := getenv("ADDR", ":8080")
	dbPath := getenv("DB_PATH", "./data/analytics.db")
	staticDir := getenv("STATIC_DIR", "./static")
	doSecret := os.Getenv("DO_SHARED_SECRET")

	if doSecret == "" {
		log.Println("[WARN] DO_SHARED_SECRET is empty – /ingest-batch will reject requests")
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

	// Analytics API endpoints.
	mux.HandleFunc("/api/stats/summary", handlers.SummaryHandler(sqlDB))
	mux.HandleFunc("/api/stats/timeseries", handlers.TimeSeriesHandler(sqlDB))
	mux.HandleFunc("/api/stats/breakdown", handlers.BreakdownHandler(sqlDB))
	mux.HandleFunc("/api/stats/comparison", handlers.ComparisonHandler(sqlDB))
	mux.HandleFunc("/api/stats/export", handlers.ExportHandler(sqlDB))
	mux.HandleFunc("/api/deploy-status", handlers.DeployStatusHandler())

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
		log.Printf("%s %s from %s in %s", r.Method, r.URL.Path, r.RemoteAddr, time.Since(start))
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

		// If file exists, serve it
		path := filepath.Join(staticDir, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}

		// Otherwise serve SPA entry (index.html)
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
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
	
	log.Printf("[Scheduler] Sheets archiver enabled: sheet=%s, creds=%s", sheetsID, credsPath)
	
	for {
		// Calculate time until next 00:15
		now := time.Now()
		next := time.Date(now.Year(), now.Month(), now.Day(), 0, 15, 0, 0, now.Location())
		if now.After(next) {
			next = next.Add(24 * time.Hour)
		}
		sleepDuration := time.Until(next)
		
		log.Printf("[Scheduler] Next Sheets export at %s (in %s)", next.Format(time.RFC3339), sleepDuration.Round(time.Minute))
		time.Sleep(sleepDuration)
		
		// Run the archiver
		log.Println("[Scheduler] Running scheduled Sheets export...")
		runArchiver(sheetsID, credsPath, kumaPushURL)
	}
}

// runArchiver executes the archiver binary with the given parameters.
// This calls the archiver as a subprocess to maintain separation of concerns.
func runArchiver(sheetsID, credsPath, kumaPushURL string) {
	args := []string{"-sheet", sheetsID, "-creds", credsPath, "-api", "http://localhost:8080/api/stats/summary"}
	if kumaPushURL != "" {
		args = append(args, "-kuma", kumaPushURL)
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