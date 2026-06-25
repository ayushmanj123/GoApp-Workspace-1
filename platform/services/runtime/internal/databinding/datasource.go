package databinding

import (
	"context"
	"fmt"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/records"
	"github.com/google/uuid"
)

// DataSource is the connector-ready abstraction for runtime data access.
type DataSource interface {
	Kind() DataSourceKind
	Query(ctx context.Context, input QueryInput) (*QueryResult, error)
	Get(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID) (*DataItem, error)
	Create(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, data map[string]interface{}) (*DataItem, error)
	Update(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID, data map[string]interface{}, version int) (*DataItem, error)
	Delete(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID) error
}

// RecordService is the subset of records.Service used by entity datasources.
type RecordService interface {
	List(ctx context.Context, tenantID, entityID uuid.UUID, opts records.ListOptions) ([]records.EntityRecord, int64, error)
	Get(ctx context.Context, tenantID, entityID, recordID uuid.UUID) (*records.EntityRecord, error)
	Create(ctx context.Context, tenantID, userID, entityID uuid.UUID, data map[string]interface{}) (*records.EntityRecord, error)
	Update(ctx context.Context, tenantID, userID, entityID, recordID uuid.UUID, patch map[string]interface{}, expectedVersion int) (*records.EntityRecord, error)
	Delete(ctx context.Context, tenantID, userID, entityID, recordID uuid.UUID) error
}

// EntityDataSource loads entity records through the record service.
type EntityDataSource struct {
	records RecordService
}

func NewEntityDataSource(records RecordService) *EntityDataSource {
	return &EntityDataSource{records: records}
}

func (d *EntityDataSource) Kind() DataSourceKind {
	return DataSourceKindEntity
}

func (d *EntityDataSource) Query(ctx context.Context, input QueryInput) (*QueryResult, error) {
	fetchLimit := input.Limit + input.Offset
	if fetchLimit <= 0 {
		fetchLimit = 50
	}
	if len(input.Filters) > 0 {
		if fetchLimit < 1000 {
			fetchLimit = 1000
		}
	}
	if fetchLimit > 1000 {
		fetchLimit = 1000
	}

	listOpts := records.ListOptions{
		Limit:          fetchLimit,
		Offset:         0,
		OrderBy:        input.OrderBy,
		OrderDirection: input.OrderDirection,
	}

	rows, _, err := d.records.List(ctx, input.TenantID, input.EntityID, listOpts)
	if err != nil {
		return nil, err
	}

	filtered := make([]records.EntityRecord, 0, len(rows))
	for _, row := range rows {
		if matchesFilters(row.Data, input.Filters) {
			filtered = append(filtered, row)
		}
	}

	total := int64(len(filtered))
	start := input.Offset
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + input.Limit
	if input.Limit <= 0 {
		end = len(filtered)
	}
	if end > len(filtered) {
		end = len(filtered)
	}

	items := make([]DataItem, 0, end-start)
	for _, row := range filtered[start:end] {
		items = append(items, toDataItem(row))
	}

	return &QueryResult{Items: items, Count: total}, nil
}

func (d *EntityDataSource) Get(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID) (*DataItem, error) {
	_ = userID
	record, err := d.records.Get(ctx, tenantID, key.EntityID, recordID)
	if err != nil {
		return nil, err
	}
	item := toDataItem(*record)
	return &item, nil
}

func (d *EntityDataSource) Create(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, data map[string]interface{}) (*DataItem, error) {
	record, err := d.records.Create(ctx, tenantID, userID, key.EntityID, data)
	if err != nil {
		return nil, err
	}
	item := toDataItem(*record)
	return &item, nil
}

func (d *EntityDataSource) Update(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID, data map[string]interface{}, version int) (*DataItem, error) {
	record, err := d.records.Update(ctx, tenantID, userID, key.EntityID, recordID, data, version)
	if err != nil {
		return nil, err
	}
	item := toDataItem(*record)
	return &item, nil
}

func (d *EntityDataSource) Delete(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID) error {
	return d.records.Delete(ctx, tenantID, userID, key.EntityID, recordID)
}

func toDataItem(record records.EntityRecord) DataItem {
	item := DataItem{}
	for key, value := range record.Data {
		item[key] = value
	}
	item["recordId"] = record.ID.String()
	item["entityId"] = record.EntityID.String()
	item["version"] = record.Version
	return item
}

func matchesFilters(data map[string]interface{}, filters []EqualsFilter) bool {
	if len(filters) == 0 {
		return true
	}
	for _, filter := range filters {
		value, ok := data[filter.Field]
		if !ok {
			return false
		}
		if !valuesEqual(value, filter.Value) {
			return false
		}
	}
	return true
}

func valuesEqual(actual interface{}, expected string) bool {
	switch v := actual.(type) {
	case string:
		return v == expected
	case bool:
		return strings.EqualFold(expected, fmt.Sprintf("%t", v))
	case float64:
		return fmt.Sprintf("%v", v) == expected || fmt.Sprintf("%.0f", v) == expected
	case int:
		return fmt.Sprintf("%d", v) == expected
	case int64:
		return fmt.Sprintf("%d", v) == expected
	default:
		return fmt.Sprintf("%v", v) == expected
	}
}
