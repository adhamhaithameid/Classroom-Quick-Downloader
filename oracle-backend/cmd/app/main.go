// filepath oracle-backend/cmd/app/main.go
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/adhamhaithameid/cqd-oracle-backend/internal/db"
	"github.com/adhamhaithameid/cqd-oracle-backend/internal/handlers"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/cqd-analytics.db"
	}

	secret := os.Getenv("DO_SHARED_SECRET")
	if secret == "" {
		log.Println("[WARN] DO_SHARED_SECRET is empty – StoreBatch will reject writes until you set it")
	}

	// Open DB
	sqlDB, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("failed to open DB: %v", err)
	}
	defer sqlDB.Close()

	mux := http.NewServeMux()

	// Health endpoints
	mux.HandleFunc("/health", handlers.HealthAPI)
	mux.Handle("/health/db", handlers.HealthDB(sqlDB))

	// Stats + ingest
	mux.Handle("/stats", handlers.GetStats(sqlDB))
	mux.Handle("/store-batch", handlers.StoreBatch(sqlDB, secret))

	// Static dashboard at "/"
	//   GET /           -> static/index.html
	//   GET /static/... -> static assets if you add more later
	fs := http.FileServer(http.Dir("static"))
	mux.Handle("/", fs)

	addr := ":" + port
	log.Printf("CQD Oracle backend listening on %s (DB=%s)", addr, dbPath)
	if err := http.ListenAndServe(addr, logRequest(mux)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// logRequest is a simple logging middleware.
func logRequest(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		next.ServeHTTP(w, r)
	})
}