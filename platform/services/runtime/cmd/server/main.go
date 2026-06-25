package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/goapps-platform/runtime-service/internal/config"
	"github.com/goapps-platform/runtime-service/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	runtimeApp, err := server.New(cfg)
	if err != nil {
		log.Fatalf("failed to create server: %v", err)
	}

	go func() {
		if err := runtimeApp.Fiber.Listen(cfg.Addr()); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	if err := runtimeApp.Shutdown(); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
