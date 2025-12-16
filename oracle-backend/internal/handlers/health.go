// oracle-backend/internal/handlers/health.go
package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type healthResponse struct {
	OK bool `json:"ok"`
}

// APIHealthHandler responds that the HTTP server is up.
func APIHealthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(healthResponse{OK: true})
}

// DBHealthHandler checks connectivity to SQLite.
func DBHealthHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		if err := db.PingContext(r.Context()); err != nil {
			http.Error(w, "db unreachable", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(healthResponse{OK: true})
	}
}