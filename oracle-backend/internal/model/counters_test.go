package model

import (
	"encoding/json"
	"testing"
)

func TestOracleBatchJSONRoundTrip(t *testing.T) {
	now := int64(1739308800000)
	b := OracleBatch{
		BatchID:     "batch-1",
		GeneratedAt: now,
		TimeZone:    "UTC",
		Summary: BatchSummary{
			Totals: BucketTotals{
				TotalEvents:    2,
				TotalDownloads: 2,
				TotalSuccess:   1,
				TotalFail:      1,
				TotalCancelled: 0,
			},
			Browsers:     map[string]int64{"chrome": 2},
			Os:           map[string]int64{"windows": 2},
			Countries:    map[string]int64{"us": 2},
			Languages:    map[string]int64{"en": 2},
			Versions:     map[string]int64{"1.0.0": 2},
			Types:        map[string]int64{"pdf": 2},
			ErrorReasons: map[string]int64{"none": 1},
			TopBrowser:   "chrome",
			TopOs:        "windows",
			TopCountry:   "us",
			TopType:      "pdf",
		},
		TimeBuckets: []TimeBucket{
			{
				BucketStart: "2026-02-11T00:00:00Z",
				BucketEnd:   "2026-02-11T01:00:00Z",
				Totals: BucketTotals{
					TotalEvents:    2,
					TotalDownloads: 2,
					TotalSuccess:   1,
					TotalFail:      1,
				},
				Counters: BucketCounters{
					ByStatus:    map[string]int64{"success": 1, "fail": 1},
					ByType:      map[string]int64{"pdf": 2},
					ByBrowser:   map[string]int64{"chrome": 2},
					ByOs:        map[string]int64{"windows": 2},
					ByExtVer:    map[string]int64{"1.0.0": 2},
					ByLanguage:  map[string]int64{"en": 2},
					ByCountry:   map[string]int64{"us": 2},
					ByErrorType: map[string]int64{"none": 1},
				},
			},
		},
		DOState: DOState{
			OK:             true,
			TotalEvents:    2,
			TotalDownloads: 2,
			TotalSuccess:   1,
			TotalFail:      1,
		},
		UniqueIps: []string{"1.1.1.1"},
	}

	raw, err := json.Marshal(b)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var out OracleBatch
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if out.BatchID != b.BatchID || out.GeneratedAt != b.GeneratedAt || out.TimeZone != b.TimeZone {
		t.Fatalf("unexpected basic fields: %+v", out)
	}
	if got := out.TimeBuckets[0].Counters.ByExtVer["1.0.0"]; got != 2 {
		t.Fatalf("unexpected ext version counter after roundtrip: %d", got)
	}
}
