package metrics

import (
	"time"

	sharedmetrics "github.com/goapps-platform/shared/metrics"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const ServiceName = "runtime-service"

var (
	activeSessions = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "goapps_runtime_sessions_active",
		Help: "Number of active runtime sessions",
	})

	metadataCacheHits = promauto.NewCounter(prometheus.CounterOpts{
		Name: "goapps_runtime_metadata_cache_hits_total",
		Help: "Metadata cache hits",
	})

	metadataCacheMisses = promauto.NewCounter(prometheus.CounterOpts{
		Name: "goapps_runtime_metadata_cache_misses_total",
		Help: "Metadata cache misses",
	})
)

func SetActiveSessions(count int) {
	activeSessions.Set(float64(count))
}

func RecordMetadataCacheHit() {
	metadataCacheHits.Inc()
}

func RecordMetadataCacheMiss() {
	metadataCacheMisses.Inc()
}

func TimeFormula(operation string, fn func() error) error {
	return sharedmetrics.TimeSubsystem(ServiceName, "formula", operation, fn)
}

func TimeProperty(operation string, fn func() error) error {
	return sharedmetrics.TimeSubsystem(ServiceName, "property", operation, fn)
}

func TimeRenderer(operation string, fn func() error) error {
	return sharedmetrics.TimeSubsystem(ServiceName, "renderer", operation, fn)
}

func TimeRecords(operation string, fn func() error) error {
	return sharedmetrics.TimeSubsystem(ServiceName, "records", operation, fn)
}

func TimeSession(operation string, fn func() error) error {
	return sharedmetrics.TimeSubsystem(ServiceName, "session", operation, fn)
}

func TimeReactive(operation string, fn func() error) error {
	return sharedmetrics.TimeSubsystem(ServiceName, "reactive", operation, fn)
}

func ObserveDuration(subsystem, operation string, duration time.Duration) {
	sharedmetrics.ObserveSubsystem(ServiceName, subsystem, operation, "ok", duration)
}
