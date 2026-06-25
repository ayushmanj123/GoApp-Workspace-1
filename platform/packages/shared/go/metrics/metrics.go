// Package metrics provides Prometheus instrumentation helpers for GoApps Platform services.
package metrics

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/valyala/fasthttp/fasthttpadaptor"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "goapps_http_requests_total",
		Help: "Total HTTP requests processed",
	}, []string{"service", "method", "path", "status"})

	httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "goapps_http_request_duration_seconds",
		Help:    "HTTP request latency in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"service", "method", "path"})

	subsystemDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "goapps_subsystem_duration_seconds",
		Help:    "Subsystem operation latency in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"service", "subsystem", "operation"})

	subsystemTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "goapps_subsystem_operations_total",
		Help: "Subsystem operations processed",
	}, []string{"service", "subsystem", "operation", "status"})
)

// RegisterMetrics mounts the Prometheus scrape endpoint.
func RegisterMetrics(app *fiber.App) {
	app.Get("/metrics", func(c *fiber.Ctx) error {
		fasthttpadaptor.NewFastHTTPHandler(promhttp.Handler())(c.Context())
		return nil
	})
}

// HTTPMiddleware records request latency and status for Prometheus.
func HTTPMiddleware(serviceName string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		status := strconv.Itoa(c.Response().StatusCode())
		path := c.Route().Path
		if path == "" {
			path = c.Path()
		}
		httpRequestsTotal.WithLabelValues(serviceName, c.Method(), path, status).Inc()
		httpRequestDuration.WithLabelValues(serviceName, c.Method(), path).Observe(time.Since(start).Seconds())
		return err
	}
}

// ObserveSubsystem records a subsystem operation duration and outcome.
func ObserveSubsystem(service, subsystem, operation, status string, duration time.Duration) {
	subsystemTotal.WithLabelValues(service, subsystem, operation, status).Inc()
	subsystemDuration.WithLabelValues(service, subsystem, operation).Observe(duration.Seconds())
}

// TimeSubsystem runs fn and records subsystem metrics.
func TimeSubsystem(service, subsystem, operation string, fn func() error) error {
	start := time.Now()
	err := fn()
	status := "ok"
	if err != nil {
		status = "error"
	}
	ObserveSubsystem(service, subsystem, operation, status, time.Since(start))
	return err
}
