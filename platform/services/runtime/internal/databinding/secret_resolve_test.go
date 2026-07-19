package databinding

import (
	"context"
	"testing"

	"github.com/goapps-platform/shared/secrets"
	"github.com/google/uuid"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestDecryptSecretPlaintextPrefersEnvironmentOverride(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`CREATE TABLE secrets (
		id TEXT PRIMARY KEY, tenant_id TEXT, ciphertext BLOB, nonce BLOB, deleted_at DATETIME
	)`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`CREATE TABLE environment_secret_overrides (
		id TEXT PRIMARY KEY, tenant_id TEXT, environment_id TEXT, base_secret_id TEXT,
		ciphertext BLOB, nonce BLOB, deleted_at DATETIME
	)`).Error; err != nil {
		t.Fatal(err)
	}

	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	tenantID := uuid.New()
	secretID := uuid.New()
	envID := uuid.New()

	baseCT, baseNonce, err := secrets.Encrypt(key, []byte("base-secret"))
	if err != nil {
		t.Fatal(err)
	}
	envCT, envNonce, err := secrets.Encrypt(key, []byte("env-secret"))
	if err != nil {
		t.Fatal(err)
	}

	if err := db.Exec(
		`INSERT INTO secrets (id, tenant_id, ciphertext, nonce) VALUES (?, ?, ?, ?)`,
		secretID.String(), tenantID.String(), baseCT, baseNonce,
	).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(
		`INSERT INTO environment_secret_overrides (id, tenant_id, environment_id, base_secret_id, ciphertext, nonce)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		uuid.New().String(), tenantID.String(), envID.String(), secretID.String(), envCT, envNonce,
	).Error; err != nil {
		t.Fatal(err)
	}

	got, err := decryptSecretPlaintext(context.Background(), db, key, tenantID, secretID, &envID)
	if err != nil {
		t.Fatal(err)
	}
	if got != "env-secret" {
		t.Fatalf("expected env override, got %q", got)
	}

	gotBase, err := decryptSecretPlaintext(context.Background(), db, key, tenantID, secretID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if gotBase != "base-secret" {
		t.Fatalf("expected base secret, got %q", gotBase)
	}
}

func TestEnvironmentIDContext(t *testing.T) {
	id := uuid.New()
	ctx := WithEnvironmentID(context.Background(), &id)
	got := EnvironmentIDFromContext(ctx)
	if got == nil || *got != id {
		t.Fatalf("expected %s, got %v", id, got)
	}
}
