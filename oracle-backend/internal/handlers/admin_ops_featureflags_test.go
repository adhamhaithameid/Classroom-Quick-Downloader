package handlers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFeatureFlagHandlers(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	getReq := httptest.NewRequest(http.MethodGet, "/api/admin/flags", nil)
	getRR := httptest.NewRecorder()
	FeatureFlagsHandler(sqlDB).ServeHTTP(getRR, getReq)
	if getRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from feature flags get, got %d", getRR.Code)
	}

	updatePayload := `{"name":"feature_sync_enabled","enabled":true}`
	updateReq := httptest.NewRequest(http.MethodPost, "/api/admin/flags/update", bytes.NewBufferString(updatePayload))
	updateReq.Header.Set("Content-Type", "application/json")
	updateRR := httptest.NewRecorder()
	UpdateFeatureFlagHandler(sqlDB).ServeHTTP(updateRR, updateReq)
	if updateRR.Code != http.StatusOK {
		t.Fatalf("expected 200 from feature flags update, got %d: %s", updateRR.Code, updateRR.Body.String())
	}

	enabled, err := IsFeatureEnabled(context.Background(), sqlDB, "feature_sync_enabled")
	if err != nil {
		t.Fatalf("IsFeatureEnabled failed: %v", err)
	}
	if !enabled {
		t.Fatalf("expected feature_sync_enabled to be true")
	}
}
