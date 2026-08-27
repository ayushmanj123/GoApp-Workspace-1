package ssrf

import (
	"testing"
)

func TestValidateHTTPURLAllowsPublicHTTPS(t *testing.T) {
	t.Setenv("REST_SSRF_ALLOW_PRIVATE", "")
	if err := ValidateHTTPURL("https://example.com/api"); err != nil {
		t.Fatalf("expected allow: %v", err)
	}
}

func TestValidateHTTPURLBlocksLocalhost(t *testing.T) {
	t.Setenv("REST_SSRF_ALLOW_PRIVATE", "")
	if err := ValidateHTTPURL("http://localhost:8080/secret"); err == nil {
		t.Fatal("expected block")
	}
}

func TestValidateHTTPURLBlocksFileScheme(t *testing.T) {
	t.Setenv("REST_SSRF_ALLOW_PRIVATE", "")
	if err := ValidateHTTPURL("file:///etc/passwd"); err == nil {
		t.Fatal("expected block")
	}
}

func TestValidateHTTPURLAllowPrivateEscape(t *testing.T) {
	t.Setenv("REST_SSRF_ALLOW_PRIVATE", "true")
	if err := ValidateHTTPURL("http://127.0.0.1:9000/x"); err != nil {
		t.Fatalf("expected allow with escape hatch: %v", err)
	}
}
