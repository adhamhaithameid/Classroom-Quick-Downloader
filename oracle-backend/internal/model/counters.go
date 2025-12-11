// filepath: oracle-backend/internal/model/counters.go
package model

import (
	"database/sql"
)

// BatchIncrement updates a counter by a specific delta (usually +1).
// It handles the "upsert" logic: insert if new, update if exists.
func BatchIncrement(tx *sql.Tx, key string, delta int) error {
	query := `
	INSERT INTO counters(key, value)
	VALUES(?, ?)
	ON CONFLICT(key) DO UPDATE SET value = counters.value + excluded.value;
	`
	_, err := tx.Exec(query, key, delta)
	return err
}

// GetAllCounters fetches all raw counters from the database.
func GetAllCounters(db *sql.DB) (map[string]int64, error) {
	rows, err := db.Query("SELECT key, value FROM counters")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]int64)
	for rows.Next() {
		var key string
		var value int64
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		result[key] = value
	}
	return result, nil
}