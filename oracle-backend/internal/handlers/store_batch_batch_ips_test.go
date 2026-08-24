package handlers

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	model "oracle-backend/internal/model"
)

// ──────────────────────────────────────────────────────────────────────────────
// isValidIP
// ──────────────────────────────────────────────────────────────────────────────

func TestIsValidIP_Accepts(t *testing.T) {
	cases := []string{"127.0.0.1", "192.168.1.1", "::1", "2001:db8::1", "8.8.8.8"}
	for _, ip := range cases {
		if !isValidIP(ip) {
			t.Errorf("expected %q to be valid", ip)
		}
	}
}

func TestIsValidIP_Rejects(t *testing.T) {
	cases := []string{"", "unknown", "not-an-ip", "999.999.999.999", "abc"}
	for _, ip := range cases {
		if isValidIP(ip) {
			t.Errorf("expected %q to be invalid", ip)
		}
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// insertBatchIPs
// ──────────────────────────────────────────────────────────────────────────────

func TestInsertBatchIPs_SkipsEmptyBatch(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	batch := &model.OracleBatch{BatchID: "b-empty", UniqueIps: []string{}}
	tx, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback()

	if err := insertBatchIPs(context.Background(), tx, batch); err != nil {
		t.Fatalf("expected nil for empty IPs, got %v", err)
	}
}

func TestInsertBatchIPs_SkipsInvalidIPs(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	batch := &model.OracleBatch{BatchID: "b-invalid", UniqueIps: []string{"", "unknown", "garbage"}}
	tx, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback()

	if err := insertBatchIPs(context.Background(), tx, batch); err != nil {
		t.Fatalf("expected nil for all-invalid IPs, got %v", err)
	}
}

func TestInsertBatchIPs_CanonicalizesIPv6(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	// Ensure batch row exists for FK
	if _, err := sqlDB.Exec(`INSERT INTO batches (batch_id, generated_at, ingested_at, time_zone, events_count, downloads_count, success_count, fail_count) VALUES ('b-ipv6', 0, 0, 'UTC', 0, 0, 0, 0)`); err != nil {
		t.Fatalf("insert batch: %v", err)
	}

	batch := &model.OracleBatch{
		BatchID:   "b-ipv6",
		UniqueIps: []string{"::1", "0:0:0:0:0:0:0:1", "127.0.0.1"},
	}
	tx, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}

	if err := insertBatchIPs(context.Background(), tx, batch); err != nil {
		t.Fatalf("insertBatchIPs: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	var rawIPs string
	if err := sqlDB.QueryRow(`SELECT unique_ips FROM batch_ips WHERE batch_id = 'b-ipv6'`).Scan(&rawIPs); err != nil {
		t.Fatalf("query batch_ips: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(rawIPs), &parsed); err != nil {
		t.Fatalf("parse unique_ips JSON: %v", err)
	}

	// ::1 and 0:0:0:0:0:0:0:1 should canonicalize to same IP = 2 unique IPs total
	count, ok := parsed["count"].(float64)
	if !ok {
		t.Fatalf("expected count in JSON, got %#v", parsed)
	}
	if int(count) != 2 {
		t.Fatalf("expected 2 unique IPs (::1 canonicalized + 127.0.0.1), got %d", int(count))
	}
}

func TestInsertBatchIPs_TruncatesAt500(t *testing.T) {
	sqlDB := newTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`INSERT INTO batches (batch_id, generated_at, ingested_at, time_zone, events_count, downloads_count, success_count, fail_count) VALUES ('b-trunc', 0, 0, 'UTC', 0, 0, 0, 0)`); err != nil {
		t.Fatalf("insert batch: %v", err)
	}

	// Generate 600 unique IPs
	ips := make([]string, 600)
	for i := 0; i < 600; i++ {
		ips[i] = "10." + strings.Repeat("0", 0) + string(rune('0'+(i/256)%10)) + "." + string(rune('0'+(i/10)%10)) + string(rune('0'+i%10)) + ".1"
	}
	// Use a simpler approach: generate 10.X.Y.Z IPs
	ips = make([]string, 600)
	for i := 0; i < 600; i++ {
		a := (i / 256) % 256
		b := i % 256
		ips[i] = "10.0." + itoa(a) + "." + itoa(b)
	}

	batch := &model.OracleBatch{BatchID: "b-trunc", UniqueIps: ips}
	tx, err := sqlDB.Begin()
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}

	if err := insertBatchIPs(context.Background(), tx, batch); err != nil {
		t.Fatalf("insertBatchIPs: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	var rawIPs string
	if err := sqlDB.QueryRow(`SELECT unique_ips FROM batch_ips WHERE batch_id = 'b-trunc'`).Scan(&rawIPs); err != nil {
		t.Fatalf("query batch_ips: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(rawIPs), &parsed); err != nil {
		t.Fatalf("parse unique_ips JSON: %v", err)
	}

	isTruncated, _ := parsed["is_truncated"].(bool)
	if !isTruncated {
		t.Fatalf("expected is_truncated=true for >500 IPs")
	}

	storedIPs, ok := parsed["ips"].([]interface{})
	if !ok {
		t.Fatalf("expected ips array in JSON")
	}
	if len(storedIPs) > 500 {
		t.Fatalf("expected at most 500 stored IPs, got %d", len(storedIPs))
	}
}
