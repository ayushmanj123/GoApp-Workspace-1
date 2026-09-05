package form

import "testing"

func TestReadDataSourceValueWrapper(t *testing.T) {
	got := ReadDataSource(map[string]interface{}{
		"dataSource": map[string]interface{}{"value": "GoSheetsOne"},
	})
	if got != "GoSheetsOne" {
		t.Fatalf("expected GoSheetsOne, got %q", got)
	}
}

func TestParseModeVariants(t *testing.T) {
	cases := map[string]Mode{
		"New":       ModeNew,
		"new":       ModeNew,
		"New mode":  ModeNew,
		"Edit":      ModeEdit,
		"edit mode": ModeEdit,
		"View":      ModeView,
		"view mode": ModeView,
	}
	for input, want := range cases {
		if got := parseMode(input); got != want {
			t.Fatalf("parseMode(%q) = %s, want %s", input, got, want)
		}
	}
}
