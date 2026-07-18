// Package server wires the runtime-service HTTP server.
package server

import (
	"context"
	"log/slog"

	"github.com/goapps-platform/runtime-service/internal/config"
	"github.com/goapps-platform/runtime-service/internal/database"
	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/form"
	"github.com/goapps-platform/runtime-service/internal/formula"
	"github.com/goapps-platform/runtime-service/internal/gallery"
	runtimehealth "github.com/goapps-platform/runtime-service/internal/health"
	"github.com/goapps-platform/runtime-service/internal/kernel"
	"github.com/goapps-platform/runtime-service/internal/properties"
	"github.com/goapps-platform/runtime-service/internal/records"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/renderer"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/health"
	"github.com/goapps-platform/shared/logging"
	"github.com/goapps-platform/shared/metrics"
	"github.com/goapps-platform/shared/middleware"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"gorm.io/gorm"
)

// RuntimeApp holds the Fiber app and runtime lifecycle dependencies.
type RuntimeApp struct {
	Fiber         *fiber.App
	Kernel        *kernel.RuntimeKernel
	DB            *gorm.DB
	cleanupCancel context.CancelFunc
}

// Shutdown stops background workers and closes open resources.
func (a *RuntimeApp) Shutdown() error {
	if a == nil {
		return nil
	}
	if a.cleanupCancel != nil {
		a.cleanupCancel()
	}
	if a.DB != nil {
		_ = database.Close(a.DB)
	}
	if a.Fiber != nil {
		return a.Fiber.Shutdown()
	}
	return nil
}

// New creates the runtime-service Fiber application.
func New(cfg config.Config) (*RuntimeApp, error) {
	logger := logging.New(logging.Config{
		Level:   cfg.LogLevel,
		AppEnv:  cfg.AppEnv,
		Service: cfg.ServiceName,
	})

	validator, err := auth.NewTokenValidator(cfg.Auth)
	if err != nil {
		return nil, err
	}

	app := fiber.New(fiber.Config{
		AppName:      cfg.ServiceName,
		ErrorHandler: middleware.ErrorHandler,
	})

	app.Use(recover.New())
	app.Use(middleware.RequestID())
	if cfg.MetricsEnabled {
		app.Use(metrics.HTTPMiddleware(cfg.ServiceName))
		metrics.RegisterMetrics(app)
	}
	app.Use(middleware.RequestLogger(logger))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Tenant-Id, X-User-Id, X-User-Email, X-Request-ID",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	db, dbErr := database.Open(database.FromServiceConfig(cfg))
	checkers := []health.Checker{}
	if dbErr == nil {
		checkers = append(checkers, runtimehealth.DatabaseChecker{DB: db})
	} else {
		logger.Error("database unavailable; record and kernel routes disabled", slog.String("error", dbErr.Error()))
	}

	registerPublicRoutes(app, cfg.ServiceName, checkers)

	authMiddleware := auth.Middleware(cfg.Auth, validator)
	stateStore := state.NewMemoryStore()
	stateSvc := state.NewService(stateStore)
	reactiveEngine := reactive.NewEngine()

	api := app.Group("/api", authMiddleware, auth.RequireAuthenticated(), databinding.RequestCacheMiddleware())
	state.RegisterRoutes(api, stateSvc)
	reactive.RegisterRoutes(api, reactive.NewService(reactiveEngine))

	formulaDeps := formula.Dependencies{StateStore: stateStore, Reactive: reactiveEngine}

	if dbErr != nil {
		formula.RegisterRoutes(api, formula.NewService(formulaDeps))
		return &RuntimeApp{Fiber: app}, nil
	}

	repo := records.NewPostgresRepository(db)
	svc := records.NewService(repo, repo)
	metadataRepo := databinding.NewPostgresMetadataRepository(db)
	resolver := databinding.NewResolver(metadataRepo)
	entityDS := databinding.NewEntityDataSource(svc)
	restRepo := databinding.NewPostgresRestConnectorRepository(db)
	restDS := databinding.NewRestDataSource(restRepo, nil)
	sqlRepo := databinding.NewPostgresSqlConnectorRepository(db)
	sqlDS := databinding.NewSqlDataSource(sqlRepo)
	storageRepo := databinding.NewPostgresStorageConnectorRepository(db)
	storageDS := databinding.NewStorageDataSource(storageRepo)
	dataSources := databinding.NewDataSourceRegistry(entityDS).SetRest(restDS).SetSql(sqlDS).SetStorage(storageDS)
	bindingSvc := databinding.NewService(resolver, dataSources)

	formulaDeps.Resolver = resolver
	formulaDeps.DataSources = dataSources

	galleryStore := gallery.NewSessionStore()
	gallerySvc := gallery.NewService(galleryStore, bindingSvc, resolver)
	formStore := form.NewSessionStore()
	formSvc := form.NewService(formStore, svc, svc, resolver, formulaDeps.DataSources, galleryStore)

	metadataLoader := kernel.NewCachedMetadataLoader(
		kernel.NewPostgresMetadataLoader(db),
		cfg.MetadataCacheTTL,
	)
	registry := kernel.NewRegistry(stateStore, reactiveEngine, resolver, formulaDeps.DataSources, bindingSvc, gallerySvc, formSvc, nil, nil, metadataLoader)
	registry.SessionTTL = cfg.SessionTTL
	registry.MaxSessions = cfg.SessionMax

	runtimeKernel := kernel.NewRuntimeKernel(registry)
	propertiesEngine := properties.NewEngine(kernel.NewFormulaEvaluatorAdapter(runtimeKernel), reactiveEngine)
	rendererEngine := renderer.NewEngine(propertiesEngine)
	registry.Properties = propertiesEngine
	registry.Renderer = rendererEngine

	cleanupCtx, cleanupCancel := context.WithCancel(context.Background())
	runtimeKernel.StartCleanup(cleanupCtx)

	kernel.RegisterRoutes(api, kernel.NewService(runtimeKernel))
	gallery.RegisterRoutes(api, gallery.NewHandler(gallerySvc, runtimeKernel.GallerySessionAdapter()))
	form.RegisterRoutes(api, form.NewHandler(formSvc, runtimeKernel.FormSessionAdapter()))
	properties.RegisterRoutes(api, properties.NewHandler(propertiesEngine, runtimeKernel.PropertySessionAdapter()))
	renderer.RegisterRoutes(api, renderer.NewHandler(rendererEngine, runtimeKernel.RenderSessionAdapter()))

	records.RegisterRoutes(api, svc)
	databinding.RegisterRoutes(api, bindingSvc)
	formula.RegisterRoutes(api, formula.NewService(formulaDeps))

	return &RuntimeApp{
		Fiber:         app,
		Kernel:        runtimeKernel,
		DB:            db,
		cleanupCancel: cleanupCancel,
	}, nil
}

func registerPublicRoutes(app *fiber.App, serviceName string, checkers []health.Checker) {
	health.RegisterWithChecks(app, serviceName, checkers)
	app.Get("/live", liveness(serviceName))
}

func liveness(serviceName string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID, _ := c.Locals("requestID").(string)
		return c.JSON(response.OK(health.Status{
			Status:  "live",
			Service: serviceName,
		}, requestID))
	}
}

// DefaultLogger creates a logger from runtime config.
func DefaultLogger(cfg config.Config) *slog.Logger {
	return logging.New(logging.Config{
		Level:   cfg.LogLevel,
		AppEnv:  cfg.AppEnv,
		Service: cfg.ServiceName,
	})
}
