package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGitHubOpenCountsHandler_InvalidRepoSlug(t *testing.T) {
	h := GitHubOpenCountsHandler("invalid slug", "", time.Minute)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/github/open-counts", nil)
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for invalid repo slug, got %d", rr.Code)
	}
}
