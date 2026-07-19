package databinding

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

type requestCacheKey struct{}

// RequestCache stores per-request datasource query results.
type RequestCache struct {
	entries map[string]*QueryResult
}

func NewRequestCache() *RequestCache {
	return &RequestCache{entries: map[string]*QueryResult{}}
}

func WithRequestCache(ctx context.Context) context.Context {
	if _, ok := ctx.Value(requestCacheKey{}).(*RequestCache); ok {
		return ctx
	}
	return context.WithValue(ctx, requestCacheKey{}, NewRequestCache())
}

func requestCacheFromContext(ctx context.Context) *RequestCache {
	cache, _ := ctx.Value(requestCacheKey{}).(*RequestCache)
	return cache
}

func cacheKey(tenantID, appID uuid.UUID, dataSourceName string, query QueryInput) string {
	payload := struct {
		TenantID       string     `json:"tenantId"`
		AppID          string     `json:"appId"`
		DataSource     string     `json:"dataSource"`
		EntityID       string     `json:"entityId"`
		Limit          int        `json:"limit"`
		Offset         int        `json:"offset"`
		FilterExpr     FilterExpr `json:"filterExpr"`
		OrderBy        string     `json:"orderBy"`
		OrderDirection string     `json:"orderDirection"`
	}{
		TenantID:       tenantID.String(),
		AppID:          appID.String(),
		DataSource:     dataSourceName,
		EntityID:       query.EntityID.String(),
		Limit:          query.Limit,
		Offset:         query.Offset,
		FilterExpr:     query.FilterExpr,
		OrderBy:        query.OrderBy,
		OrderDirection: query.OrderDirection,
	}
	bytes, _ := json.Marshal(payload)
	sum := sha256.Sum256(bytes)
	return hex.EncodeToString(sum[:])
}

func (c *RequestCache) Get(key string) (*QueryResult, bool) {
	if c == nil {
		return nil, false
	}
	result, ok := c.entries[key]
	return result, ok
}

func (c *RequestCache) Set(key string, result *QueryResult) {
	if c == nil || result == nil {
		return
	}
	c.entries[key] = cloneQueryResult(result)
}

func cloneQueryResult(result *QueryResult) *QueryResult {
	if result == nil {
		return nil
	}
	items := make([]DataItem, 0, len(result.Items))
	for _, item := range result.Items {
		copyItem := DataItem{}
		for key, value := range item {
			copyItem[key] = value
		}
		items = append(items, copyItem)
	}
	return &QueryResult{Items: items, Count: result.Count}
}

// DataSourceRegistry selects a datasource implementation by kind.
type DataSourceRegistry struct {
	entity  DataSource
	rest    DataSource
	sql     DataSource
	storage DataSource
}

func NewDataSourceRegistry(entity DataSource) *DataSourceRegistry {
	return &DataSourceRegistry{entity: entity}
}

// SetRest registers the REST connector datasource implementation. Kept as a
// setter (rather than a constructor parameter) so existing callers of
// NewDataSourceRegistry keep working unchanged.
func (r *DataSourceRegistry) SetRest(rest DataSource) *DataSourceRegistry {
	if r != nil {
		r.rest = rest
	}
	return r
}

// SetSql registers the SQL connector datasource implementation.
func (r *DataSourceRegistry) SetSql(sql DataSource) *DataSourceRegistry {
	if r != nil {
		r.sql = sql
	}
	return r
}

// SetStorage registers the storage (S3/MinIO) connector datasource implementation.
func (r *DataSourceRegistry) SetStorage(storage DataSource) *DataSourceRegistry {
	if r != nil {
		r.storage = storage
	}
	return r
}

func (r *DataSourceRegistry) ForKind(kind DataSourceKind) (DataSource, error) {
	switch kind {
	case DataSourceKindEntity:
		if r.entity == nil {
			return nil, fmt.Errorf("databinding: entity datasource unavailable")
		}
		return r.entity, nil
	case DataSourceKindRest:
		if r.rest == nil {
			return nil, fmt.Errorf("databinding: rest datasource unavailable")
		}
		return r.rest, nil
	case DataSourceKindSql:
		if r.sql == nil {
			return nil, fmt.Errorf("databinding: sql datasource unavailable")
		}
		return r.sql, nil
	case DataSourceKindStorage:
		if r.storage == nil {
			return nil, fmt.Errorf("databinding: storage datasource unavailable")
		}
		return r.storage, nil
	default:
		return nil, fmt.Errorf("databinding: unsupported datasource kind %q", kind)
	}
}
