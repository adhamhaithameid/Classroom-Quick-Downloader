package db

import (
	"os"
	"testing"
)

func TestInitPostgres_Smoke(t *testing.T) {
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		t.Skip("POSTGRES_DSN not set")
	}

	pg, err := InitPostgres(dsn)
	if err != nil {
		t.Fatalf("InitPostgres failed: %v", err)
	}
	defer pg.Close()

	var count int
	if err := pg.QueryRow(`SELECT COUNT(*) FROM raw_ingest_events`).Scan(&count); err != nil {
		t.Fatalf("expected raw_ingest_events table to exist: %v", err)
	}
}
