package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"testing"
)

func publicResolver(string) ([]net.IP, error) {
	return []net.IP{net.ParseIP("93.184.216.34")}, nil
}

func TestValidateOutboundURLAcceptsSafeTargets(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		input    string
		resolver func(string) ([]net.IP, error)
	}{
		{name: "external https", input: "https://oracle.example.com/api", resolver: publicResolver},
		{name: "external https with port", input: "https://oracle.example.com:8443/api", resolver: publicResolver},
		{name: "localhost", input: "http://localhost:8080/api"},
		{name: "ipv4 loopback", input: "http://127.0.0.1:8080/api"},
		{name: "ipv6 loopback", input: "http://[::1]:8080/api"},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			resolver := tc.resolver
			if resolver == nil {
				resolver = net.LookupIP
			}
			if _, err := validateOutboundURL(tc.input, resolver); err != nil {
				t.Fatalf("validateOutboundURL(%q) returned error: %v", tc.input, err)
			}
		})
	}
}

func TestValidateOutboundURLRejectsUnsafeTargets(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		input    string
		resolver func(string) ([]net.IP, error)
	}{
		{name: "empty", input: ""},
		{name: "missing host", input: "https:///api"},
		{name: "relative", input: "/api"},
		{name: "unsupported scheme", input: "ftp://oracle.example.com/api", resolver: publicResolver},
		{name: "embedded credentials", input: "https://user:pass@oracle.example.com/api", resolver: publicResolver},
		{name: "remote http", input: "http://oracle.example.com/api", resolver: publicResolver},
		{name: "loopback", input: "https://internal.example/api", resolver: resolverFor("127.0.0.1")},
		{name: "private ipv4", input: "https://internal.example/api", resolver: resolverFor("10.0.0.1")},
		{name: "private ipv6", input: "https://internal.example/api", resolver: resolverFor("fc00::1")},
		{name: "cloud metadata", input: "https://internal.example/api", resolver: resolverFor("169.254.169.254")},
		{name: "unspecified", input: "https://internal.example/api", resolver: resolverFor("0.0.0.0")},
		{name: "multicast", input: "https://internal.example/api", resolver: resolverFor("224.0.0.1")},
		{name: "empty dns response", input: "https://internal.example/api", resolver: func(string) ([]net.IP, error) { return nil, nil }},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			resolver := tc.resolver
			if resolver == nil {
				resolver = net.LookupIP
			}
			if _, err := validateOutboundURL(tc.input, resolver); err == nil {
				t.Fatalf("validateOutboundURL(%q) expected an error", tc.input)
			}
		})
	}
}

func TestArchiverHTTPClientDoesNotFollowRedirects(t *testing.T) {
	t.Parallel()

	client := newArchiverHTTPClient()
	if client.CheckRedirect == nil {
		t.Fatal("expected redirect policy")
	}
	if err := client.CheckRedirect(nil, nil); !errors.Is(err, http.ErrUseLastResponse) {
		t.Fatalf("expected http.ErrUseLastResponse, got %v", err)
	}
}

func TestArchiverHTTPClientRejectsDNSRebindingBeforeDial(t *testing.T) {
	t.Parallel()

	dialCalled := false
	client := newArchiverHTTPClientWithNetwork(
		func(context.Context, string, string) ([]net.IP, error) {
			return []net.IP{net.ParseIP("169.254.169.254")}, nil
		},
		func(context.Context, string, string) (net.Conn, error) {
			dialCalled = true
			return nil, nil
		},
	)
	transport, ok := client.Transport.(*http.Transport)
	if !ok || transport.DialContext == nil {
		t.Fatal("expected guarded HTTP transport")
	}

	if _, err := transport.DialContext(context.Background(), "tcp", "oracle.example.com:443"); err == nil {
		t.Fatal("expected private rebound address to be rejected")
	}
	if dialCalled {
		t.Fatal("network dialer was called for a private rebound address")
	}
}

func TestArchiverHTTPClientDialsValidatedIPAddress(t *testing.T) {
	t.Parallel()

	var dialedAddress string
	client := newArchiverHTTPClientWithNetwork(
		func(context.Context, string, string) ([]net.IP, error) {
			return []net.IP{net.ParseIP("93.184.216.34")}, nil
		},
		func(_ context.Context, _, address string) (net.Conn, error) {
			dialedAddress = address
			return nil, nil
		},
	)
	transport, ok := client.Transport.(*http.Transport)
	if !ok || transport.DialContext == nil {
		t.Fatal("expected guarded HTTP transport")
	}

	if _, err := transport.DialContext(context.Background(), "tcp", "oracle.example.com:443"); err != nil {
		t.Fatalf("expected public address to reach the network dialer: %v", err)
	}
	if dialedAddress != "93.184.216.34:443" {
		t.Fatalf("expected resolved IP to be pinned, got %q", dialedAddress)
	}
}

func resolverFor(rawIP string) func(string) ([]net.IP, error) {
	return func(string) ([]net.IP, error) {
		return []net.IP{net.ParseIP(rawIP)}, nil
	}
}
