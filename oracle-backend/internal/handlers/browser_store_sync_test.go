package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestParseStoreStatsFromHTML(t *testing.T) {
	users, version := parseStoreStatsFromHTML("chrome", `<script>{"users":"120K","version":"5.9.1"}</script>`)
	if users != "120K" {
		t.Fatalf("expected users 120K, got %q", users)
	}
	if version != "5.9.1" {
		t.Fatalf("expected version 5.9.1, got %q", version)
	}

	users, version = parseStoreStatsFromHTML("firefox", `<div>Users 12,345</div><div>Version 6.0.0</div>`)
	if users != "12,345" {
		t.Fatalf("expected users 12,345, got %q", users)
	}
	if version != "6.0.0" {
		t.Fatalf("expected version 6.0.0, got %q", version)
	}
}

func TestParseApproxUsersCount(t *testing.T) {
	cases := []struct {
		in   string
		want int64
	}{
		{in: "12,345", want: 12345},
		{in: "120K", want: 120000},
		{in: "1.2M", want: 1200000},
		{in: "0", want: 0},
	}
	for _, tc := range cases {
		got := parseApproxUsersCount(tc.in)
		if got != tc.want {
			t.Fatalf("input=%q got=%d want=%d", tc.in, got, tc.want)
		}
	}
}

func TestDeploymentsSyncHandlerWithClient(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "true")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chrome":
			_, _ = w.Write([]byte(`<script>{"users":"120K","version":"5.9.1"}</script>`))
		case "/firefox":
			_, _ = w.Write([]byte(`<div>Users 12,345</div><div>Version 6.0.0</div>`))
		case "/edge":
			_, _ = w.Write([]byte(`<div>1.2M users</div><div>Version 6.1.0</div>`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	store := newControlPlaneStore(sqlDB, nil)
	if err := store.upsertRecord(context.Background(), "deployment_target", "chrome", map[string]any{"url": server.URL + "/chrome"}); err != nil {
		t.Fatalf("seed chrome record failed: %v", err)
	}
	if err := store.upsertRecord(context.Background(), "deployment_target", "firefox", map[string]any{"url": server.URL + "/firefox"}); err != nil {
		t.Fatalf("seed firefox record failed: %v", err)
	}
	if err := store.upsertRecord(context.Background(), "deployment_target", "edge", map[string]any{"url": server.URL + "/edge"}); err != nil {
		t.Fatalf("seed edge record failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/admin/deployments/sync", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	deploymentsSyncHandlerWithClient(sqlDB, nil, server.Client(), nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("sync failed: %d %s", rr.Code, rr.Body.String())
	}

	var payload struct {
		OK      bool `json:"ok"`
		Count   int  `json:"count"`
		OKCount int  `json:"okCount"`
		Results []struct {
			Key     string `json:"key"`
			Status  string `json:"status"`
			Version string `json:"version"`
		} `json:"results"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse sync payload failed: %v", err)
	}
	if !payload.OK || payload.Count != 3 || payload.OKCount != 3 {
		t.Fatalf("unexpected sync payload: %+v", payload)
	}

	records, err := store.listRecords(context.Background(), "deployment_target")
	if err != nil {
		t.Fatalf("list deployment records failed: %v", err)
	}
	versions := map[string]string{}
	for _, row := range records {
		var m map[string]any
		if err := json.Unmarshal(row.Data, &m); err != nil {
			t.Fatalf("unmarshal deployment record failed: %v", err)
		}
		if v, _ := m["version"].(string); v != "" {
			versions[row.RecordKey] = v
		}
	}
	if versions["chrome"] != "5.9.1" {
		t.Fatalf("expected chrome version to be updated, got %q", versions["chrome"])
	}
	if versions["firefox"] != "6.0.0" {
		t.Fatalf("expected firefox version to be updated, got %q", versions["firefox"])
	}
	if versions["edge"] != "6.1.0" {
		t.Fatalf("expected edge version to be updated, got %q", versions["edge"])
	}
}

func TestDeploymentsSyncHandlerRejectsUnknownTarget(t *testing.T) {
	sqlDB := newAdminTestDB(t)
	defer sqlDB.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/deployments/sync", bytes.NewBufferString(`{"targets":["unknown"]}`))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	deploymentsSyncHandlerWithClient(sqlDB, nil, &http.Client{}, nil).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown target, got %d", rr.Code)
	}
}

func TestValidateStoreURL_RejectsUntrustedHostByDefault(t *testing.T) {
	t.Setenv("ORACLE_ALLOW_UNTRUSTED_STORE_URLS", "false")
	err := validateStoreURL("chrome", "https://example.com/x")
	if err == nil {
		t.Fatalf("expected untrusted host to be rejected")
	}
}
