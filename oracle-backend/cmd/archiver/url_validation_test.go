package main

import "testing"

func TestParseAndValidateOutboundURL_AcceptsHTTPS(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		in   string
	}{
		{name: "https", in: "https://example.com/api/stats/summary?range=all"},
		{name: "https_google", in: "https://google.com/"},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := parseAndValidateOutboundURL(tc.in)
			if err != nil {
				t.Fatalf("parseAndValidateOutboundURL(%q) returned error: %v", tc.in, err)
			}
			if got == "" {
				t.Fatalf("parseAndValidateOutboundURL(%q) returned empty URL", tc.in)
			}
		})
	}
}

func TestParseAndValidateOutboundURL_RejectsInvalidOrUnsupportedValues(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		in   string
	}{
		{name: "empty", in: ""},
		{name: "whitespace", in: "   "},
		{name: "missing host", in: "https:///api/stats/summary"},
		{name: "unsupported scheme", in: "ftp://oracle.example.com/api/stats/summary"},
		{name: "http scheme", in: "http://example.com/api/stats/summary"},
		{name: "javascript scheme", in: "javascript:alert(1)"},
		{name: "relative URL", in: "/api/stats/summary"},
		{name: "localhost", in: "https://localhost:8080/api/stats/summary"},
		{name: "loopback", in: "https://127.0.0.1/api/stats/summary"},
		{name: "private_network_10", in: "https://10.0.0.1/"},
		{name: "private_network_172", in: "https://172.16.0.1/"},
		{name: "private_network_192", in: "https://192.168.1.1/"},
		{name: "cloud_metadata", in: "https://169.254.169.254/latest/meta-data/"},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if _, err := parseAndValidateOutboundURL(tc.in); err == nil {
				t.Fatalf("parseAndValidateOutboundURL(%q) expected error, got nil", tc.in)
			}
		})
	}
}
