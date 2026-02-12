package handlers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeJSONBodyStrict_ValidJSON(t *testing.T) {
	// Arrange
	type payload struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}
	body := `{"name":"alice","age":30}`
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	var dst payload

	// Act
	err := decodeJSONBodyStrict(req, &dst)

	// Assert
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if dst.Name != "alice" || dst.Age != 30 {
		t.Fatalf("unexpected result: %+v", dst)
	}
}

func TestDecodeJSONBodyStrict_TrailingData(t *testing.T) {
	// Arrange
	type payload struct {
		A int `json:"a"`
	}
	body := `{"a":1}{"b":2}`
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	var dst payload

	// Act
	err := decodeJSONBodyStrict(req, &dst)

	// Assert
	if !errors.Is(err, errTrailingJSON) {
		t.Fatalf("expected errTrailingJSON, got %v", err)
	}
}

func TestDecodeJSONBodyStrict_UnknownFields(t *testing.T) {
	// Arrange
	type payload struct {
		A int `json:"a"`
	}
	body := `{"a":1,"unknown_field":"value"}`
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	var dst payload

	// Act
	err := decodeJSONBodyStrict(req, &dst)

	// Assert
	if err == nil {
		t.Fatalf("expected error for unknown fields, got nil")
	}
}

func TestDecodeJSONBodyStrict_EmptyBody(t *testing.T) {
	// Arrange
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(""))
	var dst struct{ A int }

	// Act
	err := decodeJSONBodyStrict(req, &dst)

	// Assert
	if err == nil {
		t.Fatalf("expected error for empty body, got nil")
	}
}

func TestDecodeJSONBodyStrict_MalformedJSON(t *testing.T) {
	// Arrange
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("{invalid"))
	var dst struct{ A int }

	// Act
	err := decodeJSONBodyStrict(req, &dst)

	// Assert
	if err == nil {
		t.Fatalf("expected error for malformed JSON, got nil")
	}
}

func TestDecodeJSONBodyStrict_TrailingWhitespace(t *testing.T) {
	// Arrange — trailing whitespace after valid JSON should NOT error
	type payload struct {
		A int `json:"a"`
	}
	body := `{"a":1}   `
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	var dst payload

	// Act
	err := decodeJSONBodyStrict(req, &dst)

	// Assert
	if err != nil {
		t.Fatalf("expected no error for trailing whitespace, got %v", err)
	}
	if dst.A != 1 {
		t.Fatalf("expected A=1, got %d", dst.A)
	}
}

func TestDecodeJSONBodyStrict_NullBody(t *testing.T) {
	// Arrange — JSON null should decode into a pointer or interface
	body := `null`
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	var dst *struct{ A int }

	// Act
	err := decodeJSONBodyStrict(req, &dst)

	// Assert
	if err != nil {
		t.Fatalf("expected no error for null body, got %v", err)
	}
	if dst != nil {
		t.Fatalf("expected nil destination, got %+v", dst)
	}
}
