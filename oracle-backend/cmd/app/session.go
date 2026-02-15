package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net"
	"strings"
	"sync"
	"time"
)

// =============================================================================
// AUTHENTICATION SYSTEM
// =============================================================================

// sessionStore holds active session tokens. In production, consider Redis.
var sessionStore = struct {
	sync.RWMutex
	tokens map[string]time.Time // token -> expiry
}{tokens: make(map[string]time.Time)}

const sessionDuration = 24 * time.Hour
const sessionCookieName = "oracle_session"
const stepUpSessionDuration = 15 * time.Minute
const stepUpChallengeDuration = 5 * time.Minute
const stepUpSessionCookieName = "oracle_stepup"

type loginAttempt struct {
	attempts       int
	firstAttemptAt time.Time
	blockedUntil   time.Time
}

var loginRateStore = struct {
	sync.Mutex
	attempts map[string]*loginAttempt
}{attempts: make(map[string]*loginAttempt)}

const loginMaxAttempts = 5
const loginLockout = 15 * time.Minute

type stepUpChallenge struct {
	clientIP  string
	expiresAt time.Time
}

type stepUpSession struct {
	expiresAt          time.Time
	parentSessionToken string
}

type stepUpAttempt struct {
	attempts       int
	firstAttemptAt time.Time
	blockedUntil   time.Time
}

var stepUpChallengeStore = struct {
	sync.Mutex
	items map[string]stepUpChallenge
}{items: make(map[string]stepUpChallenge)}

var stepUpSessionStore = struct {
	sync.RWMutex
	tokens map[string]stepUpSession
}{tokens: make(map[string]stepUpSession)}

var stepUpRateStore = struct {
	sync.Mutex
	attempts map[string]*stepUpAttempt
}{attempts: make(map[string]*stepUpAttempt)}

const stepUpMaxAttempts = 8
const stepUpLockout = 10 * time.Minute
const stepUpAbuseThreshold = 5
const inMemoryCleanupHorizon = 24 * time.Hour

var trustedProxyNets []*net.IPNet
var sessionCookieSecureMode = "auto"
var csrfAllowedOrigins map[string]struct{}

var authStateStore = struct {
	sync.RWMutex
	db *sql.DB
}{}

const (
	authSessionKindViewer = "viewer"
	authSessionKindStepUp = "stepup"
	authRateScopeLogin    = "login"
	authRateScopeStepUp   = "stepup"
)

func setTrustedProxyNets(nets []*net.IPNet) {
	trustedProxyNets = nets
}

func setAuthStateDB(database *sql.DB) {
	authStateStore.Lock()
	authStateStore.db = database
	authStateStore.Unlock()
}

func getAuthStateDB() *sql.DB {
	authStateStore.RLock()
	defer authStateStore.RUnlock()
	return authStateStore.db
}

func startInMemoryStoreCleanupLoop(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 15 * time.Minute
	}
	cleanupExpiredInMemoryStores(time.Now())
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cleanupExpiredInMemoryStores(time.Now())
		}
	}
}

func cleanupExpiredInMemoryStores(now time.Time) {
	cleanupExpiredViewerSessions(now)
	cleanupExpiredStepUpChallenges(now)
	cleanupExpiredStepUpSessions(now)
	cleanupExpiredLoginRateEntries(now)
	cleanupExpiredStepUpRateEntries(now)
	cleanupPersistedAuthState(now)
}

func cleanupExpiredViewerSessions(now time.Time) {
	sessionStore.Lock()
	defer sessionStore.Unlock()
	for token, expiry := range sessionStore.tokens {
		if now.After(expiry) {
			delete(sessionStore.tokens, token)
		}
	}
}

func cleanupExpiredStepUpChallenges(now time.Time) {
	stepUpChallengeStore.Lock()
	defer stepUpChallengeStore.Unlock()
	cleanupExpiredStepUpChallengesLocked(now)
}

func cleanupExpiredStepUpSessions(now time.Time) {
	stepUpSessionStore.Lock()
	defer stepUpSessionStore.Unlock()
	for token, session := range stepUpSessionStore.tokens {
		if now.After(session.expiresAt) {
			delete(stepUpSessionStore.tokens, token)
		}
	}
}

func cleanupExpiredLoginRateEntries(now time.Time) {
	loginRateStore.Lock()
	defer loginRateStore.Unlock()
	for ip, rec := range loginRateStore.attempts {
		if rec == nil {
			delete(loginRateStore.attempts, ip)
			continue
		}
		if !rec.blockedUntil.IsZero() && now.Before(rec.blockedUntil) {
			continue
		}
		if now.Sub(rec.firstAttemptAt) > loginLockout+inMemoryCleanupHorizon {
			delete(loginRateStore.attempts, ip)
		}
	}
}

func cleanupExpiredStepUpRateEntries(now time.Time) {
	stepUpRateStore.Lock()
	defer stepUpRateStore.Unlock()
	for ip, rec := range stepUpRateStore.attempts {
		if rec == nil {
			delete(stepUpRateStore.attempts, ip)
			continue
		}
		if !rec.blockedUntil.IsZero() && now.Before(rec.blockedUntil) {
			continue
		}
		if now.Sub(rec.firstAttemptAt) > stepUpLockout+inMemoryCleanupHorizon {
			delete(stepUpRateStore.attempts, ip)
		}
	}
}

func cleanupPersistedAuthState(now time.Time) {
	database := getAuthStateDB()
	if database == nil {
		return
	}

	nowUnix := now.Unix()
	pruneBefore := now.Add(-(inMemoryCleanupHorizon + loginLockout)).Unix()
	if stepUpLockout > loginLockout {
		pruneBefore = now.Add(-(inMemoryCleanupHorizon + stepUpLockout)).Unix()
	}

	_, _ = database.Exec(
		`DELETE FROM auth_sessions WHERE expires_at <= ?`,
		nowUnix,
	)
	_, _ = database.Exec(
		`DELETE FROM auth_stepup_challenges WHERE expires_at <= ?`,
		nowUnix,
	)
	_, _ = database.Exec(
		`DELETE FROM auth_rate_limits
		  WHERE ((blocked_until > 0 AND blocked_until <= ?) OR first_attempt_at <= ?)`,
		nowUnix,
		pruneBefore,
	)
}

func parseTrustedProxyCIDRs(input string) []*net.IPNet {
	if input == "" {
		return nil
	}
	var nets []*net.IPNet
	for _, part := range strings.Split(input, ",") {
		entry := strings.TrimSpace(part)
		if entry == "" {
			continue
		}
		if strings.Contains(entry, "/") {
			_, network, err := net.ParseCIDR(entry)
			if err != nil {
				log.Printf("[WARN] invalid trusted proxy CIDR: %s", sanitizeLogValue(entry)) // #nosec G706 -- value is sanitized before logging.
				continue
			}
			nets = append(nets, network)
			continue
		}
		ip := net.ParseIP(entry)
		if ip == nil {
			log.Printf("[WARN] invalid trusted proxy IP: %s", sanitizeLogValue(entry)) // #nosec G706 -- value is sanitized before logging.
			continue
		}
		bits := 32
		if ip.To4() == nil {
			bits = 128
		}
		mask := net.CIDRMask(bits, bits)
		nets = append(nets, &net.IPNet{IP: ip, Mask: mask})
	}
	return nets
}

func normalizeSessionCookieSecureMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "true", "1", "yes", "always":
		return "true"
	case "false", "0", "no", "never":
		return "false"
	default:
		return "auto"
	}
}

func isTrustedProxy(remoteIP string) bool {
	if remoteIP == "" || len(trustedProxyNets) == 0 {
		return false
	}
	ip := net.ParseIP(remoteIP)
	if ip == nil {
		return false
	}
	for _, network := range trustedProxyNets {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

func extractRemoteIP(addr string) string {
	if addr == "" {
		return ""
	}
	host, _, err := net.SplitHostPort(addr)
	if err == nil && host != "" {
		return host
	}
	return addr
}

func persistAuthSession(token, kind, parentToken string, expiresAt time.Time) error {
	database := getAuthStateDB()
	if database == nil {
		return nil
	}
	nowUnix := time.Now().Unix()
	_, err := database.Exec(
		`INSERT INTO auth_sessions (token, session_kind, parent_token, expires_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(token) DO UPDATE SET
		   session_kind = excluded.session_kind,
		   parent_token = excluded.parent_token,
		   expires_at = excluded.expires_at,
		   updated_at = excluded.updated_at`,
		token,
		kind,
		parentToken,
		expiresAt.Unix(),
		nowUnix,
		nowUnix,
	)
	return err
}

func loadAuthSession(token, kind string) (time.Time, string, bool, error) {
	database := getAuthStateDB()
	if database == nil {
		return time.Time{}, "", false, nil
	}

	var expiresAtUnix int64
	var parent sql.NullString
	err := database.QueryRow(
		`SELECT expires_at, parent_token
		   FROM auth_sessions
		  WHERE token = ? AND session_kind = ?`,
		token,
		kind,
	).Scan(&expiresAtUnix, &parent)
	if errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, "", false, nil
	}
	if err != nil {
		return time.Time{}, "", false, err
	}
	return time.Unix(expiresAtUnix, 0), parent.String, true, nil
}

func deleteAuthSession(token string) {
	database := getAuthStateDB()
	if database == nil {
		return
	}
	_, _ = database.Exec(`DELETE FROM auth_sessions WHERE token = ?`, token)
}

func persistAuthRateAttempt(scope, ip string, attempts int, firstAttemptAt time.Time, blockedUntil time.Time) {
	database := getAuthStateDB()
	if database == nil {
		return
	}
	blockedUntilUnix := int64(0)
	if !blockedUntil.IsZero() {
		blockedUntilUnix = blockedUntil.Unix()
	}
	nowUnix := time.Now().Unix()
	_, _ = database.Exec(
		`INSERT INTO auth_rate_limits (scope, client_ip, attempts, first_attempt_at, blocked_until, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(scope, client_ip) DO UPDATE SET
		   attempts = excluded.attempts,
		   first_attempt_at = excluded.first_attempt_at,
		   blocked_until = excluded.blocked_until,
		   updated_at = excluded.updated_at`,
		scope,
		ip,
		attempts,
		firstAttemptAt.Unix(),
		blockedUntilUnix,
		nowUnix,
	)
}

func loadAuthRateAttempt(scope, ip string) (attempts int, firstAttemptAt time.Time, blockedUntil time.Time, ok bool) {
	database := getAuthStateDB()
	if database == nil {
		return 0, time.Time{}, time.Time{}, false
	}
	var firstAttemptUnix int64
	var blockedUntilUnix int64
	err := database.QueryRow(
		`SELECT attempts, first_attempt_at, blocked_until
		   FROM auth_rate_limits
		  WHERE scope = ? AND client_ip = ?`,
		scope,
		ip,
	).Scan(&attempts, &firstAttemptUnix, &blockedUntilUnix)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, time.Time{}, time.Time{}, false
	}
	if err != nil {
		return 0, time.Time{}, time.Time{}, false
	}
	firstAttemptAt = time.Unix(firstAttemptUnix, 0)
	if blockedUntilUnix > 0 {
		blockedUntil = time.Unix(blockedUntilUnix, 0)
	}
	return attempts, firstAttemptAt, blockedUntil, true
}

func deleteAuthRateAttempt(scope, ip string) {
	database := getAuthStateDB()
	if database == nil {
		return
	}
	_, _ = database.Exec(`DELETE FROM auth_rate_limits WHERE scope = ? AND client_ip = ?`, scope, ip)
}

func persistStepUpChallenge(challengeID, clientIP string, expiresAt time.Time) error {
	database := getAuthStateDB()
	if database == nil {
		return nil
	}
	nowUnix := time.Now().Unix()
	_, err := database.Exec(
		`INSERT INTO auth_stepup_challenges (challenge_id, client_ip, expires_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(challenge_id) DO UPDATE SET
		   client_ip = excluded.client_ip,
		   expires_at = excluded.expires_at,
		   updated_at = excluded.updated_at`,
		challengeID,
		clientIP,
		expiresAt.Unix(),
		nowUnix,
		nowUnix,
	)
	return err
}

func consumePersistedStepUpChallenge(challengeID, clientIP string) bool {
	database := getAuthStateDB()
	if database == nil {
		return false
	}
	nowUnix := time.Now().Unix()
	res, err := database.Exec(
		`DELETE FROM auth_stepup_challenges
		  WHERE challenge_id = ?
		    AND client_ip = ?
		    AND expires_at >= ?`,
		challengeID,
		clientIP,
		nowUnix,
	)
	if err != nil {
		return false
	}
	rows, err := res.RowsAffected()
	return err == nil && rows > 0
}

func deletePersistedStepUpChallenge(challengeID string) {
	database := getAuthStateDB()
	if database == nil {
		return
	}
	_, _ = database.Exec(`DELETE FROM auth_stepup_challenges WHERE challenge_id = ?`, challengeID)
}
