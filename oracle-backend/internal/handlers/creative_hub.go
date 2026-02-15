package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
)

var simpleEmailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func creativeFeatureEnabled(w http.ResponseWriter, r *http.Request, sqliteDB *sql.DB) bool {
	if sqliteDB == nil {
		return true
	}
	return ensureFeatureEnabled(w, r, sqliteDB, "feature_creative_hub_enabled")
}

func fixedRecordListHandler(sqliteDB, postgresDB *sql.DB, recordType string, featureGuard bool) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if featureGuard && !creativeFeatureEnabled(w, r, sqliteDB) {
			return
		}

		out, err := store.listRecords(r.Context(), recordType)
		if err != nil {
			http.Error(w, "failed to list records", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":         true,
			"recordType": recordType,
			"records":    out,
		})
	}
}

func fixedRecordUpsertHandler(sqliteDB, postgresDB *sql.DB, recordType string, featureGuard bool) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if featureGuard && !creativeFeatureEnabled(w, r, sqliteDB) {
			return
		}

		var req struct {
			RecordKey string         `json:"recordKey"`
			Data      map[string]any `json:"data"`
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.RecordKey = strings.TrimSpace(req.RecordKey)
		if req.RecordKey == "" {
			http.Error(w, "recordKey is required", http.StatusBadRequest)
			return
		}
		if req.Data == nil {
			req.Data = map[string]any{}
		}
		if err := store.upsertRecord(r.Context(), recordType, req.RecordKey, req.Data); err != nil {
			http.Error(w, "failed to upsert record", http.StatusInternalServerError)
			return
		}
		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			sqliteDB,
			"creative_record_upsert",
			recordType,
			req.RecordKey,
			"ok",
			map[string]any{"recordType": recordType, "recordKey": req.RecordKey},
		) {
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}
}

func fixedRecordDeleteHandler(sqliteDB, postgresDB *sql.DB, recordType string, featureGuard bool) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if featureGuard && !creativeFeatureEnabled(w, r, sqliteDB) {
			return
		}

		var req struct {
			RecordKey string `json:"recordKey"`
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.RecordKey = strings.TrimSpace(req.RecordKey)
		if req.RecordKey == "" {
			http.Error(w, "recordKey is required", http.StatusBadRequest)
			return
		}
		affected, err := store.deleteRecord(r.Context(), recordType, req.RecordKey)
		if err != nil {
			http.Error(w, "failed to delete record", http.StatusInternalServerError)
			return
		}
		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			sqliteDB,
			"creative_record_delete",
			recordType,
			req.RecordKey,
			"ok",
			map[string]any{"recordType": recordType, "recordKey": req.RecordKey, "affected": affected},
		) {
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":       true,
			"affected": affected,
		})
	}
}

func CreativeDesignsListHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordListHandler(sqliteDB, postgresDB, "creative_design", true)
}

func CreativeDesignsUpsertHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordUpsertHandler(sqliteDB, postgresDB, "creative_design", true)
}

func CreativeDesignsDeleteHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordDeleteHandler(sqliteDB, postgresDB, "creative_design", true)
}

func CreativeEmailsListHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordListHandler(sqliteDB, postgresDB, "creative_email_template", true)
}

func CreativeEmailsUpsertHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordUpsertHandler(sqliteDB, postgresDB, "creative_email_template", true)
}

func CreativeEmailsDeleteHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordDeleteHandler(sqliteDB, postgresDB, "creative_email_template", true)
}

func NewsletterSubscribersListHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordListHandler(sqliteDB, postgresDB, "newsletter_subscriber", true)
}

func NewsletterSubscribersUpsertHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	store := newControlPlaneStore(sqliteDB, postgresDB)
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !creativeFeatureEnabled(w, r, sqliteDB) {
			return
		}

		var req struct {
			RecordKey string         `json:"recordKey"`
			Data      map[string]any `json:"data"`
		}
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Data == nil {
			req.Data = map[string]any{}
		}
		email, _ := req.Data["email"].(string)
		email = strings.ToLower(strings.TrimSpace(email))
		if email == "" {
			http.Error(w, "email is required", http.StatusBadRequest)
			return
		}
		if !simpleEmailPattern.MatchString(email) {
			http.Error(w, "invalid email", http.StatusBadRequest)
			return
		}
		req.Data["email"] = email

		req.RecordKey = strings.TrimSpace(req.RecordKey)
		if req.RecordKey == "" {
			req.RecordKey = email
		}
		if err := store.upsertRecord(r.Context(), "newsletter_subscriber", req.RecordKey, req.Data); err != nil {
			http.Error(w, "failed to upsert subscriber", http.StatusInternalServerError)
			return
		}
		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			sqliteDB,
			"newsletter_subscriber_upsert",
			"newsletter_subscriber",
			req.RecordKey,
			"ok",
			map[string]any{"recordKey": req.RecordKey},
		) {
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "recordKey": req.RecordKey})
	}
}

func NewsletterSubscribersDeleteHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordDeleteHandler(sqliteDB, postgresDB, "newsletter_subscriber", true)
}

func NewsletterCampaignsListHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordListHandler(sqliteDB, postgresDB, "newsletter_campaign", true)
}

func NewsletterCampaignsUpsertHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordUpsertHandler(sqliteDB, postgresDB, "newsletter_campaign", true)
}

func NewsletterCampaignsDeleteHandler(sqliteDB, postgresDB *sql.DB) http.HandlerFunc {
	return fixedRecordDeleteHandler(sqliteDB, postgresDB, "newsletter_campaign", true)
}
