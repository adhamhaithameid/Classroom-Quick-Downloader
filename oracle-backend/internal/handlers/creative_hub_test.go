package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreativeDesignsHandlers_CRUD(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	upsertReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/creative/designs/upsert",
		bytes.NewBufferString(`{"recordKey":"design-001","data":{"title":"Landing Revamp","description":"New hero","url":"https://figma.com/file/abc"}}`),
	)
	upsertReq.Header.Set("Content-Type", "application/json")
	upsertRR := httptest.NewRecorder()
	CreativeDesignsUpsertHandler(sqlDB, nil).ServeHTTP(upsertRR, upsertReq)
	if upsertRR.Code != http.StatusOK {
		t.Fatalf("design upsert failed: %d %s", upsertRR.Code, upsertRR.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/creative/designs", nil)
	listRR := httptest.NewRecorder()
	CreativeDesignsListHandler(sqlDB, nil).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("design list failed: %d %s", listRR.Code, listRR.Body.String())
	}
	var listPayload map[string]any
	if err := json.Unmarshal(listRR.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("parse list payload failed: %v", err)
	}
	records, ok := listPayload["records"].([]any)
	if !ok || len(records) == 0 {
		t.Fatalf("expected design records, got %#v", listPayload["records"])
	}

	deleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/creative/designs/delete", bytes.NewBufferString(`{"recordKey":"design-001"}`))
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	CreativeDesignsDeleteHandler(sqlDB, nil).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("design delete failed: %d %s", deleteRR.Code, deleteRR.Body.String())
	}
}

func TestCreativeHandlers_FeatureFlagDisabled(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	if _, err := sqlDB.Exec(`UPDATE feature_flags SET enabled = 0 WHERE name = 'feature_creative_hub_enabled'`); err != nil {
		t.Fatalf("disable creative feature flag failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/creative/designs", nil)
	rr := httptest.NewRecorder()
	CreativeDesignsListHandler(sqlDB, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when creative feature is disabled, got %d", rr.Code)
	}
}

func TestNewsletterSubscribersUpsert_ValidatesAndNormalizesEmail(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	invalidReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/newsletter/subscribers/upsert",
		bytes.NewBufferString(`{"data":{"email":"invalid"}}`),
	)
	invalidReq.Header.Set("Content-Type", "application/json")
	invalidRR := httptest.NewRecorder()
	NewsletterSubscribersUpsertHandler(sqlDB, nil).ServeHTTP(invalidRR, invalidReq)
	if invalidRR.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid email to fail with 400, got %d", invalidRR.Code)
	}

	validReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/newsletter/subscribers/upsert",
		bytes.NewBufferString(`{"data":{"email":"USER@Example.COM","name":"User"}}`),
	)
	validReq.Header.Set("Content-Type", "application/json")
	validRR := httptest.NewRecorder()
	NewsletterSubscribersUpsertHandler(sqlDB, nil).ServeHTTP(validRR, validReq)
	if validRR.Code != http.StatusOK {
		t.Fatalf("expected valid email upsert to succeed, got %d %s", validRR.Code, validRR.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/newsletter/subscribers", nil)
	listRR := httptest.NewRecorder()
	NewsletterSubscribersListHandler(sqlDB, nil).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("subscriber list failed: %d %s", listRR.Code, listRR.Body.String())
	}

	var payload struct {
		Records []struct {
			RecordKey string         `json:"recordKey"`
			Data      map[string]any `json:"data"`
		} `json:"records"`
	}
	if err := json.Unmarshal(listRR.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse subscriber list failed: %v", err)
	}
	if len(payload.Records) != 1 {
		t.Fatalf("expected 1 subscriber, got %d", len(payload.Records))
	}
	if payload.Records[0].RecordKey != "user@example.com" {
		t.Fatalf("expected normalized key=user@example.com, got %q", payload.Records[0].RecordKey)
	}
	if email, _ := payload.Records[0].Data["email"].(string); email != "user@example.com" {
		t.Fatalf("expected normalized email in payload, got %q", email)
	}
}

func TestCreativeEmailTemplateHandlers_CRUD(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	upsertReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/creative/emails/upsert",
		bytes.NewBufferString(`{"recordKey":"welcome-v1","data":{"title":"Welcome V1","version":"1.0.0","html":"<h1>Welcome</h1>"}}`),
	)
	upsertReq.Header.Set("Content-Type", "application/json")
	upsertRR := httptest.NewRecorder()
	CreativeEmailsUpsertHandler(sqlDB, nil).ServeHTTP(upsertRR, upsertReq)
	if upsertRR.Code != http.StatusOK {
		t.Fatalf("email upsert failed: %d %s", upsertRR.Code, upsertRR.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/creative/emails", nil)
	listRR := httptest.NewRecorder()
	CreativeEmailsListHandler(sqlDB, nil).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("email list failed: %d %s", listRR.Code, listRR.Body.String())
	}

	var listPayload map[string]any
	if err := json.Unmarshal(listRR.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("parse email list payload failed: %v", err)
	}
	records, ok := listPayload["records"].([]any)
	if !ok || len(records) != 1 {
		t.Fatalf("expected one email template record, got %#v", listPayload["records"])
	}

	deleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/creative/emails/delete", bytes.NewBufferString(`{"recordKey":"welcome-v1"}`))
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	CreativeEmailsDeleteHandler(sqlDB, nil).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("email delete failed: %d %s", deleteRR.Code, deleteRR.Body.String())
	}
}

func TestNewsletterCampaignHandlers_CRUD(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	upsertReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/newsletter/campaigns/upsert",
		bytes.NewBufferString(`{"recordKey":"campaign-2026-02","data":{"version":"4.0.0","subject":"February Update","scheduledAt":"2026-02-11T09:00:00Z"}}`),
	)
	upsertReq.Header.Set("Content-Type", "application/json")
	upsertRR := httptest.NewRecorder()
	NewsletterCampaignsUpsertHandler(sqlDB, nil).ServeHTTP(upsertRR, upsertReq)
	if upsertRR.Code != http.StatusOK {
		t.Fatalf("campaign upsert failed: %d %s", upsertRR.Code, upsertRR.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/newsletter/campaigns", nil)
	listRR := httptest.NewRecorder()
	NewsletterCampaignsListHandler(sqlDB, nil).ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("campaign list failed: %d %s", listRR.Code, listRR.Body.String())
	}

	deleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/newsletter/campaigns/delete", bytes.NewBufferString(`{"recordKey":"campaign-2026-02"}`))
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	NewsletterCampaignsDeleteHandler(sqlDB, nil).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("campaign delete failed: %d %s", deleteRR.Code, deleteRR.Body.String())
	}
}

func TestNewsletterSubscribersDeleteHandler(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	upsertReq := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/newsletter/subscribers/upsert",
		bytes.NewBufferString(`{"data":{"email":"subscriber@example.com"}}`),
	)
	upsertReq.Header.Set("Content-Type", "application/json")
	upsertRR := httptest.NewRecorder()
	NewsletterSubscribersUpsertHandler(sqlDB, nil).ServeHTTP(upsertRR, upsertReq)
	if upsertRR.Code != http.StatusOK {
		t.Fatalf("subscriber upsert failed: %d %s", upsertRR.Code, upsertRR.Body.String())
	}

	deleteReq := httptest.NewRequest(http.MethodPost, "/api/admin/newsletter/subscribers/delete", bytes.NewBufferString(`{"recordKey":"subscriber@example.com"}`))
	deleteReq.Header.Set("Content-Type", "application/json")
	deleteRR := httptest.NewRecorder()
	NewsletterSubscribersDeleteHandler(sqlDB, nil).ServeHTTP(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("subscriber delete failed: %d %s", deleteRR.Code, deleteRR.Body.String())
	}
}
