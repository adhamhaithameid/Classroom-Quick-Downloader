package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"os"
	"testing"
	"time"

	"oracle-backend/internal/observability"
)

func captureLogOutput(fn func()) string {
	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)
	fn()
	return buf.String()
}

func TestLogEvent_ProducesStructuredJSON(t *testing.T) {
	// Arrange & Act
	output := captureLogOutput(func() {
		logEvent("info", "test_action", map[string]interface{}{
			"key": "value",
			"num": 42,
		})
	})

	// Assert — strip the standard log prefix (date+time) to get the JSON portion
	// The log.Println output includes a prefix like "2006/01/02 15:04:05 "
	if output == "" {
		t.Fatalf("expected non-empty log output")
	}

	// Find the JSON part (starts with '{')
	idx := bytes.IndexByte([]byte(output), '{')
	if idx == -1 {
		t.Fatalf("expected JSON in log output, got: %q", output)
	}
	jsonPart := output[idx:]

	var parsed logPayload
	if err := json.Unmarshal([]byte(jsonPart), &parsed); err != nil {
		t.Fatalf("log output is not valid JSON: %v, raw: %q", err, jsonPart)
	}
	if parsed.Level != "info" {
		t.Fatalf("expected level=info, got %q", parsed.Level)
	}
	if parsed.Message != "test_action" {
		t.Fatalf("expected message=test_action, got %q", parsed.Message)
	}
	if parsed.Fields["key"] != "value" {
		t.Fatalf("expected field key=value, got %v", parsed.Fields["key"])
	}
}

func TestLogEvent_IncludesUTCTimestamp(t *testing.T) {
	// Arrange & Act
	before := time.Now().UTC()
	output := captureLogOutput(func() {
		logEvent("warn", "ts_test", nil)
	})
	after := time.Now().UTC()

	// Assert
	idx := bytes.IndexByte([]byte(output), '{')
	if idx == -1 {
		t.Fatalf("expected JSON in log output")
	}
	var parsed logPayload
	if err := json.Unmarshal([]byte(output[idx:]), &parsed); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	ts, err := time.Parse(time.RFC3339, parsed.Time)
	if err != nil {
		t.Fatalf("time field is not RFC3339: %q", parsed.Time)
	}
	if ts.Before(before.Add(-time.Second)) || ts.After(after.Add(time.Second)) {
		t.Fatalf("timestamp %v is out of expected range [%v, %v]", ts, before, after)
	}
}

func TestLogEvent_HandlesNilFields(t *testing.T) {
	// Arrange & Act — should not panic
	output := captureLogOutput(func() {
		logEvent("error", "nil_fields", nil)
	})

	// Assert
	if output == "" {
		t.Fatalf("expected non-empty log output for nil fields")
	}
	idx := bytes.IndexByte([]byte(output), '{')
	if idx == -1 {
		t.Fatalf("expected JSON in log output")
	}
	var parsed logPayload
	if err := json.Unmarshal([]byte(output[idx:]), &parsed); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if parsed.Level != "error" {
		t.Fatalf("expected level=error, got %q", parsed.Level)
	}
}

func TestLogEvent_HandlesEmptyFields(t *testing.T) {
	// Arrange & Act
	output := captureLogOutput(func() {
		logEvent("debug", "empty_fields", map[string]interface{}{})
	})

	// Assert
	idx := bytes.IndexByte([]byte(output), '{')
	if idx == -1 {
		t.Fatalf("expected JSON in log output")
	}
	var parsed logPayload
	if err := json.Unmarshal([]byte(output[idx:]), &parsed); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if parsed.Message != "empty_fields" {
		t.Fatalf("expected message=empty_fields, got %q", parsed.Message)
	}
}

func TestLogEventWithContext_IncludesRequestAndCorrelationIDs(t *testing.T) {
	ctx := observability.WithRequestContext(context.Background(), "req-test-123", "corr-test-456")

	output := captureLogOutput(func() {
		logEventWithContext(ctx, "info", "ctx_test", map[string]interface{}{"ok": true})
	})

	idx := bytes.IndexByte([]byte(output), '{')
	if idx == -1 {
		t.Fatalf("expected JSON in log output")
	}
	var parsed logPayload
	if err := json.Unmarshal([]byte(output[idx:]), &parsed); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if parsed.RequestID != "req-test-123" {
		t.Fatalf("expected requestId=req-test-123, got %q", parsed.RequestID)
	}
	if parsed.CorrelationID != "corr-test-456" {
		t.Fatalf("expected correlationId=corr-test-456, got %q", parsed.CorrelationID)
	}
}
