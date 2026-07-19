package databinding

import (
	"context"

	"github.com/google/uuid"
)

type environmentIDCtxKey struct{}

// WithEnvironmentID attaches an optional environment id for secret override resolution.
func WithEnvironmentID(ctx context.Context, id *uuid.UUID) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if id == nil || *id == uuid.Nil {
		return ctx
	}
	return context.WithValue(ctx, environmentIDCtxKey{}, *id)
}

// EnvironmentIDFromContext returns the environment id when present.
func EnvironmentIDFromContext(ctx context.Context) *uuid.UUID {
	if ctx == nil {
		return nil
	}
	v, ok := ctx.Value(environmentIDCtxKey{}).(uuid.UUID)
	if !ok || v == uuid.Nil {
		return nil
	}
	return &v
}

func coalesceEnvironmentID(explicit *uuid.UUID, ctx context.Context) *uuid.UUID {
	if explicit != nil && *explicit != uuid.Nil {
		return explicit
	}
	return EnvironmentIDFromContext(ctx)
}
