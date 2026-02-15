package main

import (
	"net/url"
	"testing"
	"time"
)

func TestResolveArchiveDateUTC(t *testing.T) {
	now := time.Date(2026, time.February, 14, 12, 0, 0, 0, time.UTC)

	day, err := resolveArchiveDateUTC("", now)
	if err != nil {
		t.Fatalf("default day should resolve, got error: %v", err)
	}
	if day != "2026-02-13" {
		t.Fatalf("expected default day to be yesterday, got %q", day)
	}

	day, err = resolveArchiveDateUTC("today", now)
	if err != nil {
		t.Fatalf("today should resolve, got error: %v", err)
	}
	if day != "2026-02-14" {
		t.Fatalf("expected today day, got %q", day)
	}

	day, err = resolveArchiveDateUTC("2026-02-01", now)
	if err != nil {
		t.Fatalf("explicit day should resolve, got error: %v", err)
	}
	if day != "2026-02-01" {
		t.Fatalf("expected explicit day to be preserved, got %q", day)
	}

	if _, err := resolveArchiveDateUTC("bad-date", now); err == nil {
		t.Fatalf("expected invalid day to fail")
	}
}

func TestBuildSummaryURLForDay(t *testing.T) {
	out, err := buildSummaryURLForDay("http://127.0.0.1:8080/api/stats/summary", "2026-02-13")
	if err != nil {
		t.Fatalf("buildSummaryURLForDay failed: %v", err)
	}
	parsed, err := url.Parse(out)
	if err != nil {
		t.Fatalf("parse output url failed: %v", err)
	}
	if parsed.Path != "/api/stats/summary" {
		t.Fatalf("unexpected path: %s", parsed.Path)
	}
	if got := parsed.Query().Get("from"); got != "2026-02-13" {
		t.Fatalf("expected from query to be set, got %q", got)
	}
	if got := parsed.Query().Get("to"); got != "2026-02-13" {
		t.Fatalf("expected to query to be set, got %q", got)
	}
}

func TestBuildArchiveRow_OrderAndCancelledAtEnd(t *testing.T) {
	var data SummaryResponse
	data.Totals.TotalDownloads = 100
	data.Totals.TotalSuccess = 80
	data.Totals.TotalFail = 20
	data.Totals.TotalCancelled = 9
	data.TopBrowser = "chrome"
	data.TopOs = "windows"
	data.TopCountry = "us"
	data.TopType = "pdf"
	data.Browsers = map[string]int64{"chrome": 80}
	data.Os = map[string]int64{"windows": 80}
	data.Countries = map[string]int64{"us": 80}
	data.Languages = map[string]int64{"en": 80}
	data.Types = map[string]int64{"pdf": 80}
	data.ErrorReasons = map[string]int64{"none": 80}
	data.Versions = map[string]int64{"1.0.0": 80}

	row := buildArchiveRow("2026-02-13", data)
	if len(row) != 17 {
		t.Fatalf("expected 17 columns, got %d", len(row))
	}
	if row[0] != "2026-02-13" {
		t.Fatalf("expected date in first column, got %v", row[0])
	}
	if row[4] != "80.00%" {
		t.Fatalf("expected success rate at column E, got %v", row[4])
	}
	if row[5] != "chrome" || row[6] != "windows" || row[7] != "us" || row[8] != "pdf" {
		t.Fatalf("unexpected top columns: %v", row[5:9])
	}
	if row[16] != int64(9) {
		t.Fatalf("expected total cancelled in last column, got %v", row[16])
	}
}
