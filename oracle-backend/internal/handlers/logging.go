// oracle-backend/internal/handlers/logging.go
package handlers

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"oracle-backend/internal/observability"
)

type logPayload struct {
	Level         string                 `json:"level"`
	Message       string                 `json:"message"`
	Time          string                 `json:"time"`
	RequestID     string                 `json:"requestId,omitempty"`
	CorrelationID string                 `json:"correlationId,omitempty"`
	Fields        map[string]interface{} `json:"fields,omitempty"`
}

func logEvent(level string, message string, fields map[string]interface{}) {
	logEventWithContext(context.Background(), level, message, fields)
}

func logEventWithContext(ctx context.Context, level string, message string, fields map[string]interface{}) {
	payload := logPayload{
		Level:   level,
		Message: message,
		Time:    time.Now().UTC().Format(time.RFC3339),
		Fields:  fields,
	}
	if requestID := observability.RequestIDFromContext(ctx); requestID != "" && requestID != "unknown" {
		payload.RequestID = requestID
	}
	if correlationID := observability.CorrelationIDFromContext(ctx); correlationID != "" && correlationID != "unknown" {
		payload.CorrelationID = correlationID
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[logEvent] marshal error: %v", err)
		return
	}
	log.Println(string(encoded))
}
