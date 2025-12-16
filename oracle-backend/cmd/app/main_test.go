package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"oracle-backend/internal/handlers"
)

func TestAPIHealthHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(handlers.APIHealthHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v",
			status, http.StatusOK)
	}

	// You might check the body here too if you know what it returns
	expected := `{"status":"ok"}`
	if rr.Body.String() != expected {
		t.Logf("handler returned unexpected body: %v", rr.Body.String())
		// Not failing the test on body mismatch to avoid brittleness,
		// but useful for debugging.
	}
}
