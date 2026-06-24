package main

import (
	"net"
	"testing"
)

// publicIP returns a non-private, non-loopback IP for happy-path stubs.
func publicIP() net.IP { return net.ParseIP("93.184.216.34") }

func pubRes(string) ([]net.IP, error) { return []net.IP{publicIP()}, nil }

// TestValidateOutboundURL_Accepts verifies URLs that should succeed.
// Each subtest passes its own resolver — no global mutation, no data race.
func TestValidateOutboundURL_Accepts(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		in       string
		resolver func(string) ([]net.IP, error)
	}{
		{name: "https external", in: "https://oracle.example.com/api?range=all", resolver: pubRes},
		{name: "https with port", in: "https://oracle.example.com:8443/api", resolver: pubRes},
		{name: "http localhost name", in: "http://localhost:8080/api/stats/summary"},
		{name: "http 127.0.0.1", in: "http://127.0.0.1:8080/api/stats/summary"},
		{name: "http ::1", in: "http://[::1]:8080/api/stats/summary"},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			resolve := tc.resolver
			if resolve == nil {
				resolve = net.LookupIP
			}
			got, err := validateOutboundURL(tc.in, resolve)
			if err != nil {
				t.Fatalf("validateOutboundURL(%q) error: %v", tc.in, err)
			}
			if got == "" {
				t.Fatalf("validateOutboundURL(%q) returned empty URL", tc.in)
			}
		})
	}
}

// TestValidateOutboundURL_Rejects verifies URLs that must be rejected.
func TestValidateOutboundURL_Rejects(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		in       string
		resolver func(string) ([]net.IP, error)
	}{
		// Input hygiene
		{name: "empty string", in: ""},
		{name: "whitespace only", in: "   "},
		{name: "missing host", in: "https:///api/stats/summary"},
		{name: "relative URL", in: "/api/stats/summary"},
		// Scheme enforcement
		{name: "ftp scheme", in: "ftp://oracle.example.com/api", resolver: pubRes},
		{name: "javascript scheme", in: "javascript:alert(1)"},
		{name: "http non-localhost", in: "http://oracle.example.com/api", resolver: pubRes},
		// Private IPv4 via https
		{name: "loopback 127.0.0.1", in: "https://i.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("127.0.0.1")}, nil }},
		{name: "RFC-1918 10.x", in: "https://i.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("10.0.0.1")}, nil }},
		{name: "RFC-1918 172.16.x", in: "https://i.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("172.16.0.1")}, nil }},
		{name: "RFC-1918 192.168.x", in: "https://i.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("192.168.1.1")}, nil }},
		{name: "link-local 169.254 cloud metadata", in: "https://m.example.com/",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("169.254.169.254")}, nil }},
		{name: "unspecified 0.0.0.0", in: "https://n.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("0.0.0.0").To4()}, nil }},
		// Multicast
		{name: "IPv4 multicast 224.x", in: "https://m.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("224.0.0.1")}, nil }},
		// IPv6 private
		{name: "IPv6 ULA fc00::/7", in: "https://u.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("fc00::1")}, nil }},
		{name: "IPv4-mapped private ::ffff:10.0.0.1", in: "https://mp.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("::ffff:10.0.0.1")}, nil }},
		// DNS edge cases
		{name: "hostname resolves to empty IP list", in: "https://nx.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{}, nil }},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			resolve := tc.resolver
			if resolve == nil {
				resolve = net.LookupIP
			}
			if _, err := validateOutboundURL(tc.in, resolve); err == nil {
				t.Fatalf("validateOutboundURL(%q) expected error, got nil", tc.in)
			}
		})
	}
}
