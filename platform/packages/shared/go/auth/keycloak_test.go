package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestKeycloakTokenValidatorAcceptsSignedJWT(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	kid := "test-key-1"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/realms/goapps/protocol/openid-connect/certs" {
			http.NotFound(w, r)
			return
		}
		n := base64.RawURLEncoding.EncodeToString(privateKey.N.Bytes())
		e := base64.RawURLEncoding.EncodeToString(big.NewInt(int64(privateKey.E)).Bytes())
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"keys": []map[string]string{
				{"kty": "RSA", "kid": kid, "n": n, "e": e, "alg": "RS256", "use": "sig"},
			},
		})
	}))
	defer server.Close()

	tenantID := uuid.MustParse("00000000-0000-4000-8000-000000000001")
	userID := uuid.MustParse("00000000-0000-4000-8000-000000000002")
	cfg := Config{
		Mode:             ModeKeycloak,
		KeycloakURL:      server.URL,
		KeycloakRealm:    "goapps",
		KeycloakClientID: "goapps-platform",
		KeycloakAudience: "goapps-platform",
	}
	validator := NewKeycloakTokenValidator(cfg)
	validator.httpClient = server.Client()

	claims := &keycloakClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			Issuer:    server.URL + "/realms/goapps",
			Audience:  []string{"goapps-platform"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		Email:    "user@example.com",
		TenantID: tenantID.String(),
		RealmAccess: keycloakRealmAccess{
			Roles: []string{"PlatformAdmin"},
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kid
	signed, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	ac, err := validator.Validate(context.Background(), signed)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if ac.TenantID != tenantID || ac.UserID != userID {
		t.Fatalf("unexpected identity: %+v", ac)
	}
	if ac.Email != "user@example.com" {
		t.Fatalf("unexpected email: %s", ac.Email)
	}
	if len(ac.Roles) != 1 || ac.Roles[0] != "PlatformAdmin" {
		t.Fatalf("unexpected roles: %#v", ac.Roles)
	}
}

func TestKeycloakTokenValidatorRejectsInvalidToken(t *testing.T) {
	cfg := Config{
		Mode:          ModeKeycloak,
		KeycloakURL:   "http://localhost:8080",
		KeycloakRealm: "goapps",
	}
	validator := NewKeycloakTokenValidator(cfg)
	if _, err := validator.Validate(context.Background(), "not-a-jwt"); err == nil {
		t.Fatalf("expected invalid token error")
	}
}
