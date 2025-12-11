//filepath: oracle-backend/internal/handlers/stats.go
package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/adhamhaithameid/cqd-oracle-backend/internal/model"
)

type StatsResponse struct {
	Total     int64            `json:"total"`
	ByType    map[string]int64 `json:"byType"`
	ByBrowser map[string]int64 `json:"byBrowser"`
}

func GetStats(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. Fetch raw counters from DB (e.g., "type:pdf" -> 5)
		counters, err := model.GetAllCounters(db)
		if err != nil {
			http.Error(w, "DB Error", http.StatusInternalServerError)
			return
		}

		// 2. Transform into structured JSON
		resp := StatsResponse{
			Total:     0,
			ByType:    make(map[string]int64),
			ByBrowser: make(map[string]int64),
		}

		for key, value := range counters {
			if key == "total" {
				resp.Total = value
			} else if strings.HasPrefix(key, "type:") {
				// Remove "type:" prefix (e.g. "type:pdf" -> "pdf")
				cleanKey := strings.TrimPrefix(key, "type:")
				resp.ByType[cleanKey] = value
			} else if strings.HasPrefix(key, "browser:") {
				// Remove "browser:" prefix
				cleanKey := strings.TrimPrefix(key, "browser:")
				resp.ByBrowser[cleanKey] = value
			}
		}

		// 3. Send response
		w.Header().Set("Content-Type", "application/json")
		// Allow CORS so your static UI or local testing can reach it easily
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(resp)
	}
}