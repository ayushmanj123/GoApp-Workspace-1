// Package config loads runtime-service configuration from environment variables.
package config

import (
	"time"

	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/config"
)

// Config holds runtime-service configuration.
type Config struct {
	config.Base
	Auth                    auth.Config
	DatabaseMaxOpenConns    int           `env:"DATABASE_MAX_OPEN_CONNS" envDefault:"25"`
	DatabaseMaxIdleConns    int           `env:"DATABASE_MAX_IDLE_CONNS" envDefault:"5"`
	DatabaseConnMaxLifetime time.Duration `env:"DATABASE_CONN_MAX_LIFETIME" envDefault:"30m"`
	SessionTTL              time.Duration `env:"SESSION_TTL" envDefault:"30m"`
	SessionMax              int           `env:"SESSION_MAX" envDefault:"0"`
	MetadataCacheTTL        time.Duration `env:"METADATA_CACHE_TTL" envDefault:"5m"`
	MetricsEnabled          bool          `env:"METRICS_ENABLED" envDefault:"true"`
}

// Load reads configuration from the environment.
func Load() (Config, error) {
	var cfg Config
	if err := config.Load(&cfg); err != nil {
		return Config{}, err
	}
	authCfg, err := auth.LoadConfig()
	if err != nil {
		return Config{}, err
	}
	cfg.Auth = authCfg
	return cfg, nil
}
