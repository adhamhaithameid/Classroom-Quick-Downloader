package main

import "testing"

func TestParseAndValidateOutboundURL_AcceptsHTTPAndHTTPS(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		in   string
	}{
		{name: "http", in: "http://127.0.0.1:8080/api/stats/summary"},
		{name: "https", in: "https://oracle.example.com/api/stats/summary?range=all"},
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
		{name: "javascript scheme", in: "javascript:alert(1)"},
		{name: "relative URL", in: "/api/stats/summary"},
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
