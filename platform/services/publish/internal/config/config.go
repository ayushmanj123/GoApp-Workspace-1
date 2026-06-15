package config

import "github.com/goapps-platform/shared/config"

type Config struct {
	config.Base
}

func Load() (Config, error) {
	var cfg Config
	if err := config.Load(&cfg); err != nil {
		return Config{}, err
	}
	return cfg, nil
}
