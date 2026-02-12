package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"oracle-backend/internal/db"
)

func openCreativeDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := db.Init(t.TempDir() + "/creative.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

func disableCreativeFlag(t *testing.T, d *sql.DB) {
	t.Helper()
	_, err := d.Exec(`UPDATE feature_flags SET enabled = 0 WHERE name = 'feature_creative_hub_enabled'`)
	if err != nil {
		t.Fatal(err)
	}
}

// ---------------------------------------------------------------------------
// creativeFeatureEnabled
// ---------------------------------------------------------------------------

func TestCreativeFeatureEnabled_NilDB(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if !creativeFeatureEnabled(rr, req, nil) {
		t.Fatal("expected true when sqliteDB is nil")
	}
}

func TestCreativeFeatureEnabled_FlagOn(t *testing.T) {
	d := openCreativeDB(t)
	// feature_creative_hub_enabled is seeded as enabled=1 by db.Init
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	result := creativeFeatureEnabled(rr, req, d)
	if !result {
		t.Fatal("expected true when feature flag enabled")
	}
}

func TestCreativeFeatureEnabled_FlagOff(t *testing.T) {
	d := openCreativeDB(t)
	disableCreativeFlag(t, d)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	result := creativeFeatureEnabled(rr, req, d)
	if result {
		t.Fatal("expected false when feature flag disabled")
	}
}

// ---------------------------------------------------------------------------
// fixedRecordListHandler
// ---------------------------------------------------------------------------

func TestFixedRecordListHandler_Success(t *testing.T) {
	d := openCreativeDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/creative/designs", nil)
	fixedRecordListHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestFixedRecordListHandler_MethodNotAllowed(t *testing.T) {
	d := openCreativeDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/creative/designs", nil)
	fixedRecordListHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestFixedRecordListHandler_WithFeatureGuard_Disabled(t *testing.T) {
	d := openCreativeDB(t)
	disableCreativeFlag(t, d)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/creative/designs", nil)
	fixedRecordListHandler(d, nil, "creative_design", true).ServeHTTP(rr, req)
	if rr.Code != 403 {
		t.Fatalf("expected 403, got %d", rr.Code)
	}
}

func TestFixedRecordListHandler_WithFeatureGuard_Enabled(t *testing.T) {
	d := openCreativeDB(t)
	// enabled=1 by default from seed
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/creative/designs", nil)
	fixedRecordListHandler(d, nil, "creative_design", true).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ---------------------------------------------------------------------------
// fixedRecordUpsertHandler
// ---------------------------------------------------------------------------

func TestFixedRecordUpsertHandler_Success(t *testing.T) {
	d := openCreativeDB(t)
	body, _ := json.Marshal(map[string]interface{}{
		"recordKey": "design-1",
		"data":      map[string]interface{}{"color": "blue"},
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/creative/designs/upsert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	fixedRecordUpsertHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestFixedRecordUpsertHandler_MethodNotAllowed(t *testing.T) {
	d := openCreativeDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/creative/designs/upsert", nil)
	fixedRecordUpsertHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestFixedRecordUpsertHandler_InvalidBody(t *testing.T) {
	d := openCreativeDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/creative/designs/upsert", bytes.NewReader([]byte("bad")))
	req.Header.Set("Content-Type", "application/json")
	fixedRecordUpsertHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestFixedRecordUpsertHandler_EmptyKey(t *testing.T) {
	d := openCreativeDB(t)
	body, _ := json.Marshal(map[string]interface{}{"recordKey": ""})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/creative/designs/upsert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	fixedRecordUpsertHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestFixedRecordUpsertHandler_NilData(t *testing.T) {
	d := openCreativeDB(t)
	body, _ := json.Marshal(map[string]interface{}{"recordKey": "k1"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/creative/designs/upsert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	fixedRecordUpsertHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestFixedRecordUpsertHandler_WithFeatureGuard_Disabled(t *testing.T) {
	d := openCreativeDB(t)
	disableCreativeFlag(t, d)
	body, _ := json.Marshal(map[string]interface{}{"recordKey": "k1"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/creative/designs/upsert", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	fixedRecordUpsertHandler(d, nil, "creative_design", true).ServeHTTP(rr, req)
	if rr.Code != 403 {
		t.Fatalf("expected 403, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// fixedRecordDeleteHandler
// ---------------------------------------------------------------------------

func TestFixedRecordDeleteHandler_Success(t *testing.T) {
	d := openCreativeDB(t)
	body, _ := json.Marshal(map[string]interface{}{"recordKey": "design-1"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/creative/designs/delete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	fixedRecordDeleteHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestFixedRecordDeleteHandler_MethodNotAllowed(t *testing.T) {
	d := openCreativeDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/creative/designs/delete", nil)
	fixedRecordDeleteHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestFixedRecordDeleteHandler_EmptyKey(t *testing.T) {
	d := openCreativeDB(t)
	body, _ := json.Marshal(map[string]interface{}{"recordKey": ""})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/creative/designs/delete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	fixedRecordDeleteHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestFixedRecordDeleteHandler_InvalidBody(t *testing.T) {
	d := openCreativeDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/creative/designs/delete", bytes.NewReader([]byte("bad")))
	req.Header.Set("Content-Type", "application/json")
	fixedRecordDeleteHandler(d, nil, "creative_design", false).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestFixedRecordDeleteHandler_WithFeatureGuard_Disabled(t *testing.T) {
	d := openCreativeDB(t)
	disableCreativeFlag(t, d)
	body, _ := json.Marshal(map[string]interface{}{"recordKey": "k1"})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/creative/designs/delete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	fixedRecordDeleteHandler(d, nil, "creative_design", true).ServeHTTP(rr, req)
	if rr.Code != 403 {
		t.Fatalf("expected 403, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// NewsletterSubscribersUpsertHandler
// ---------------------------------------------------------------------------

func TestNewsletterSubscribersUpsertHandler_Success(t *testing.T) {
	d := openCreativeDB(t)
	// feature_creative_hub_enabled is seeded as enabled=1
	body, _ := json.Marshal(map[string]interface{}{
		"data": map[string]interface{}{"email": "test@example.com"},
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/newsletter/subscribe", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	NewsletterSubscribersUpsertHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestNewsletterSubscribersUpsertHandler_WithRecordKey(t *testing.T) {
	d := openCreativeDB(t)
	body, _ := json.Marshal(map[string]interface{}{
		"recordKey": "custom-key",
		"data":      map[string]interface{}{"email": "test@example.com"},
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/newsletter/subscribe", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	NewsletterSubscribersUpsertHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["recordKey"].(string) != "custom-key" {
		t.Fatalf("expected recordKey=custom-key, got %v", resp["recordKey"])
	}
}

func TestNewsletterSubscribersUpsertHandler_MethodNotAllowed(t *testing.T) {
	d := openCreativeDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/newsletter/subscribe", nil)
	NewsletterSubscribersUpsertHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 405 {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestNewsletterSubscribersUpsertHandler_InvalidBody(t *testing.T) {
	d := openCreativeDB(t)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/newsletter/subscribe", bytes.NewReader([]byte("bad")))
	req.Header.Set("Content-Type", "application/json")
	NewsletterSubscribersUpsertHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestNewsletterSubscribersUpsertHandler_MissingEmail(t *testing.T) {
	d := openCreativeDB(t)
	body, _ := json.Marshal(map[string]interface{}{"data": map[string]interface{}{}})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/newsletter/subscribe", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	NewsletterSubscribersUpsertHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestNewsletterSubscribersUpsertHandler_InvalidEmail(t *testing.T) {
	d := openCreativeDB(t)
	body, _ := json.Marshal(map[string]interface{}{
		"data": map[string]interface{}{"email": "not-valid"},
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/newsletter/subscribe", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	NewsletterSubscribersUpsertHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestNewsletterSubscribersUpsertHandler_NilData(t *testing.T) {
	d := openCreativeDB(t)
	body, _ := json.Marshal(map[string]interface{}{})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/newsletter/subscribe", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	NewsletterSubscribersUpsertHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d (email missing from nil data)", rr.Code)
	}
}

func TestNewsletterSubscribersUpsertHandler_FeatureDisabled(t *testing.T) {
	d := openCreativeDB(t)
	disableCreativeFlag(t, d)
	body, _ := json.Marshal(map[string]interface{}{
		"data": map[string]interface{}{"email": "test@example.com"},
	})
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/newsletter/subscribe", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	NewsletterSubscribersUpsertHandler(d, nil).ServeHTTP(rr, req)
	if rr.Code != 403 {
		t.Fatalf("expected 403, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// simpleEmailPattern
// ---------------------------------------------------------------------------

func TestSimpleEmailPattern(t *testing.T) {
	valid := []string{"a@b.c", "test@example.com", "user.name@domain.org"}
	for _, e := range valid {
		if !simpleEmailPattern.MatchString(e) {
			t.Fatalf("expected %q to match", e)
		}
	}
	invalid := []string{"", "no-at-sign", "@missing.user", "spaces @bad.com"}
	for _, e := range invalid {
		if simpleEmailPattern.MatchString(e) {
			t.Fatalf("expected %q to NOT match", e)
		}
	}
}

// ---------------------------------------------------------------------------
// All exported creative hub handler constructors
// ---------------------------------------------------------------------------

func TestCreativeDesignsListHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := CreativeDesignsListHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestCreativeDesignsUpsertHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := CreativeDesignsUpsertHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestCreativeDesignsDeleteHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := CreativeDesignsDeleteHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestCreativeEmailsListHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := CreativeEmailsListHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestCreativeEmailsUpsertHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := CreativeEmailsUpsertHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestCreativeEmailsDeleteHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := CreativeEmailsDeleteHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestNewsletterSubscribersListHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := NewsletterSubscribersListHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestNewsletterSubscribersDeleteHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := NewsletterSubscribersDeleteHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestNewsletterCampaignsListHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := NewsletterCampaignsListHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestNewsletterCampaignsUpsertHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := NewsletterCampaignsUpsertHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestNewsletterCampaignsDeleteHandler_Returns(t *testing.T) {
	d := openCreativeDB(t)
	h := NewsletterCampaignsDeleteHandler(d, nil)
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}
