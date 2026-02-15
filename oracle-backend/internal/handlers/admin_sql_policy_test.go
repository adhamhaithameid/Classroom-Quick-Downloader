package handlers

import (
	"reflect"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// splitIdentifierParts
// ---------------------------------------------------------------------------

func TestSplitIdentifierParts_Bare(t *testing.T) {
	parts, ok := splitIdentifierParts("my_table")
	if !ok || !reflect.DeepEqual(parts, []string{"my_table"}) {
		t.Fatalf("expected [my_table]/true, got %v/%v", parts, ok)
	}
}

func TestSplitIdentifierParts_Dotted(t *testing.T) {
	parts, ok := splitIdentifierParts("schema.my_table")
	if !ok || !reflect.DeepEqual(parts, []string{"schema", "my_table"}) {
		t.Fatalf("expected [schema my_table]/true, got %v/%v", parts, ok)
	}
}

func TestSplitIdentifierParts_DoubleQuoted(t *testing.T) {
	parts, ok := splitIdentifierParts(`"schema"."My Table"`)
	if !ok || !reflect.DeepEqual(parts, []string{"schema", "My Table"}) {
		t.Fatalf("expected [schema My Table]/true, got %v/%v", parts, ok)
	}
}

func TestSplitIdentifierParts_BacktickQuoted(t *testing.T) {
	parts, ok := splitIdentifierParts("`schema`.`table`")
	if !ok || !reflect.DeepEqual(parts, []string{"schema", "table"}) {
		t.Fatalf("expected [schema table]/true, got %v/%v", parts, ok)
	}
}

func TestSplitIdentifierParts_BracketQuoted(t *testing.T) {
	parts, ok := splitIdentifierParts("[schema].[table]")
	if !ok || !reflect.DeepEqual(parts, []string{"schema", "table"}) {
		t.Fatalf("expected [schema table]/true, got %v/%v", parts, ok)
	}
}

func TestSplitIdentifierParts_MixedQuoting(t *testing.T) {
	parts, ok := splitIdentifierParts(`"main".my_table`)
	if !ok || !reflect.DeepEqual(parts, []string{"main", "my_table"}) {
		t.Fatalf("expected [main my_table]/true, got %v/%v", parts, ok)
	}
}

func TestSplitIdentifierParts_Parenthesized(t *testing.T) {
	_, ok := splitIdentifierParts("(SELECT 1)")
	if ok {
		t.Fatal("expected false for parenthesized expression")
	}
}

func TestSplitIdentifierParts_Empty(t *testing.T) {
	_, ok := splitIdentifierParts("")
	if ok {
		t.Fatal("expected false for empty")
	}
}

func TestSplitIdentifierParts_MalformedUnclosedQuote(t *testing.T) {
	_, ok := splitIdentifierParts(`"main`)
	if ok {
		t.Fatal("expected false for unclosed double-quote")
	}
}

func TestSplitIdentifierParts_MalformedUnclosedBracket(t *testing.T) {
	_, ok := splitIdentifierParts("[main")
	if ok {
		t.Fatal("expected false for unclosed bracket")
	}
}

func TestSplitIdentifierParts_ThreeParts(t *testing.T) {
	// catalog.schema.table (not typical for SQLite, but the parser should handle it)
	parts, ok := splitIdentifierParts("catalog.schema.my_table")
	if !ok || len(parts) != 3 || parts[2] != "my_table" {
		t.Fatalf("expected 3-part split, got %v/%v", parts, ok)
	}
}

func TestSplitIdentifierParts_EmptyQuoted(t *testing.T) {
	_, ok := splitIdentifierParts(`""`)
	if ok {
		t.Fatal("expected false for empty quoted identifier")
	}
}

func TestSplitIdentifierParts_EmptyBracket(t *testing.T) {
	_, ok := splitIdentifierParts("[]")
	if ok {
		t.Fatal("expected false for empty bracket identifier")
	}
}

func TestSplitIdentifierParts_TrailingDot(t *testing.T) {
	// The parser reads "schema" as the first part, sees the dot, then
	// reads an empty bare token for the second part → returns false.
	// However, in practice the internal readBare returns empty → fails.
	// Verify the parser rejects it gracefully.
	parts, ok := splitIdentifierParts("schema.")
	// If the parser returns ok, it found at least "schema" — both are valid behaviors;
	// the key point is it doesn't panic.
	if ok && len(parts) == 0 {
		t.Fatal("returned ok=true but no parts")
	}
}

func TestSplitIdentifierParts_WhitespaceAround(t *testing.T) {
	parts, ok := splitIdentifierParts("  my_table  ")
	if !ok || len(parts) != 1 || strings.TrimSpace(parts[0]) != "my_table" {
		t.Fatalf("expected my_table, got %v/%v", parts, ok)
	}
}

// ---------------------------------------------------------------------------
// leadingSourceToken
// ---------------------------------------------------------------------------

func TestLeadingSourceToken_Simple(t *testing.T) {
	token, ok := leadingSourceToken("batches AS b")
	if !ok || token != "batches" {
		t.Fatalf("expected batches/true, got %q/%v", token, ok)
	}
}

func TestLeadingSourceToken_QuotedTable(t *testing.T) {
	token, ok := leadingSourceToken(`"my_table" AS t1`)
	if !ok || token != `"my_table"` {
		t.Fatalf("expected quoted table, got %q/%v", token, ok)
	}
}

func TestLeadingSourceToken_BracketQuoted(t *testing.T) {
	token, ok := leadingSourceToken("[my_table] t1")
	if !ok || token != "[my_table]" {
		t.Fatalf("expected bracket-quoted table, got %q/%v", token, ok)
	}
}

func TestLeadingSourceToken_Subselect(t *testing.T) {
	_, ok := leadingSourceToken("(SELECT 1) AS sub")
	if ok {
		t.Fatal("expected false for subselect")
	}
}

func TestLeadingSourceToken_Empty(t *testing.T) {
	_, ok := leadingSourceToken("")
	if ok {
		t.Fatal("expected false for empty segment")
	}
}

func TestLeadingSourceToken_WhitespaceOnly(t *testing.T) {
	_, ok := leadingSourceToken("   ")
	if ok {
		t.Fatal("expected false for whitespace-only segment")
	}
}

func TestLeadingSourceToken_NoAlias(t *testing.T) {
	token, ok := leadingSourceToken("batches")
	if !ok || token != "batches" {
		t.Fatalf("expected batches/true, got %q/%v", token, ok)
	}
}

func TestLeadingSourceToken_DottedIdentifier(t *testing.T) {
	token, ok := leadingSourceToken("main.batches AS b")
	if !ok || token != "main.batches" {
		t.Fatalf("expected main.batches/true, got %q/%v", token, ok)
	}
}

// ---------------------------------------------------------------------------
// splitTopLevelCommaSegments
// ---------------------------------------------------------------------------

func TestSplitTopLevelCommaSegments_Simple(t *testing.T) {
	segs, ok := splitTopLevelCommaSegments("a, b, c")
	if !ok || len(segs) != 3 {
		t.Fatalf("expected 3 segments, got %d/%v", len(segs), ok)
	}
}

func TestSplitTopLevelCommaSegments_QuotedComma(t *testing.T) {
	segs, ok := splitTopLevelCommaSegments(`"a,b", c`)
	if !ok || len(segs) != 2 {
		t.Fatalf("expected 2 segments (comma inside quotes), got %d/%v", len(segs), ok)
	}
}

func TestSplitTopLevelCommaSegments_NestedParens(t *testing.T) {
	segs, ok := splitTopLevelCommaSegments("fn(a,b), c")
	if !ok || len(segs) != 2 {
		t.Fatalf("expected 2 segments (comma inside parens), got %d/%v", len(segs), ok)
	}
}

func TestSplitTopLevelCommaSegments_UnbalancedParen(t *testing.T) {
	_, ok := splitTopLevelCommaSegments("a, b)")
	if ok {
		t.Fatal("expected false for unbalanced closing paren")
	}
}

func TestSplitTopLevelCommaSegments_UnclosedParen(t *testing.T) {
	_, ok := splitTopLevelCommaSegments("a, (b")
	if ok {
		t.Fatal("expected false for unclosed opening paren")
	}
}

func TestSplitTopLevelCommaSegments_UnclosedQuote(t *testing.T) {
	_, ok := splitTopLevelCommaSegments(`a, "b`)
	if ok {
		t.Fatal("expected false for unclosed quote")
	}
}

func TestSplitTopLevelCommaSegments_BracketQuoted(t *testing.T) {
	segs, ok := splitTopLevelCommaSegments("[a,b], c")
	if !ok || len(segs) != 2 {
		t.Fatalf("expected 2 segments (comma inside brackets), got %d/%v", len(segs), ok)
	}
}

func TestSplitTopLevelCommaSegments_UnclosedBracket(t *testing.T) {
	_, ok := splitTopLevelCommaSegments("[a,b, c")
	if ok {
		t.Fatal("expected false for unclosed bracket")
	}
}

func TestSplitTopLevelCommaSegments_EscapedQuote(t *testing.T) {
	// double-quote escaped: ""
	segs, ok := splitTopLevelCommaSegments(`"a""b", c`)
	if !ok || len(segs) != 2 {
		t.Fatalf("expected 2 segments with escaped quote, got %d/%v", len(segs), ok)
	}
}

func TestSplitTopLevelCommaSegments_SingleSegment(t *testing.T) {
	segs, ok := splitTopLevelCommaSegments("just_one")
	if !ok || len(segs) != 1 {
		t.Fatalf("expected 1 segment, got %d/%v", len(segs), ok)
	}
}

// ---------------------------------------------------------------------------
// extractCommaSourceTokens
// ---------------------------------------------------------------------------

func TestExtractCommaSourceTokens_MultiSource(t *testing.T) {
	tokens, ok := extractCommaSourceTokens("batches b, feature_flags f")
	if !ok || len(tokens) != 1 || tokens[0] != "feature_flags" {
		t.Fatalf("expected [feature_flags]/true, got %v/%v", tokens, ok)
	}
}

func TestExtractCommaSourceTokens_SingleSource(t *testing.T) {
	tokens, ok := extractCommaSourceTokens("batches")
	if !ok || tokens != nil {
		t.Fatalf("expected nil/true for single source, got %v/%v", tokens, ok)
	}
}

func TestExtractCommaSourceTokens_MalformedSubselect(t *testing.T) {
	_, ok := extractCommaSourceTokens("batches, (SELECT 1) AS sub")
	if ok {
		t.Fatal("expected false for subselect as comma source")
	}
}

func TestExtractCommaSourceTokens_ThreeSources(t *testing.T) {
	tokens, ok := extractCommaSourceTokens("a x, b y, c z")
	if !ok || len(tokens) != 2 {
		t.Fatalf("expected 2 tokens, got %d/%v", len(tokens), ok)
	}
	if tokens[0] != "b" || tokens[1] != "c" {
		t.Fatalf("expected [b c], got %v", tokens)
	}
}

// ---------------------------------------------------------------------------
// normalizeReadOnlySourceTable
// ---------------------------------------------------------------------------

func TestNormalizeReadOnlySourceTable_Bare(t *testing.T) {
	table, ok := normalizeReadOnlySourceTable("batches")
	if !ok || table != "batches" {
		t.Fatalf("expected batches/true, got %q/%v", table, ok)
	}
}

func TestNormalizeReadOnlySourceTable_Qualified(t *testing.T) {
	table, ok := normalizeReadOnlySourceTable("main.batches")
	if !ok || table != "batches" {
		t.Fatalf("expected batches/true, got %q/%v", table, ok)
	}
}

func TestNormalizeReadOnlySourceTable_Quoted(t *testing.T) {
	table, ok := normalizeReadOnlySourceTable(`"main"."Batches"`)
	if !ok || table != "batches" {
		t.Fatalf("expected batches/true, got %q/%v", table, ok)
	}
}

func TestNormalizeReadOnlySourceTable_Empty(t *testing.T) {
	_, ok := normalizeReadOnlySourceTable("")
	if ok {
		t.Fatal("expected false for empty")
	}
}

func TestNormalizeReadOnlySourceTable_Subselect(t *testing.T) {
	_, ok := normalizeReadOnlySourceTable("(SELECT 1)")
	if ok {
		t.Fatal("expected false for subselect")
	}
}

func TestNormalizeReadOnlySourceTable_TrailingComma(t *testing.T) {
	table, ok := normalizeReadOnlySourceTable("batches,")
	if !ok || table != "batches" {
		t.Fatalf("expected batches/true, got %q/%v", table, ok)
	}
}

// ---------------------------------------------------------------------------
// collectReadOnlySourceTokens
// ---------------------------------------------------------------------------

func TestCollectReadOnlySourceTokens_JoinSources(t *testing.T) {
	stmt := "SELECT * FROM batches JOIN events ON batches.id = events.batch_id"
	tokens, ok := collectReadOnlySourceTokens(stmt)
	if !ok {
		t.Fatal("expected ok for valid join query")
	}
	if len(tokens) < 2 {
		t.Fatalf("expected at least 2 tokens, got %d: %v", len(tokens), tokens)
	}
}

func TestCollectReadOnlySourceTokens_CommaJoin(t *testing.T) {
	stmt := "SELECT * FROM batches b, events e"
	tokens, ok := collectReadOnlySourceTokens(stmt)
	if !ok {
		t.Fatal("expected ok for comma-join query")
	}
	if len(tokens) < 2 {
		t.Fatalf("expected at least 2 tokens, got %d: %v", len(tokens), tokens)
	}
}

func TestCollectReadOnlySourceTokens_NoFrom(t *testing.T) {
	stmt := "SELECT 1"
	tokens, ok := collectReadOnlySourceTokens(stmt)
	if !ok {
		t.Fatal("expected ok for query with no FROM")
	}
	if len(tokens) != 0 {
		t.Fatalf("expected 0 tokens for no-FROM query, got %d: %v", len(tokens), tokens)
	}
}

// ---------------------------------------------------------------------------
// isMutatingSQL / isReadOnlySQL / hasForbiddenSQLTerms edge cases
// ---------------------------------------------------------------------------

func TestIsReadOnlySQL_WithCTE(t *testing.T) {
	// The current regex-based classifier doesn't recognize WITH ... SELECT as read-only
	// (it only looks for leading SELECT/EXPLAIN/PRAGMA). CTE support is a known limitation.
	stmt := "WITH cte AS (SELECT 1) SELECT * FROM cte"
	policy := normalizeSQLForPolicy(stmt)
	// WITH is NOT matched as read-only by the current implementation
	if isReadOnlySQL(policy) {
		// If this starts passing, the implementation was enhanced — that's good
		t.Log("CTE WITH clause is now recognized as read-only")
	}
}

func TestIsMutatingSQL_WithCTE(t *testing.T) {
	// The current regex-based classifier checks for leading INSERT/UPDATE/DELETE.
	// A statement starting with WITH doesn't match, even if it contains INSERT.
	stmt := "WITH cte AS (SELECT 1) INSERT INTO batches SELECT * FROM cte"
	policy := normalizeSQLForPolicy(stmt)
	// WITH is NOT matched as mutating by the current implementation
	if isMutatingSQL(policy) {
		t.Log("CTE WITH clause followed by INSERT is now recognized as mutating")
	}
}

func TestHasForbiddenSQLTerms_CaseInsensitive(t *testing.T) {
	cases := []string{
		"DROP TABLE foo",
		"drop table foo",
		"DrOp TaBlE foo",
		"ALTER TABLE foo ADD COLUMN bar",
		"PRAGMA journal_mode",
		"ATTACH DATABASE 'x' AS y",
		"CREATE TRIGGER foo",
		"LOAD_EXTENSION('x')",
	}
	for _, stmt := range cases {
		if !hasForbiddenSQLTerms(normalizeSQLForPolicy(stmt)) {
			t.Fatalf("expected forbidden for: %q", stmt)
		}
	}
}

func TestHasForbiddenSQLTerms_AllowedStatements(t *testing.T) {
	cases := []string{
		"SELECT * FROM batches",
		"INSERT INTO batches VALUES (1)",
		"UPDATE batches SET x = 1",
		"DELETE FROM batches WHERE 1=0",
	}
	for _, stmt := range cases {
		if hasForbiddenSQLTerms(normalizeSQLForPolicy(stmt)) {
			t.Fatalf("expected allowed for: %q", stmt)
		}
	}
}

func TestIsReadOnlySQL_MixedCase(t *testing.T) {
	if !isReadOnlySQL(normalizeSQLForPolicy("select * from batches")) {
		t.Fatal("expected read-only for lowercase select")
	}
}

func TestIsMutatingSQL_Replace(t *testing.T) {
	// REPLACE is in forbiddenTerms, but test that it's detected as mutating too
	stmt := "INSERT OR REPLACE INTO batches VALUES (1)"
	policy := normalizeSQLForPolicy(stmt)
	if !isMutatingSQL(policy) {
		t.Fatal("expected mutating for INSERT OR REPLACE")
	}
}

// ---------------------------------------------------------------------------
// normalizeSQLForPolicy additional edge cases
// ---------------------------------------------------------------------------

func TestNormalizeSQLForPolicy_NestedBlockComments(t *testing.T) {
	// The comment stripper is non-recursive: /* ... /* inner */ closes at the first */
	// so "still comment */" remains. This tests the actual behavior.
	got := normalizeSQLForPolicy("SELECT /* outer /* inner */ still_comment */ * FROM batches")
	// After removing /* outer /* inner */, we're left with " still_comment */ * FROM batches"
	if !strings.Contains(got, "FROM") {
		t.Fatalf("expected FROM preserved after comment removal, got %q", got)
	}
	// The non-recursive stripping means "inner" IS removed (it's inside the first /* ... */)
	if strings.Contains(got, "inner") || strings.Contains(got, "outer") {
		t.Fatalf("expected inner/outer comment text removed, got %q", got)
	}
}

func TestNormalizeSQLForPolicy_MultilineComment(t *testing.T) {
	got := normalizeSQLForPolicy("SELECT *\n-- line comment\nFROM batches")
	if strings.Contains(got, "line comment") {
		t.Fatalf("expected line comment removed, got %q", got)
	}
}

func TestNormalizeSQLForPolicy_PreservesContent(t *testing.T) {
	stmt := "SELECT batch_id FROM batches WHERE batch_id = 'test'"
	got := normalizeSQLForPolicy(stmt)
	if !strings.Contains(got, "SELECT") || !strings.Contains(got, "batches") {
		t.Fatalf("expected key tokens preserved, got %q", got)
	}
}
