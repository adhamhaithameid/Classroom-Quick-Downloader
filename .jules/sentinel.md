## 2024-05-15 - [Remove internal error details exposure]
**Vulnerability:** Leaking internal error details to users in HTTP responses. In `oracle-backend/internal/handlers/stats.go`, many `http.Error` responses mapped to `http.StatusInternalServerError` were appending `err.Error()`.
**Learning:** Returning detailed backend errors to external users can expose internal system architecture, database details, or stack details to an attacker.
**Prevention:** Ensure that internal errors are logged internally, and return generic user-friendly error messages for 500 Internal Server Error responses.
