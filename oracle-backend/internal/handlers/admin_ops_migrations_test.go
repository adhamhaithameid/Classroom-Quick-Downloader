package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMigrationsStatusHandler_StateMatrix(t *testing.T) {
	tests := []struct {
		name               string
		postgresConfigured bool
		postgresErr        *string
		wantStatus         string
		wantConfigured     bool
	}{
		{
			name:               "postgres-disabled",
			postgresConfigured: false,
			postgresErr:        nil,
			wantStatus:         "disabled",
			wantConfigured:     false,
		},
		{
			name:               "postgres-ready",
			postgresConfigured: true,
			postgresErr:        nil,
			wantStatus:         "ready",
			wantConfigured:     true,
		},
		{
			name:               "postgres-error",
			postgresConfigured: true,
			postgresErr:        ptr("dsn auth failed"),
			wantStatus:         "error",
			wantConfigured:     true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/admin/migrations/status", nil)
			rr := httptest.NewRecorder()
			MigrationsStatusHandler(tc.postgresConfigured, tc.postgresErr).ServeHTTP(rr, req)
			if rr.Code != http.StatusOK {
				t.Fatalf("migrations status failed: %d %s", rr.Code, rr.Body.String())
			}

			var payload map[string]any
			if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
				t.Fatalf("parse payload failed: %v", err)
			}
			postgres, _ := payload["postgres"].(map[string]any)
			if postgres == nil {
				t.Fatalf("postgres payload missing: %#v", payload)
			}
			if got, _ := postgres["status"].(string); got != tc.wantStatus {
				t.Fatalf("unexpected postgres status=%q want=%q", got, tc.wantStatus)
			}
			if got, _ := postgres["configured"].(bool); got != tc.wantConfigured {
				t.Fatalf("unexpected postgres configured=%v want=%v", got, tc.wantConfigured)
			}
		})
	}
}
