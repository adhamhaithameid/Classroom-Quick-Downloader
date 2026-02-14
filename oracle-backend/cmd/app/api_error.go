package main

import (
	"encoding/json"
	"log"
	"net/http"
)

// writeAPIError writes a consistent JSON API error envelope.
func writeAPIError(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(map[string]string{"error": code}); err != nil {
		log.Printf("failed to encode api error response: %v", err)
	}
}
