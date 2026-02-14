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

// ──────────────────────────────────────────────────────────────────────────────
// Expanded model tests
// ──────────────────────────────────────────────────────────────────────────────

func TestOracleBatch_PartialJSON(t *testing.T) {
	// Partial batch with only required fields — should decode without error
	input := `{"batchId":"partial-1","generatedAt":1000,"timeZone":"UTC"}`
	var b OracleBatch
	if err := json.Unmarshal([]byte(input), &b); err != nil {
		t.Fatalf("expected partial JSON to parse, got %v", err)
	}
	if b.BatchID != "partial-1" {
		t.Fatalf("expected batchId=partial-1, got %q", b.BatchID)
	}
	if b.TimeBuckets != nil && len(b.TimeBuckets) != 0 {
		t.Fatalf("expected nil or empty time buckets for partial, got %d", len(b.TimeBuckets))
	}
}

func TestOracleBatch_NilDelivery(t *testing.T) {
	b := OracleBatch{
		BatchID:     "nil-delivery",
		GeneratedAt: 1000,
		TimeZone:    "UTC",
		Delivery:    nil,
	}

	raw, err := json.Marshal(b)
	if err != nil {
		t.Fatalf("marshal with nil delivery: %v", err)
	}

	var out OracleBatch
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal with nil delivery: %v", err)
	}
	if out.Delivery != nil {
		t.Fatalf("expected nil delivery after roundtrip, got %+v", out.Delivery)
	}
}

func TestDOState_WithQuotaAndRetry(t *testing.T) {
	state := DOState{
		OK:             true,
		TotalEvents:    100,
		TotalDownloads: 90,
		TotalSuccess:   80,
		TotalFail:      10,
		PendingEvents:  5,
		Quota: &DOStateQuota{
			QuotaLevel:          "standard",
			ModeLabel:           "normal",
			RemoteEnabled:       true,
			BatchSizeSuggestion: 25,
		},
	}

	raw, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("marshal DOState: %v", err)
	}

	var out DOState
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal DOState: %v", err)
	}

	if !out.OK || out.TotalEvents != 100 || out.TotalDownloads != 90 {
		t.Fatalf("basic DOState fields mismatch: %+v", out)
	}
	if out.Quota == nil {
		t.Fatalf("expected quota to be present after roundtrip")
	}
	if out.Quota.QuotaLevel != "standard" || !out.Quota.RemoteEnabled {
		t.Fatalf("quota fields mismatch: %+v", out.Quota)
	}
}

func TestBatchSummary_EmptyMaps(t *testing.T) {
	summary := BatchSummary{
		Totals: BucketTotals{
			TotalEvents:    0,
			TotalDownloads: 0,
		},
		Browsers:     map[string]int64{},
		Os:           map[string]int64{},
		Countries:    map[string]int64{},
		Languages:    map[string]int64{},
		Versions:     map[string]int64{},
		Types:        map[string]int64{},
		ErrorReasons: map[string]int64{},
	}

	raw, err := json.Marshal(summary)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out BatchSummary
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(out.Browsers) != 0 || len(out.Os) != 0 {
		t.Fatalf("expected empty maps after roundtrip")
	}
}

func TestDeliverySnapshot_JSON(t *testing.T) {
	minSeq := int64(1)
	maxSeq := int64(100)
	d := DeliverySnapshot{
		DeliveryID:     "dlv-test",
		AcceptedCount:  50,
		StoredCount:    48,
		ForwardedCount: 45,
		CommittedCount: 42,
		MinSeq:         &minSeq,
		MaxSeq:         &maxSeq,
		CreatedAt:      1000,
	}

	raw, err := json.Marshal(d)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out DeliverySnapshot
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out.DeliveryID != "dlv-test" || out.AcceptedCount != 50 || out.CommittedCount != 42 {
		t.Fatalf("delivery fields mismatch: %+v", out)
	}
	if out.MinSeq == nil || *out.MinSeq != 1 || out.MaxSeq == nil || *out.MaxSeq != 100 {
		t.Fatalf("seq fields mismatch")
	}
}
