package handlers

import (
	"crypto/subtle"
	"database/sql"
	"net/http"
	"strings"
	"time"
)

func InternalWebsiteEventsBatchHandler(sqliteDB *sql.DB, doSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if sqliteDB == nil {
			writePublicWebsiteError(w, http.StatusServiceUnavailable, "database_unavailable", "Database is unavailable.", true)
			return
		}
		if r.Method != http.MethodPost {
			writePublicWebsiteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Only POST is allowed for this endpoint.", false)
			return
		}
		if strings.TrimSpace(doSecret) == "" {
			writePublicWebsiteError(w, http.StatusServiceUnavailable, "service_misconfigured", "Service misconfigured: missing shared secret.", true)
			return
		}
		provided := strings.TrimSpace(r.Header.Get("X-DO-SECRET"))
		if subtle.ConstantTimeCompare([]byte(provided), []byte(strings.TrimSpace(doSecret))) != 1 {
			writePublicWebsiteError(w, http.StatusUnauthorized, "unauthorized", "Missing or invalid shared secret.", false)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, publicWebsiteEventsBodyLimitBytes)
		var req publicWebsiteEventsBatchIngestRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			writePublicWebsiteError(w, http.StatusBadRequest, "invalid_request_body", "Request body must be valid JSON and match the expected schema.", false)
			return
		}
		if req.SchemaVersion != publicWebsiteSchemaVersion {
			writePublicWebsiteError(w, http.StatusBadRequest, "schema_version_required", "schemaVersion must be \"1\".", false)
			return
		}
		if trimAndLimit(req.BatchID, 160) == "" {
			writePublicWebsiteError(w, http.StatusBadRequest, "batch_id_required", "batchId is required.", false)
			return
		}
		if req.Attempt < 1 || req.Attempt > 20 {
			writePublicWebsiteError(w, http.StatusBadRequest, "attempt_out_of_range", "attempt must be between 1 and 20.", false)
			return
		}
		if req.GeneratedAtUTC <= 0 {
			writePublicWebsiteError(w, http.StatusBadRequest, "generated_at_utc_required", "generatedAtUtc must be a positive Unix ms timestamp.", false)
			return
		}
		if len(req.Events) == 0 {
			writePublicWebsiteError(w, http.StatusBadRequest, "events_required", "events must be a non-empty array.", false)
			return
		}
		if len(req.Events) > publicWebsiteEventsMaxPerRequest {
			writePublicWebsiteError(w, http.StatusBadRequest, "events_batch_too_large", "events length exceeds the maximum allowed batch size.", false)
			return
		}
		checksum := strings.ToLower(strings.TrimSpace(req.BatchChecksum))
		if checksum != "" {
			if len(checksum) != 64 || !isHexLower(checksum) {
				writePublicWebsiteError(w, http.StatusBadRequest, "invalid_batch_checksum", "batchChecksum must be a 64-char lowercase hex SHA-256 string.", false)
				return
			}
		}
		if req.ExpectedEvents != nil {
			if *req.ExpectedEvents < 0 || *req.ExpectedEvents > publicWebsiteEventsMaxPerRequest {
				writePublicWebsiteError(w, http.StatusBadRequest, "invalid_expected_event_count", "expectedEventCount is out of range.", false)
				return
			}
		}

		nowUTC := time.Now().UTC()
		nowMillis := nowUTC.UnixMilli()
		result, err := ingestWebsiteEvents(
			r.Context(),
			sqliteDB,
			req.Events,
			nowUTC,
			websiteEventsIngestMetadata{
				Source:         "worker_internal_batch",
				BatchID:        trimAndLimit(req.BatchID, 160),
				TriggeredBy:    "worker_website_events_batch",
				Attempt:        req.Attempt,
				SessionID:      sanitizeWebsiteEventSessionID(req.SessionID),
				PagePath:       sanitizeWebsiteEventPagePath(req.PagePath),
				GeneratedAtUTC: req.GeneratedAtUTC,
				CorrelationID:  trimAndLimit(r.Header.Get("X-Correlation-ID"), 200),
				BatchChecksum:  checksum,
				ExpectedEvents: req.ExpectedEvents,
			},
		)
		if err != nil {
			writePublicWebsiteError(w, http.StatusInternalServerError, "ingest_failed", "Failed to ingest website events batch.", true)
			return
		}
		if result.Integrity == "critical" {
			_ = upsertOpenAlert(
				r.Context(),
				sqliteDB,
				"website_batch_integrity_mismatch",
				"critical",
				"Website telemetry batch integrity verification failed.",
				map[string]any{
					"batchId":        trimAndLimit(req.BatchID, 160),
					"checksumStatus": result.ChecksumStatus,
					"rowCountStatus": result.RowCountStatus,
					"acceptedCount":  result.Accepted,
					"rejectedCount":  result.Rejected,
					"receivedCount":  result.Received,
					"accountedCount": result.Accounted,
					"integrityNotes": result.IntegrityNotes,
					"generatedAtUtc": req.GeneratedAtUTC,
				},
			)
		}

		writePublicWebsiteJSON(w, http.StatusOK, publicWebsiteEventsBatchIngestResponse{
			SchemaVersion: publicWebsiteSchemaVersion,
			OK:            true,
			BatchID:       trimAndLimit(req.BatchID, 160),
			GeneratedAt:   nowMillis,
			AcceptedCount: result.Accepted,
			RejectedCount: result.Rejected,
			Checksum:      result.BatchChecksum,
			ChecksumState: result.ChecksumStatus,
			RowCountState: result.RowCountStatus,
			Integrity:     result.Integrity,
		})
	}
}

func isHexLower(v string) bool {
	for _, ch := range v {
		if (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') {
			continue
		}
		return false
	}
	return true
}
