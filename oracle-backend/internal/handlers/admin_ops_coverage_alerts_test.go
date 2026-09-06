package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// AlertsHandler
// ---------------------------------------------------------------------------

func TestAlertsHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/alerts", nil)
	AlertsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestAlertsHandler_EmptyDB(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/alerts", nil)
	AlertsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// truncateAlertError
// ---------------------------------------------------------------------------

func TestTruncateAlertError_Short(t *testing.T) {
	s := truncateAlertError("short")
	if s != "short" {
		t.Fatalf("expected unchanged string, got %q", s)
	}
}

func TestTruncateAlertError_Long(t *testing.T) {
	long := strings.Repeat("x", 1000)
	s := truncateAlertError(long)
	if len(s) == len(long) {
		t.Fatal("expected truncated string for long error")
	}
}

// ---------------------------------------------------------------------------
// upsertOpenAlert (admin_ops version)
// ---------------------------------------------------------------------------

func TestUpsertOpenAlert_NewAlert(t *testing.T) {
	d := openAdminCoverageDB(t)
	err := upsertOpenAlert(context.Background(), d, "test_alert", "warn", "test message", map[string]any{"key": "val"})
	if err != nil {
		t.Fatal(err)
	}
	var count int64
	d.QueryRow("SELECT COUNT(*) FROM system_alerts WHERE alert_type = 'test_alert'").Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 alert, got %d", count)
	}
}

func TestUpsertOpenAlert_UpdateExistingAlert(t *testing.T) {
	d := openAdminCoverageDB(t)
	upsertOpenAlert(context.Background(), d, "test_alert2", "warn", "msg1", map[string]any{})
	upsertOpenAlert(context.Background(), d, "test_alert2", "critical", "msg2", map[string]any{})
	var count int64
	d.QueryRow("SELECT COUNT(*) FROM system_alerts WHERE alert_type = 'test_alert2'").Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 alert after update, got %d", count)
	}
}

// ---------------------------------------------------------------------------
// AlertsHandler edge cases
// ---------------------------------------------------------------------------

func TestAlertsHandler_WithData(t *testing.T) {
	d := openAdminCoverageDB(t)
	upsertOpenAlert(context.Background(), d, "test_alert_data", "info", "alert msg", map[string]any{"k": "v"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/alerts", nil)
	AlertsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	alerts := resp["alerts"].([]interface{})
	if len(alerts) < 1 {
		t.Fatal("expected at least 1 alert")
	}
}
