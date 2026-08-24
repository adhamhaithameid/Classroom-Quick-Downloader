package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---------------------------------------------------------------------------
// FeatureFlagsHandler
// ---------------------------------------------------------------------------

func TestFeatureFlagsHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/flags", nil)
	FeatureFlagsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestFeatureFlagsHandler_ReturnsSeedFlags(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/flags", nil)
	FeatureFlagsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	flags := resp["flags"].([]interface{})
	if len(flags) < 5 {
		t.Fatalf("expected at least 5 seeded flags, got %d", len(flags))
	}
}

// ---------------------------------------------------------------------------
// UpdateFeatureFlagHandler
// ---------------------------------------------------------------------------

func TestUpdateFeatureFlagHandler_MethodNotAllowed(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/flags/update", nil)
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestUpdateFeatureFlagHandler_EmptyName(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"name": "", "enabled": true})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/flags/update", bytes.NewReader(body))
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateFeatureFlagHandler_InvalidBody(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/flags/update", bytes.NewReader([]byte("bad")))
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateFeatureFlagHandler_NotFoundFlag(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"name": "nonexistent_flag", "enabled": true})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/flags/update", bytes.NewReader(body))
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 404 {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
}

func TestUpdateFeatureFlagHandler_Success(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"name": "feature_sync_enabled", "enabled": false})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/flags/update", bytes.NewReader(body))
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// IsFeatureEnabled
// ---------------------------------------------------------------------------

func TestIsFeatureEnabled_Exists(t *testing.T) {
	d := openAdminCoverageDB(t)
	enabled, err := IsFeatureEnabled(context.Background(), d, "feature_sync_enabled")
	if err != nil {
		t.Fatal(err)
	}
	if !enabled {
		t.Fatal("expected feature_sync_enabled to be on by default")
	}
}

func TestIsFeatureEnabled_NoRows(t *testing.T) {
	d := openAdminCoverageDB(t)
	enabled, err := IsFeatureEnabled(context.Background(), d, "nonexistent_flag")
	if err != nil {
		t.Fatal(err)
	}
	if enabled {
		t.Fatal("expected false for nonexistent flag")
	}
}

// ---------------------------------------------------------------------------
// FeatureFlagsHandler edge cases
// ---------------------------------------------------------------------------

func TestFeatureFlagsHandler_WithFlags(t *testing.T) {
	d := openAdminCoverageDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	FeatureFlagsHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["ok"] != true {
		t.Fatal("expected ok=true")
	}
	flags := resp["flags"].([]interface{})
	if len(flags) == 0 {
		t.Fatal("expected seeded flags")
	}
}

func TestUpdateFeatureFlagHandler_SuccessCoverage(t *testing.T) {
	d := openAdminCoverageDB(t)
	body, _ := json.Marshal(map[string]interface{}{"name": "feature_sync_enabled", "enabled": true})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/feature-flags/update", bytes.NewReader(body))
	UpdateFeatureFlagHandler(d).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}
