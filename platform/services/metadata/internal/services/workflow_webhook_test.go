package services

import (
	"crypto/subtle"
	"encoding/json"
	"strings"
	"testing"
)

func TestTruncateJSONPayloadValidJSON(t *testing.T) {
	raw := []byte(`{"hello":"world"}`)
	got := truncateJSONPayload(raw)
	if string(got) != string(raw) {
		t.Fatalf("got %s", got)
	}
}

func TestTruncateJSONPayloadNonJSON(t *testing.T) {
	got := truncateJSONPayload([]byte("not-json"))
	var s string
	if err := json.Unmarshal(got, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if s != "not-json" {
		t.Fatalf("got %q", s)
	}
}

func TestWebhookTokenConstantTimeCompare(t *testing.T) {
	a := "abc"
	b := "abc"
	c := "abd"
	if subtle.ConstantTimeCompare([]byte(a), []byte(b)) != 1 {
		t.Fatal("expected match")
	}
	if subtle.ConstantTimeCompare([]byte(a), []byte(c)) == 1 {
		t.Fatal("expected mismatch")
	}
}

func TestGenerateWebhookToken(t *testing.T) {
	tok, err := generateWebhookToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(tok) < 20 {
		t.Fatalf("token too short: %q", tok)
	}
	tok2, err := generateWebhookToken()
	if err != nil {
		t.Fatal(err)
	}
	if tok == tok2 {
		t.Fatal("tokens should differ")
	}
	if strings.ContainsAny(tok, "+/=") {
		// RawURLEncoding should avoid +/
		t.Fatalf("unexpected chars in token: %q", tok)
	}
}
