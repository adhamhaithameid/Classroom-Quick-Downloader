// oracle-backend/internal/handlers/deploy_status.go
// Provides deployment status information for the dashboard
package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"strings"
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

// Variables to allow mocking in tests
var (
	execCommandOutput = func(name string, arg ...string) ([]byte, error) {
		return exec.Command(name, arg...).Output()
	}
	timeNow   = time.Now
	timeSince = time.Since
)

// DeployStatusHandler returns the current deployment status
func DeployStatusHandler() http.HandlerFunc {
	// Cache the deployment info at startup
	status := getDeployStatus()
	
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache")
		json.NewEncoder(w).Encode(status)
	}
}

func getDeployStatus() DeployStatus {
	status := DeployStatus{
		Commit:     "unknown",
		CommitFull: "unknown",
		Branch:     "main",
		DeployedAt: timeNow().UTC().Format(time.RFC3339),
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
		if out, err := execCommandOutput("git", "rev-parse", "HEAD"); err == nil {
			full := strings.TrimSpace(string(out))
			status.CommitFull = full
			if len(full) > 7 {
				status.Commit = full[:7]
			} else {
				status.Commit = full
			}
		}
	}
	
	// Get commit message
	if out, err := execCommandOutput("git", "log", "-1", "--pretty=%s"); err == nil {
		status.Message = strings.TrimSpace(string(out))
	}
	
	// Get branch
	if out, err := execCommandOutput("git", "rev-parse", "--abbrev-ref", "HEAD"); err == nil {
		status.Branch = strings.TrimSpace(string(out))
	}
	
	// Check deploy time from environment or file
	if deployTime := os.Getenv("DEPLOY_TIME"); deployTime != "" {
		status.DeployedAt = deployTime
		
		// Check if deployment is stale (>24h old)
		if t, err := time.Parse(time.RFC3339, deployTime); err == nil {
			if timeSince(t) > 24*time.Hour {
				status.Stale = true
			}
		}
	}
	
	return status
}
