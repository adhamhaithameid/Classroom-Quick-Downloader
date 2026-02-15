package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"oracle-backend/internal/observability"
)

var (
	auditCheckpointSecretMu sync.RWMutex
	auditCheckpointSecret   []byte
)

func SetAuditCheckpointSecret(secret string) {
	trimmed := strings.TrimSpace(secret)
	auditCheckpointSecretMu.Lock()
	defer auditCheckpointSecretMu.Unlock()
	if trimmed == "" {
		auditCheckpointSecret = nil
		return
	}
	auditCheckpointSecret = []byte(trimmed)
}

func getAuditCheckpointSecret() []byte {
	auditCheckpointSecretMu.RLock()
	defer auditCheckpointSecretMu.RUnlock()
	if len(auditCheckpointSecret) == 0 {
		return nil
	}
	clone := make([]byte, len(auditCheckpointSecret))
	copy(clone, auditCheckpointSecret)
	return clone
}

func AppendAuditLog(
	ctx context.Context,
	db *sql.DB,
	actionType string,
	resourceType string,
	resourceID string,
	result string,
	payload map[string]any,
) error {
	requestID := observability.RequestIDFromContext(ctx)
	correlationID := observability.CorrelationIDFromContext(ctx)
	userID := observability.UserIDFromContext(ctx)
	tokenID := observability.TokenIDFromContext(ctx)
	role := observability.RoleFromContext(ctx)

	canonicalPayload, err := canonicalJSON(payload)
	if err != nil {
		return err
	}
	payloadHash := sha256.Sum256([]byte(canonicalPayload))
	payloadHashHex := hex.EncodeToString(payloadHash[:])

	// Serialize append operations on a dedicated connection so two concurrent
	// writers cannot fork the hash chain by reading the same predecessor.
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `BEGIN IMMEDIATE`); err != nil {
		return err
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		_, _ = conn.ExecContext(context.Background(), `ROLLBACK`)
	}()

	var prevHash string
	err = conn.QueryRowContext(ctx, `SELECT row_hash FROM admin_audit_log ORDER BY id DESC LIMIT 1`).Scan(&prevHash)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if errors.Is(err, sql.ErrNoRows) {
		prevHash = strings.Repeat("0", 64)
	}

	rowPreimage := canonicalPayload + ":" + prevHash
	rowHash := sha256.Sum256([]byte(rowPreimage))
	rowHashHex := hex.EncodeToString(rowHash[:])

	insertResult, err := conn.ExecContext(
		ctx,
		`INSERT INTO admin_audit_log (
			ts_utc, request_id, correlation_id, user_id, token_id, role,
			action_type, resource_type, resource_id, result, error_code,
			payload_json, prev_hash, payload_hash, row_hash
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		time.Now().UnixMilli(),
		requestID,
		correlationID,
		userID,
		tokenID,
		role,
		actionType,
		resourceType,
		resourceID,
		result,
		"",
		canonicalPayload,
		prevHash,
		payloadHashHex,
		rowHashHex,
	)
	if err != nil {
		return err
	}
	auditLogID, err := insertResult.LastInsertId()
	if err != nil {
		return err
	}
	if err := appendAuditCheckpoint(ctx, conn, auditLogID, rowHashHex); err != nil {
		return err
	}

	if _, err := conn.ExecContext(ctx, `COMMIT`); err != nil {
		return err
	}
	committed = true
	return nil
}

func appendAuditCheckpoint(ctx context.Context, conn *sql.Conn, auditLogID int64, rowHash string) error {
	secret := getAuditCheckpointSecret()
	if len(secret) == 0 {
		return nil
	}
	signature := computeAuditCheckpointSignature(secret, auditLogID, rowHash)
	_, err := conn.ExecContext(
		ctx,
		`INSERT INTO admin_audit_checkpoints (audit_log_id, row_hash, hmac_sig, created_at) VALUES (?, ?, ?, ?)`,
		auditLogID,
		rowHash,
		signature,
		time.Now().UnixMilli(),
	)
	return err
}

func computeAuditCheckpointSignature(secret []byte, auditLogID int64, rowHash string) string {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(fmt.Sprintf("%d:%s", auditLogID, rowHash)))
	return hex.EncodeToString(mac.Sum(nil))
}

func AuditVerifyChainHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		limit := 10000
		offset := 0
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 50000 {
				limit = n
			}
		}
		if v := r.URL.Query().Get("offset"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n >= 0 {
				offset = n
			}
		}

		rows, err := db.QueryContext( // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			r.Context(),
			`SELECT id, payload_json, prev_hash, payload_hash, row_hash FROM admin_audit_log ORDER BY id ASC LIMIT ? OFFSET ?`,
			limit, offset,
		)
		if err != nil {
			writeJSONError(w, "verify_failed", "Failed to verify audit chain", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type rowData struct {
			ID          int64
			Payload     string
			PrevHash    string
			PayloadHash string
			RowHash     string
		}
		rowCount := 0
		prev := strings.Repeat("0", 64)
		chainValid := true
		var breakAt int64
		var breakReason string

		for rows.Next() {
			var item rowData
			if err := rows.Scan(&item.ID, &item.Payload, &item.PrevHash, &item.PayloadHash, &item.RowHash); err != nil {
				writeJSONError(w, "verify_failed", "Failed to verify audit chain", http.StatusInternalServerError)
				return
			}
			payloadSum := sha256.Sum256([]byte(item.Payload))
			recomputedPayloadHash := hex.EncodeToString(payloadSum[:])
			sum := sha256.Sum256([]byte(item.Payload + ":" + item.PrevHash))
			recomputedRowHash := hex.EncodeToString(sum[:])
			rowCount++

			if item.PrevHash != prev && chainValid {
				chainValid = false
				breakAt = item.ID
				breakReason = "prev_hash_mismatch"
			}
			if item.RowHash != recomputedRowHash && chainValid {
				chainValid = false
				breakAt = item.ID
				breakReason = "row_hash_mismatch"
			}
			if item.PayloadHash != recomputedPayloadHash && chainValid {
				chainValid = false
				breakAt = item.ID
				breakReason = "payload_hash_mismatch"
			}
			prev = item.RowHash
		}
		if err := rows.Err(); err != nil {
			writeJSONError(w, "verify_failed", "Failed to verify audit chain", http.StatusInternalServerError)
			return
		}
		anchorValid, anchorStatus, anchorAuditRowID, err := verifyAuditCheckpoint(r.Context(), db)
		if err != nil {
			writeJSONError(w, "verify_failed", "Failed to verify audit chain", http.StatusInternalServerError)
			return
		}
		overallValid := chainValid && anchorValid

		w.Header().Set("Content-Type", "application/json")
		resp := map[string]any{
			"ok":           true,
			"valid":        overallValid,
			"totalRows":    rowCount,
			"limit":        limit,
			"offset":       offset,
			"hasMore":      rowCount == limit,
			"anchorValid":  anchorValid,
			"anchorStatus": anchorStatus,
		}
		if anchorAuditRowID > 0 {
			resp["anchorAuditRowId"] = anchorAuditRowID
		}
		if !chainValid {
			resp["breakAt"] = breakAt
			resp["reason"] = breakReason
		}
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func verifyAuditCheckpoint(ctx context.Context, db *sql.DB) (bool, string, int64, error) {
	secret := getAuditCheckpointSecret()
	if len(secret) == 0 {
		return false, "unconfigured", 0, nil
	}

	var auditLogID int64
	var checkpointRowHash string
	var checkpointSig string
	err := db.QueryRowContext( // #nosec G701 -- SQL text is constant and uses bound parameters.
		ctx,
		`SELECT audit_log_id, row_hash, hmac_sig FROM admin_audit_checkpoints ORDER BY created_at DESC, id DESC LIMIT 1`,
	).Scan(&auditLogID, &checkpointRowHash, &checkpointSig)
	if errors.Is(err, sql.ErrNoRows) {
		return false, "missing", 0, nil
	}
	if err != nil {
		return false, "", 0, err
	}

	var auditRowHash string
	err = db.QueryRowContext( // #nosec G701 -- SQL text is constant and uses bound parameters.
		ctx,
		`SELECT row_hash FROM admin_audit_log WHERE id = ?`,
		auditLogID,
	).Scan(&auditRowHash)
	if errors.Is(err, sql.ErrNoRows) {
		return false, "row_hash_mismatch", auditLogID, nil
	}
	if err != nil {
		return false, "", auditLogID, err
	}
	if auditRowHash != checkpointRowHash {
		return false, "row_hash_mismatch", auditLogID, nil
	}

	expectedSig := computeAuditCheckpointSignature(secret, auditLogID, checkpointRowHash)
	if subtle.ConstantTimeCompare([]byte(checkpointSig), []byte(expectedSig)) != 1 {
		return false, "signature_mismatch", auditLogID, nil
	}
	return true, "ok", auditLogID, nil
}

func canonicalJSON(payload map[string]any) (string, error) {
	if payload == nil {
		return "{}", nil
	}
	canonicalized := canonicalizeValue(payload)
	raw, err := json.Marshal(canonicalized)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

const maxCanonicalizeDepth = 32

// canonicalizeValue recursively sorts map keys for deterministic JSON output.
// Note: json.Marshal already sorts map keys alphabetically since Go 1.12,
// making the explicit sort in canonicalizeValueDepth redundant but harmless.
// The sort is kept for clarity and forward-compatibility.
func canonicalizeValue(v any) any {
	return canonicalizeValueDepth(v, 0)
}

func canonicalizeValueDepth(v any, depth int) any {
	if depth > maxCanonicalizeDepth {
		return "[max_depth_exceeded]"
	}
	switch typed := v.(type) {
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for k := range typed {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		ordered := make(map[string]any, len(typed))
		for _, k := range keys {
			ordered[k] = canonicalizeValueDepth(typed[k], depth+1)
		}
		return ordered
	case []any:
		out := make([]any, len(typed))
		for i := range typed {
			out[i] = canonicalizeValueDepth(typed[i], depth+1)
		}
		return out
	default:
		return v
	}
}

func truncateSQLForAudit(stmt string) string {
	const maxLen = 512
	normalized := strings.TrimSpace(stmt)
	if len(normalized) <= maxLen {
		return normalized
	}
	return normalized[:maxLen] + "...(truncated)"
}
