// Package config loads gateway-service configuration from environment variables.
package config

import (
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/config"
)

// Config holds gateway-service configuration.
type Config struct {
	config.Base
	Auth                auth.Config
	MetadataServiceURL  string `env:"METADATA_SERVICE_URL" envDefault:"http://localhost:8082"`
	PublishServiceURL   string `env:"PUBLISH_SERVICE_URL" envDefault:"http://localhost:8085"`
	RuntimeServiceURL   string `env:"RUNTIME_SERVICE_URL" envDefault:"http://localhost:8083"`
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
