// Package config provides environment-based configuration loading for GoApps Platform services.
package config

import (
	"fmt"

	"github.com/caarlos0/env/v11"
)

// Base holds common configuration shared by all services.
type Base struct {
	AppEnv      string `env:"APP_ENV" envDefault:"development"`
	LogLevel    string `env:"LOG_LEVEL" envDefault:"info"`
	ServiceName string `env:"SERVICE_NAME,required"`
	Port        int    `env:"PORT" envDefault:"8080"`

	// Future integration points — loaded but not used in foundation phase.
	DatabaseURL string `env:"DATABASE_URL"`
	RedisURL    string `env:"REDIS_URL"`
}

// Load parses environment variables into the given config struct.
// The struct may embed Base or extend it with service-specific fields.
func Load(cfg interface{}) error {
	if err := env.Parse(cfg); err != nil {
		return fmt.Errorf("config: failed to parse environment: %w", err)
	}
	return nil
}

// Addr returns the listen address for the HTTP server.
func (b Base) Addr() string {
	return fmt.Sprintf(":%d", b.Port)
}
