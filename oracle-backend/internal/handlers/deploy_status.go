// oracle-backend/internal/handlers/deploy_status.go
// Provides deployment status information for the dashboard
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// DeployStatus contains deployment information
type DeployStatus struct {
	Commit     string `json:"commit"`
	CommitFull string `json:"commit_full"`
	Branch     string `json:"branch"`
	DeployedAt string `json:"deployed_at"`
	Message    string `json:"message,omitempty"`
	Stale      bool   `json:"stale"`
}

var deployStatusRuntime = struct {
	sync.Mutex
	cached    DeployStatus
	expiresAt time.Time
}{
	cached: DeployStatus{},
}

const (
	deployStatusCacheTTL  = 30 * time.Second
	gitCommandTimeoutEach = 800 * time.Millisecond
)

// DeployStatusHandler returns the current deployment status
func DeployStatusHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		status := getDeployStatus()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		if err := json.NewEncoder(w).Encode(status); err != nil {
			http.Error(w, "failed to encode deploy status", http.StatusInternalServerError)
			return
		}
	}
}

func getDeployStatus() DeployStatus {
	// When explicit deployment metadata is present, compute directly from env.
	// This avoids stale cache interactions in dynamic test and rollout flows.
	if strings.TrimSpace(os.Getenv("GIT_COMMIT")) != "" || strings.TrimSpace(os.Getenv("DEPLOY_TIME")) != "" {
		return collectDeployStatus(time.Now())
	}

	now := time.Now()
	deployStatusRuntime.Lock()
	if !deployStatusRuntime.expiresAt.IsZero() && now.Before(deployStatusRuntime.expiresAt) {
		cached := deployStatusRuntime.cached
		deployStatusRuntime.Unlock()
		return cached
	}
	deployStatusRuntime.Unlock()

	status := collectDeployStatus(now)

	deployStatusRuntime.Lock()
	deployStatusRuntime.cached = status
	deployStatusRuntime.expiresAt = now.Add(deployStatusCacheTTL)
	deployStatusRuntime.Unlock()
	return status
}

func collectDeployStatus(now time.Time) DeployStatus {
	status := DeployStatus{
		Commit:     "unknown",
		CommitFull: "unknown",
		Branch:     "main",
		DeployedAt: now.UTC().Format(time.RFC3339),
		Stale:      false,
	}

	// Try to get git info from environment (set during deploy)
	if commit := os.Getenv("GIT_COMMIT"); commit != "" {
		status.CommitFull = commit
		if len(commit) > 7 {
			status.Commit = commit[:7]
		} else {
			status.Commit = commit
		}
	} else {
		// Fall back to git command
		if full, err := runGitCommand("rev-parse", "HEAD"); err == nil {
			status.CommitFull = full
			if len(full) > 7 {
				status.Commit = full[:7]
			} else {
				status.Commit = full
			}
		}
	}

	// Get commit message
	if message, err := runGitCommand("log", "-1", "--pretty=%s"); err == nil {
		status.Message = message
	}

	// Get branch
	if branch, err := runGitCommand("rev-parse", "--abbrev-ref", "HEAD"); err == nil {
		status.Branch = branch
	}

	// Check deploy time from environment or file
	if deployTime := os.Getenv("DEPLOY_TIME"); deployTime != "" {
		status.DeployedAt = deployTime

		// Check if deployment is stale (>24h old)
		if t, err := time.Parse(time.RFC3339, deployTime); err == nil {
			if time.Since(t) > 24*time.Hour {
				status.Stale = true
			}
		}
	}

	return status
}

func runGitCommand(args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), gitCommandTimeoutEach)
	defer cancel()
	out, err := exec.CommandContext(ctx, "git", args...).Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func resetDeployStatusCache() {
	deployStatusRuntime.Lock()
	deployStatusRuntime.cached = DeployStatus{}
	deployStatusRuntime.expiresAt = time.Time{}
	deployStatusRuntime.Unlock()
}
