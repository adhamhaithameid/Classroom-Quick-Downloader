package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func loadDashboardIndexHTML(t *testing.T) string {
	t.Helper()
	indexPath := filepath.Join("..", "..", "static", "index.html")
	body, err := os.ReadFile(indexPath)
	if err != nil {
		t.Fatalf("failed to read dashboard index: %v", err)
	}
	return string(body)
}

func TestDashboardStoreMetricsUI_HasOverviewCountersAndAnalyticsChart(t *testing.T) {
	indexHTML := loadDashboardIndexHTML(t)

	requiredSnippets := []string{
		`id="stat-store-users"`,
		`id="stat-store-reviews"`,
		`id="chart-store-metrics"`,
		`async function loadDeploymentStoreMetrics()`,
	}

	for _, snippet := range requiredSnippets {
		if !strings.Contains(indexHTML, snippet) {
			t.Fatalf("dashboard index missing required store metrics snippet: %s", snippet)
		}
	}
}

func TestDashboardStoreMetricsUI_RefreshesAfterSyncAndLoads(t *testing.T) {
	indexHTML := loadDashboardIndexHTML(t)
	calls := strings.Count(indexHTML, "await loadDeploymentStoreMetrics();")
	if calls < 4 {
		t.Fatalf("expected at least 4 loadDeploymentStoreMetrics refresh calls, got %d", calls)
	}
}
