package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestQueryIntParam_Defaults(t *testing.T) {
	// Arrange — no param set
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	// Act
	v, err := queryIntParam(req, "limit", 200, 1, 2000)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v != 200 {
		t.Fatalf("expected default 200, got %d", v)
	}
}

func TestQueryIntParam_ValidValue(t *testing.T) {
	// Arrange
	req := httptest.NewRequest(http.MethodGet, "/test?limit=50", nil)

	// Act
	v, err := queryIntParam(req, "limit", 200, 1, 2000)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v != 50 {
		t.Fatalf("expected 50, got %d", v)
	}
}

func TestQueryIntParam_BelowMin(t *testing.T) {
	// Arrange
	req := httptest.NewRequest(http.MethodGet, "/test?limit=0", nil)

	// Act
	_, err := queryIntParam(req, "limit", 200, 1, 2000)

	// Assert
	if err == nil {
		t.Fatalf("expected error for value below min")
	}
}

func TestQueryIntParam_AboveMax(t *testing.T) {
	// Arrange
	req := httptest.NewRequest(http.MethodGet, "/test?limit=5000", nil)

	// Act
	_, err := queryIntParam(req, "limit", 200, 1, 2000)

	// Assert
	if err == nil {
		t.Fatalf("expected error for value above max")
	}
}

func TestQueryIntParam_NonNumeric(t *testing.T) {
	// Arrange
	req := httptest.NewRequest(http.MethodGet, "/test?limit=abc", nil)

	// Act
	_, err := queryIntParam(req, "limit", 200, 1, 2000)

	// Assert
	if err == nil {
		t.Fatalf("expected error for non-numeric value")
	}
}

func TestQueryIntParam_EmptyString(t *testing.T) {
	// Arrange
	req := httptest.NewRequest(http.MethodGet, "/test?limit=", nil)

	// Act
	v, err := queryIntParam(req, "limit", 200, 1, 2000)

	// Assert
	if err != nil {
		t.Fatalf("expected no error for empty string (use default), got %v", err)
	}
	if v != 200 {
		t.Fatalf("expected default 200 for empty string, got %d", v)
	}
}

func TestQueryIntParam_WhitespaceOnly(t *testing.T) {
	// Arrange
	req := httptest.NewRequest(http.MethodGet, "/test?limit=+", nil)

	// Act — "+" becomes " " in URL query parsing, which is whitespace
	v, err := queryIntParam(req, "limit", 200, 1, 2000)

	// Assert — trimmed whitespace should use default
	if err != nil {
		t.Fatalf("expected no error for whitespace, got %v", err)
	}
	if v != 200 {
		t.Fatalf("expected default 200 for whitespace, got %d", v)
	}
}

func TestInsertOracleOperationLog_NilDB(t *testing.T) {
	// Arrange
	entry := OracleOperationLogEntry{
		TSUTC:      1000,
		RequestID:  "req-1",
		ActionType: "test",
	}

	// Act
	err := InsertOracleOperationLog(context.Background(), nil, entry)

	// Assert
	if err == nil {
		t.Fatalf("expected error for nil DB")
	}
}

func TestInsertOracleOperationLog_WritesToDB(t *testing.T) {
	// Arrange
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	entry := OracleOperationLogEntry{
		TSUTC:         1000,
		RequestID:     "req-test-1",
		CorrelationID: "corr-1",
		UserID:        "user1",
		TokenID:       "token1",
		Role:          "admin",
		ActionType:    "test_action",
		ResourceType:  "test_resource",
		ResourceID:    "res-1",
		Method:        "POST",
		Path:          "/api/test",
		StatusCode:    200,
		Result:        "ok",
		LatencyMS:     42,
		ErrorCode:     "",
	}

	// Act
	err := InsertOracleOperationLog(context.Background(), sqlDB, entry)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	var count int64
	if err := sqlDB.QueryRow(`SELECT COUNT(*) FROM oracle_operation_logs WHERE request_id = 'req-test-1'`).Scan(&count); err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 row, got %d", count)
	}
}
