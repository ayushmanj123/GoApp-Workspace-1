package databinding

import (
	"context"
	"errors"
	"fmt"

	"github.com/goapps-platform/shared/secrets"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type envSecretOverrideRow struct {
	Ciphertext []byte `gorm:"column:ciphertext"`
	Nonce      []byte `gorm:"column:nonce"`
}

func (envSecretOverrideRow) TableName() string { return "environment_secret_overrides" }

// decryptSecretPlaintext loads a secret by id. When environmentID is non-nil,
// an environment_secret_overrides row for (env, base_secret) wins if present.
func decryptSecretPlaintext(
	ctx context.Context,
	db *gorm.DB,
	masterKey []byte,
	tenantID, secretID uuid.UUID,
	environmentID *uuid.UUID,
) (string, error) {
	if len(masterKey) == 0 {
		return "", fmt.Errorf("databinding: secrets master key is not configured")
	}
	if environmentID != nil && *environmentID != uuid.Nil {
		var override envSecretOverrideRow
		err := db.WithContext(ctx).
			Where(
				"tenant_id = ? AND environment_id = ? AND base_secret_id = ? AND deleted_at IS NULL",
				tenantID, *environmentID, secretID,
			).
			First(&override).Error
		if err == nil {
			plain, err := secrets.Decrypt(masterKey, override.Ciphertext, override.Nonce)
			if err != nil {
				return "", fmt.Errorf("databinding: decrypt environment secret override: %w", err)
			}
			return string(plain), nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return "", fmt.Errorf("databinding: load environment secret override: %w", err)
		}
	}

	var sec secretRow
	err := db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", secretID, tenantID).
		First(&sec).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", fmt.Errorf("databinding: connector secret not found")
	}
	if err != nil {
		return "", fmt.Errorf("databinding: load connector secret: %w", err)
	}
	plain, err := secrets.Decrypt(masterKey, sec.Ciphertext, sec.Nonce)
	if err != nil {
		return "", fmt.Errorf("databinding: decrypt connector secret: %w", err)
	}
	return string(plain), nil
}
