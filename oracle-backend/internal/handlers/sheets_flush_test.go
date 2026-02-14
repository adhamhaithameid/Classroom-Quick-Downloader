package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSheetsLastFlushHandler_NoRows(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodGet, "/api/admin/sheets/last-flush", nil)
	rr := httptest.NewRecorder()
	SheetsLastFlushHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}
	if payload["ok"] != true {
		t.Fatalf("expected ok=true, got %v", payload["ok"])
	}
	if payload["exists"] != false {
		t.Fatalf("expected exists=false when no rows, got %v", payload["exists"])
	}
}

func TestSheetsLastFlushHandler_ReturnsLatestRun(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	err := RecordSheetsFlushRun(context.Background(), sqlDB, SheetsFlushRunRecordInput{
		FlushedAtUTC: 1000,
		ArchivedDay:  "2026-02-13",
		Status:       "ok",
		SheetID:      "sheet-1",
		APIURL:       "http://127.0.0.1:8080/api/stats/summary?from=2026-02-13&to=2026-02-13",
		RowJSON:      []byte(`["a",1,true]`),
		SummaryJSON:  []byte(`{"totals":{"totalDownloads":1}}`),
		MetaJSON:     []byte(`{"archivedDay":"2026-02-13"}`),
		ErrorMessage: "",
	})
	if err != nil {
		t.Fatalf("record sheets flush run failed: %v", err)
	}
	err = RecordSheetsFlushRun(context.Background(), sqlDB, SheetsFlushRunRecordInput{
		FlushedAtUTC: 2000,
		ArchivedDay:  "2026-02-14",
		Status:       "error",
		SheetID:      "sheet-1",
		APIURL:       "http://127.0.0.1:8080/api/stats/summary?from=2026-02-14&to=2026-02-14",
		MetaJSON:     []byte(`{"archivedDay":"2026-02-14"}`),
		ErrorMessage: "append failed",
	})
	if err != nil {
		t.Fatalf("record latest sheets flush run failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/sheets/last-flush", nil)
	rr := httptest.NewRecorder()
	SheetsLastFlushHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK     bool `json:"ok"`
		Exists bool `json:"exists"`
		Run    struct {
			Status      string `json:"status"`
			ArchivedDay string `json:"archivedDay"`
			FlushedAt   int64  `json:"flushedAtUtc"`
			Error       string `json:"error"`
		} `json:"run"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}
	if !payload.OK || !payload.Exists {
		t.Fatalf("expected ok+exists true, got %+v", payload)
	}
	if payload.Run.FlushedAt != 2000 {
		t.Fatalf("expected latest run by flushedAtUtc, got %+v", payload.Run)
	}
	if payload.Run.Status != "error" || payload.Run.ArchivedDay != "2026-02-14" || payload.Run.Error != "append failed" {
		t.Fatalf("unexpected latest run payload: %+v", payload.Run)
	}
}

func TestSheetsLastFlushHandler_MethodNotAllowed(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/sheets/last-flush", nil)
	rr := httptest.NewRecorder()
	SheetsLastFlushHandler(sqlDB).ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}
