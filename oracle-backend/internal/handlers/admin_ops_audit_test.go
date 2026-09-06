package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"oracle-backend/internal/observability"
)

func TestAuditVerifyChainHandler(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	ctx := context.Background()
	ctx = observability.WithRequestContext(ctx, "req-test-1", "corr-test-1")
	ctx = observability.WithActorContext(ctx, "viewer", "token-1", "viewer")
	if err := AppendAuditLog(ctx, sqlDB, "test_action_1", "test_resource", "1", "ok", map[string]any{"k": "v"}); err != nil {
		t.Fatalf("AppendAuditLog #1 failed: %v", err)
	}
	time.Sleep(1 * time.Millisecond)
	if err := AppendAuditLog(ctx, sqlDB, "test_action_2", "test_resource", "2", "ok", map[string]any{"n": 2}); err != nil {
		t.Fatalf("AppendAuditLog #2 failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/audit/verify-chain", nil)
	rr := httptest.NewRecorder()
	AuditVerifyChainHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if valid, _ := resp["valid"].(bool); !valid {
		t.Fatalf("expected valid chain, got: %v", resp)
	}
}

func TestAppendAuditLog_ConcurrentWritersDoNotForkChain(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	const writers = 32
	start := make(chan struct{})
	errCh := make(chan error, writers)
	var wg sync.WaitGroup

	for i := 0; i < writers; i++ {
		i := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			ctx := context.Background()
			ctx = observability.WithRequestContext(ctx, fmt.Sprintf("req-conc-%d", i), fmt.Sprintf("corr-conc-%d", i))
			ctx = observability.WithActorContext(ctx, "user-conc", "token-conc", "super_admin")
			errCh <- AppendAuditLog(
				ctx,
				sqlDB,
				"concurrent_append",
				"audit",
				strconv.Itoa(i),
				"ok",
				map[string]any{"seq": i},
			)
		}()
	}

	close(start)
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatalf("concurrent append failed: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/audit/verify-chain", nil)
	rr := httptest.NewRecorder()
	AuditVerifyChainHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Valid     bool `json:"valid"`
		TotalRows int  `json:"totalRows"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if !resp.Valid {
		t.Fatalf("expected valid chain under concurrent appends, got %s", rr.Body.String())
	}
	if resp.TotalRows != writers {
		t.Fatalf("expected %d audit rows, got %d", writers, resp.TotalRows)
	}

	var duplicatePrevHashChains int64
	if err := sqlDB.QueryRow(
		`SELECT COUNT(*) FROM (
			SELECT prev_hash
			FROM admin_audit_log
			GROUP BY prev_hash
			HAVING COUNT(*) > 1
		)`,
	).Scan(&duplicatePrevHashChains); err != nil {
		t.Fatalf("failed to query duplicate prev_hash counts: %v", err)
	}
	if duplicatePrevHashChains != 0 {
		t.Fatalf("detected forked chain segments: %d duplicate predecessor hashes", duplicatePrevHashChains)
	}
}

func TestAuditVerifyChainHandler_DetectsPayloadHashTamper(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	payload := `{"a":1}`
	prev := strings.Repeat("0", 64)
	rowSum := sha256.Sum256([]byte(payload + ":" + prev))
	rowHash := hex.EncodeToString(rowSum[:])

	// Deliberately wrong payload_hash while row hash remains valid.
	if _, err := sqlDB.Exec(
		`INSERT INTO admin_audit_log (
			ts_utc, request_id, correlation_id, user_id, token_id, role,
			action_type, resource_type, resource_id, result, error_code,
			payload_json, prev_hash, payload_hash, row_hash
		) VALUES (?, 'r1', 'c1', 'u1', 't1', 'viewer', 'a', 'b', 'c', 'ok', '', ?, ?, ?, ?)`,
		time.Now().UnixMilli(),
		payload,
		prev,
		strings.Repeat("f", 64),
		rowHash,
	); err != nil {
		t.Fatalf("insert tampered row failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/audit/verify-chain", nil)
	rr := httptest.NewRecorder()
	AuditVerifyChainHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}
	if valid, _ := resp["valid"].(bool); valid {
		t.Fatalf("expected invalid chain due to payload hash mismatch: %v", resp)
	}
	if reason, _ := resp["reason"].(string); reason != "payload_hash_mismatch" {
		t.Fatalf("expected payload_hash_mismatch, got %v", resp["reason"])
	}
}

func TestAdminAuditLogAppendOnlyTriggers(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	ctx := context.Background()
	ctx = observability.WithRequestContext(ctx, "req-append-only", "corr-append-only")
	ctx = observability.WithActorContext(ctx, "viewer", "token", "viewer")
	if err := AppendAuditLog(ctx, sqlDB, "append_only_test", "audit", "1", "ok", map[string]any{"x": 1}); err != nil {
		t.Fatalf("AppendAuditLog failed: %v", err)
	}

	if _, err := sqlDB.Exec(`UPDATE admin_audit_log SET result = 'tampered' WHERE id = 1`); err == nil {
		t.Fatalf("expected update to fail due to append-only trigger")
	}
	if _, err := sqlDB.Exec(`DELETE FROM admin_audit_log WHERE id = 1`); err == nil {
		t.Fatalf("expected delete to fail due to append-only trigger")
	}
}
