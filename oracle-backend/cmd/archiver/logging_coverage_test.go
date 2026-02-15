package main

import (
	"bytes"
	"log"
	"strings"
	"testing"
)

func TestLogEvent_EmitsJSONPayload(t *testing.T) {
	var buf bytes.Buffer
	prevWriter := log.Writer()
	prevFlags := log.Flags()
	log.SetOutput(&buf)
	log.SetFlags(0)
	defer log.SetOutput(prevWriter)
	defer log.SetFlags(prevFlags)

	logEvent("info", "archiver_test_event", map[string]interface{}{"k": "v"})

	out := buf.String()
	if !strings.Contains(out, `"level":"info"`) {
		t.Fatalf("expected level field in log output, got: %s", out)
	}
	if !strings.Contains(out, `"message":"archiver_test_event"`) {
		t.Fatalf("expected message field in log output, got: %s", out)
	}
}
