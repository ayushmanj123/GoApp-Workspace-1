package secrets

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

const (
	envMasterKey  = "SECRETS_MASTER_KEY"
	devDefaultKey = "goapps-dev-secrets-key-32bytes!!" // 32 bytes; local/dev only
)

var (
	ErrMissingMasterKey = errors.New("secrets: SECRETS_MASTER_KEY is required outside development")
	ErrInvalidMasterKey = errors.New("secrets: SECRETS_MASTER_KEY must decode to 16, 24, or 32 bytes")
	ErrDecryptFailed    = errors.New("secrets: decrypt failed")
)

// LoadMasterKey reads SECRETS_MASTER_KEY (base64, hex, or raw 32-byte string).
// When unset and allowDevDefault is true, returns a documented development key.
func LoadMasterKey(allowDevDefault bool) ([]byte, error) {
	raw := strings.TrimSpace(os.Getenv(envMasterKey))
	if raw == "" {
		if allowDevDefault {
			return []byte(devDefaultKey), nil
		}
		return nil, ErrMissingMasterKey
	}
	if decoded, err := base64.StdEncoding.DecodeString(raw); err == nil && validKeyLen(decoded) {
		return decoded, nil
	}
	if decoded, err := hex.DecodeString(raw); err == nil && validKeyLen(decoded) {
		return decoded, nil
	}
	if validKeyLen([]byte(raw)) {
		return []byte(raw), nil
	}
	return nil, ErrInvalidMasterKey
}

func validKeyLen(key []byte) bool {
	n := len(key)
	return n == 16 || n == 24 || n == 32
}

// Encrypt encrypts plaintext with AES-GCM. Returns ciphertext and nonce.
func Encrypt(masterKey, plaintext []byte) (ciphertext, nonce []byte, err error) {
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, nil, fmt.Errorf("secrets: aes cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("secrets: gcm: %w", err)
	}
	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("secrets: nonce: %w", err)
	}
	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return ciphertext, nonce, nil
}

// Decrypt decrypts AES-GCM ciphertext using the given nonce.
func Decrypt(masterKey, ciphertext, nonce []byte) ([]byte, error) {
	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, fmt.Errorf("secrets: aes cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("secrets: gcm: %w", err)
	}
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, ErrDecryptFailed
	}
	return plain, nil
}
