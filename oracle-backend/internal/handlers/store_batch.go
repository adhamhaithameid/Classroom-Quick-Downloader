// filepath: oracle-backend/internal/handlers/store_batch.go
package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/adhamhaithameid/cqd-oracle-backend/internal/model"
)

type Event struct {
	Type    string `json:"type"`
	Browser string `json:"browser"`
	Ts      int64  `json:"ts"`
}

type Batch struct {
	Events []Event `json:"events"`
}

func StoreBatch(db *sql.DB, secret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. Auth check
		if r.Header.Get("X-DO-SECRET") != secret {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// 2. Decode JSON
		var batch Batch
		if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		if len(batch.Events) == 0 {
			w.Write([]byte("no events"))
			return
		}

		// 3. Aggregate in memory first (Performance optimization)
		// We count everything up before hitting the DB to minimize writes.
		counts := make(map[string]int)

		for _, ev := range batch.Events {
			counts["total"]++ // Global download count

			if ev.Type != "" {
				counts["type:"+ev.Type]++
			}
			if ev.Browser != "" {
				counts["browser:"+ev.Browser]++
			}
		}

		// 4. Write to DB in a single transaction
		tx, err := db.Begin()
		if err != nil {
			log.Printf("Failed to begin tx: %v", err)
			http.Error(w, "DB Error", http.StatusInternalServerError)
			return
		}

		for key, delta := range counts {
			if err := model.BatchIncrement(tx, key, delta); err != nil {
				tx.Rollback()
				log.Printf("Failed to increment %s: %v", key, err)
				http.Error(w, "DB Write Error", http.StatusInternalServerError)
				return
			}
		}

		if err := tx.Commit(); err != nil {
			log.Printf("Failed to commit tx: %v", err)
			http.Error(w, "DB Commit Error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}
}