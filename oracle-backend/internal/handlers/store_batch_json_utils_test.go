package handlers

import (
	"testing"
	"time"
)

// ──────────────────────────────────────────────────────────────────────────────
// dayUTC
// ──────────────────────────────────────────────────────────────────────────────

func TestDayUTC_FormatsCorrectly(t *testing.T) {
	// 2026-02-11 00:00:00 UTC in milliseconds
	tsMs := time.Date(2026, 2, 11, 15, 30, 0, 0, time.UTC).UnixMilli()
	got := dayUTC(tsMs)
	if got != "2026-02-11" {
		t.Fatalf("expected 2026-02-11, got %q", got)
	}
}

func TestDayUTC_HandlesEpochZero(t *testing.T) {
	got := dayUTC(0)
	if got != "1970-01-01" {
		t.Fatalf("expected 1970-01-01, got %q", got)
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// walkJSONPaths
// ──────────────────────────────────────────────────────────────────────────────

func TestWalkJSONPaths_FlatObject(t *testing.T) {
	input := map[string]interface{}{
		"name":  "test",
		"count": float64(42),
		"flag":  true,
	}
	out := make(map[string]string)
	walkJSONPaths("", input, out)

	if out["name"] != "string" {
		t.Fatalf("expected name→string, got %q", out["name"])
	}
	if out["count"] != "number" {
		t.Fatalf("expected count→number, got %q", out["count"])
	}
	if out["flag"] != "bool" {
		t.Fatalf("expected flag→bool, got %q", out["flag"])
	}
}

func TestWalkJSONPaths_NestedObject(t *testing.T) {
	input := map[string]interface{}{
		"outer": map[string]interface{}{
			"inner": "value",
		},
	}
	out := make(map[string]string)
	walkJSONPaths("", input, out)

	if out["outer.inner"] != "string" {
		t.Fatalf("expected outer.inner→string, got %q", out["outer.inner"])
	}
}

func TestWalkJSONPaths_Array(t *testing.T) {
	input := map[string]interface{}{
		"items": []interface{}{"a", "b"},
	}
	out := make(map[string]string)
	walkJSONPaths("", input, out)

	if out["items[]"] != "array" {
		t.Fatalf("expected items[]→array, got %q", out["items[]"])
	}
}

func TestWalkJSONPaths_NullValue(t *testing.T) {
	input := map[string]interface{}{
		"missing": nil,
	}
	out := make(map[string]string)
	walkJSONPaths("", input, out)

	if out["missing"] != "null" {
		t.Fatalf("expected missing→null, got %q", out["missing"])
	}
}

func TestWalkJSONPaths_EmptyMap(t *testing.T) {
	out := make(map[string]string)
	walkJSONPaths("", map[string]interface{}{}, out)

	if len(out) != 0 {
		t.Fatalf("expected no paths for empty map, got %d", len(out))
	}
}
