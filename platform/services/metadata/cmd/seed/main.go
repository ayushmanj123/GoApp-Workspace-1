package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/goapps-platform/metadata-service/internal/config"
	"github.com/goapps-platform/metadata-service/internal/database"
	"github.com/goapps-platform/metadata-service/internal/seed"
	"github.com/joho/godotenv"
)

func main() {
    // Load .env automatically in development to make local runs convenient.
    // Fall back to environment variables when .env is missing so production
    // behavior remains unchanged.
    if env := os.Getenv("APP_ENV"); env == "development" {
        if err := godotenv.Load(); err != nil {
            log.Printf(".env not loaded (continuing with environment): %v", err)
        } else {
            log.Printf(".env loaded for development environment")
        }
    }

    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("failed to load config: %v", err)
    }

    db, err := database.Open(database.FromServiceConfig(cfg))
    if err != nil {
        log.Fatalf("failed to open database: %v", err)
    }
    defer func() {
        if err := database.Close(db); err != nil {
            log.Printf("failed to close database: %v", err)
        }
    }()

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := seed.Run(ctx, db); err != nil {
        log.Fatalf("seed failed: %v", err)
    }

    log.Printf("seed completed")
    log.Printf("tenant_id=%s", seed.DevelopmentTenantID)
    log.Printf("admin_user_id=%s", seed.AdminUserID)
    log.Printf("application_id=%s", seed.DemoApplicationID)
    log.Printf("screen_id=%s", seed.DemoScreenID)
    log.Printf("container_id=%s", seed.DemoContainerID)
    log.Printf("label_id=%s", seed.DemoLabelID)
    log.Printf("button_id=%s", seed.DemoButtonID)
}
