package main

import (
	"path/filepath"
	"testing"
	"time"

	"oracle-backend/internal/db"
)

// ---------------------------------------------------------------------------
// Session persistence round-trip
// ---------------------------------------------------------------------------

func TestPersistAuthSession_RoundTrip(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "sess-rt.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	token := "roundtrip-token-123"
	expiresAt := time.Now().Add(1 * time.Hour)

	if err := persistAuthSession(token, authSessionKindViewer, "", expiresAt); err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	exp, parent, ok, err := loadAuthSession(token, authSessionKindViewer)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected session to be found")
	}
	if parent != "" {
		t.Fatalf("expected empty parent token, got %q", parent)
	}
	// Allow 2-second tolerance for timestamp comparison
	if exp.Before(time.Now()) {
		t.Fatalf("expected expiry in the future, got %v", exp)
	}
}

func TestPersistAuthSession_StepUpKind(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "sess-stepup.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	token := "stepup-token-456"
	parentToken := "parent-viewer-token"
	expiresAt := time.Now().Add(15 * time.Minute)

	if err := persistAuthSession(token, authSessionKindStepUp, parentToken, expiresAt); err != nil {
		t.Fatal(err)
	}

	_, parent, ok, err := loadAuthSession(token, authSessionKindStepUp)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected step-up session to be found")
	}
	if parent != parentToken {
		t.Fatalf("expected parent=%q, got %q", parentToken, parent)
	}
}

func TestLoadAuthSession_MissingToken(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "sess-missing.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	_, _, ok, err := loadAuthSession("non-existent", authSessionKindViewer)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("expected ok=false for non-existent token")
	}
}

func TestDeleteAuthSession_RemovesToken(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "sess-delete.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	token := "delete-me-token"
	_ = persistAuthSession(token, authSessionKindViewer, "", time.Now().Add(1*time.Hour))

	deleteAuthSession(token)

	_, _, ok, _ := loadAuthSession(token, authSessionKindViewer)
	if ok {
		t.Fatal("expected session to be deleted")
	}
}

// ---------------------------------------------------------------------------
// Step-up challenge persistence
// ---------------------------------------------------------------------------

func TestPersistStepUpChallenge_RoundTrip(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "chal-rt.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	challengeID := "challenge-abc"
	clientIP := "192.168.1.1"
	expiresAt := time.Now().Add(5 * time.Minute)

	if err := persistStepUpChallenge(challengeID, clientIP, expiresAt); err != nil {
		t.Fatal(err)
	}

	ok := consumePersistedStepUpChallenge(challengeID, clientIP)
	if !ok {
		t.Fatal("expected challenge to be consumed")
	}

	// Second consume should fail (one-time use)
	ok = consumePersistedStepUpChallenge(challengeID, clientIP)
	if ok {
		t.Fatal("expected challenge to be one-time use")
	}
}

func TestConsumePersistedStepUpChallenge_WrongIP(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "chal-ip.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	challengeID := "challenge-ip-mismatch"
	_ = persistStepUpChallenge(challengeID, "10.0.0.1", time.Now().Add(5*time.Minute))

	ok := consumePersistedStepUpChallenge(challengeID, "10.0.0.2")
	if ok {
		t.Fatal("expected challenge to fail for wrong IP")
	}
}

func TestDeletePersistedStepUpChallenge_Removes(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "chal-del.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	challengeID := "challenge-delete"
	_ = persistStepUpChallenge(challengeID, "1.2.3.4", time.Now().Add(5*time.Minute))

	deletePersistedStepUpChallenge(challengeID)

	ok := consumePersistedStepUpChallenge(challengeID, "1.2.3.4")
	if ok {
		t.Fatal("expected challenge to be deleted")
	}
}

// ---------------------------------------------------------------------------
// Rate limit persistence
// ---------------------------------------------------------------------------

func TestPersistAuthRateAttempt_RoundTrip(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "rate-rt.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	ip := "192.168.1.99"
	firstAt := time.Now()
	blocked := time.Now().Add(15 * time.Minute)

	persistAuthRateAttempt(authRateScopeLogin, ip, 3, firstAt, blocked)

	attempts, loadedFirstAt, loadedBlocked, ok := loadAuthRateAttempt(authRateScopeLogin, ip)
	if !ok {
		t.Fatal("expected rate attempt to be found")
	}
	if attempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", attempts)
	}
	// Ensure timestamps are within a second of what we stored
	if loadedFirstAt.Before(firstAt.Add(-time.Second)) || loadedFirstAt.After(firstAt.Add(time.Second)) {
		t.Fatalf("firstAttemptAt mismatch: %v vs %v", loadedFirstAt, firstAt)
	}
	if loadedBlocked.Before(blocked.Add(-time.Second)) || loadedBlocked.After(blocked.Add(time.Second)) {
		t.Fatalf("blockedUntil mismatch: %v vs %v", loadedBlocked, blocked)
	}
}

func TestDeleteAuthRateAttempt_Removes(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "rate-del.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	ip := "10.0.0.50"
	persistAuthRateAttempt(authRateScopeLogin, ip, 5, time.Now(), time.Now().Add(15*time.Minute))

	deleteAuthRateAttempt(authRateScopeLogin, ip)

	_, _, _, ok := loadAuthRateAttempt(authRateScopeLogin, ip)
	if ok {
		t.Fatal("expected rate attempt to be deleted")
	}
}

// ---------------------------------------------------------------------------
// In-memory store cleanup
// ---------------------------------------------------------------------------

func TestCleanupExpiredViewerSessions_RemovesExpired(t *testing.T) {
	resetSessionStore()

	sessionStore.Lock()
	sessionStore.tokens["valid-token"] = time.Now().Add(1 * time.Hour)
	sessionStore.tokens["expired-token"] = time.Now().Add(-1 * time.Hour)
	sessionStore.Unlock()

	cleanupExpiredViewerSessions(time.Now())

	sessionStore.RLock()
	defer sessionStore.RUnlock()

	if _, ok := sessionStore.tokens["valid-token"]; !ok {
		t.Fatal("expected valid-token to survive cleanup")
	}
	if _, ok := sessionStore.tokens["expired-token"]; ok {
		t.Fatal("expected expired-token to be cleaned up")
	}
}

func TestCleanupExpiredStepUpChallenges_RemovesExpired(t *testing.T) {
	stepUpChallengeStore.Lock()
	stepUpChallengeStore.items = map[string]stepUpChallenge{
		"valid":   {clientIP: "1.1.1.1", expiresAt: time.Now().Add(5 * time.Minute)},
		"expired": {clientIP: "2.2.2.2", expiresAt: time.Now().Add(-5 * time.Minute)},
	}
	stepUpChallengeStore.Unlock()

	cleanupExpiredStepUpChallenges(time.Now())

	stepUpChallengeStore.Lock()
	defer stepUpChallengeStore.Unlock()

	if _, ok := stepUpChallengeStore.items["valid"]; !ok {
		t.Fatal("expected valid challenge to survive cleanup")
	}
	if _, ok := stepUpChallengeStore.items["expired"]; ok {
		t.Fatal("expected expired challenge to be cleaned up")
	}
}

func TestCleanupExpiredLoginRateEntries_RemovesExpired(t *testing.T) {
	resetLoginRateStore()

	loginRateStore.Lock()
	loginRateStore.attempts["active"] = &loginAttempt{
		attempts:       2,
		firstAttemptAt: time.Now(),
		blockedUntil:   time.Now().Add(10 * time.Minute),
	}
	loginRateStore.attempts["expired"] = &loginAttempt{
		attempts:       5,
		firstAttemptAt: time.Now().Add(-48 * time.Hour),
		blockedUntil:   time.Now().Add(-47 * time.Hour),
	}
	loginRateStore.Unlock()

	cleanupExpiredLoginRateEntries(time.Now())

	loginRateStore.Lock()
	defer loginRateStore.Unlock()

	if _, ok := loginRateStore.attempts["active"]; !ok {
		t.Fatal("expected active rate entry to survive cleanup")
	}
	if _, ok := loginRateStore.attempts["expired"]; ok {
		t.Fatal("expected expired rate entry to be cleaned up")
	}
}

func TestCleanupPersistedAuthState_RemovesExpired(t *testing.T) {
	sqlDB, err := db.Init(filepath.Join(t.TempDir(), "cleanup-persist.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	prevDB := getAuthStateDB()
	setAuthStateDB(sqlDB)
	defer setAuthStateDB(prevDB)

	// Insert a valid and an expired session
	now := time.Now()
	_ = persistAuthSession("valid-session", authSessionKindViewer, "", now.Add(1*time.Hour))
	_ = persistAuthSession("expired-session", authSessionKindViewer, "", now.Add(-1*time.Hour))

	cleanupPersistedAuthState(now)

	_, _, okValid, _ := loadAuthSession("valid-session", authSessionKindViewer)
	_, _, okExpired, _ := loadAuthSession("expired-session", authSessionKindViewer)

	if !okValid {
		t.Fatal("expected valid session to survive cleanup")
	}
	if okExpired {
		t.Fatal("expected expired session to be cleaned up")
	}
}
