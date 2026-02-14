package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// CSP Header Assertions
// ---------------------------------------------------------------------------

func TestCSP_ContainsFontSrc(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	csp := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "font-src") {
		t.Fatalf("CSP missing font-src directive: %q", csp)
	}
	if !strings.Contains(csp, "'self'") {
		t.Fatalf("CSP font-src missing 'self': %q", csp)
	}
	if !strings.Contains(csp, "https://fonts.gstatic.com") {
		t.Fatalf("CSP font-src missing https://fonts.gstatic.com: %q", csp)
	}
}

func TestCSP_ContainsFrameAncestorsNone(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	csp := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "frame-ancestors 'none'") {
		t.Fatalf("CSP missing frame-ancestors 'none': %q", csp)
	}
}

func TestCSP_ContainsBaseUriSelf(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	csp := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "base-uri 'self'") {
		t.Fatalf("CSP missing base-uri 'self': %q", csp)
	}
}

func TestCSP_ContainsNonceInScriptSrc(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	csp := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "script-src 'self' 'nonce-") {
		t.Fatalf("CSP missing nonce in script-src: %q", csp)
	}
}

func TestCSP_ContainsGoogleFontsInStyleSrc(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	csp := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "https://fonts.googleapis.com") {
		t.Fatalf("CSP style-src missing Google Fonts: %q", csp)
	}
}

func TestCSP_ContainsDefaultSrc(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	csp := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "default-src 'self' https:") {
		t.Fatalf("CSP missing default-src 'self' https:: %q", csp)
	}
}

func TestCSP_ContainsImgSrcDataScheme(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	csp := rr.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "img-src 'self' data: https:") {
		t.Fatalf("CSP missing img-src 'self' data: https:: %q", csp)
	}
}

// ---------------------------------------------------------------------------
// Other Security Headers
// ---------------------------------------------------------------------------

func TestSecurityHeaders_XFrameOptionsDeny(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	xfo := rr.Header().Get("X-Frame-Options")
	if xfo != "DENY" {
		t.Fatalf("expected X-Frame-Options: DENY, got %q", xfo)
	}
}

func TestSecurityHeaders_NoSniff(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	xcto := rr.Header().Get("X-Content-Type-Options")
	if xcto != "nosniff" {
		t.Fatalf("expected X-Content-Type-Options: nosniff, got %q", xcto)
	}
}

func TestSecurityHeaders_ReferrerPolicy(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	rp := rr.Header().Get("Referrer-Policy")
	if rp == "" {
		t.Fatal("expected Referrer-Policy header to be set")
	}
}

func TestSecurityHeaders_CORP(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	corp := rr.Header().Get("Cross-Origin-Resource-Policy")
	if corp == "" {
		t.Fatal("expected Cross-Origin-Resource-Policy header to be set")
	}
}

func TestSecurityHeaders_COOP(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	coop := rr.Header().Get("Cross-Origin-Opener-Policy")
	if coop == "" {
		t.Fatal("expected Cross-Origin-Opener-Policy header to be set")
	}
}

func TestSecurityHeaders_PermissionsPolicy(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(rr, req)

	pp := rr.Header().Get("Permissions-Policy")
	if pp == "" {
		t.Fatal("expected Permissions-Policy header to be set")
	}
}

// ---------------------------------------------------------------------------
// CSP nonce uniqueness
// ---------------------------------------------------------------------------

func TestCSP_NonceIsUniquePerRequest(t *testing.T) {
	handler := securityHeadersMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	var nonces []string
	for i := 0; i < 10; i++ {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		handler.ServeHTTP(rr, req)

		csp := rr.Header().Get("Content-Security-Policy")
		// Extract nonce from script-src
		idx := strings.Index(csp, "'nonce-")
		if idx == -1 {
			t.Fatal("missing nonce in CSP")
		}
		endIdx := strings.Index(csp[idx+7:], "'")
		if endIdx == -1 {
			t.Fatal("malformed nonce in CSP")
		}
		nonce := csp[idx+7 : idx+7+endIdx]
		nonces = append(nonces, nonce)
	}

	// Verify all nonces are unique
	seen := make(map[string]bool)
	for _, n := range nonces {
		if seen[n] {
			t.Fatalf("duplicate nonce found: %s", n)
		}
		seen[n] = true
	}
}
