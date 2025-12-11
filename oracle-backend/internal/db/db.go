//filepath: oracle-backend/internal/db/db.go
package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3" // Import for side-effects
)

// Open initializes the SQLite database connection and runs migrations.
func Open(dbPath string) (*sql.DB, error) {
	// Ensure the directory exists
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	// Open the database
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open db: %w", err)
	}

	// Apply performance PRAGMAs
	if _, err := db.Exec("PRAGMA journal_mode = WAL;"); err != nil {
		return nil, fmt.Errorf("failed to set WAL mode: %w", err)
	}
	if _, err := db.Exec("PRAGMA synchronous = NORMAL;"); err != nil {
		return nil, fmt.Errorf("failed to set synchronous mode: %w", err)
	}

	// Run migrations
	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

func migrate(db *sql.DB) error {
	// Create the main counters table
	// We use text keys like "total", "type:pdf", "browser:chrome"
	query := `
	CREATE TABLE IF NOT EXISTS counters (
		key   TEXT PRIMARY KEY,
		value INTEGER NOT NULL DEFAULT 0
	);
	`
	if _, err := db.Exec(query); err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	// Seed the base 'total' counter if it doesn't exist
	_, err := db.Exec("INSERT OR IGNORE INTO counters(key, value) VALUES ('total', 0);")
	return err
}