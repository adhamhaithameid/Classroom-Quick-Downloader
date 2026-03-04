package handlers

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestPublicWebsiteSanitizePlacement_MassiveMatrix(t *testing.T) {
	allowed := make([]string, 0, len(publicWebsiteEventAllowedPlacements))
	for placement := range publicWebsiteEventAllowedPlacements {
		allowed = append(allowed, placement)
	}
	if len(allowed) == 0 {
		t.Fatal("expected non-empty placement allowlist")
	}

	for i := 0; i < 420; i++ {
		i := i
		t.Run(fmt.Sprintf("placement_case_%03d", i), func(t *testing.T) {
			t.Parallel()
			if i%3 == 0 {
				raw := strings.ToUpper(allowed[i%len(allowed)])
				got := sanitizeWebsiteEventPlacement(raw)
				want := strings.ToLower(raw)
				if got != want {
					t.Fatalf("expected normalized allowed placement %q, got %q", want, got)
				}
				return
			}

			if i%3 == 1 {
				got := sanitizeWebsiteEventPlacement("   ")
				if got != "unknown" {
					t.Fatalf("expected unknown for blank placement, got %q", got)
				}
				return
			}

			raw := fmt.Sprintf("not_allowed_%03d", i)
			got := sanitizeWebsiteEventPlacement(raw)
			if got != "unknown" {
				t.Fatalf("expected unknown for disallowed placement %q, got %q", raw, got)
			}
		})
	}
}

func TestPublicWebsiteSanitizeAggregate_MassiveMatrix(t *testing.T) {
	actions := make([]string, 0, len(publicWebsiteEventActionToType))
	for action := range publicWebsiteEventActionToType {
		actions = append(actions, action)
	}
	if len(actions) == 0 {
		t.Fatal("expected non-empty action map")
	}

	placements := make([]string, 0, len(publicWebsiteEventAllowedPlacements))
	for placement := range publicWebsiteEventAllowedPlacements {
		placements = append(placements, placement)
	}
	if len(placements) == 0 {
		t.Fatal("expected non-empty placement map")
	}

	refNow := time.Date(2026, 3, 3, 12, 0, 0, 0, time.UTC)

	for i := 0; i < 720; i++ {
		i := i
		t.Run(fmt.Sprintf("aggregate_case_%03d", i), func(t *testing.T) {
			t.Parallel()
			action := actions[i%len(actions)]
			expectedType := publicWebsiteEventActionToType[action]
			placement := placements[i%len(placements)]
			ts := refNow.Add(time.Duration(i) * time.Minute).UnixMilli()

			event := publicWebsiteEventIngestEvent{
				EventID:   fmt.Sprintf("evt-%03d-id", i),
				EventType: expectedType,
				Action:    action,
				Placement: placement,
				TSUTC:     &ts,
			}

			switch i % 6 {
			case 0:
				// valid baseline
			case 1:
				// missing eventType should be inferred from action and still valid
				event.EventType = ""
			case 2:
				// invalid ID should fail
				event.EventID = "!"
			case 3:
				// mismatched type should fail
				if expectedType == "cta" {
					event.EventType = "map"
				} else {
					event.EventType = "cta"
				}
			case 4:
				// invalid action should fail
				event.Action = "unknown_action"
			case 5:
				// invalid placement should degrade to unknown but remain valid
				event.Placement = "weird-placement"
			}

			eventID, eventType, outAction, outPlacement, dayUTC, ok := sanitizeWebsiteEventForAggregate(event, refNow)
			expectValid := i%6 == 0 || i%6 == 1 || i%6 == 5

			if ok != expectValid {
				t.Fatalf("expected ok=%v, got %v (case=%d)", expectValid, ok, i)
			}
			if !ok {
				return
			}

			if eventID == "" || outAction == "" || eventType == "" || dayUTC == "" {
				t.Fatalf("expected non-empty sanitized fields, got id=%q type=%q action=%q day=%q", eventID, eventType, outAction, dayUTC)
			}
			if outAction != strings.ToLower(strings.TrimSpace(event.Action)) {
				t.Fatalf("expected action=%q, got %q", strings.ToLower(strings.TrimSpace(event.Action)), outAction)
			}
			if i%6 == 5 {
				if outPlacement != "unknown" {
					t.Fatalf("expected unknown placement for invalid input, got %q", outPlacement)
				}
			} else if outPlacement != strings.ToLower(strings.TrimSpace(event.Placement)) {
				t.Fatalf("expected placement=%q, got %q", strings.ToLower(strings.TrimSpace(event.Placement)), outPlacement)
			}
		})
	}
}
