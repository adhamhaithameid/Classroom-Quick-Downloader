package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIngestWritesOutboxAndSchemaRegistry(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	payload := `{
		"batchId":"batch-schema-1",
		"generatedAt":1739308800000,
		"timeZone":"UTC",
		"summary":{
			"totals":{"totalEvents":2,"totalDownloads":2,"totalSuccess":1,"totalFail":1},
			"browsers":{"chrome":2},
			"os":{"windows":2},
			"countries":{"us":2},
			"languages":{"en":2},
			"versions":{"1.0.0":2},
			"types":{"pdf":2},
			"errorReasons":{"none":1},
			"topBrowser":"chrome",
			"topOs":"windows",
			"topCountry":"us",
			"topType":"pdf"
		},
		"timeBuckets":[
			{
				"bucketStart":"2026-02-01T00:00:00Z",
				"bucketEnd":"2026-02-01T01:00:00Z",
				"totals":{"totalEvents":2,"totalDownloads":2,"totalSuccess":1,"totalFail":1},
				"counters":{
					"byStatus":{"success":1,"fail":1},
					"byType":{"pdf":2},
					"byBrowser":{"chrome":2},
					"byOs":{"windows":2},
					"byExtVersion":{"1.0.0":2},
					"byLanguage":{"en":2},
					"byCountry":{"us":2},
					"byErrorType":{"none":1}
				}
			}
		],
		"doState":{"ok":true}
	}`

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", strings.NewReader(payload))
	req.Header.Set("X-DO-SECRET", "secret")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	IngestBatchHandler(sqlDB, "secret").ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var outboxCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM ingest_outbox WHERE event_type = 'ingest_batch_committed'`).Scan(&outboxCount); err != nil {
		t.Fatalf("failed querying outbox: %v", err)
	}
	if outboxCount == 0 {
		t.Fatalf("expected outbox row after ingest")
	}

	var schemaPathCount int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM cf_schema_registry WHERE json_path = 'summary.totals.totalEvents'`).Scan(&schemaPathCount); err != nil {
		t.Fatalf("failed querying schema registry: %v", err)
	}
	if schemaPathCount == 0 {
		t.Fatalf("expected schema path to be registered")
	}
}

func TestIngestRawSnapshotRedactsIPData(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	payload := `{
		"batchId":"batch-redact-1",
		"generatedAt":1739308800000,
		"timeZone":"UTC",
		"summary":{"totals":{"totalEvents":1,"totalDownloads":1,"totalSuccess":1,"totalFail":0}},
		"timeBuckets":[],
		"doState":{
			"ok":true,
			"retryState":{"consecutiveFailures":1,"lastError":"9.9.9.9"}
		},
		"uniqueIps":["1.1.1.1","8.8.8.8"]
	}`

	req := httptest.NewRequest(http.MethodPost, "/ingest-batch", bytes.NewBufferString(payload))
	req.Header.Set("X-DO-SECRET", "secret")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	IngestBatchHandler(sqlDB, "secret").ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var rawPayload string
	if err := sqlDB.QueryRow(`SELECT payload_json FROM cf_snapshots_raw ORDER BY id DESC LIMIT 1`).Scan(&rawPayload); err != nil {
		t.Fatalf("failed to load raw snapshot payload: %v", err)
	}
	if strings.Contains(rawPayload, "1.1.1.1") || strings.Contains(rawPayload, "8.8.8.8") || strings.Contains(rawPayload, "9.9.9.9") {
		t.Fatalf("expected IP values to be redacted, got payload: %s", rawPayload)
	}
	if !strings.Contains(rawPayload, "REDACTED") {
		t.Fatalf("expected redaction markers in payload, got: %s", rawPayload)
	}
}
