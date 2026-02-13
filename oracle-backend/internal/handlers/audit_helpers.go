package handlers

import (
	"context"
	"database/sql"
	"net/http"
)

func appendAuditLogOrHTTPError(
	w http.ResponseWriter,
	ctx context.Context,
	db *sql.DB,
	actionType string,
	resourceType string,
	resourceID string,
	result string,
	payload map[string]any,
) bool {
	if db == nil {
		return true
	}
	if err := AppendAuditLog(ctx, db, actionType, resourceType, resourceID, result, payload); err != nil {
		http.Error(w, "failed to write audit log", http.StatusInternalServerError)
		return false
	}
	return true
}
