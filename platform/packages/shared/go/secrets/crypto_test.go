package secrets

import (
	"bytes"
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := []byte(devDefaultKey)
	plain := []byte("super-secret-api-key")
	ct, nonce, err := Encrypt(key, plain)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if len(ct) == 0 || len(nonce) == 0 {
		t.Fatalf("expected ciphertext and nonce")
	}
	if bytes.Contains(ct, plain) {
		t.Fatalf("ciphertext must not contain plaintext")
	}
	out, err := Decrypt(key, ct, nonce)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if !bytes.Equal(out, plain) {
		t.Fatalf("got %q want %q", out, plain)
	}
}

func TestDecryptRejectsTamperedCiphertext(t *testing.T) {
	key := []byte(devDefaultKey)
	ct, nonce, err := Encrypt(key, []byte("value"))
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	ct[0] ^= 0xff
	if _, err := Decrypt(key, ct, nonce); err == nil {
		t.Fatalf("expected decrypt failure")
	}
}

func TestLoadMasterKeyDevDefault(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv(envMasterKey, "")
	key, err := LoadMasterKey(true)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if !bytes.Equal(key, []byte(devDefaultKey)) {
		t.Fatalf("unexpected default key")
	}
}

func TestLoadMasterKeyRejectsDefaultInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv(envMasterKey, "")
	if _, err := LoadMasterKey(true); err == nil {
		t.Fatal("expected missing master key in production")
	}
	if _, err := LoadMasterKeyFromEnv(); err == nil {
		t.Fatal("expected LoadMasterKeyFromEnv to fail in production without key")
	}
}
