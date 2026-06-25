// Package database provides PostgreSQL connectivity for the runtime service.
package database

import (
	"time"

	"github.com/goapps-platform/runtime-service/internal/config"
)

// Config contains database-specific runtime configuration.
type Config struct {
	DSN             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// FromServiceConfig builds database configuration from the service config.
func FromServiceConfig(cfg config.Config) Config {
	db := Config{
		DSN:             cfg.DatabaseURL,
		MaxOpenConns:    cfg.DatabaseMaxOpenConns,
		MaxIdleConns:    cfg.DatabaseMaxIdleConns,
		ConnMaxLifetime: cfg.DatabaseConnMaxLifetime,
	}
	if db.MaxOpenConns == 0 {
		db.MaxOpenConns = 25
	}
	if db.MaxIdleConns == 0 {
		db.MaxIdleConns = 5
	}
	if db.ConnMaxLifetime == 0 {
		db.ConnMaxLifetime = 30 * time.Minute
	}
	return db
}
