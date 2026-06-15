package database

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// setTenantContext sets app.tenant_id for the current transaction. (unexported)
func setTenantContext(ctx context.Context, tx *gorm.DB, tenantID uuid.UUID) error {
	if tx == nil {
		return fmt.Errorf("database: nil transaction")
	}
	if tenantID == uuid.Nil {
		return fmt.Errorf("database: tenant id is required")
	}
	if err := tx.WithContext(ctx).
		Exec("SELECT set_config('app.tenant_id', ?, true)", tenantID.String()).
		Error; err != nil {
		return fmt.Errorf("database: set tenant context: %w", err)
	}
	return nil
}

// clearTenantContext clears app.tenant_id for the current transaction. (unexported)
func clearTenantContext(ctx context.Context, tx *gorm.DB) error {
	if tx == nil {
		return fmt.Errorf("database: nil transaction")
	}
	if err := tx.WithContext(ctx).
		Exec("SELECT set_config('app.tenant_id', '', true)").
		Error; err != nil {
		return fmt.Errorf("database: clear tenant context: %w", err)
	}
	return nil
}

// WithTenantContext executes fn inside a transaction with app.tenant_id set.
func WithTenantContext(ctx context.Context, db *gorm.DB, tenantID uuid.UUID, fn func(tx *gorm.DB) error) error {
	if db == nil {
		return fmt.Errorf("database: nil database")
	}
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := setTenantContext(ctx, tx, tenantID); err != nil {
			return err
		}
		return fn(tx)
	})
}
