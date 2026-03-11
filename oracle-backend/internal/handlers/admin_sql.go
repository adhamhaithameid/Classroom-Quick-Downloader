package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type sqlQueryRequest struct {
	SQL   string `json:"sql"`
	Limit int    `json:"limit"`
}

type sqlExecRequest struct {
	SQL    string `json:"sql"`
	DryRun bool   `json:"dryRun"`
}

var sqlForbiddenTermsRegexp = regexp.MustCompile(`(?i)\b(drop|alter|pragma|vacuum|attach|detach|reindex|create|trigger|load_extension|replace)\b`)
var sqlInlineCommentRegexp = regexp.MustCompile(`(?s)/\*.*?\*/|--[^\r\n]*`)
var sqlExecTimeout = 5 * time.Second

var sqlReadOnlyRestrictedTables = map[string]struct{}{
	"admin_audit_log": {},
	"feature_flags":   {},
	"sqlite_master":   {},
	"sqlite_schema":   {},
}

var sqlExecAllowedTables = map[string]struct{}{
	"pipeline_failure_logs": {},
	"ingest_outbox":         {},
	"outbox_dead_letter":    {},
	"system_alerts":         {},
	"cf_snapshots_raw":      {},
	"oracle_operation_logs": {},
	"cf_schema_registry":    {},
	"backup_runs":           {},
}

var sqlTargetTableRegexp = regexp.MustCompile(`(?i)^\s*(?:insert\s+into|update|delete\s+from)\s+([a-zA-Z_][a-zA-Z0-9_]*)`)
var sqlReadOnlySourceRegexp = regexp.MustCompile(`(?i)\b(?:from|join)\s+([^\s,;]+)`)
var sqlReadOnlyFromClauseRegexp = regexp.MustCompile(`(?is)\bfrom\b\s+(.+?)(?:\bwhere\b|\bgroup\b|\border\b|\blimit\b|\bhaving\b|\bunion\b|\bintersect\b|\bexcept\b|$)`)

func SQLQueryHandler(db *sql.DB, readOnlyDB *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !ensureFeatureEnabled(w, r, db, "feature_sql_console_enabled") {
			return
		}

		var req sqlQueryRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		stmt, err := normalizeSingleStatement(req.SQL)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		policyStmt := normalizeSQLForPolicy(stmt)
		if !isReadOnlySQL(policyStmt) {
			http.Error(w, "only read-only SQL is allowed on query endpoint", http.StatusBadRequest)
			return
		}
		if hasForbiddenSQLTerms(policyStmt) {
			http.Error(w, "statement is not allowed by safety policy", http.StatusBadRequest)
			return
		}
		if !isAllowedReadOnlyQuery(policyStmt) {
			http.Error(w, "query references restricted tables", http.StatusBadRequest)
			return
		}

		limit := req.Limit
		if limit <= 0 {
			limit = 200
		}
		if limit > 2000 {
			limit = 2000
		}

		queryDB := readOnlyDB
		if queryDB == nil {
			queryDB = db
		}
		sqlCtx, cancel := context.WithTimeout(r.Context(), sqlExecTimeout)
		defer cancel()
		rows, err := queryDB.QueryContext(sqlCtx, stmt) // #nosec G701 -- SQL text is validated by strict single-statement read-only guards and restricted table policy.
		if err != nil {
			logEventWithContext(r.Context(), "warn", "sql_query_failed", map[string]any{
				"error": truncateAlertError(err.Error()),
			})
			writeJSONError(w, "query_failed", "SQL query execution error", http.StatusBadRequest)
			return
		}
		defer rows.Close()

		cols, err := rows.Columns()
		if err != nil {
			writeJSONError(w, "query_failed", "SQL query execution error", http.StatusInternalServerError)
			return
		}

		out := make([]map[string]any, 0, limit)
		for rows.Next() {
			if len(out) >= limit {
				break
			}
			values := make([]any, len(cols))
			ptrs := make([]any, len(cols))
			for i := range values {
				ptrs[i] = &values[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				writeJSONError(w, "scan_failed", "SQL query scan error", http.StatusInternalServerError)
				return
			}
			row := make(map[string]any, len(cols))
			for i, col := range cols {
				v := values[i]
				switch t := v.(type) {
				case []byte:
					row[col] = string(t)
				default:
					row[col] = t
				}
			}
			out = append(out, row)
		}
		if err := rows.Err(); err != nil {
			writeJSONError(w, "query_failed", "SQL query execution error", http.StatusInternalServerError)
			return
		}

		_ = AppendAuditLog(
			r.Context(),
			db,
			"sql_query",
			"sql_console",
			"query",
			"ok",
			map[string]any{
				"rows":    len(out),
				"limited": limit,
				"sql":     truncateSQLForAudit(stmt),
			},
		)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":    true,
			"limit": limit,
			"count": len(out),
			"rows":  out,
		})
	}
}

func SQLExecHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !ensureFeatureEnabled(w, r, db, "feature_sql_console_enabled") {
			return
		}

		var req sqlExecRequest
		if err := decodeJSONBodyStrict(r, &req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		stmt, err := normalizeSingleStatement(req.SQL)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		policyStmt := normalizeSQLForPolicy(stmt)
		if !isMutatingSQL(policyStmt) {
			http.Error(w, "exec endpoint only supports insert/update/delete statements", http.StatusBadRequest)
			return
		}
		if hasForbiddenSQLTerms(policyStmt) {
			http.Error(w, "statement is not allowed by safety policy", http.StatusBadRequest)
			return
		}
		tableName, ok := mutatingTargetTable(policyStmt)
		if !ok {
			http.Error(w, "unable to determine target table", http.StatusBadRequest)
			return
		}
		if _, allowed := sqlExecAllowedTables[tableName]; !allowed {
			http.Error(w, "mutations on this table are not allowed by safety policy", http.StatusBadRequest)
			return
		}

		affected := int64(0)
		if req.DryRun {
			sqlCtx, cancel := context.WithTimeout(r.Context(), sqlExecTimeout)
			defer cancel()
			tx, err := db.BeginTx(sqlCtx, nil)
			if err != nil {
				http.Error(w, "failed to execute dry run", http.StatusInternalServerError)
				return
			}
			res, err := tx.ExecContext(sqlCtx, stmt) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			if err == nil {
				affected, _ = res.RowsAffected()
			}
			_ = tx.Rollback()
			if err != nil {
				logEventWithContext(r.Context(), "warn", "sql_exec_dry_run_failed", map[string]any{
					"error": truncateAlertError(err.Error()),
					"table": tableName,
				})
				writeJSONError(w, "dry_run_failed", "SQL dry run execution error", http.StatusBadRequest)
				return
			}
		} else {
			sqlCtx, cancel := context.WithTimeout(r.Context(), sqlExecTimeout)
			defer cancel()
			res, err := db.ExecContext(sqlCtx, stmt) // #nosec G701 -- SQL text is constant or derived from validated allowlisted identifiers; values are passed as bound parameters.
			if err != nil {
				logEventWithContext(r.Context(), "warn", "sql_exec_failed", map[string]any{
					"error": truncateAlertError(err.Error()),
					"table": tableName,
				})
				writeJSONError(w, "exec_failed", "SQL execution error", http.StatusBadRequest)
				return
			}
			affected, _ = res.RowsAffected()
		}

		action := "sql_exec"
		if req.DryRun {
			action = "sql_exec_dry_run"
		}
		if !appendAuditLogOrHTTPError(
			w,
			r.Context(),
			db,
			action,
			"sql_console",
			"exec",
			"ok",
			map[string]any{
				"affected": affected,
				"dryRun":   req.DryRun,
				"table":    tableName,
				"sql":      truncateSQLForAudit(stmt),
			},
		) {
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":       true,
			"dryRun":   req.DryRun,
			"affected": affected,
		})
	}
}

func ensureFeatureEnabled(w http.ResponseWriter, r *http.Request, db *sql.DB, flagName string) bool {
	enabled, err := IsFeatureEnabled(r.Context(), db, flagName)
	if err != nil {
		http.Error(w, "failed to evaluate feature flag", http.StatusInternalServerError)
		return false
	}
	if !enabled {
		http.Error(w, "feature disabled", http.StatusForbidden)
		return false
	}
	return true
}

func normalizeSingleStatement(sqlText string) (string, error) {
	stmt := strings.TrimSpace(sqlText)
	if stmt == "" {
		return "", errors.New("sql is required")
	}
	if strings.Count(stmt, ";") > 1 {
		return "", errors.New("multiple SQL statements are not allowed")
	}
	stmt = strings.TrimSuffix(stmt, ";")
	if strings.Contains(stmt, ";") {
		return "", errors.New("multiple SQL statements are not allowed")
	}
	return stmt, nil
}

func normalizeSQLForPolicy(stmt string) string {
	noComments := sqlInlineCommentRegexp.ReplaceAllString(stmt, " ")
	return strings.TrimSpace(noComments)
}

func isReadOnlySQL(stmt string) bool {
	lower := strings.ToLower(strings.TrimSpace(stmt))
	return strings.HasPrefix(lower, "select ")
}

func isMutatingSQL(stmt string) bool {
	lower := strings.ToLower(strings.TrimSpace(stmt))
	return strings.HasPrefix(lower, "insert ") ||
		strings.HasPrefix(lower, "update ") ||
		strings.HasPrefix(lower, "delete ")
}

func hasForbiddenSQLTerms(stmt string) bool {
	return sqlForbiddenTermsRegexp.MatchString(stmt)
}

func mutatingTargetTable(stmt string) (string, bool) {
	match := sqlTargetTableRegexp.FindStringSubmatch(stmt)
	if len(match) < 2 {
		return "", false
	}
	return strings.ToLower(strings.TrimSpace(match[1])), true
}

func isAllowedReadOnlyQuery(stmt string) bool {
	sourceTokens, ok := collectReadOnlySourceTokens(stmt)
	if !ok {
		return false
	}
	for _, token := range sourceTokens {
		table, ok := normalizeReadOnlySourceTable(token)
		if !ok {
			return false
		}
		if _, blocked := sqlReadOnlyRestrictedTables[table]; blocked {
			return false
		}
	}
	return true
}

func collectReadOnlySourceTokens(stmt string) ([]string, bool) {
	tokens := make([]string, 0, 8)

	matches := sqlReadOnlySourceRegexp.FindAllStringSubmatch(stmt, -1)
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		tokens = append(tokens, match[1])
	}

	fromMatches := sqlReadOnlyFromClauseRegexp.FindAllStringSubmatch(stmt, -1)
	for _, match := range fromMatches {
		if len(match) < 2 {
			continue
		}
		commaSources, ok := extractCommaSourceTokens(match[1])
		if !ok {
			return nil, false
		}
		tokens = append(tokens, commaSources...)
	}

	return tokens, true
}

func extractCommaSourceTokens(fromClause string) ([]string, bool) {
	segments, ok := splitTopLevelCommaSegments(fromClause)
	if !ok {
		return nil, false
	}
	if len(segments) <= 1 {
		return nil, true
	}

	out := make([]string, 0, len(segments)-1)
	for i := 1; i < len(segments); i++ {
		token, ok := leadingSourceToken(segments[i])
		if !ok {
			return nil, false
		}
		out = append(out, token)
	}
	return out, true
}

func splitTopLevelCommaSegments(input string) ([]string, bool) {
	segments := make([]string, 0, 4)
	start := 0
	depth := 0
	var quote byte
	bracketQuoted := false

	for i := 0; i < len(input); i++ {
		ch := input[i]
		if quote != 0 {
			if ch == quote {
				if i+1 < len(input) && input[i+1] == quote {
					i++
					continue
				}
				quote = 0
			}
			continue
		}
		if bracketQuoted {
			if ch == ']' {
				bracketQuoted = false
			}
			continue
		}

		switch ch {
		case '\'', '"', '`':
			quote = ch
		case '[':
			bracketQuoted = true
		case '(':
			depth++
		case ')':
			if depth == 0 {
				return nil, false
			}
			depth--
		case ',':
			if depth == 0 {
				segments = append(segments, input[start:i])
				start = i + 1
			}
		}
	}

	if quote != 0 || bracketQuoted || depth != 0 {
		return nil, false
	}

	segments = append(segments, input[start:])
	return segments, true
}

func leadingSourceToken(segment string) (string, bool) {
	s := strings.TrimSpace(segment)
	if s == "" || strings.HasPrefix(s, "(") {
		return "", false
	}

	var quote byte
	bracketQuoted := false
	end := 0
	for end < len(s) {
		ch := s[end]
		if quote != 0 {
			if ch == quote {
				if end+1 < len(s) && s[end+1] == quote {
					end += 2
					continue
				}
				quote = 0
			}
			end++
			continue
		}
		if bracketQuoted {
			if ch == ']' {
				bracketQuoted = false
			}
			end++
			continue
		}

		switch ch {
		case '\'', '"', '`':
			quote = ch
		case '[':
			bracketQuoted = true
		case ' ', '\t', '\n', '\r', ',', ';':
			token := strings.TrimSpace(s[:end])
			if token == "" {
				return "", false
			}
			return token, true
		case '(', ')':
			return "", false
		}
		end++
	}

	if quote != 0 || bracketQuoted {
		return "", false
	}
	token := strings.TrimSpace(s[:end])
	if token == "" {
		return "", false
	}
	return token, true
}

func normalizeReadOnlySourceTable(sourceToken string) (string, bool) {
	token := strings.TrimSpace(strings.TrimRight(sourceToken, ","))
	if token == "" {
		return "", false
	}
	if strings.HasPrefix(token, "(") {
		return "", false
	}

	parts, ok := splitIdentifierParts(token)
	if !ok || len(parts) == 0 {
		return "", false
	}

	table := strings.ToLower(strings.TrimSpace(parts[len(parts)-1]))
	if table == "" {
		return "", false
	}
	return table, true
}

// splitIdentifierParts parses a SQL identifier token into its schema/table
// components. Supported formats:
//   - bare:             my_table             → ["my_table"]
//   - dotted:           schema.my_table      → ["schema", "my_table"]
//   - double-quoted:    "schema"."My Table"  → ["schema", "My Table"]
//   - backtick-quoted:  `schema`.`table`     → ["schema", "table"]
//   - bracket-quoted:   [schema].[table]     → ["schema", "table"]
//
// Returns (nil, false) for malformed input or input containing parentheses.
func splitIdentifierParts(token string) ([]string, bool) {
	parts := make([]string, 0, 2)
	i := 0

	readBare := func() (string, bool) {
		start := i
		for i < len(token) {
			switch token[i] {
			case '.', ' ', '\t', '\n', '\r', ',', ';':
				goto done
			case '(', ')':
				return "", false
			default:
				i++
			}
		}
	done:
		if start == i {
			return "", false
		}
		return token[start:i], true
	}

	readQuoted := func(quote byte) (string, bool) {
		if i >= len(token) || token[i] != quote {
			return "", false
		}
		i++
		start := i
		for i < len(token) && token[i] != quote {
			i++
		}
		if i >= len(token) {
			return "", false
		}
		value := token[start:i]
		i++ // closing quote
		if value == "" {
			return "", false
		}
		return value, true
	}

	readBracketQuoted := func() (string, bool) {
		if i >= len(token) || token[i] != '[' {
			return "", false
		}
		i++
		start := i
		for i < len(token) && token[i] != ']' {
			i++
		}
		if i >= len(token) {
			return "", false
		}
		value := token[start:i]
		i++ // closing bracket
		if value == "" {
			return "", false
		}
		return value, true
	}

	for i < len(token) {
		for i < len(token) && (token[i] == ' ' || token[i] == '\t' || token[i] == '\n' || token[i] == '\r') {
			i++
		}
		if i >= len(token) {
			break
		}

		var part string
		var ok bool
		switch token[i] {
		case '"', '`':
			part, ok = readQuoted(token[i])
		case '[':
			part, ok = readBracketQuoted()
		default:
			part, ok = readBare()
		}
		if !ok {
			return nil, false
		}
		part = strings.TrimSpace(part)
		if part == "" {
			return nil, false
		}
		parts = append(parts, part)

		for i < len(token) && (token[i] == ' ' || token[i] == '\t' || token[i] == '\n' || token[i] == '\r') {
			i++
		}
		if i >= len(token) {
			break
		}
		if token[i] != '.' {
			return nil, false
		}
		i++ // dot separator
	}

	if len(parts) == 0 {
		return nil, false
	}
	return parts, true
}
