package auth

import (
	"testing"
)

func TestValidateRejectsDevelopmentInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	cfg := Config{Mode: ModeDevelopment}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected error when AUTH_MODE=development and APP_ENV=production")
	}
}

func TestValidateAllowsDevelopmentOutsideProduction(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	cfg := Config{Mode: ModeDevelopment}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
