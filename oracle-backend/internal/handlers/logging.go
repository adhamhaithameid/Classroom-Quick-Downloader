// oracle-backend/internal/handlers/logging.go
package handlers

import (
	"encoding/json"
	"log"
	"time"
)

type logPayload struct {
	Level   string                 `json:"level"`
	Message string                 `json:"message"`
	Time    string                 `json:"time"`
	Fields  map[string]interface{} `json:"fields,omitempty"`
}

func logEvent(level string, message string, fields map[string]interface{}) {
	payload := logPayload{
		Level:   level,
		Message: message,
		Time:    time.Now().UTC().Format(time.RFC3339),
		Fields:  fields,
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[logEvent] marshal error: %v", err)
		return
	}
	log.Println(string(encoded))
}
