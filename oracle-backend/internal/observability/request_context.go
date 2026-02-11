package observability

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type contextKey string

const (
	requestIDKey     contextKey = "request_id"
	correlationIDKey contextKey = "correlation_id"
	userIDKey        contextKey = "user_id"
	tokenIDKey       contextKey = "token_id"
	roleKey          contextKey = "role"
)

var validIDPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)

func idFromHeaderOrRandom(h http.Header, key string, prefix string) string {
	if h == nil {
		return randomID(prefix)
	}
	if val := sanitizeInboundID(strings.TrimSpace(h.Get(key))); val != "" {
		return val
	}
	return randomID(prefix)
}

func sanitizeInboundID(v string) string {
	if len(v) > 128 {
		v = v[:128]
	}
	if !validIDPattern.MatchString(v) {
		return ""
	}
	return v
}

func randomID(prefix string) string {
	raw := make([]byte, 8)
	if _, err := rand.Read(raw); err != nil {
		return prefix + "-" + time.Now().UTC().Format("20060102150405.000")
	}
	return prefix + "-" + hex.EncodeToString(raw)
}

func WithRequestContext(ctx context.Context, requestID string, correlationID string) context.Context {
	ctx = context.WithValue(ctx, requestIDKey, requestID)
	ctx = context.WithValue(ctx, correlationIDKey, correlationID)
	return ctx
}

func WithActorContext(ctx context.Context, userID, tokenID, role string) context.Context {
	ctx = context.WithValue(ctx, userIDKey, userID)
	ctx = context.WithValue(ctx, tokenIDKey, tokenID)
	ctx = context.WithValue(ctx, roleKey, role)
	return ctx
}

func RequestIDFromContext(ctx context.Context) string {
	return valueOrDefault(ctx, requestIDKey, "unknown")
}

func CorrelationIDFromContext(ctx context.Context) string {
	return valueOrDefault(ctx, correlationIDKey, "unknown")
}

func UserIDFromContext(ctx context.Context) string {
	return valueOrDefault(ctx, userIDKey, "anonymous")
}

func TokenIDFromContext(ctx context.Context) string {
	return valueOrDefault(ctx, tokenIDKey, "none")
}

func RoleFromContext(ctx context.Context) string {
	return valueOrDefault(ctx, roleKey, "viewer")
}

func valueOrDefault(ctx context.Context, key contextKey, def string) string {
	if ctx == nil {
		return def
	}
	val, ok := ctx.Value(key).(string)
	if !ok || strings.TrimSpace(val) == "" {
		return def
	}
	return val
}

func RequestContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := idFromHeaderOrRandom(r.Header, "X-Request-ID", "req")
		corrID := idFromHeaderOrRandom(r.Header, "X-Correlation-ID", "corr")
		ctx := WithRequestContext(r.Context(), reqID, corrID)
		r = r.WithContext(ctx)
		w.Header().Set("X-Request-ID", reqID)
		w.Header().Set("X-Correlation-ID", corrID)
		next.ServeHTTP(w, r)
	})
}
