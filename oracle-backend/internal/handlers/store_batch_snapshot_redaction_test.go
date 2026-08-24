package handlers

import (
	"encoding/json"
	"testing"
)

// ──────────────────────────────────────────────────────────────────────────────
// sanitizeRawSnapshotPayload / isSensitiveRawSnapshotKey / redactRawSnapshotValue
// ──────────────────────────────────────────────────────────────────────────────

func TestSanitizeRawSnapshotPayload_RedactsIPValues(t *testing.T) {
	input := `{"name":"test","address":"192.168.1.1"}`
	got := sanitizeRawSnapshotPayload([]byte(input))

	var parsed map[string]interface{}
	if err := json.Unmarshal(got, &parsed); err != nil {
		t.Fatalf("parse sanitized: %v", err)
	}
	// "192.168.1.1" is a valid IP string, should be redacted
	if parsed["address"] != "[REDACTED_IP]" {
		t.Fatalf("expected address to be redacted, got %v", parsed["address"])
	}
	if parsed["name"] != "test" {
		t.Fatalf("expected name to remain 'test', got %v", parsed["name"])
	}
}

func TestSanitizeRawSnapshotPayload_RedactsSensitiveKeys(t *testing.T) {
	input := `{"ip":"8.8.8.8","clientIp":"1.1.1.1","data":"kept"}`
	got := sanitizeRawSnapshotPayload([]byte(input))

	var parsed map[string]interface{}
	if err := json.Unmarshal(got, &parsed); err != nil {
		t.Fatalf("parse sanitized: %v", err)
	}

	if parsed["ip"] != "[REDACTED]" {
		t.Fatalf("expected ip key to be redacted, got %v", parsed["ip"])
	}
	if parsed["data"] != "kept" {
		t.Fatalf("expected data to remain, got %v", parsed["data"])
	}
}

func TestSanitizeRawSnapshotPayload_PreservesNonIPStrings(t *testing.T) {
	input := `{"name":"alice","status":"ok","count":42}`
	got := sanitizeRawSnapshotPayload([]byte(input))

	var parsed map[string]interface{}
	if err := json.Unmarshal(got, &parsed); err != nil {
		t.Fatalf("parse sanitized: %v", err)
	}
	if parsed["name"] != "alice" {
		t.Fatalf("expected name=alice, got %v", parsed["name"])
	}
	if parsed["status"] != "ok" {
		t.Fatalf("expected status=ok, got %v", parsed["status"])
	}
}

func TestSanitizeRawSnapshotPayload_InvalidJSON(t *testing.T) {
	input := []byte(`{invalid`)
	got := sanitizeRawSnapshotPayload(input)
	if string(got) != string(input) {
		t.Fatalf("expected original bytes for invalid JSON, got %q", string(got))
	}
}

func TestIsSensitiveRawSnapshotKey_NormalizedKeys(t *testing.T) {
	sensitiveKeys := []string{"ip", "IP", "client-ip", "CLIENT_IP", "uniqueIps", "raw_ips", "ipAddress"}
	for _, key := range sensitiveKeys {
		if !isSensitiveRawSnapshotKey(key) {
			t.Errorf("expected %q to be sensitive", key)
		}
	}

	safeKeys := []string{"name", "status", "count", "batchId", "type"}
	for _, key := range safeKeys {
		if isSensitiveRawSnapshotKey(key) {
			t.Errorf("expected %q to NOT be sensitive", key)
		}
	}
}

func TestRedactedRawSnapshotValue_Array(t *testing.T) {
	input := []interface{}{"a", "b", "c"}
	got := redactedRawSnapshotValue(input)

	m, ok := got.(map[string]any)
	if !ok {
		t.Fatalf("expected map, got %T", got)
	}
	if m["redacted"] != true {
		t.Fatalf("expected redacted=true")
	}
	if m["count"] != 3 {
		t.Fatalf("expected count=3, got %v", m["count"])
	}
}

func TestRedactedRawSnapshotValue_Map(t *testing.T) {
	input := map[string]interface{}{"a": 1, "b": 2}
	got := redactedRawSnapshotValue(input)

	m, ok := got.(map[string]any)
	if !ok {
		t.Fatalf("expected map, got %T", got)
	}
	if m["redacted"] != true {
		t.Fatalf("expected redacted=true")
	}
	if m["keys"] != 2 {
		t.Fatalf("expected keys=2, got %v", m["keys"])
	}
}

func TestRedactedRawSnapshotValue_Scalar(t *testing.T) {
	got := redactedRawSnapshotValue("some string")
	if got != "[REDACTED]" {
		t.Fatalf("expected [REDACTED], got %v", got)
	}
}
