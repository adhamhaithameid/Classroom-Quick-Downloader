package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPublicWebsiteNewsletterSubscribeHandler_SubscribesAndPersistsInNewsletterRecords(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://classroom-quick-downloader-website.pages.dev")

	req := httptest.NewRequest(http.MethodPost, "/api/public/website/newsletter/subscribe", bytes.NewBufferString(`{
		"email":"Student@Example.com",
		"source":"overview_ready_to_save_hours"
	}`))
	req.Header.Set("Origin", "https://classroom-quick-downloader-website.pages.dev")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	PublicWebsiteNewsletterSubscribeHandler(sqlDB, nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK        bool   `json:"ok"`
		RecordKey string `json:"recordKey"`
		Message   string `json:"message"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode subscribe response: %v", err)
	}
	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if payload.RecordKey != "student@example.com" {
		t.Fatalf("expected normalized record key, got %q", payload.RecordKey)
	}
	if payload.Message == "" {
		t.Fatal("expected response message")
	}

	var dataJSON string
	if err := sqlDB.QueryRow(
		`SELECT data_json FROM admin_records WHERE record_type = 'newsletter_subscriber' AND record_key = ?`,
		"student@example.com",
	).Scan(&dataJSON); err != nil {
		t.Fatalf("expected subscriber record to be stored: %v", err)
	}
	var saved map[string]any
	if err := json.Unmarshal([]byte(dataJSON), &saved); err != nil {
		t.Fatalf("failed to decode saved subscriber data: %v", err)
	}
	if got, _ := saved["email"].(string); got != "student@example.com" {
		t.Fatalf("expected normalized email in record data, got %q", got)
	}
	if got, _ := saved["status"].(string); got != "active" {
		t.Fatalf("expected active status, got %q", got)
	}
}

func TestPublicWebsiteNewsletterSubscribeHandler_RejectsInvalidRequests(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	t.Setenv("PUBLIC_WEBSITE_ALLOWED_ORIGINS", "https://classroom-quick-downloader-website.pages.dev")

	cases := []struct {
		name       string
		method     string
		origin     string
		header     string
		body       string
		wantStatus int
		wantCode   string
	}{
		{
			name:       "method not allowed",
			method:     http.MethodGet,
			origin:     "https://classroom-quick-downloader-website.pages.dev",
			body:       "",
			wantStatus: http.StatusMethodNotAllowed,
			wantCode:   "method_not_allowed",
		},
		{
			name:       "origin not allowed",
			method:     http.MethodPost,
			origin:     "https://evil.example",
			header:     "XMLHttpRequest",
			body:       `{"email":"ok@example.com"}`,
			wantStatus: http.StatusForbidden,
			wantCode:   "origin_not_allowed",
		},
		{
			name:       "invalid email without requested-with header",
			method:     http.MethodPost,
			origin:     "https://classroom-quick-downloader-website.pages.dev",
			header:     "",
			body:       `{"email":"not-an-email"}`,
			wantStatus: http.StatusBadRequest,
			wantCode:   "invalid_email",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, "/api/public/website/newsletter/subscribe", bytes.NewBufferString(tc.body))
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			if tc.header != "" {
				req.Header.Set("X-Requested-With", tc.header)
			}
			if tc.body != "" {
				req.Header.Set("Content-Type", "application/json")
			}

			rr := httptest.NewRecorder()
			PublicWebsiteNewsletterSubscribeHandler(sqlDB, nil).ServeHTTP(rr, req)
			if rr.Code != tc.wantStatus {
				t.Fatalf("expected status %d, got %d: %s", tc.wantStatus, rr.Code, rr.Body.String())
			}
			var payload struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
				t.Fatalf("decode error payload failed: %v", err)
			}
			if payload.Error.Code != tc.wantCode {
				t.Fatalf("expected error code %q, got %q", tc.wantCode, payload.Error.Code)
			}
		})
	}
}
