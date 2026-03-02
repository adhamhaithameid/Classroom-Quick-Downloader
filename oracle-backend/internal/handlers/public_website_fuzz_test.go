package handlers

import (
	"testing"
	"time"
)

func FuzzSanitizeWebsiteEventForAggregate(f *testing.F) {
	f.Add("event-000001", "cta", "install_click", "hero_install", int64(1771800000000))
	f.Add("event-000002", "map", "map_yes", "map_prompt_yes", int64(1771800000000))
	f.Add("bad", "cta", "install_click", "hero_install", int64(0))
	f.Add("event-000003", "map", "unknown", "hero_install", int64(-1))
	f.Add("event-000004", "", "download_click", "hero_download", int64(1771800000000))

	nowUTC := time.Date(2026, time.February, 26, 12, 0, 0, 0, time.UTC)

	f.Fuzz(func(t *testing.T, eventID, eventType, action, placement string, tsUtc int64) {
		input := publicWebsiteEventIngestEvent{
			EventID:   eventID,
			EventType: eventType,
			Action:    action,
			Placement: placement,
			TSUTC:     &tsUtc,
		}

		outEventID, outEventType, outAction, outPlacement, outDayUTC, ok := sanitizeWebsiteEventForAggregate(input, nowUTC)

		if !ok {
			if outEventID != "" || outEventType != "" || outAction != "" || outPlacement != "" || outDayUTC != "" {
				t.Fatalf("invalid events must return empty outputs, got id=%q type=%q action=%q placement=%q day=%q", outEventID, outEventType, outAction, outPlacement, outDayUTC)
			}
			return
		}

		expectedType, exists := publicWebsiteEventActionToType[outAction]
		if !exists {
			t.Fatalf("accepted action not in allowlist: %q", outAction)
		}
		if outEventType != expectedType {
			t.Fatalf("event/action mismatch: action=%q expected type=%q got type=%q", outAction, expectedType, outEventType)
		}
		if len(outEventID) < 6 || len(outEventID) > 120 {
			t.Fatalf("accepted eventId length out of range: %q", outEventID)
		}
		if len(outDayUTC) != len("2006-01-02") {
			t.Fatalf("unexpected dayUTC format: %q", outDayUTC)
		}
		if outPlacement == "" {
			t.Fatal("placement must never be empty for accepted events")
		}
	})
}

func FuzzSanitizeWebsiteEventPlacement(f *testing.F) {
	f.Add("hero_install")
	f.Add("MAP_PROMPT_YES")
	f.Add("<script>alert(1)</script>")
	f.Add("   ")

	f.Fuzz(func(t *testing.T, raw string) {
		placement := sanitizeWebsiteEventPlacement(raw)
		if placement == "" {
			t.Fatal("placement sanitizer must never return empty string")
		}
		if placement != "unknown" {
			if _, ok := publicWebsiteEventAllowedPlacements[placement]; !ok {
				t.Fatalf("placement returned value not in allowlist: %q", placement)
			}
		}
	})
}
