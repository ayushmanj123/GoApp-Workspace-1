package services

import "testing"

func TestValidateSQLTableName(t *testing.T) {
	cases := []struct {
		in    string
		ok    bool
	}{
		{"orders", true},
		{"public.orders", true},
		{"_private", true},
		{"", true},
		{"public.orders.extra", false},
		{"public;drop", false},
		{"orders-1", false},
		{"public.Orders", true},
	}
	for _, tc := range cases {
		err := ValidateSQLTableName(tc.in)
		if tc.ok && err != nil {
			t.Fatalf("%q: expected ok, got %v", tc.in, err)
		}
		if !tc.ok && err == nil {
			t.Fatalf("%q: expected error", tc.in)
		}
	}
}

func TestValidateSQLPrimaryKey(t *testing.T) {
	if err := ValidateSQLPrimaryKey(""); err != nil {
		t.Fatalf("empty ok: %v", err)
	}
	if err := ValidateSQLPrimaryKey("id"); err != nil {
		t.Fatalf("id ok: %v", err)
	}
	if err := ValidateSQLPrimaryKey("id;drop"); err == nil {
		t.Fatalf("expected invalid pk error")
	}
}
