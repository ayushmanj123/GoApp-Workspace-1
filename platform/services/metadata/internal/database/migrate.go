package database

import (
	"embed"
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

// Migrator runs versioned database migrations.
type Migrator struct {
	db *gorm.DB
}

// NewMigrator creates a migration runner backed by the GORM connection pool.
func NewMigrator(db *gorm.DB) *Migrator {
	return &Migrator{db: db}
}

// Up applies all pending migrations.
func (m *Migrator) Up() error {
	runner, err := m.runner()
	if err != nil {
		return err
	}
	defer runner.Close()

	if err := runner.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("database: migrate up: %w", err)
	}
	return nil
}

// Down rolls back all migrations. This is intended for controlled development and CI flows.
func (m *Migrator) Down() error {
	runner, err := m.runner()
	if err != nil {
		return err
	}
	defer runner.Close()

	if err := runner.Down(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("database: migrate down: %w", err)
	}
	return nil
}

// Steps applies n migration steps. Positive values migrate up, negative values migrate down.
func (m *Migrator) Steps(n int) error {
	runner, err := m.runner()
	if err != nil {
		return err
	}
	defer runner.Close()

	if err := runner.Steps(n); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("database: migrate steps: %w", err)
	}
	return nil
}

func (m *Migrator) runner() (*migrate.Migrate, error) {
	if m == nil || m.db == nil {
		return nil, fmt.Errorf("database: nil migrator database")
	}
	sqlDB, err := m.db.DB()
	if err != nil {
		return nil, fmt.Errorf("database: unwrap sql connection: %w", err)
	}
	source, err := iofs.New(migrationFiles, "migrations")
	if err != nil {
		return nil, fmt.Errorf("database: create migration source: %w", err)
	}
	driver, err := postgres.WithInstance(sqlDB, &postgres.Config{})
	if err != nil {
		return nil, fmt.Errorf("database: create migration driver: %w", err)
	}
	runner, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		return nil, fmt.Errorf("database: create migration runner: %w", err)
	}
	return runner, nil
}
