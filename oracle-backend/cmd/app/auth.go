package main

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"oracle-backend/internal/handlers"
	"oracle-backend/internal/observability"
)

// generateToken creates a cryptographically secure session token.
func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// hashPassword creates a bcrypt hash for password verification.
func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func mustHashPassword(password string) string {
	hashed, err := hashPassword(password)
	if err != nil {
		log.Fatalf("failed to hash password: %v", err)
	}
	return hashed
}

func verifyPasswordHash(hashedPassword, password string) bool {
	if strings.TrimSpace(hashedPassword) == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)) == nil
}

// requireAuth returns middleware that checks for valid session cookie.
// If dashboardPassword is empty, all requests are allowed (no auth).
func requireAuth(db *sql.DB, dashboardPassword, archiverSecret string, allowLoopbackBypass bool) func(http.Handler) http.Handler {
	archiverAllowedPaths := map[string]struct{}{
		"/api/stats/summary": {},
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// No auth required if DASHBOARD_PASSWORD is not set
			if dashboardPassword == "" {
				next.ServeHTTP(w, r)
				return
			}

			if allowLoopbackBypass && archiverSecret == "" && isLoopbackAddr(r.RemoteAddr) && isLoopbackHost(r.Host) && !hasForwardedIp(r) {
				ctx := observability.WithActorContext(r.Context(), "loopback-bypass", "loopback", "system")
				setActorContextOnWriter(w, "loopback-bypass", "loopback", "system")
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			if archiverSecret != "" {
				headerSecret := r.Header.Get("X-Archiver-Secret")
				_, pathAllowed := archiverAllowedPaths[r.URL.Path]
				if pathAllowed &&
					r.Method == http.MethodGet &&
					headerSecret != "" &&
					subtle.ConstantTimeCompare([]byte(headerSecret), []byte(archiverSecret)) == 1 {
					ctx := observability.WithActorContext(r.Context(), "archiver", "archiver-secret", "system")
					setActorContextOnWriter(w, "archiver", "archiver-secret", "system")
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}

			cookie, err := r.Cookie(sessionCookieName)
			if err != nil || !isValidSession(cookie.Value) {
				appMetrics.IncCounter("oracle_auth_failures_total", map[string]string{"reason": "session_invalid"}, 1)
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			tokenID := cookie.Value
			if len(tokenID) > 12 {
				tokenID = tokenID[:12]
			}
			ctx := observability.WithActorContext(r.Context(), "viewer", tokenID, "viewer")
			setActorContextOnWriter(w, "viewer", tokenID, "viewer")
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// requireStepUp enforces super-admin step-up for critical routes when enabled by feature flag.
func requireStepUp(db *sql.DB, superAdminPassword string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			enabled, err := handlers.IsFeatureEnabled(r.Context(), db, "feature_stepup_enforced")
			if err != nil {
				http.Error(w, `{"error":"stepup_flag_unavailable"}`, http.StatusInternalServerError)
				return
			}
			if !enabled {
				next.ServeHTTP(w, r)
				return
			}
			if superAdminPassword == "" {
				http.Error(w, `{"error":"stepup_misconfigured"}`, http.StatusInternalServerError)
				return
			}

			cookie, err := r.Cookie(stepUpSessionCookieName)
			parentSession := ""
			if mainCookie, mainErr := r.Cookie(sessionCookieName); mainErr == nil {
				parentSession = mainCookie.Value
			}
			if err != nil || !isValidStepUpSession(cookie.Value, parentSession) {
				appMetrics.IncCounter("oracle_auth_failures_total", map[string]string{"reason": "stepup_required"}, 1)
				http.Error(w, `{"error":"step_up_required"}`, http.StatusForbidden)
				return
			}

			tokenID := cookie.Value
			if len(tokenID) > 12 {
				tokenID = tokenID[:12]
			}
			ctx := observability.WithActorContext(r.Context(), "super-admin", tokenID, "super_admin")
			setActorContextOnWriter(w, "super-admin", tokenID, "super_admin")
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func stepUpStartHandler(db *sql.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		enabled, err := handlers.IsFeatureEnabled(r.Context(), db, "feature_stepup_enforced")
		if err != nil {
			http.Error(w, `{"error":"stepup_flag_unavailable"}`, http.StatusInternalServerError)
			return
		}
		if !enabled {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"ok":       true,
				"required": false,
			})
			return
		}

		challengeID, err := generateToken()
		if err != nil {
			http.Error(w, `{"error":"failed_to_create_challenge"}`, http.StatusInternalServerError)
			return
		}
		clientIP := getClientIP(r)

		now := time.Now()
		expiresAt := now.Add(stepUpChallengeDuration)
		if err := persistStepUpChallenge(challengeID, clientIP, expiresAt); err != nil {
			http.Error(w, `{"error":"failed_to_persist_challenge"}`, http.StatusInternalServerError)
			return
		}

		stepUpChallengeStore.Lock()
		cleanupExpiredStepUpChallengesLocked(now)
		stepUpChallengeStore.items[challengeID] = stepUpChallenge{
			clientIP:  clientIP,
			expiresAt: expiresAt,
		}
		stepUpChallengeStore.Unlock()

		appMetrics.IncCounter("oracle_stepup_start_total", nil, 1)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":           true,
			"required":     true,
			"challengeId":  challengeID,
			"expiresInSec": int(stepUpChallengeDuration.Seconds()),
		})
	})
}

func stepUpVerifyHandler(db *sql.DB, superAdminPassword string) http.Handler {
	storedHash := mustHashPassword(superAdminPassword)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		enabled, err := handlers.IsFeatureEnabled(r.Context(), db, "feature_stepup_enforced")
		if err != nil {
			http.Error(w, `{"error":"stepup_flag_unavailable"}`, http.StatusInternalServerError)
			return
		}
		if !enabled {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"ok":       true,
				"required": false,
			})
			return
		}

		clientIP := getClientIP(r)
		allowed, retryAfter := allowStepUpAttempt(clientIP)
		if !allowed {
			appMetrics.IncCounter("oracle_rate_limit_hits_total", map[string]string{"scope": "stepup"}, 1)
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			http.Error(w, `{"error":"too many attempts"}`, http.StatusTooManyRequests)
			return
		}

		var req struct {
			ChallengeID string `json:"challengeId"`
			Password    string `json:"password"` // #nosec G117 -- required request field for step-up verify API contract.
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		req.ChallengeID = strings.TrimSpace(req.ChallengeID)
		if req.ChallengeID == "" || strings.TrimSpace(req.Password) == "" {
			http.Error(w, `{"error":"challengeId and password are required"}`, http.StatusBadRequest)
			return
		}

		if !consumeStepUpChallenge(req.ChallengeID, clientIP) {
			appMetrics.IncCounter("oracle_stepup_verify_total", map[string]string{"result": "invalid_challenge"}, 1)
			http.Error(w, `{"error":"invalid_or_expired_challenge"}`, http.StatusUnauthorized)
			return
		}

		mainSessionCookie, mainSessionErr := r.Cookie(sessionCookieName)
		if mainSessionErr != nil || strings.TrimSpace(mainSessionCookie.Value) == "" {
			http.Error(w, `{"error":"missing_parent_session"}`, http.StatusUnauthorized)
			return
		}

		if !verifyPasswordHash(storedHash, req.Password) {
			appMetrics.IncCounter("oracle_stepup_verify_total", map[string]string{"result": "invalid_password"}, 1)
			appMetrics.IncCounter("oracle_auth_failures_total", map[string]string{"reason": "stepup_invalid_password"}, 1)
			blocked, retryAfter := recordStepUpFailure(db, clientIP)
			if blocked {
				appMetrics.IncCounter("oracle_rate_limit_hits_total", map[string]string{"scope": "stepup"}, 1)
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				http.Error(w, `{"error":"too many attempts"}`, http.StatusTooManyRequests)
				return
			}
			http.Error(w, `{"error":"invalid password"}`, http.StatusUnauthorized)
			return
		}

		clearStepUpFailures(clientIP)
		token, err := generateToken()
		if err != nil {
			http.Error(w, `{"error":"failed to create stepup session"}`, http.StatusInternalServerError)
			return
		}
		expiresAt := time.Now().Add(stepUpSessionDuration)
		if err := persistAuthSession(token, authSessionKindStepUp, mainSessionCookie.Value, expiresAt); err != nil {
			http.Error(w, `{"error":"failed to persist stepup session"}`, http.StatusInternalServerError)
			return
		}

		stepUpSessionStore.Lock()
		stepUpSessionStore.tokens[token] = stepUpSession{
			expiresAt:          expiresAt,
			parentSessionToken: mainSessionCookie.Value,
		}
		stepUpSessionStore.Unlock()

		secureCookie, sameSite := cookieSecurityPolicy(r)
		http.SetCookie(w, &http.Cookie{
			Name:     stepUpSessionCookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: sameSite,
			MaxAge:   int(stepUpSessionDuration.Seconds()),
		})

		appMetrics.IncCounter("oracle_stepup_verify_total", map[string]string{"result": "success"}, 1)
		_ = handlers.AppendAuditLog(
			r.Context(),
			db,
			"stepup_verify",
			"auth",
			"stepup",
			"ok",
			map[string]any{
				"clientIp": clientIP,
			},
		)

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":           true,
			"expiresInSec": int(stepUpSessionDuration.Seconds()),
		})
	})
}

func stepUpCheckHandler(db *sql.DB) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodGet {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}
		enabled, err := handlers.IsFeatureEnabled(r.Context(), db, "feature_stepup_enforced")
		if err != nil {
			http.Error(w, `{"error":"stepup_flag_unavailable"}`, http.StatusInternalServerError)
			return
		}
		active := false
		if cookie, err := r.Cookie(stepUpSessionCookieName); err == nil {
			parent := ""
			if mainCookie, mainErr := r.Cookie(sessionCookieName); mainErr == nil {
				parent = mainCookie.Value
			}
			active = isValidStepUpSession(cookie.Value, parent)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":       true,
			"required": enabled,
			"active":   active,
		})
	})
}

func consumeStepUpChallenge(challengeID string, clientIP string) bool {
	if consumePersistedStepUpChallenge(challengeID, clientIP) {
		stepUpChallengeStore.Lock()
		delete(stepUpChallengeStore.items, challengeID)
		stepUpChallengeStore.Unlock()
		return true
	}

	now := time.Now()
	stepUpChallengeStore.Lock()
	defer stepUpChallengeStore.Unlock()

	cleanupExpiredStepUpChallengesLocked(now)
	item, exists := stepUpChallengeStore.items[challengeID]
	if !exists {
		return false
	}
	if item.expiresAt.Before(now) || item.clientIP != clientIP {
		delete(stepUpChallengeStore.items, challengeID)
		deletePersistedStepUpChallenge(challengeID)
		return false
	}
	delete(stepUpChallengeStore.items, challengeID)
	deletePersistedStepUpChallenge(challengeID)
	return true
}

func cleanupExpiredStepUpChallengesLocked(now time.Time) {
	for key, item := range stepUpChallengeStore.items {
		if now.After(item.expiresAt) {
			delete(stepUpChallengeStore.items, key)
		}
	}
}

func isValidStepUpSession(token string, parentSessionToken string) bool {
	now := time.Now()
	stepUpSessionStore.RLock()
	session, exists := stepUpSessionStore.tokens[token]
	stepUpSessionStore.RUnlock()
	if !exists {
		expiry, persistedParent, ok, err := loadAuthSession(token, authSessionKindStepUp)
		if err != nil || !ok {
			return false
		}
		session = stepUpSession{
			expiresAt:          expiry,
			parentSessionToken: persistedParent,
		}
		stepUpSessionStore.Lock()
		stepUpSessionStore.tokens[token] = session
		stepUpSessionStore.Unlock()
		exists = true
	}
	if !exists {
		return false
	}
	if parentSessionToken != "" && parentSessionToken != session.parentSessionToken {
		return false
	}
	if now.After(session.expiresAt) {
		stepUpSessionStore.Lock()
		if latest, ok := stepUpSessionStore.tokens[token]; ok && now.After(latest.expiresAt) {
			delete(stepUpSessionStore.tokens, token)
		}
		stepUpSessionStore.Unlock()
		deleteAuthSession(token)
		return false
	}
	return true
}

func allowStepUpAttempt(ip string) (bool, int) {
	now := time.Now()
	stepUpRateStore.Lock()
	defer stepUpRateStore.Unlock()

	rec := stepUpRateStore.attempts[ip]
	if rec == nil {
		attempts, firstAttemptAt, blockedUntil, ok := loadAuthRateAttempt(authRateScopeStepUp, ip)
		if ok {
			rec = &stepUpAttempt{
				attempts:       attempts,
				firstAttemptAt: firstAttemptAt,
				blockedUntil:   blockedUntil,
			}
			stepUpRateStore.attempts[ip] = rec
		}
	}
	if rec == nil {
		return true, 0
	}
	if !rec.blockedUntil.IsZero() && now.Before(rec.blockedUntil) {
		retryAfter := int(time.Until(rec.blockedUntil).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, retryAfter
	}
	if now.Sub(rec.firstAttemptAt) > stepUpLockout {
		delete(stepUpRateStore.attempts, ip)
		deleteAuthRateAttempt(authRateScopeStepUp, ip)
		return true, 0
	}
	return true, 0
}

func recordStepUpFailure(db *sql.DB, ip string) (blocked bool, retryAfter int) {
	now := time.Now()
	stepUpRateStore.Lock()
	rec := stepUpRateStore.attempts[ip]
	if rec == nil || now.Sub(rec.firstAttemptAt) > stepUpLockout {
		rec = &stepUpAttempt{attempts: 0, firstAttemptAt: now}
		stepUpRateStore.attempts[ip] = rec
	}
	rec.attempts++
	attempts := rec.attempts
	if rec.attempts >= stepUpMaxAttempts {
		rec.blockedUntil = now.Add(stepUpLockout)
		retryAfter = int(time.Until(rec.blockedUntil).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		blocked = true
	}
	persistAuthRateAttempt(authRateScopeStepUp, ip, rec.attempts, rec.firstAttemptAt, rec.blockedUntil)
	stepUpRateStore.Unlock()

	if attempts >= stepUpAbuseThreshold {
		_ = upsertSystemAlert(
			context.Background(),
			db,
			"stepup_abuse_spike",
			"warning",
			"high volume of failed step-up verification attempts",
			map[string]any{
				"ip":            ip,
				"attempts":      attempts,
				"threshold":     stepUpAbuseThreshold,
				"windowMinutes": int(stepUpLockout.Minutes()),
			},
		)
	}
	return blocked, retryAfter
}

func clearStepUpFailures(ip string) {
	stepUpRateStore.Lock()
	defer stepUpRateStore.Unlock()
	delete(stepUpRateStore.attempts, ip)
	deleteAuthRateAttempt(authRateScopeStepUp, ip)
}

func upsertSystemAlert(
	ctx context.Context,
	db *sql.DB,
	alertType string,
	severity string,
	message string,
	payload map[string]any,
) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	nowMs := time.Now().UnixMilli()

	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `BEGIN IMMEDIATE`); err != nil {
		return err
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		_, _ = conn.ExecContext(context.Background(), `ROLLBACK`)
	}()

	updateRes, err := conn.ExecContext(
		ctx,
		`UPDATE system_alerts
		 SET severity = ?, message = ?, payload_json = ?, updated_at = ?
		 WHERE alert_type = ? AND status = 'open'`,
		severity,
		message,
		string(raw),
		nowMs,
		alertType,
	)
	if err != nil {
		return err
	}
	updatedRows, err := updateRes.RowsAffected()
	if err != nil {
		return err
	}

	if updatedRows == 0 {
		if _, err := conn.ExecContext(
			ctx,
			`INSERT INTO system_alerts (alert_type, severity, message, status, payload_json, created_at, updated_at)
			 VALUES (?, ?, ?, 'open', ?, ?, ?)`,
			alertType,
			severity,
			message,
			string(raw),
			nowMs,
			nowMs,
		); err != nil {
			return err
		}
	}

	if _, err := conn.ExecContext(ctx, `COMMIT`); err != nil {
		return err
	}
	committed = true
	return nil
}

// isValidSession checks if token is in store and not expired.
func isValidSession(token string) bool {
	now := time.Now()
	sessionStore.RLock()
	expiry, exists := sessionStore.tokens[token]
	sessionStore.RUnlock()
	if !exists {
		persistedExpiry, _, ok, err := loadAuthSession(token, authSessionKindViewer)
		if err != nil || !ok {
			return false
		}
		expiry = persistedExpiry
		sessionStore.Lock()
		sessionStore.tokens[token] = expiry
		sessionStore.Unlock()
		exists = true
	}
	if !exists {
		return false
	}
	if now.After(expiry) {
		sessionStore.Lock()
		if latest, ok := sessionStore.tokens[token]; ok && now.After(latest) {
			delete(sessionStore.tokens, token)
		}
		sessionStore.Unlock()
		deleteAuthSession(token)
		return false
	}
	return true
}

func getClientIP(r *http.Request) string {
	if r == nil {
		return "unknown"
	}
	remoteIP := extractRemoteIP(r.RemoteAddr)
	if isTrustedProxy(remoteIP) {
		if ip := parseForwardedForHeaderValue(r.Header.Get("Forwarded")); ip != "" {
			return ip
		}
		if ip := parseIPHeaderValue(r.Header.Get("X-Real-IP")); ip != "" {
			return ip
		}
		if ip := parseIPHeaderValue(firstHeaderListValue(r.Header.Get("X-Forwarded-For"))); ip != "" {
			return ip
		}
	}
	if remoteIP != "" {
		return remoteIP
	}
	return r.RemoteAddr
}

func parseIPHeaderValue(raw string) string {
	candidate := strings.Trim(strings.TrimSpace(raw), `"`)
	if candidate == "" {
		return ""
	}
	if strings.EqualFold(candidate, "unknown") {
		return ""
	}
	// Reject scoped identifiers and RFC 7239 obfuscated identifiers.
	if strings.Contains(candidate, "%") {
		return ""
	}
	if strings.HasPrefix(candidate, "_") {
		return ""
	}
	// RFC 7239 "for=" may include host:port. Accept only when host portion is an IP.
	if host, _, err := net.SplitHostPort(candidate); err == nil {
		candidate = host
	}
	// RFC 7239 IPv6 values may be wrapped in brackets.
	if strings.HasPrefix(candidate, "[") && strings.HasSuffix(candidate, "]") && len(candidate) > 2 {
		candidate = candidate[1 : len(candidate)-1]
	}
	addr, err := netip.ParseAddr(candidate)
	if err != nil {
		return ""
	}
	return addr.Unmap().String()
}

func firstHeaderListValue(raw string) string {
	for _, part := range strings.Split(raw, ",") {
		if token := strings.TrimSpace(part); token != "" {
			return token
		}
	}
	return ""
}

func parseForwardedForHeaderValue(raw string) string {
	entry := firstHeaderListValue(raw)
	if entry == "" {
		return ""
	}
	for _, part := range strings.Split(entry, ";") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(kv[0]), "for") {
			return parseIPHeaderValue(kv[1])
		}
	}
	return ""
}

func parseForwardedProtoHeaderValue(raw string) string {
	entry := firstHeaderListValue(raw)
	if entry == "" {
		return ""
	}
	for _, part := range strings.Split(entry, ";") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(kv[0]), "proto") {
			proto := strings.ToLower(strings.Trim(strings.TrimSpace(kv[1]), `"`))
			if proto == "https" || proto == "http" {
				return proto
			}
			return ""
		}
	}
	return ""
}

func parseXForwardedProtoHeaderValue(raw string) string {
	proto := strings.ToLower(strings.TrimSpace(firstHeaderListValue(raw)))
	if proto == "https" || proto == "http" {
		return proto
	}
	return ""
}

func trustedProxyProto(r *http.Request) string {
	if r == nil {
		return ""
	}
	if !isTrustedProxy(extractRemoteIP(r.RemoteAddr)) {
		return ""
	}
	if proto := parseForwardedProtoHeaderValue(r.Header.Get("Forwarded")); proto != "" {
		return proto
	}
	return parseXForwardedProtoHeaderValue(r.Header.Get("X-Forwarded-Proto"))
}

func allowLoginAttempt(ip string) (bool, int, int) {
	now := time.Now()
	loginRateStore.Lock()
	defer loginRateStore.Unlock()

	rec := loginRateStore.attempts[ip]
	if rec == nil {
		attempts, firstAttemptAt, blockedUntil, ok := loadAuthRateAttempt(authRateScopeLogin, ip)
		if ok {
			rec = &loginAttempt{
				attempts:       attempts,
				firstAttemptAt: firstAttemptAt,
				blockedUntil:   blockedUntil,
			}
			loginRateStore.attempts[ip] = rec
		}
	}
	if rec == nil {
		return true, loginMaxAttempts, 0
	}

	if !rec.blockedUntil.IsZero() && now.Before(rec.blockedUntil) {
		retryAfter := int(time.Until(rec.blockedUntil).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, 0, retryAfter
	}

	if now.Sub(rec.firstAttemptAt) > loginLockout {
		delete(loginRateStore.attempts, ip)
		deleteAuthRateAttempt(authRateScopeLogin, ip)
		return true, loginMaxAttempts, 0
	}

	remaining := loginMaxAttempts - rec.attempts
	if remaining < 0 {
		remaining = 0
	}
	return true, remaining, 0
}

func recordLoginFailure(ip string) (blocked bool, retryAfter int) {
	now := time.Now()
	loginRateStore.Lock()
	defer loginRateStore.Unlock()

	rec := loginRateStore.attempts[ip]
	if rec == nil || now.Sub(rec.firstAttemptAt) > loginLockout {
		rec = &loginAttempt{attempts: 0, firstAttemptAt: now}
		loginRateStore.attempts[ip] = rec
	}

	rec.attempts++
	if rec.attempts >= loginMaxAttempts {
		rec.blockedUntil = now.Add(loginLockout)
		retryAfter = int(time.Until(rec.blockedUntil).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		persistAuthRateAttempt(authRateScopeLogin, ip, rec.attempts, rec.firstAttemptAt, rec.blockedUntil)
		return true, retryAfter
	}
	persistAuthRateAttempt(authRateScopeLogin, ip, rec.attempts, rec.firstAttemptAt, rec.blockedUntil)

	return false, 0
}

func clearLoginFailures(ip string) {
	loginRateStore.Lock()
	defer loginRateStore.Unlock()
	delete(loginRateStore.attempts, ip)
	deleteAuthRateAttempt(authRateScopeLogin, ip)
}

// loginHandler handles POST /api/auth/login
func loginHandler(db *sql.DB, dashboardPassword string) http.HandlerFunc {
	storedHash := ""
	if dashboardPassword != "" {
		storedHash = mustHashPassword(dashboardPassword)
	}
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		// No auth required if DASHBOARD_PASSWORD is not set
		if dashboardPassword == "" {
			if err := json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "authRequired": false}); err != nil {
				log.Printf("failed to encode login response: %v", err)
			}
			return
		}

		clientIP := getClientIP(r)
		allowed, _, retryAfter := allowLoginAttempt(clientIP)
		if !allowed {
			appMetrics.IncCounter("oracle_rate_limit_hits_total", map[string]string{"scope": "login"}, 1)
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			http.Error(w, `{"error":"too many attempts"}`, http.StatusTooManyRequests)
			return
		}

		var req struct {
			Password string `json:"password"` // #nosec G117 -- required request field for login API contract.
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		if !verifyPasswordHash(storedHash, req.Password) {
			appMetrics.IncCounter("oracle_auth_failures_total", map[string]string{"reason": "invalid_password"}, 1)
			blocked, retryAfter := recordLoginFailure(clientIP)
			if blocked {
				appMetrics.IncCounter("oracle_rate_limit_hits_total", map[string]string{"scope": "login"}, 1)
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				http.Error(w, `{"error":"too many attempts"}`, http.StatusTooManyRequests)
				return
			}
			http.Error(w, `{"error":"invalid password"}`, http.StatusUnauthorized)
			return
		}

		clearLoginFailures(clientIP)

		// Create session
		token, err := generateToken()
		if err != nil {
			http.Error(w, `{"error":"failed to create session"}`, http.StatusInternalServerError)
			return
		}

		expiresAt := time.Now().Add(sessionDuration)
		if err := persistAuthSession(token, authSessionKindViewer, "", expiresAt); err != nil {
			http.Error(w, `{"error":"failed to persist session"}`, http.StatusInternalServerError)
			return
		}

		sessionStore.Lock()
		sessionStore.tokens[token] = expiresAt
		sessionStore.Unlock()

		secureCookie, sameSite := cookieSecurityPolicy(r)
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: sameSite,
			MaxAge:   int(sessionDuration.Seconds()),
		})

		if err := json.NewEncoder(w).Encode(map[string]interface{}{"ok": true}); err != nil {
			log.Printf("failed to encode login success response: %v", err)
		}
	}
}

// logoutHandler handles POST /api/auth/logout
func logoutHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		cookie, err := r.Cookie(sessionCookieName)
		if err == nil && cookie.Value != "" {
			sessionStore.Lock()
			delete(sessionStore.tokens, cookie.Value)
			sessionStore.Unlock()
			deleteAuthSession(cookie.Value)
		}
		stepUpCookie, stepErr := r.Cookie(stepUpSessionCookieName)
		if stepErr == nil && stepUpCookie.Value != "" {
			stepUpSessionStore.Lock()
			delete(stepUpSessionStore.tokens, stepUpCookie.Value)
			stepUpSessionStore.Unlock()
			deleteAuthSession(stepUpCookie.Value)
		}

		secureCookie, sameSite := cookieSecurityPolicy(r)
		// Clear cookie
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: sameSite,
			MaxAge:   -1,
		})
		http.SetCookie(w, &http.Cookie{
			Name:     stepUpSessionCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: sameSite,
			MaxAge:   -1,
		})

		if err := json.NewEncoder(w).Encode(map[string]interface{}{"ok": true}); err != nil {
			log.Printf("failed to encode logout response: %v", err)
		}
	}
}

func cookieSecurityPolicy(r *http.Request) (bool, http.SameSite) {
	switch sessionCookieSecureMode {
	case "true":
		return true, http.SameSiteStrictMode
	case "false":
		return false, http.SameSiteLaxMode
	}
	if r != nil && r.TLS != nil {
		return true, http.SameSiteStrictMode
	}
	if trustedProxyProto(r) == "https" {
		return true, http.SameSiteStrictMode
	}
	// HTTP deployments require non-secure cookies or browsers will drop the session.
	return false, http.SameSiteLaxMode
}

func isLoopbackAddr(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func hasForwardedIp(r *http.Request) bool {
	return r.Header.Get("X-Forwarded-For") != "" || r.Header.Get("X-Real-IP") != "" || r.Header.Get("Forwarded") != ""
}

func isLoopbackHost(hostport string) bool {
	host := hostport
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		host = h
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// authCheckHandler handles GET /api/auth/check
func authCheckHandler(db *sql.DB, dashboardPassword string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// No auth required if DASHBOARD_PASSWORD is not set
		if dashboardPassword == "" {
			if err := json.NewEncoder(w).Encode(map[string]interface{}{
				"authenticated": true,
				"authRequired":  false,
			}); err != nil {
				log.Printf("failed to encode auth-check response: %v", err)
			}
			return
		}

		cookie, err := r.Cookie(sessionCookieName)
		authenticated := err == nil && isValidSession(cookie.Value)

		if err := json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": authenticated,
			"authRequired":  true,
		}); err != nil {
			log.Printf("failed to encode auth-check response: %v", err)
		}
	}
}
