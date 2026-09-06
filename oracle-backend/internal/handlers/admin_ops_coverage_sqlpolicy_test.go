package handlers

import (
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// normalizeSingleStatement
// ---------------------------------------------------------------------------

func TestNormalizeSingleStatement_Valid(t *testing.T) {
	stmt, err := normalizeSingleStatement("SELECT * FROM feature_flags;")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(stmt, "SELECT") {
		t.Fatalf("expected normalized to start with SELECT, got %q", stmt)
	}
}

func TestNormalizeSingleStatement_Empty(t *testing.T) {
	_, err := normalizeSingleStatement("")
	if err == nil {
		t.Fatal("expected error for empty statement")
	}
}

func TestNormalizeSingleStatement_Multiple(t *testing.T) {
	_, err := normalizeSingleStatement("SELECT 1; SELECT 2;")
	if err == nil {
		t.Fatal("expected error for multiple statements")
	}
}

// ---------------------------------------------------------------------------
// mutatingTargetTable
// ---------------------------------------------------------------------------

func TestMutatingTargetTable_Update(t *testing.T) {
	table, ok := mutatingTargetTable("UPDATE feature_flags SET enabled = 1")
	if !ok || table != "feature_flags" {
		t.Fatalf("expected feature_flags/true, got %q/%v", table, ok)
	}
}

func TestMutatingTargetTable_Insert(t *testing.T) {
	table, ok := mutatingTargetTable("INSERT INTO batches VALUES ()")
	if !ok || table != "batches" {
		t.Fatalf("expected batches/true, got %q/%v", table, ok)
	}
}

func TestMutatingTargetTable_Delete(t *testing.T) {
	table, ok := mutatingTargetTable("DELETE FROM batches WHERE 1=1")
	if !ok || table != "batches" {
		t.Fatalf("expected batches/true, got %q/%v", table, ok)
	}
}

func TestMutatingTargetTable_Select(t *testing.T) {
	table, ok := mutatingTargetTable("SELECT * FROM feature_flags")
	if ok || table != "" {
		t.Fatalf("expected empty/false for SELECT, got %q/%v", table, ok)
	}
}

// ---------------------------------------------------------------------------
// isAllowedReadOnlyQuery
// ---------------------------------------------------------------------------

func TestIsAllowedReadOnlyQuery_Valid(t *testing.T) {
	// feature_flags IS restricted, use batches instead
	if !isAllowedReadOnlyQuery("SELECT * FROM batches") {
		t.Fatal("expected allowed for batches")
	}
}

func TestIsAllowedReadOnlyQuery_RestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery("SELECT * FROM admin_audit_log") {
		t.Fatal("expected rejected for admin_audit_log")
	}
}

func TestIsAllowedReadOnlyQuery_FeatureFlagsRestricted(t *testing.T) {
	if isAllowedReadOnlyQuery("SELECT * FROM feature_flags") {
		t.Fatal("expected rejected for feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_QuotedRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM "feature_flags"`) {
		t.Fatal("expected rejected for quoted feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_QualifiedRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM main.feature_flags`) {
		t.Fatal("expected rejected for qualified feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_QualifiedQuotedRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM "main"."feature_flags"`) {
		t.Fatal("expected rejected for quoted qualified feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_BacktickRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery("SELECT * FROM `feature_flags`") {
		t.Fatal("expected rejected for backtick-quoted feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_BracketRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery("SELECT * FROM [feature_flags]") {
		t.Fatal("expected rejected for bracket-quoted feature_flags")
	}
}

func TestIsAllowedReadOnlyQuery_MalformedSourceFailsClosed(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM "main"."feature_flags`) {
		t.Fatal("expected malformed quoted source to be rejected")
	}
}

func TestIsAllowedReadOnlyQuery_CommentObfuscatedRestrictedTable(t *testing.T) {
	stmt := normalizeSQLForPolicy(`SELECT * FROM/* bypass */feature_flags`)
	if isAllowedReadOnlyQuery(stmt) {
		t.Fatal("expected rejected for comment-obfuscated restricted table")
	}
}

func TestIsAllowedReadOnlyQuery_CommaJoinRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM batches, feature_flags`) {
		t.Fatal("expected rejected for comma-joined restricted table")
	}
}

func TestIsAllowedReadOnlyQuery_CommaJoinQuotedRestrictedTable(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM batches b, "main"."feature_flags" f`) {
		t.Fatal("expected rejected for comma-joined quoted restricted table")
	}
}

func TestIsAllowedReadOnlyQuery_CommaJoinMalformedFailsClosed(t *testing.T) {
	if isAllowedReadOnlyQuery(`SELECT * FROM batches, "feature_flags`) {
		t.Fatal("expected malformed comma source to be rejected")
	}
}

func TestNormalizeSQLForPolicy_RemovesDashComments(t *testing.T) {
	got := normalizeSQLForPolicy("SELECT * FROM batches -- trailing comment")
	if strings.Contains(got, "--") {
		t.Fatalf("expected dash comments to be removed, got %q", got)
	}
}

func TestNormalizeSQLForPolicy_RemovesBlockComments(t *testing.T) {
	got := normalizeSQLForPolicy("SELECT /* hidden */ * FROM batches")
	if strings.Contains(got, "hidden") {
		t.Fatalf("expected block comments to be removed, got %q", got)
	}
}

// ---------------------------------------------------------------------------
// truncateSQLForAudit
// ---------------------------------------------------------------------------

func TestTruncateSQLForAudit_Short(t *testing.T) {
	s := truncateSQLForAudit("SELECT 1")
	if s != "SELECT 1" {
		t.Fatalf("expected unchanged short string, got %q", s)
	}
}

func TestTruncateSQLForAudit_Long(t *testing.T) {
	long := strings.Repeat("x", 2000)
	s := truncateSQLForAudit(long)
	if len(s) > 1024 {
		t.Fatalf("expected truncated to <=1024, got %d", len(s))
	}
}
