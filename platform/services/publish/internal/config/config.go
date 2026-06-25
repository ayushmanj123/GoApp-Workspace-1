package config

import "github.com/goapps-platform/shared/config"

type Config struct {
	config.Base
	MetadataServiceURL string `env:"METADATA_SERVICE_URL" envDefault:"http://localhost:8082"`
}

func Load() (Config, error) {
	var cfg Config
	if err := config.Load(&cfg); err != nil {
		return Config{}, err
	}
	return cfg, nil
}
