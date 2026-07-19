package databinding

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestResolveAuthSecretKeepsLegacyHeaderValue(t *testing.T) {
	r := &PostgresRestConnectorRepository{}
	auth := &RestAuthConfig{
		Type:        "header",
		HeaderName:  "X-Api-Key",
		HeaderValue: "legacy-plain",
	}
	if err := r.resolveAuthSecret(context.Background(), uuid.New(), uuid.Nil, nil, uuid.Nil, auth); err != nil {
		t.Fatalf("resolveAuthSecret: %v", err)
	}
	if auth.HeaderValue != "legacy-plain" {
		t.Fatalf("expected legacy header value preserved, got %q", auth.HeaderValue)
	}
}

func TestResolveAuthSecretRequiresMasterKey(t *testing.T) {
	r := &PostgresRestConnectorRepository{}
	auth := &RestAuthConfig{
		Type:     "header",
		SecretID: uuid.New().String(),
	}
	err := r.resolveAuthSecret(context.Background(), uuid.New(), uuid.Nil, nil, uuid.Nil, auth)
	if err == nil {
		t.Fatalf("expected error when master key is missing")
	}
}
