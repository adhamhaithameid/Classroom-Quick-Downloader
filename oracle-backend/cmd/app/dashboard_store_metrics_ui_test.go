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

func loadDashboardJS(t *testing.T) string {
	t.Helper()
	jsPath := filepath.Join("..", "..", "static", "oracle-dashboard.js")
	body, err := os.ReadFile(jsPath)
	if err != nil {
		t.Fatalf("failed to read dashboard JS: %v", err)
	}
	return string(body)
}

func loadDashboardCSS(t *testing.T) string {
	t.Helper()
	cssPath := filepath.Join("..", "..", "static", "oracle-dashboard.css")
	body, err := os.ReadFile(cssPath)
	if err != nil {
		t.Fatalf("failed to read dashboard CSS: %v", err)
	}
	return string(body)
}

func TestDashboardStoreMetricsUI_HasOverviewStoreAndReachCounters(t *testing.T) {
	indexHTML := loadDashboardIndexHTML(t)
	dashboardJS := loadDashboardJS(t)

	requiredSnippets := []string{
		`id="stat-store-users"`,
		`id="stat-store-reviews"`,
		`id="stat-cancelled"`,
		`id="stat-countries-reached"`,
		`id="stat-languages-reached"`,
	}

	for _, snippet := range requiredSnippets {
		if !strings.Contains(indexHTML, snippet) {
			t.Fatalf("dashboard index missing required store metrics snippet: %s", snippet)
		}
	}
	if !strings.Contains(dashboardJS, `async function loadDeploymentStoreMetrics()`) {
		t.Fatalf("dashboard JS missing required store metrics loader")
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
	dashboardJS := loadDashboardJS(t)
	calls := strings.Count(dashboardJS, "await loadDeploymentStoreMetrics();")
	if calls < 3 {
		t.Fatalf("expected at least 3 loadDeploymentStoreMetrics refresh calls, got %d", calls)
	}
}

func TestDashboardStoreMetricsUI_HasUtcToggleAnimationAndStatusHoverHooks(t *testing.T) {
	dashboardCSS := loadDashboardCSS(t)
	cssSnippets := []string{
		`.nav-utc-time.is-swapping`,
		`.status-indicator:hover`,
		`#status-indicator:hover #sidebar-status-text`,
	}
	for _, snippet := range cssSnippets {
		if !strings.Contains(dashboardCSS, snippet) {
			t.Fatalf("dashboard CSS missing interaction snippet: %s", snippet)
		}
	}
	dashboardJS := loadDashboardJS(t)
	if !strings.Contains(dashboardJS, `label.classList.add('is-swapping');`) {
		t.Fatalf("dashboard JS missing UTC toggle animation snippet")
	}
}
