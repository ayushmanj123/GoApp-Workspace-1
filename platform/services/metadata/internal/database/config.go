// Package database provides PostgreSQL connectivity, migrations, and tenant context helpers.
package database

import (
	"time"

	"github.com/goapps-platform/metadata-service/internal/config"
)

// Config contains database-specific runtime configuration.
type Config struct {
	DSN             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	SlowQuery       time.Duration
}

// FromServiceConfig builds database configuration from the service config.
func FromServiceConfig(cfg config.Config) Config {
	db := Config{
		DSN:             cfg.DatabaseURL,
		MaxOpenConns:    cfg.DatabaseMaxOpenConns,
		MaxIdleConns:    cfg.DatabaseMaxIdleConns,
		ConnMaxLifetime: cfg.DatabaseConnMaxLifetime,
		SlowQuery:       cfg.DatabaseSlowQuery,
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
	if db.SlowQuery == 0 {
		db.SlowQuery = 500 * time.Millisecond
	}
	return db
}
