package response_test

import (
	"encoding/json"
	"testing"

	"github.com/goapps-platform/shared/response"
)

func TestOK(t *testing.T) {
	env := response.OK(map[string]string{"key": "value"}, "req-123")

	if !env.Success {
		t.Fatal("expected success=true")
	}
	if env.Error != nil {
		t.Fatal("expected no error")
	}
	if env.Meta == nil || env.Meta.RequestID != "req-123" {
		t.Fatalf("expected requestId req-123, got %+v", env.Meta)
	}
}

func TestFail(t *testing.T) {
	env := response.Fail("BAD_REQUEST", "invalid input", "req-456")

	if env.Success {
		t.Fatal("expected success=false")
	}
	if env.Error == nil || env.Error.Code != "BAD_REQUEST" {
		t.Fatalf("expected BAD_REQUEST error, got %+v", env.Error)
	}
	if env.Meta == nil || env.Meta.RequestID != "req-456" {
		t.Fatalf("expected requestId req-456, got %+v", env.Meta)
	}
}

func TestEnvelopeJSON(t *testing.T) {
	env := response.OK("data", "req-789")
	b, err := json.Marshal(env)
	if err != nil {
		t.Fatal(err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(b, &parsed); err != nil {
		t.Fatal(err)
	}
	if parsed["success"] != true {
		t.Fatal("expected success field in JSON")
	}
}
