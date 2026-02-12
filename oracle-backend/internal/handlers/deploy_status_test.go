package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestDeployStatusHandler_ReturnsJSON(t *testing.T) {
	// Arrange
	handler := DeployStatusHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/deploy-status", nil)
	rr := httptest.NewRecorder()

	// Act
	handler.ServeHTTP(rr, req)

	// Assert
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected application/json, got %q", ct)
	}
	var status DeployStatus
	if err := json.Unmarshal(rr.Body.Bytes(), &status); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if status.Commit == "" {
		t.Fatalf("expected non-empty commit field")
	}
	if status.Branch == "" {
		t.Fatalf("expected non-empty branch field")
	}
	if status.DeployedAt == "" {
		t.Fatalf("expected non-empty deployed_at field")
	}
}

func TestDeployStatusHandler_NoCacheHeaders(t *testing.T) {
	// Arrange
	handler := DeployStatusHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/deploy-status", nil)
	rr := httptest.NewRecorder()

	// Act
	handler.ServeHTTP(rr, req)

	// Assert
	if cc := rr.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Fatalf("expected Cache-Control: no-cache, got %q", cc)
	}
}

func TestGetDeployStatus_UsesGitCommitEnv(t *testing.T) {
	// Arrange
	testCommit := "abc123def456789"
	os.Setenv("GIT_COMMIT", testCommit)
	defer os.Unsetenv("GIT_COMMIT")

	// Act
	status := getDeployStatus()

	// Assert
	if status.CommitFull != testCommit {
		t.Fatalf("expected full commit %q, got %q", testCommit, status.CommitFull)
	}
	if status.Commit != testCommit[:7] {
		t.Fatalf("expected short commit %q, got %q", testCommit[:7], status.Commit)
	}
}

func TestGetDeployStatus_ShortCommitUnchanged(t *testing.T) {
	// Arrange — commit shorter than 7 chars should not be truncated
	shortCommit := "abc12"
	os.Setenv("GIT_COMMIT", shortCommit)
	defer os.Unsetenv("GIT_COMMIT")

	// Act
	status := getDeployStatus()

	// Assert
	if status.Commit != shortCommit {
		t.Fatalf("expected short commit %q unchanged, got %q", shortCommit, status.Commit)
	}
	if status.CommitFull != shortCommit {
		t.Fatalf("expected full commit %q, got %q", shortCommit, status.CommitFull)
	}
}

func TestGetDeployStatus_StaleDetection(t *testing.T) {
	// Arrange — set DEPLOY_TIME to >24h ago
	oldTime := time.Now().Add(-25 * time.Hour).UTC().Format(time.RFC3339)
	os.Setenv("DEPLOY_TIME", oldTime)
	defer os.Unsetenv("DEPLOY_TIME")

	// Act
	status := getDeployStatus()

	// Assert
	if !status.Stale {
		t.Fatalf("expected stale=true for deploy >24h ago")
	}
	if status.DeployedAt != oldTime {
		t.Fatalf("expected deployed_at=%q, got %q", oldTime, status.DeployedAt)
	}
}

func TestGetDeployStatus_NotStaleWhenRecent(t *testing.T) {
	// Arrange — set DEPLOY_TIME to recent
	recentTime := time.Now().Add(-1 * time.Hour).UTC().Format(time.RFC3339)
	os.Setenv("DEPLOY_TIME", recentTime)
	defer os.Unsetenv("DEPLOY_TIME")

	// Act
	status := getDeployStatus()

	// Assert
	if status.Stale {
		t.Fatalf("expected stale=false for deploy <24h ago")
	}
}

func TestGetDeployStatus_DefaultsWithoutEnvVars(t *testing.T) {
	// Arrange — clear all relevant env vars
	os.Unsetenv("GIT_COMMIT")
	os.Unsetenv("DEPLOY_TIME")

	// Act
	status := getDeployStatus()

	// Assert
	if status.Stale {
		t.Fatalf("expected stale=false by default")
	}
	if status.DeployedAt == "" {
		t.Fatalf("expected non-empty deployed_at by default")
	}
	// deployed_at should be valid RFC3339
	if _, err := time.Parse(time.RFC3339, status.DeployedAt); err != nil {
		t.Fatalf("deployed_at is not valid RFC3339: %q", status.DeployedAt)
	}
}
