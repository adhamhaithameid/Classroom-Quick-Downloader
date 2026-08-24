package handlers

import (
	"strings"
	"testing"
)

// ──────────────────────────────────────────────────────────────────────────────
// sanitizeFailureField / sanitizeFailureDetail
// ──────────────────────────────────────────────────────────────────────────────

func TestSanitizeFailureField_EmptyFallback(t *testing.T) {
	if got := sanitizeFailureField("", "fallback"); got != "fallback" {
		t.Fatalf("expected fallback, got %q", got)
	}
}

func TestSanitizeFailureField_Normal(t *testing.T) {
	if got := sanitizeFailureField("ingest", "fallback"); got != "ingest" {
		t.Fatalf("expected ingest, got %q", got)
	}
}

func TestSanitizeFailureField_Truncation(t *testing.T) {
	long := strings.Repeat("x", 100)
	got := sanitizeFailureField(long, "fallback")
	if len(got) != maxFailureFieldLen {
		t.Fatalf("expected length %d, got %d", maxFailureFieldLen, len(got))
	}
}

func TestSanitizeFailureDetail_EmptyReturnsNA(t *testing.T) {
	if got := sanitizeFailureDetail(""); got != "n/a" {
		t.Fatalf("expected n/a, got %q", got)
	}
}

func TestSanitizeFailureDetail_Normal(t *testing.T) {
	if got := sanitizeFailureDetail("some error"); got != "some error" {
		t.Fatalf("expected 'some error', got %q", got)
	}
}

func TestSanitizeFailureDetail_Truncation(t *testing.T) {
	long := strings.Repeat("x", 500)
	got := sanitizeFailureDetail(long)
	if len(got) != maxFailureDetailLen {
		t.Fatalf("expected length %d, got %d", maxFailureDetailLen, len(got))
	}
}
