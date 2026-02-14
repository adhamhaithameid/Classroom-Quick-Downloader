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

func TestDashboardStoreMetricsUI_HasOverviewStoreAndReachCounters(t *testing.T) {
	indexHTML := loadDashboardIndexHTML(t)

	requiredSnippets := []string{
		`id="stat-store-users"`,
		`id="stat-store-reviews"`,
		`id="stat-cancelled"`,
		`id="stat-countries-reached"`,
		`id="stat-languages-reached"`,
		`async function loadDeploymentStoreMetrics()`,
	}

	for _, snippet := range requiredSnippets {
		if !strings.Contains(indexHTML, snippet) {
			t.Fatalf("dashboard index missing required store metrics snippet: %s", snippet)
		}
	}
}

func TestDashboardStoreMetricsUI_RemovesStoreAnalyticsCardAndSuccessRateCard(t *testing.T) {
	indexHTML := loadDashboardIndexHTML(t)
	forbiddenSnippets := []string{
		`id="chart-store-metrics"`,
		`id="stat-rate"`,
	}
	for _, snippet := range forbiddenSnippets {
		if strings.Contains(indexHTML, snippet) {
			t.Fatalf("dashboard index must not include legacy snippet: %s", snippet)
		}
	}
}

func TestDashboardStoreMetricsUI_RefreshesOverviewAfterSyncAndLoads(t *testing.T) {
	indexHTML := loadDashboardIndexHTML(t)
	calls := strings.Count(indexHTML, "await loadDeploymentStoreMetrics();")
	if calls < 3 {
		t.Fatalf("expected at least 3 loadDeploymentStoreMetrics refresh calls, got %d", calls)
	}
}

func TestDashboardStoreMetricsUI_HasUtcToggleAnimationAndStatusHoverHooks(t *testing.T) {
	indexHTML := loadDashboardIndexHTML(t)
	requiredSnippets := []string{
		`.nav-utc-time.is-swapping`,
		`label.classList.add('is-swapping');`,
		`.status-indicator:hover`,
		`#status-indicator:hover #sidebar-status-text`,
	}
	for _, snippet := range requiredSnippets {
		if !strings.Contains(indexHTML, snippet) {
			t.Fatalf("dashboard index missing interaction snippet: %s", snippet)
		}
	}
}
