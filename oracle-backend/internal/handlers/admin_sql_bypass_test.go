package handlers

import "testing"

// readPolicyAllows mirrors the guard chain SQLQueryHandler applies before it
// hands a statement to the read-only connection.
func readPolicyAllows(raw string) bool {
	stmt, err := normalizeSingleStatement(raw)
	if err != nil {
		return false
	}
	policy := normalizeSQLForPolicy(stmt)
	if !isReadOnlySQL(policy) {
		return false
	}
	if hasForbiddenSQLTerms(policy) {
		return false
	}
	return isAllowedReadOnlyQuery(policy)
}

// execPolicyAllows mirrors the guard chain SQLExecHandler applies before it
// executes a mutating statement.
func execPolicyAllows(raw string) bool {
	stmt, err := normalizeSingleStatement(raw)
	if err != nil {
		return false
	}
	policy := normalizeSQLForPolicy(stmt)
	if !isMutatingSQL(policy) {
		return false
	}
	if hasForbiddenSQLTerms(policy) {
		return false
	}
	table, ok := mutatingTargetTable(policy)
	if !ok {
		return false
	}
	_, allowed := sqlExecAllowedTables[table]
	return allowed
}

// TestReadPolicyBlocksRestrictedTableEvasion asserts that the restricted-table
// policy cannot be evaded through identifier quoting, schema qualification,
// case, comments, set operations, joins, or subqueries.
func TestReadPolicyBlocksRestrictedTableEvasion(t *testing.T) {
	t.Parallel()

	blocked := []struct{ name, sql string }{
		{"bare", `SELECT * FROM admin_audit_log`},
		{"lowercase", `select * from admin_audit_log`},
		{"uppercase table", `SELECT * FROM ADMIN_AUDIT_LOG`},
		{"double quoted", `SELECT * FROM "admin_audit_log"`},
		{"bracket quoted", `SELECT * FROM [admin_audit_log]`},
		{"backtick quoted", "SELECT * FROM `admin_audit_log`"},
		{"schema qualified", `SELECT * FROM main.admin_audit_log`},
		{"schema qualified quoted", `SELECT * FROM "main"."admin_audit_log"`},
		{"leading block comment", `SELECT * FROM /*x*/admin_audit_log`},
		{"sqlite_master", `SELECT * FROM sqlite_master`},
		{"sqlite_schema", `SELECT * FROM sqlite_schema`},
		{"feature_flags", `SELECT * FROM feature_flags`},
		{"union", `SELECT * FROM cf_snapshots_raw UNION SELECT * FROM admin_audit_log`},
		{"comma join", `SELECT * FROM cf_snapshots_raw, admin_audit_log`},
		{"explicit join", `SELECT * FROM cf_snapshots_raw JOIN admin_audit_log ON 1=1`},
		{"subquery in where", `SELECT * FROM cf_snapshots_raw WHERE x IN (SELECT y FROM admin_audit_log)`},
		{"trailing line comment newline", "SELECT * FROM cf_snapshots_raw --\n UNION SELECT * FROM admin_audit_log"},
	}

	for _, tc := range blocked {
		t.Run(tc.name, func(t *testing.T) {
			if readPolicyAllows(tc.sql) {
				t.Fatalf("read policy allowed a restricted-table statement: %s", tc.sql)
			}
		})
	}
}

// TestReadPolicyBlocksNonSelectAndMultiStatement asserts the read endpoint
// rejects anything that is not a single plain SELECT.
func TestReadPolicyBlocksNonSelectAndMultiStatement(t *testing.T) {
	t.Parallel()

	blocked := []struct{ name, sql string }{
		{"multi statement", `SELECT 1; DELETE FROM cf_snapshots_raw`},
		{"semicolon in text", `SELECT 1 /* ; */`},
		{"drop", `DROP TABLE cf_snapshots_raw`},
		{"pragma", `PRAGMA table_info(cf_snapshots_raw)`},
		{"attach", `ATTACH DATABASE 'x.db' AS x`},
		{"vacuum", `VACUUM`},
		{"create", `CREATE TABLE x (a int)`},
		{"load_extension", `SELECT load_extension('x')`},
		{"cte", `WITH x AS (SELECT * FROM admin_audit_log) SELECT * FROM x`},
		{"parenthesised select", `(SELECT * FROM admin_audit_log)`},
		{"update via query endpoint", `UPDATE cf_snapshots_raw SET a = 1`},
	}

	for _, tc := range blocked {
		t.Run(tc.name, func(t *testing.T) {
			if readPolicyAllows(tc.sql) {
				t.Fatalf("read policy allowed a disallowed statement: %s", tc.sql)
			}
		})
	}
}

// TestReadPolicyAllowsPermittedQueries guards against the policy becoming so
// strict that the console stops working.
func TestReadPolicyAllowsPermittedQueries(t *testing.T) {
	t.Parallel()

	allowed := []struct{ name, sql string }{
		{"simple", `SELECT * FROM cf_snapshots_raw`},
		{"with where", `SELECT a, b FROM cf_snapshots_raw WHERE a = 1`},
		{"aliased", `SELECT t.a FROM cf_snapshots_raw t WHERE t.a = 1`},
		{"join permitted tables", `SELECT * FROM cf_snapshots_raw JOIN backup_runs ON 1=1`},
		{"order and limit", `SELECT a FROM ingest_outbox ORDER BY a LIMIT 10`},
	}

	for _, tc := range allowed {
		t.Run(tc.name, func(t *testing.T) {
			if !readPolicyAllows(tc.sql) {
				t.Fatalf("read policy rejected a permitted statement: %s", tc.sql)
			}
		})
	}
}

// TestExecPolicyBlocksDisallowedTargets asserts the exec endpoint only mutates
// allowlisted tables and cannot be steered elsewhere.
func TestExecPolicyBlocksDisallowedTargets(t *testing.T) {
	t.Parallel()

	blocked := []struct{ name, sql string }{
		{"update restricted", `UPDATE admin_audit_log SET a = 1`},
		{"update quoted restricted", `UPDATE "admin_audit_log" SET a = 1`},
		{"update bracket restricted", `UPDATE [admin_audit_log] SET a = 1`},
		{"delete restricted", `DELETE FROM admin_audit_log`},
		{"insert restricted", `INSERT INTO admin_audit_log (a) VALUES (1)`},
		{"update unlisted table", `UPDATE some_other_table SET a = 1`},
		{"schema qualified", `UPDATE main.admin_audit_log SET a = 1`},
		{"multi statement", `UPDATE cf_snapshots_raw SET a = 1; DROP TABLE x`},
		{"drop", `DROP TABLE cf_snapshots_raw`},
		{"select via exec endpoint", `SELECT * FROM cf_snapshots_raw`},
		{"comment before target", `UPDATE /*x*/ admin_audit_log SET a = 1`},
	}

	for _, tc := range blocked {
		t.Run(tc.name, func(t *testing.T) {
			if execPolicyAllows(tc.sql) {
				t.Fatalf("exec policy allowed a disallowed statement: %s", tc.sql)
			}
		})
	}
}

// TestExecPolicyAllowsPermittedMutations guards the allowlisted write paths.
func TestExecPolicyAllowsPermittedMutations(t *testing.T) {
	t.Parallel()

	allowed := []struct{ name, sql string }{
		{"update allowed", `UPDATE cf_snapshots_raw SET a = 1 WHERE b = 2`},
		{"delete allowed", `DELETE FROM ingest_outbox WHERE a = 1`},
		{"insert allowed", `INSERT INTO system_alerts (a) VALUES (1)`},
	}

	for _, tc := range allowed {
		t.Run(tc.name, func(t *testing.T) {
			if !execPolicyAllows(tc.sql) {
				t.Fatalf("exec policy rejected a permitted statement: %s", tc.sql)
			}
		})
	}
}
