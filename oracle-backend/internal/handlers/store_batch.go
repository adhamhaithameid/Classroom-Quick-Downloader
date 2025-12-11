// filepath: oracle-backend/internal/handlers/store_batch.go
package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/adhamhaithameid/cqd-oracle-backend/internal/model"
)

// Event mirrors just the fields we care about from the Cloudflare DO payload.
// The DO sends events like:
// {
//   "status": "success" | "fail",
//   "file_type": "pdf",
//   "browser": "chrome",
//   ... (other fields, ignored here)
// }
type Event struct {
	Status   string `json:"status"`
	FileType string `json:"file_type"`
	Browser  string `json:"browser"`
}

// Batch is the top-level payload: { "events": [...] }
type Batch struct {
	Events []Event `json:"events"`
}

func StoreBatch(db *sql.DB, secret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Method guard
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// If we forgot to set the secret, warn loudly
		if secret == "" {
			log.Println("[WARN] DO_SHARED_SECRET is empty – rejecting StoreBatch")
			http.Error(w, "Server misconfigured", http.StatusInternalServerError)
			return
		}

		// 1. Auth check – must match DO_SHARED_SECRET sent as X-DO-SECRET
		if r.Header.Get("X-DO-SECRET") != secret {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// 2. Decode JSON
		var batch Batch
		if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
			log.Printf("StoreBatch: decode error: %v", err)
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		if len(batch.Events) == 0 {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":       true,
				"ingested": 0,
			})
			return
		}

		// 3. Aggregate in memory first (Performance optimization)
		// We count only SUCCESS events as "downloads".
		counts := make(map[string]int)

		for _, ev := range batch.Events {
			if ev.Status != "success" {
				continue
			}

			counts["total"]++ // Global successful download count

			if ev.FileType != "" {
				t := strings.ToLower(ev.FileType)
				counts["type:"+t]++
			}
			if ev.Browser != "" {
				b := strings.ToLower(ev.Browser)
				counts["browser:"+b]++
			}
		}

		// If nothing to write (e.g., all were fails), return OK
		if len(counts) == 0 {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":       true,
				"ingested": 0,
			})
			return
		}

		// 4. Write to DB in a single transaction
		tx, err := db.Begin()
		if err != nil {
			log.Printf("StoreBatch: failed to begin tx: %v", err)
			http.Error(w, "DB Error", http.StatusInternalServerError)
			return
		}

		for key, delta := range counts {
			if err := model.BatchIncrement(tx, key, delta); err != nil {
				_ = tx.Rollback()
				log.Printf("StoreBatch: failed to increment %s: %v", key, err)
				http.Error(w, "DB Write Error", http.StatusInternalServerError)
				return
			}
		}

		if err := tx.Commit(); err != nil {
			log.Printf("StoreBatch: failed to commit tx: %v", err)
			http.Error(w, "DB Commit Error", http.StatusInternalServerError)
			return
		}

		// 5. Response
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":       true,
			"ingested": len(batch.Events),
		})
	}
}