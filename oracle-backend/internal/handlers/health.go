//filepath: oracle-backend/internal/handlers/health.go
package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

func HealthAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":      true,
		"service": "cqd-oracle-backend",
	})
}

func HealthDB(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := db.Ping(); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"ok":    false,
				"error": "db connection failed",
			})
			return
		}
		json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}
}