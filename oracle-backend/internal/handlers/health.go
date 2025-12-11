//filepath: oracle-backend/internal/handlers/health.go
package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

// HealthAPI returns a simple "service ok" JSON and does not touch the DB.
func HealthAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":      true,
		"service": "cqd-oracle-backend",
	})
}

// HealthDB checks the DB connection and reports whether it's alive.
func HealthDB(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := db.Ping(); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":    false,
				"error": "db connection failed",
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}
}