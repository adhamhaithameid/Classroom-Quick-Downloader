package handlers

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"oracle-backend/internal/observability"
)

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

	if _, err := conn.ExecContext(
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
	); err != nil {
		return err
	}

	if _, err := conn.ExecContext(ctx, `COMMIT`); err != nil {
		return err
	}
	committed = true
	return nil
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
			Recomputed  string
		}
		chain := make([]rowData, 0, 256)
		prev := strings.Repeat("0", 64)
		ok := true
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
			item.Recomputed = hex.EncodeToString(sum[:])
			chain = append(chain, item)

			if item.PrevHash != prev && ok {
				ok = false
				breakAt = item.ID
				breakReason = "prev_hash_mismatch"
			}
			if item.RowHash != item.Recomputed && ok {
				ok = false
				breakAt = item.ID
				breakReason = "row_hash_mismatch"
			}
			if item.PayloadHash != recomputedPayloadHash && ok {
				ok = false
				breakAt = item.ID
				breakReason = "payload_hash_mismatch"
			}
			prev = item.RowHash
		}
		if err := rows.Err(); err != nil {
			writeJSONError(w, "verify_failed", "Failed to verify audit chain", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		resp := map[string]any{
			"ok":        true,
			"valid":     ok,
			"totalRows": len(chain),
			"limit":     limit,
			"offset":    offset,
			"hasMore":   len(chain) == limit,
		}
		if !ok {
			resp["breakAt"] = breakAt
			resp["reason"] = breakReason
		}
		_ = json.NewEncoder(w).Encode(resp)
	}
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
