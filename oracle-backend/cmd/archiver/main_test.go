package main

import (
	"testing"
)

func TestFormatMapSorted(t *testing.T) {
	in := map[string]int64{
		"zeta":  2,
		"alpha": 1,
	}
	got := formatMapSorted(in)
	want := "alpha: 1\nzeta: 2"
	if got != want {
		t.Fatalf("unexpected sorted map: %q", got)
	}
}

func TestCalcSuccessRate(t *testing.T) {
	if got := calcSuccessRate(0, 0); got != 0 {
		t.Fatalf("expected 0 for empty downloads, got %f", got)
	}
	if got := calcSuccessRate(10, 8); got != 80 {
		t.Fatalf("expected 80, got %f", got)
	}
}

func TestBuildArchiveRow(t *testing.T) {
	var data SummaryResponse
	data.Totals.TotalDownloads = 10
	data.Totals.TotalSuccess = 8
	data.Totals.TotalFail = 2
	data.Totals.TotalCancelled = 1
	data.TopBrowser = "chrome"
	data.TopOs = "windows"
	data.TopCountry = "us"
	data.TopType = "pdf"
	data.Browsers = map[string]int64{"chrome": 10}
	data.Os = map[string]int64{"windows": 10}
	data.Countries = map[string]int64{"us": 10}
	data.Languages = map[string]int64{"en": 10}
	data.Types = map[string]int64{"pdf": 10}
	data.ErrorReasons = map[string]int64{"none": 8}
	data.Versions = map[string]int64{"1.0.0": 10}

	row := buildArchiveRow("2026-02-11", data)
	if len(row) != 17 {
		t.Fatalf("expected 17 columns, got %d", len(row))
	}
	if row[0] != "2026-02-11" {
		t.Fatalf("unexpected date column: %v", row[0])
	}
	if row[5] != "80.00%" {
		t.Fatalf("unexpected success rate column: %v", row[5])
	}
}
