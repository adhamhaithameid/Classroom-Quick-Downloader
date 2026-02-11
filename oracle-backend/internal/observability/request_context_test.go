package observability

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRequestContextMiddleware_UsesHeadersWhenProvided(t *testing.T) {
	var reqID, corrID string
	handler := RequestContextMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID = RequestIDFromContext(r.Context())
		corrID = CorrelationIDFromContext(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Request-ID", "req-123")
	req.Header.Set("X-Correlation-ID", "corr-456")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if reqID != "req-123" || corrID != "corr-456" {
		t.Fatalf("unexpected context ids: req=%q corr=%q", reqID, corrID)
	}
	if got := rr.Header().Get("X-Request-ID"); got != "req-123" {
		t.Fatalf("unexpected response request id: %q", got)
	}
	if got := rr.Header().Get("X-Correlation-ID"); got != "corr-456" {
		t.Fatalf("unexpected response correlation id: %q", got)
	}
}

func TestRequestContextMiddleware_GeneratesWhenMissing(t *testing.T) {
	var reqID, corrID string
	handler := RequestContextMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID = RequestIDFromContext(r.Context())
		corrID = CorrelationIDFromContext(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if !strings.HasPrefix(reqID, "req-") {
		t.Fatalf("expected generated request id, got %q", reqID)
	}
	if !strings.HasPrefix(corrID, "corr-") {
		t.Fatalf("expected generated correlation id, got %q", corrID)
	}
}

func TestActorContext_DefaultsAndOverrides(t *testing.T) {
	if got := UserIDFromContext(nil); got != "anonymous" {
		t.Fatalf("unexpected default user: %q", got)
	}
	if got := TokenIDFromContext(nil); got != "none" {
		t.Fatalf("unexpected default token: %q", got)
	}
	if got := RoleFromContext(nil); got != "viewer" {
		t.Fatalf("unexpected default role: %q", got)
	}

	ctx := WithActorContext(context.Background(), "u1", "t1", "admin")
	if got := UserIDFromContext(ctx); got != "u1" {
		t.Fatalf("unexpected user override: %q", got)
	}
	if got := TokenIDFromContext(ctx); got != "t1" {
		t.Fatalf("unexpected token override: %q", got)
	}
	if got := RoleFromContext(ctx); got != "admin" {
		t.Fatalf("unexpected role override: %q", got)
	}
}
