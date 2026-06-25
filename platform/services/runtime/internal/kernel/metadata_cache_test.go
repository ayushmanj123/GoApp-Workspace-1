package kernel

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCachedMetadataLoaderCachesLoads(t *testing.T) {
	tenantID := uuid.New()
	appID := uuid.New()
	inner := &fakeMetadataLoader{}
	cached := NewCachedMetadataLoader(inner, time.Minute)

	ctx := context.Background()
	if _, err := cached.Load(ctx, tenantID, appID, "draft"); err != nil {
		t.Fatalf("first load failed: %v", err)
	}
	if _, err := cached.Load(ctx, tenantID, appID, "draft"); err != nil {
		t.Fatalf("second load failed: %v", err)
	}
	if inner.loadCount() != 1 {
		t.Fatalf("expected one metadata load, got %d", inner.loadCount())
	}
}
