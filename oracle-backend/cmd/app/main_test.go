package main

import (
	"net/http/httptest"
	"testing"
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
