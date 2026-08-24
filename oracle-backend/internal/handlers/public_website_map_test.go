package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPublicWebsiteMapHandler_ReturnsIsoCountryBreakdown(t *testing.T) {
	sqlDB := openPublicWebsiteDB(t)
	seedPublicWebsiteFixture(t, sqlDB)

	req := httptest.NewRequest(http.MethodGet, "/api/public/website/map", nil)
	rr := httptest.NewRecorder()
	PublicWebsiteMapHandler(sqlDB, nil).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK        bool `json:"ok"`
		Countries []struct {
			CountryCode string `json:"countryCode"`
			Count       int64  `json:"count"`
		} `json:"countries"`
		Totals struct {
			Countries int   `json:"countries"`
			Downloads int64 `json:"downloads"`
		} `json:"totals"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal map payload failed: %v", err)
	}

	if !payload.OK {
		t.Fatal("expected ok=true")
	}
	if payload.Totals.Downloads != 1200 {
		t.Fatalf("expected downloads total 1200, got %d", payload.Totals.Downloads)
	}
	if payload.Totals.Countries != 2 {
		t.Fatalf("expected 2 valid countries, got %d", payload.Totals.Countries)
	}
	if len(payload.Countries) != 2 || payload.Countries[0].CountryCode != "US" || payload.Countries[1].CountryCode != "GB" {
		t.Fatalf("unexpected country payload: %+v", payload.Countries)
	}
}
