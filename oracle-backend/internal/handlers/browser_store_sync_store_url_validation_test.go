package handlers

import (
	"testing"
)

func TestValidateStoreURL_RejectsUntrustedHostByDefault(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "false")
	err := validateStoreURL("chrome", "https://example.com/x")
	if err == nil {
		t.Fatalf("expected untrusted host to be rejected")
	}
}

func TestValidateStoreURL_RejectsHTTPByDefault(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	t.Setenv("ORACLE_ALLOW_HTTP_STORE_URLS", "false")
	err := validateStoreURL("chrome", "http://example.com/x")
	if err == nil {
		t.Fatalf("expected plain HTTP URL to be rejected by default")
	}
}

func TestValidateStoreURL_AllowsHTTPWithExplicitOptIn(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	t.Setenv("ORACLE_ALLOW_HTTP_STORE_URLS", "true")
	err := validateStoreURL("chrome", "http://example.com/x")
	if err != nil {
		t.Fatalf("expected plain HTTP URL with explicit opt-in, got: %v", err)
	}
}

// ---------------------------------------------------------------------------
// validateStoreURL additional edge cases
// ---------------------------------------------------------------------------

func TestValidateStoreURL_EmptyURL(t *testing.T) {
	err := validateStoreURL("chrome", "")
	if err == nil {
		t.Fatal("expected error for empty URL")
	}
}

func TestValidateStoreURL_BlankSpacesOnly(t *testing.T) {
	err := validateStoreURL("chrome", "   ")
	if err == nil {
		t.Fatal("expected error for blank URL")
	}
}

func TestValidateStoreURL_NoScheme(t *testing.T) {
	err := validateStoreURL("chrome", "example.com/path")
	if err == nil {
		t.Fatal("expected error for URL without http/https scheme")
	}
}

func TestValidateStoreURL_FTPScheme(t *testing.T) {
	err := validateStoreURL("chrome", "ftp://example.com/path")
	if err == nil {
		t.Fatal("expected error for ftp scheme URL")
	}
}

func TestValidateStoreURL_MissingHost(t *testing.T) {
	err := validateStoreURL("chrome", "https://")
	if err == nil {
		t.Fatal("expected error for URL with missing host")
	}
}

func TestValidateStoreURL_AllowsUntrustedWithEnvVar(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")
	err := validateStoreURL("chrome", "https://random-host.example.com/path")
	if err != nil {
		t.Fatalf("expected untrusted URL to be allowed, got: %v", err)
	}
}

func TestValidateStoreURL_RejectsUnknownKeyWithNoAllowedHosts(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "false")
	err := validateStoreURL("unknown_key_xyz", "https://example.com/path")
	if err == nil {
		t.Fatal("expected error for unknown target key with no allowed hosts")
	}
}
