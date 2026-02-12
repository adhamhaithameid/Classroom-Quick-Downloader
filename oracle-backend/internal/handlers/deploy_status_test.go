package handlers

import (
	"errors"
	"os"
	"strings"
	"testing"
	"time"
)

func TestGetDeployStatus(t *testing.T) {
	// Backup original functions
	origExecCommandOutput := execCommandOutput
	origTimeNow := timeNow
	origTimeSince := timeSince
	defer func() {
		execCommandOutput = origExecCommandOutput
		timeNow = origTimeNow
		timeSince = origTimeSince
	}()

	// Helper to set env vars and restore them
	setEnv := func(t *testing.T, key, value string) {
		t.Helper()
		origValue, exists := os.LookupEnv(key)
		os.Setenv(key, value)
		t.Cleanup(func() {
			if exists {
				os.Setenv(key, origValue)
			} else {
				os.Unsetenv(key)
			}
		})
	}

	// Mock current time
	fixedTime := time.Date(2023, 10, 27, 10, 0, 0, 0, time.UTC)
	timeNow = func() time.Time {
		return fixedTime
	}

	t.Run("EnvVarsPriority", func(t *testing.T) {
		setEnv(t, "GIT_COMMIT", "abcdef1234567890")
		setEnv(t, "DEPLOY_TIME", "2023-10-26T10:00:00Z")

		// Mock git command to fail to ensure it's not used for commit hash
		execCommandOutput = func(name string, arg ...string) ([]byte, error) {
			return nil, errors.New("git command failed")
		}

		// Mock timeSince to return a safe value
		timeSince = func(t time.Time) time.Duration {
			return 24 * time.Hour // Exactly 24h, not stale
		}

		status := getDeployStatus()

		if status.CommitFull != "abcdef1234567890" {
			t.Errorf("expected full commit from env, got %s", status.CommitFull)
		}
		if status.Commit != "abcdef1" {
			t.Errorf("expected short commit from env, got %s", status.Commit)
		}
		if status.DeployedAt != "2023-10-26T10:00:00Z" {
			t.Errorf("expected deployed at from env, got %s", status.DeployedAt)
		}
		if status.Stale {
			t.Error("expected not stale")
		}
	})

	t.Run("StaleCheck_Stale", func(t *testing.T) {
		setEnv(t, "DEPLOY_TIME", "2023-10-20T10:00:00Z")

		timeSince = func(t time.Time) time.Duration {
			return 24*time.Hour + time.Second // > 24h
		}

		status := getDeployStatus()

		if !status.Stale {
			t.Error("expected stale to be true")
		}
	})

	t.Run("StaleCheck_Fresh", func(t *testing.T) {
		setEnv(t, "DEPLOY_TIME", "2023-10-27T09:00:00Z")

		timeSince = func(t time.Time) time.Duration {
			return 1 * time.Hour // < 24h
		}

		status := getDeployStatus()

		if status.Stale {
			t.Error("expected stale to be false")
		}
	})

	t.Run("GitFallback_Success", func(t *testing.T) {
		// Unset env vars
		os.Unsetenv("GIT_COMMIT")
		os.Unsetenv("DEPLOY_TIME") // Should fallback to timeNow

		execCommandOutput = func(name string, arg ...string) ([]byte, error) {
			cmd := strings.Join(arg, " ")
			switch cmd {
			case "rev-parse HEAD":
				return []byte("gitcommit123\n"), nil
			case "log -1 --pretty=%s":
				return []byte("fix: something important\n"), nil
			case "rev-parse --abbrev-ref HEAD":
				return []byte("feature-branch\n"), nil
			default:
				return nil, errors.New("unknown command")
			}
		}

		status := getDeployStatus()

		if status.CommitFull != "gitcommit123" {
			t.Errorf("expected commit from git, got %s", status.CommitFull)
		}
		if status.Commit != "gitcomm" { // First 7 chars
			t.Errorf("expected short commit, got %s", status.Commit)
		}
		if status.Message != "fix: something important" {
			t.Errorf("expected message from git, got %s", status.Message)
		}
		if status.Branch != "feature-branch" {
			t.Errorf("expected branch from git, got %s", status.Branch)
		}
		if status.DeployedAt != fixedTime.Format(time.RFC3339) {
			t.Errorf("expected default deployed at, got %s", status.DeployedAt)
		}
	})

	t.Run("GitFallback_Failure", func(t *testing.T) {
		// Unset env vars
		os.Unsetenv("GIT_COMMIT")
		os.Unsetenv("DEPLOY_TIME")

		execCommandOutput = func(name string, arg ...string) ([]byte, error) {
			return nil, errors.New("git not found")
		}

		status := getDeployStatus()

		if status.Commit != "unknown" {
			t.Errorf("expected unknown commit, got %s", status.Commit)
		}
		if status.Branch != "main" {
			t.Errorf("expected default branch main, got %s", status.Branch)
		}
		if status.Message != "" {
			t.Errorf("expected empty message, got %s", status.Message)
		}
	})
}
