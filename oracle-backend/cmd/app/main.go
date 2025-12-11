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
	// 1. Configuration
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/cqd-analytics.db"
	}

	doSecret := os.Getenv("DO_SECRET")
	if doSecret == "" {
		// We enforce this to prevent insecure deployments
		log.Fatal("DO_SECRET env var is required")
	}

	// 2. Initialize Database
	log.Printf("Opening database at %s...", dbPath)
	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer database.Close()

	// 3. Setup Router (Go 1.22+ style)
	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /health/api", handlers.HealthAPI)
	mux.HandleFunc("GET /health/db", handlers.HealthDB(database))

	// Core Logic
	mux.HandleFunc("POST /storeBatch", handlers.StoreBatch(database, doSecret))
	mux.HandleFunc("GET /stats", handlers.GetStats(database))

	// Static UI
	fs := http.FileServer(http.Dir("./static"))
	mux.Handle("GET /", fs)

	// 4. Start Server
	log.Printf("Server starting on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}