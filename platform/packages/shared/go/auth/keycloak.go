package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// KeycloakTokenValidator validates Keycloak-issued JWTs via JWKS.
type KeycloakTokenValidator struct {
	cfg        Config
	httpClient *http.Client

	mu     sync.RWMutex
	keys   map[string]*rsa.PublicKey
	fetchedAt time.Time
}

func NewKeycloakTokenValidator(cfg Config) *KeycloakTokenValidator {
	return &KeycloakTokenValidator{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		keys: map[string]*rsa.PublicKey{},
	}
}

func (v *KeycloakTokenValidator) Validate(ctx context.Context, tokenString string) (*AuthContext, error) {
	tokenString = strings.TrimSpace(tokenString)
	if tokenString == "" {
		return nil, ErrInvalidToken
	}
	if err := v.cfg.ValidateKeycloak(); err != nil {
		return nil, err
	}

	parser := jwt.NewParser(jwt.WithValidMethods([]string{"RS256"}))
	claims := &keycloakClaims{}
	token, err := parser.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, ErrInvalidToken
		}
		return v.publicKey(ctx, kid)
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	if err := v.validateStandardClaims(claims); err != nil {
		return nil, err
	}

	userID, err := uuid.Parse(strings.TrimSpace(claims.Subject))
	if err != nil {
		return nil, ErrInvalidToken
	}
	tenantID, err := resolveTenantID(claims)
	if err != nil {
		return nil, err
	}

	email := strings.TrimSpace(claims.Email)
	if email == "" {
		email = strings.TrimSpace(claims.PreferredUsername)
	}

	return &AuthContext{
		UserID:          userID,
		TenantID:        tenantID,
		Email:           email,
		Roles:           claims.roles(v.cfg.KeycloakClientID),
		IsAuthenticated: true,
	}, nil
}

func (v *KeycloakTokenValidator) validateStandardClaims(claims *keycloakClaims) error {
	issuer := strings.TrimRight(v.cfg.KeycloakURL, "/") + "/realms/" + v.cfg.KeycloakRealm
	if claims.Issuer != issuer {
		return ErrInvalidToken
	}
	if v.cfg.KeycloakAudience != "" {
		audOK := false
		for _, aud := range claims.Audience {
			if aud == v.cfg.KeycloakAudience || aud == v.cfg.KeycloakClientID {
				audOK = true
				break
			}
		}
		if !audOK && claims.AuthorizedParty != v.cfg.KeycloakAudience && claims.AuthorizedParty != v.cfg.KeycloakClientID {
			return ErrInvalidToken
		}
	}
	if claims.ExpiresAt == nil || claims.ExpiresAt.Time.Before(time.Now().Add(-30*time.Second)) {
		return ErrInvalidToken
	}
	return nil
}

func resolveTenantID(claims *keycloakClaims) (uuid.UUID, error) {
	candidates := []string{
		claims.TenantID,
		claims.GoAppsTenantID,
	}
	if claims.Organization != nil {
		candidates = append(candidates, claims.Organization.ID)
	}
	for _, raw := range candidates {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		id, err := uuid.Parse(raw)
		if err == nil {
			return id, nil
		}
	}
	return uuid.Nil, ErrInvalidToken
}

func (v *KeycloakTokenValidator) publicKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.RLock()
	key, ok := v.keys[kid]
	fresh := time.Since(v.fetchedAt) < 10*time.Minute
	v.mu.RUnlock()
	if ok && fresh {
		return key, nil
	}
	if err := v.refreshJWKS(ctx); err != nil {
		return nil, err
	}
	v.mu.RLock()
	defer v.mu.RUnlock()
	key, ok = v.keys[kid]
	if !ok {
		return nil, ErrInvalidToken
	}
	return key, nil
}

func (v *KeycloakTokenValidator) refreshJWKS(ctx context.Context) error {
	url := strings.TrimRight(v.cfg.KeycloakURL, "/") + "/realms/" + v.cfg.KeycloakRealm + "/protocol/openid-connect/certs"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := v.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("keycloak jwks fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("keycloak jwks status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	var doc jwksDocument
	if err := json.Unmarshal(body, &doc); err != nil {
		return err
	}
	keys := make(map[string]*rsa.PublicKey, len(doc.Keys))
	for _, jwk := range doc.Keys {
		if jwk.Kty != "RSA" || jwk.Kid == "" || jwk.N == "" || jwk.E == "" {
			continue
		}
		pub, err := rsaPublicKeyFromJWK(jwk.N, jwk.E)
		if err != nil {
			continue
		}
		keys[jwk.Kid] = pub
	}
	if len(keys) == 0 {
		return fmt.Errorf("keycloak jwks: no rsa keys")
	}
	v.mu.Lock()
	v.keys = keys
	v.fetchedAt = time.Now()
	v.mu.Unlock()
	return nil
}

type jwksDocument struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func rsaPublicKeyFromJWK(nB64, eB64 string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nB64)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eB64)
	if err != nil {
		return nil, err
	}
	var eInt int
	for _, b := range eBytes {
		eInt = eInt<<8 + int(b)
	}
	if eInt == 0 {
		return nil, fmt.Errorf("invalid exponent")
	}
	return &rsa.PublicKey{
		N: new(big.Int).SetBytes(nBytes),
		E: eInt,
	}, nil
}

type keycloakClaims struct {
	jwt.RegisteredClaims
	Email             string              `json:"email"`
	PreferredUsername string              `json:"preferred_username"`
	TenantID          string              `json:"tenant_id"`
	GoAppsTenantID    string              `json:"goapps_tenant_id"`
	AuthorizedParty   string              `json:"azp"`
	Organization      *keycloakOrgClaim   `json:"organization"`
	RealmAccess       keycloakRealmAccess `json:"realm_access"`
	ResourceAccess    map[string]keycloakRealmAccess `json:"resource_access"`
}

type keycloakOrgClaim struct {
	ID string `json:"id"`
}

type keycloakRealmAccess struct {
	Roles []string `json:"roles"`
}

func (c *keycloakClaims) roles(clientID string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(c.RealmAccess.Roles)+4)
	add := func(roles []string) {
		for _, role := range roles {
			role = strings.TrimSpace(role)
			if role == "" {
				continue
			}
			if _, ok := seen[role]; ok {
				continue
			}
			seen[role] = struct{}{}
			out = append(out, role)
		}
	}
	add(c.RealmAccess.Roles)
	if clientID != "" {
		if ra, ok := c.ResourceAccess[clientID]; ok {
			add(ra.Roles)
		}
	}
	return out
}
