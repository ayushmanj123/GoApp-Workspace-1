package main

import (
	"context"
	"flag"
	"log"
	"strconv"
	"time"

	"github.com/goapps-platform/metadata-service/internal/config"
	"github.com/goapps-platform/metadata-service/internal/database"
	"github.com/goapps-platform/metadata-service/internal/seed"
)

func main() {
	command := flag.String("command", "up", "migration command: up, down, steps, seed")
	steps := flag.Int("steps", 0, "number of migration steps for command=steps")
	flag.Parse()

	if flag.NArg() > 0 {
		*command = flag.Arg(0)
	}
	if flag.NArg() > 1 && *command == "steps" {
		parsed, err := strconv.Atoi(flag.Arg(1))
		if err != nil {
			log.Fatalf("invalid steps value: %v", err)
		}
		*steps = parsed
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

	migrator := database.NewMigrator(db)
	switch *command {
	case "up":
		err = migrator.Up()
	case "down":
		err = migrator.Down()
	case "steps":
		err = migrator.Steps(*steps)
	case "seed":
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		err = seed.Run(ctx, db)
	default:
		log.Fatalf("unknown command %q", *command)
	}
	if err != nil {
		log.Fatalf("%s failed: %v", *command, err)
	}
	log.Printf("%s completed", *command)
}
