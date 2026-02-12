package main

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestGetClientIPTrustedProxyUsesForwarded(t *testing.T) {
	prev := trustedProxyNets
	defer setTrustedProxyNets(prev)

	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.RemoteAddr = "10.1.2.3:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.10, 10.1.2.3")

	ip := getClientIP(req)
	if ip != "203.0.113.10" {
		t.Fatalf("expected forwarded IP, got %q", ip)
	}
}

func TestGetClientIPUntrustedProxyIgnoresForwarded(t *testing.T) {
	prev := trustedProxyNets
	defer setTrustedProxyNets(prev)

	setTrustedProxyNets(parseTrustedProxyCIDRs("10.0.0.0/8"))

	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.RemoteAddr = "192.168.1.5:4321"
	req.Header.Set("X-Forwarded-For", "203.0.113.10")

	ip := getClientIP(req)
	if ip != "192.168.1.5" {
		t.Fatalf("expected remote IP, got %q", ip)
	}
}

func TestNextRunTime(t *testing.T) {
	tests := []struct {
		name     string
		now      time.Time
		expected time.Time
	}{
		{
			name:     "before 00:15 same day",
			now:      time.Date(2023, 10, 27, 0, 10, 0, 0, time.UTC),
			expected: time.Date(2023, 10, 27, 0, 15, 0, 0, time.UTC),
		},
		{
			name:     "after 00:15 same day",
			now:      time.Date(2023, 10, 27, 0, 20, 0, 0, time.UTC),
			expected: time.Date(2023, 10, 28, 0, 15, 0, 0, time.UTC),
		},
		{
			name:     "exactly 00:15 same day",
			now:      time.Date(2023, 10, 27, 0, 15, 0, 0, time.UTC),
			expected: time.Date(2023, 10, 27, 0, 15, 0, 0, time.UTC),
		},
		{
			name:     "just before 00:15",
			now:      time.Date(2023, 10, 27, 0, 14, 59, 999999999, time.UTC),
			expected: time.Date(2023, 10, 27, 0, 15, 0, 0, time.UTC),
		},
		{
			name:     "just after 00:15",
			now:      time.Date(2023, 10, 27, 0, 15, 0, 1, time.UTC),
			expected: time.Date(2023, 10, 28, 0, 15, 0, 0, time.UTC),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := nextRunTime(tt.now)
			if !got.Equal(tt.expected) {
				t.Errorf("nextRunTime() = %v, want %v", got, tt.expected)
			}
		})
	}
}
