package databinding

import "context"

type channelCtxKey struct{}

// WithChannel attaches the active session channel ("draft" or "published")
// so connector repositories can decide whether to resolve config from the
// live connectors table or a frozen publish snapshot (Phase 7.13).
func WithChannel(ctx context.Context, channel string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if channel == "" {
		return ctx
	}
	return context.WithValue(ctx, channelCtxKey{}, channel)
}

// ChannelFromContext returns the session channel when present.
func ChannelFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	v, _ := ctx.Value(channelCtxKey{}).(string)
	return v
}

// IsPublishedChannel reports whether the context channel is "published".
// Draft sessions (and any context without a channel set) always resolve
// connector config live from the database.
func IsPublishedChannel(ctx context.Context) bool {
	return ChannelFromContext(ctx) == "published"
}
