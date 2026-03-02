package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"log"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"oracle-backend/internal/handlers"
)

const adminRequestBodyLimit = 1 << 20      // 1 MiB
const authRequestBodyLimit = 256 << 10     // 256 KiB
const internalRequestBodyLimit = 256 << 10 // 256 KiB

func requestBodyLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			switch {
			case strings.HasPrefix(r.URL.Path, "/api/admin/"):
				r.Body = http.MaxBytesReader(w, r.Body, adminRequestBodyLimit)
			case strings.HasPrefix(r.URL.Path, "/api/auth/"):
				r.Body = http.MaxBytesReader(w, r.Body, authRequestBodyLimit)
			case strings.HasPrefix(r.URL.Path, "/api/internal/"):
				r.Body = http.MaxBytesReader(w, r.Body, internalRequestBodyLimit)
			}
		}
		next.ServeHTTP(w, r)
	})
}

func csrfHeaderMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Public website endpoints apply their own strict origin/CORS validation.
		if strings.HasPrefix(r.URL.Path, "/api/public/website/") {
			next.ServeHTTP(w, r)
			return
		}
		// Internal service endpoints use shared-secret auth and are non-browser.
		if strings.HasPrefix(r.URL.Path, "/api/internal/") {
			next.ServeHTTP(w, r)
			return
		}

		if strings.HasPrefix(r.URL.Path, "/api/") {
			switch r.Method {
			case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
				if r.Header.Get("X-Requested-With") != "XMLHttpRequest" {
					writeAPIError(w, http.StatusBadRequest, "missing_csrf_header")
					return
				}
				origin := strings.TrimSpace(r.Header.Get("Origin"))
				if origin != "" {
					if !isAllowedCSRFOrigin(r, origin) {
						writeAPIError(w, http.StatusForbidden, "invalid_origin")
						return
					}
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}

func loadCSRFAllowedOrigins(rawList, publicBaseURL string) map[string]struct{} {
	origins := make(map[string]struct{})
	candidates := make([]string, 0, 8)
	if strings.TrimSpace(rawList) != "" {
		candidates = append(candidates, strings.Split(rawList, ",")...)
	}
	if strings.TrimSpace(publicBaseURL) != "" {
		candidates = append(candidates, publicBaseURL)
	}
	for _, candidate := range candidates {
		normalized, err := normalizeOriginValue(candidate)
		if err != nil {
			log.Printf("[WARN] ignoring invalid CSRF origin entry")
			continue
		}
		origins[normalized] = struct{}{}
	}
	if len(origins) == 0 {
		return nil
	}
	return origins
}

func isAllowedCSRFOrigin(r *http.Request, originValue string) bool {
	normalizedOrigin, err := normalizeOriginValue(originValue)
	if err != nil {
		return false
	}
	if len(csrfAllowedOrigins) > 0 {
		_, ok := csrfAllowedOrigins[normalizedOrigin]
		return ok
	}
	return normalizedOrigin == requestOriginForCSRF(r)
}

func requestOriginForCSRF(r *http.Request) string {
	if r == nil {
		return ""
	}
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if proto := trustedProxyProto(r); proto != "" {
		scheme = proto
	} else {
		// Fallback for TLS-terminating proxy deployments where TRUSTED_PROXY_CIDRS
		// is not explicitly configured. This preserves same-origin CSRF checks based
		// on forwarded protocol headers commonly set by reverse proxies.
		if proto := parseForwardedProtoHeaderValue(r.Header.Get("Forwarded")); proto != "" {
			scheme = proto
		} else if proto := parseXForwardedProtoHeaderValue(r.Header.Get("X-Forwarded-Proto")); proto != "" {
			scheme = proto
		}
	}
	host := strings.TrimSpace(r.Host)
	if host == "" {
		return ""
	}
	normalized, err := normalizeOriginValue(scheme + "://" + host)
	if err != nil {
		return ""
	}
	return normalized
}

func normalizeOriginValue(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("origin is empty")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "http" && scheme != "https" {
		return "", errors.New("origin scheme must be http or https")
	}
	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	if host == "" {
		return "", errors.New("origin host is required")
	}
	if strings.Contains(host, "%") {
		return "", errors.New("origin host must not contain zone identifiers")
	}
	port := strings.TrimSpace(parsed.Port())
	switch {
	case scheme == "http" && port == "80":
		port = ""
	case scheme == "https" && port == "443":
		port = ""
	}
	var hostPort string
	if port == "" {
		if strings.Contains(host, ":") {
			hostPort = "[" + host + "]"
		} else {
			hostPort = host
		}
	} else {
		if _, err := strconv.Atoi(port); err != nil {
			return "", errors.New("origin port must be numeric")
		}
		hostPort = net.JoinHostPort(host, port)
	}
	return scheme + "://" + hostPort, nil
}

func decodeJSONBodyStrict(r *http.Request, dst any) error {
	return handlers.DecodeJSONBodyStrict(r, dst)
}

type cspNonceContextKey struct{}

func generateCSPNonce() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		log.Printf("[WARN] CSP nonce generation failed: %v — request will run without script nonce protection", err)
		appMetrics.IncCounter("oracle_csp_nonce_failures_total", nil, 1)
		return ""
	}
	return base64.RawStdEncoding.EncodeToString(b)
}

func cspNonceFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	nonce, _ := ctx.Value(cspNonceContextKey{}).(string)
	return strings.TrimSpace(nonce)
}

func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nonce := generateCSPNonce()
		scriptSrc := "script-src 'self'"
		styleSrc := "style-src 'self' https://fonts.googleapis.com"
		if nonce != "" {
			scriptSrc += " 'nonce-" + nonce + "'"
			styleSrc += " 'nonce-" + nonce + "'"
		}
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set(
			"Content-Security-Policy",
			"default-src 'self' https:; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; "+styleSrc+"; "+scriptSrc+"; frame-ancestors 'none'; base-uri 'self'",
		)
		if strings.HasPrefix(r.URL.Path, "/api/auth/") || strings.HasPrefix(r.URL.Path, "/api/admin/") || strings.HasPrefix(r.URL.Path, "/metrics") {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Pragma", "no-cache")
		}
		ctx := context.WithValue(r.Context(), cspNonceContextKey{}, nonce)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
