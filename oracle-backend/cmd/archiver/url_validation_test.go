package main

import (
	"net"
	"testing"
)

// stubResolver replaces resolveHost for the duration of a test.
func stubResolver(t *testing.T, fn func(string) ([]net.IP, error)) {
	t.Helper()
	orig := resolveHost
	resolveHost = fn
	t.Cleanup(func() { resolveHost = orig })
}

// publicIP returns a non-private, non-loopback IP for stubbing happy paths.
func publicIP() net.IP { return net.ParseIP("93.184.216.34") } // example.com

func TestParseAndValidateOutboundURL_Accepts(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		in       string
		resolver func(string) ([]net.IP, error)
	}{
		{
			name:     "https external",
			in:       "https://oracle.example.com/api/stats/summary?range=all",
			resolver: func(string) ([]net.IP, error) { return []net.IP{publicIP()}, nil },
		},
		{
			name:     "https external with port",
			in:       "https://oracle.example.com:8443/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{publicIP()}, nil },
		},
		{
			name: "http localhost by name",
			in:   "http://localhost:8080/api/stats/summary",
			// resolver not called for http+localhost
		},
		{
			name: "http 127.0.0.1",
			in:   "http://127.0.0.1:8080/api/stats/summary",
		},
		{
			name: "http ::1",
			in:   "http://[::1]:8080/api/stats/summary",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if tc.resolver != nil {
				stubResolver(t, tc.resolver)
			}
			got, err := parseAndValidateOutboundURL(tc.in)
			if err != nil {
				t.Fatalf("parseAndValidateOutboundURL(%q) error: %v", tc.in, err)
			}
			if got == "" {
				t.Fatalf("parseAndValidateOutboundURL(%q) returned empty URL", tc.in)
			}
		})
	}
}

func TestParseAndValidateOutboundURL_Rejects(t *testing.T) {
	t.Parallel()

	pubRes := func(string) ([]net.IP, error) { return []net.IP{publicIP()}, nil }

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

		// Scheme
		{name: "ftp scheme", in: "ftp://oracle.example.com/api", resolver: pubRes},
		{name: "javascript scheme", in: "javascript:alert(1)"},
		{name: "http non-localhost", in: "http://oracle.example.com/api", resolver: pubRes},

		// Private IPv4 ranges (https)
		{
			name:     "loopback 127.0.0.1 via https",
			in:       "https://internal.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("127.0.0.1")}, nil },
		},
		{
			name:     "RFC-1918 10.x via https",
			in:       "https://internal.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("10.0.0.1")}, nil },
		},
		{
			name:     "RFC-1918 172.16.x via https",
			in:       "https://internal.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("172.16.0.1")}, nil },
		},
		{
			name:     "RFC-1918 192.168.x via https",
			in:       "https://internal.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("192.168.1.1")}, nil },
		},
		{
			name:     "link-local 169.254 cloud metadata via https",
			in:       "https://metadata.example.com/",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("169.254.169.254")}, nil },
		},
		{
			name:     "unspecified 0.0.0.0 via https",
			in:       "https://null.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("0.0.0.0")}, nil },
		},

		// Multicast (new check)
		{
			name:     "IPv4 multicast 224.x via https",
			in:       "https://mcast.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("224.0.0.1")}, nil },
		},

		// IPv6 private ranges
		{
			name:     "IPv6 ULA fc00::/7 via https",
			in:       "https://ula.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("fc00::1")}, nil },
		},
		{
			name:     "IPv4-mapped private ::ffff:10.0.0.1 via https",
			in:       "https://mapped.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{net.ParseIP("::ffff:10.0.0.1")}, nil },
		},

		// DNS edge cases
		{
			name:     "hostname resolves to empty IP list",
			in:       "https://nxdomain.example.com/api",
			resolver: func(string) ([]net.IP, error) { return []net.IP{}, nil },
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if tc.resolver != nil {
				stubResolver(t, tc.resolver)
			}
			if _, err := parseAndValidateOutboundURL(tc.in); err == nil {
				t.Fatalf("parseAndValidateOutboundURL(%q) expected error, got nil", tc.in)
			}
		})
	}
}
