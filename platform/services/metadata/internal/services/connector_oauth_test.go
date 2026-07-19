package services

import (
	"strings"
	"testing"
)

func TestPkceChallengeS256Deterministic(t *testing.T) {
	// RFC 7636 appendix B example verifier/challenge (base64url).
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	got := pkceChallengeS256(verifier)
	want := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	if got != want {
		t.Fatalf("challenge=%q want %q", got, want)
	}
}

func TestConnectorOAuthRedirectURIDefault(t *testing.T) {
	t.Setenv("OAUTH_CONNECTOR_REDIRECT_URI", "")
	if !strings.Contains(connectorOAuthRedirectURI(), "/connectors/oauth/callback") {
		t.Fatalf("unexpected default redirect: %s", connectorOAuthRedirectURI())
	}
}

func TestConnectorOAuthRuntimeReturnURLDefault(t *testing.T) {
	t.Setenv("OAUTH_CONNECTOR_RUNTIME_RETURN_URL", "")
	got := connectorOAuthRuntimeReturnURL()
	if !strings.Contains(got, "5174") || !strings.Contains(got, "oauth=connected") {
		t.Fatalf("unexpected default runtime return: %s", got)
	}
}

func TestNormalizeOAuthReturnTo(t *testing.T) {
	if normalizeOAuthReturnTo("runtime") != "runtime" {
		t.Fatal("expected runtime")
	}
	if normalizeOAuthReturnTo("") != "studio" {
		t.Fatal("expected studio default")
	}
}

func TestNormalizeConnectionScope(t *testing.T) {
	if normalizeConnectionScope("USER") != "user" {
		t.Fatal("expected user")
	}
	if normalizeConnectionScope("app") != "app" {
		t.Fatal("expected app")
	}
}
