package kernel

import (
	"context"
	"fmt"
	"sync"
	"time"

	runtimemetrics "github.com/goapps-platform/runtime-service/internal/metrics"
	"github.com/google/uuid"
)

type metadataCacheEntry struct {
	pkg       *Package
	expiresAt time.Time
}

// CachedMetadataLoader wraps a MetadataLoader with a short-lived in-memory cache
// to avoid repeated database reads when multiple sessions start for the same app.
type CachedMetadataLoader struct {
	inner MetadataLoader
	ttl   time.Duration
	mu    sync.RWMutex
	cache map[string]metadataCacheEntry
}

func NewCachedMetadataLoader(inner MetadataLoader, ttl time.Duration) *CachedMetadataLoader {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &CachedMetadataLoader{
		inner: inner,
		ttl:   ttl,
		cache: map[string]metadataCacheEntry{},
	}
}

func (c *CachedMetadataLoader) Load(ctx context.Context, tenantID, appID uuid.UUID, channel string) (*Package, error) {
	if c == nil || c.inner == nil {
		return nil, ErrMetadataMissing
	}
	key := metadataCacheKey(tenantID, appID, channel)
	now := time.Now().UTC()

	c.mu.RLock()
	entry, ok := c.cache[key]
	c.mu.RUnlock()
	if ok && now.Before(entry.expiresAt) && entry.pkg != nil {
		runtimemetrics.RecordMetadataCacheHit()
		return clonePackage(entry.pkg), nil
	}
	runtimemetrics.RecordMetadataCacheMiss()

	pkg, err := c.inner.Load(ctx, tenantID, appID, channel)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache[key] = metadataCacheEntry{pkg: clonePackage(pkg), expiresAt: now.Add(c.ttl)}
	c.mu.Unlock()
	return clonePackage(pkg), nil
}

func metadataCacheKey(tenantID, appID uuid.UUID, channel string) string {
	return fmt.Sprintf("%s:%s:%s", tenantID.String(), appID.String(), channel)
}

func clonePackage(pkg *Package) *Package {
	if pkg == nil {
		return nil
	}
	copy := *pkg
	if pkg.Controls != nil {
		copy.Controls = make(map[string]RuntimeControl, len(pkg.Controls))
		for key, control := range pkg.Controls {
			copy.Controls[key] = control
		}
	}
	if pkg.ScreensByName != nil {
		copy.ScreensByName = make(map[string]RuntimeScreen, len(pkg.ScreensByName))
		for key, screen := range pkg.ScreensByName {
			copy.ScreensByName[key] = screen
		}
	}
	if len(pkg.Screens) > 0 {
		copy.Screens = append([]RuntimeScreen(nil), pkg.Screens...)
	}
	if len(pkg.Entities) > 0 {
		copy.Entities = append([]string(nil), pkg.Entities...)
	}
	return &copy
}
