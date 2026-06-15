// Package config loads auth-service configuration from environment variables.
package config

import (
	"github.com/goapps-platform/shared/config"
)

// Config holds auth-service specific configuration.
type Config struct {
	config.Base
}

// Load reads configuration from the environment.
func Load() (Config, error) {
	var cfg Config
	if err := config.Load(&cfg); err != nil {
		return Config{}, err
	}
	return cfg, nil
}
