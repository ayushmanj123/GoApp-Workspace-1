package records

import (
	"strings"
	"testing"
)

func TestBuildJSONBFilterClauseEqualsAnd(t *testing.T) {
	clause, args, err := buildJSONBFilterClause(FilterExpr{
		Combinator: "And",
		Leaves: []FilterLeaf{
			{Field: "Status", Op: "=", Value: "Active"},
			{Field: "Region", Op: "=", Value: "West"},
		},
	})
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	want := `(data->>'Status') = ? AND (data->>'Region') = ?`
	if clause != want {
		t.Fatalf("clause=%q want %q", clause, want)
	}
	if len(args) != 2 || args[0] != "Active" || args[1] != "West" {
		t.Fatalf("args=%#v", args)
	}
}

func TestBuildJSONBFilterClauseOrAndNumeric(t *testing.T) {
	clause, args, err := buildJSONBFilterClause(FilterExpr{
		Combinator: "Or",
		Leaves: []FilterLeaf{
			{Field: "Amount", Op: ">", Value: "10"},
			{Field: "Status", Op: "=", Value: "Open"},
		},
	})
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if !strings.Contains(clause, `(data->>'Amount')::numeric > ?`) {
		t.Fatalf("expected numeric cast, got %q", clause)
	}
	if !strings.Contains(clause, ` OR `) {
		t.Fatalf("expected OR, got %q", clause)
	}
	if len(args) != 2 {
		t.Fatalf("args=%#v", args)
	}
}

func TestBuildJSONBFilterClauseRejectsBadField(t *testing.T) {
	_, _, err := buildJSONBFilterClause(FilterExpr{
		Leaves: []FilterLeaf{{Field: "Status;drop", Op: "=", Value: "x"}},
	})
	if err == nil {
		t.Fatal("expected invalid field error")
	}
}

func TestBuildJSONBFilterClauseContainsStartsWith(t *testing.T) {
	clause, args, err := buildJSONBFilterClause(FilterExpr{
		Leaves: []FilterLeaf{{Field: "Name", Op: "contains", Value: "ac"}},
	})
	if err != nil {
		t.Fatalf("build contains: %v", err)
	}
	if !strings.Contains(clause, "LOWER") || !strings.Contains(clause, "LIKE") {
		t.Fatalf("expected ILIKE-style clause, got %q", clause)
	}
	if len(args) != 1 || args[0] != "%ac%" {
		t.Fatalf("args=%#v", args)
	}

	clause, args, err = buildJSONBFilterClause(FilterExpr{
		Leaves: []FilterLeaf{{Field: "Name", Op: "startswith", Value: "A"}},
	})
	if err != nil {
		t.Fatalf("build startswith: %v", err)
	}
	if len(args) != 1 || args[0] != "A%" {
		t.Fatalf("args=%#v", args)
	}
}

func TestMatchFilterExprContainsStartsWith(t *testing.T) {
	row := map[string]interface{}{"Name": "Acme Corp"}
	ok := MatchFilterExpr(row, FilterExpr{
		Leaves: []FilterLeaf{{Field: "Name", Op: "contains", Value: "ac"}},
	})
	if !ok {
		t.Fatal("expected contains match")
	}
	ok = MatchFilterExpr(row, FilterExpr{
		Leaves: []FilterLeaf{{Field: "Name", Op: "startswith", Value: "ac"}},
	})
	if !ok {
		t.Fatal("expected startswith match")
	}
}

func TestMatchFilterExprOr(t *testing.T) {
	row := map[string]interface{}{"Status": "Active", "Amount": float64(20)}
	ok := MatchFilterExpr(row, FilterExpr{
		Combinator: "Or",
		Leaves: []FilterLeaf{
			{Field: "Status", Op: "=", Value: "Missing"},
			{Field: "Status", Op: "=", Value: "Active"},
		},
	})
	if !ok {
		t.Fatal("expected Or match")
	}
}
