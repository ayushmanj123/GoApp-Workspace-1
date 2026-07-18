package databinding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

var equalsFilterPattern = regexp.MustCompile(`^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]([^'"]*)['"]\s*$`)

// BindingMetadataRepository loads datasource metadata and entity mappings.
type BindingMetadataRepository interface {
	ResolveEntity(ctx context.Context, tenantID, appID uuid.UUID, dataSourceName string) (*ResolvedBinding, error)
	LoadBindingMetadata(ctx context.Context, tenantID, appID uuid.UUID, dataSourceName string) (*ControlBindingMetadata, error)
}

// Resolver converts metadata and request overrides into executable queries.
type Resolver struct {
	metadata BindingMetadataRepository
}

func NewResolver(metadata BindingMetadataRepository) *Resolver {
	return &Resolver{metadata: metadata}
}

func (r *Resolver) Resolve(ctx context.Context, tenantID, appID uuid.UUID, dataSourceName string, overrides QueryOverrides) (*ResolvedBinding, QueryInput, error) {
	name := strings.TrimSpace(dataSourceName)
	if name == "" {
		return nil, QueryInput{}, ErrDataSourceNotFound
	}

	binding, err := r.metadata.ResolveEntity(ctx, tenantID, appID, name)
	if err != nil {
		return nil, QueryInput{}, err
	}

	meta := binding.Metadata
	if meta.DataSource == "" {
		meta.DataSource = name
	}

	if overrides.Filter != "" {
		meta.Filter = overrides.Filter
	}
	if overrides.Sort != "" {
		meta.Sort = overrides.Sort
	}
	if overrides.Limit > 0 {
		meta.Limit = overrides.Limit
	}

	filters, err := ParseEqualsFilter(meta.Filter)
	if err != nil {
		return nil, QueryInput{}, err
	}

	limit := meta.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := overrides.Offset
	if offset < 0 {
		offset = 0
	}

	orderBy := strings.TrimSpace(meta.Sort)
	if orderBy == "" {
		orderBy = "created_on"
	}
	direction := strings.ToLower(strings.TrimSpace(overrides.OrderDirection))
	if direction == "" {
		direction = "asc"
	}
	if direction != "asc" && direction != "desc" {
		return nil, QueryInput{}, fmt.Errorf("%w: orderDirection must be asc or desc", ErrInvalidQuery)
	}

	query := QueryInput{
		EntityID:       binding.EntityID,
		Limit:          limit,
		Offset:         offset,
		Filters:        filters,
		OrderBy:        orderBy,
		OrderDirection: direction,
	}

	binding.Metadata = meta
	return binding, query, nil
}

// ParseEqualsFilter parses a single equals expression such as Status='Active'.
func ParseEqualsFilter(expression string) ([]EqualsFilter, error) {
	expression = strings.TrimSpace(expression)
	if expression == "" {
		return nil, nil
	}
	matches := equalsFilterPattern.FindStringSubmatch(expression)
	if len(matches) != 3 {
		return nil, fmt.Errorf("%w: %q", ErrInvalidFilter, expression)
	}
	return []EqualsFilter{{Field: matches[1], Value: matches[2]}}, nil
}

type entityCatalogRow struct {
	ID            uuid.UUID `gorm:"column:id"`
	TenantID      uuid.UUID `gorm:"column:tenant_id"`
	ApplicationID uuid.UUID `gorm:"column:application_id"`
	Name          string    `gorm:"column:name"`
}

func (entityCatalogRow) TableName() string { return "entities" }

// connectorCatalogRow is the minimal projection used to resolve a datasource
// name to a REST or SQL connector when no matching entity exists.
type connectorCatalogRow struct {
	ID            uuid.UUID `gorm:"column:id"`
	TenantID      uuid.UUID `gorm:"column:tenant_id"`
	ApplicationID uuid.UUID `gorm:"column:application_id"`
	Name          string    `gorm:"column:name"`
	ConnectorType string    `gorm:"column:connector_type"`
}

func (connectorCatalogRow) TableName() string { return "connectors" }

type controlPropertyRow struct {
	PropertyName  string         `gorm:"column:property_name"`
	PropertyValue datatypes.JSON `gorm:"column:property_value"`
}

// PostgresMetadataRepository resolves datasource metadata from shared PostgreSQL tables.
type PostgresMetadataRepository struct {
	db *gorm.DB
}

func NewPostgresMetadataRepository(db *gorm.DB) *PostgresMetadataRepository {
	return &PostgresMetadataRepository{db: db}
}

func (r *PostgresMetadataRepository) ResolveEntity(ctx context.Context, tenantID, appID uuid.UUID, dataSourceName string) (*ResolvedBinding, error) {
	var entity entityCatalogRow
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND application_id = ? AND name = ? AND deleted_at IS NULL", tenantID, appID, dataSourceName).
		First(&entity).Error
	if err == nil {
		meta, err := r.LoadBindingMetadata(ctx, tenantID, appID, dataSourceName)
		if err != nil && !errors.Is(err, ErrDataSourceNotFound) {
			return nil, err
		}
		if meta == nil {
			meta = &ControlBindingMetadata{DataSource: dataSourceName}
		}
		return &ResolvedBinding{
			Name:       dataSourceName,
			Kind:       DataSourceKindEntity,
			EntityID:   entity.ID,
			EntityName: entity.Name,
			Metadata:   *meta,
		}, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("databinding: resolve entity: %w", err)
	}

	// No matching entity: fall back to a REST or SQL connector with the same name.
	var connector connectorCatalogRow
	connErr := r.db.WithContext(ctx).
		Table("connectors").
		Where("tenant_id = ? AND application_id = ? AND name = ? AND connector_type IN ('rest','sql','storage') AND deleted_at IS NULL", tenantID, appID, dataSourceName).
		First(&connector).Error
	if errors.Is(connErr, gorm.ErrRecordNotFound) {
		return nil, ErrDataSourceNotFound
	}
	if connErr != nil {
		return nil, fmt.Errorf("databinding: resolve connector: %w", connErr)
	}

	meta, err := r.LoadBindingMetadata(ctx, tenantID, appID, dataSourceName)
	if err != nil && !errors.Is(err, ErrDataSourceNotFound) {
		return nil, err
	}
	if meta == nil {
		meta = &ControlBindingMetadata{DataSource: dataSourceName}
	}

	kind := DataSourceKindRest
	switch connector.ConnectorType {
	case "sql":
		kind = DataSourceKindSql
	case "storage":
		kind = DataSourceKindStorage
	}

	return &ResolvedBinding{
		Name: dataSourceName,
		Kind: kind,
		// EntityID is reused to carry the connector id through the generic
		// QueryInput/DataSourceKey pipeline (see models.go).
		EntityID:   connector.ID,
		EntityName: connector.Name,
		Metadata:   *meta,
	}, nil
}

func (r *PostgresMetadataRepository) LoadBindingMetadata(ctx context.Context, tenantID, appID uuid.UUID, dataSourceName string) (*ControlBindingMetadata, error) {
	rows, err := r.loadControlProperties(ctx, tenantID, appID)
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		switch row.PropertyName {
		case "dataBinding":
			meta, ok, err := parseDataBindingProperty(row.PropertyValue)
			if err != nil {
				return nil, err
			}
			if ok && strings.EqualFold(strings.TrimSpace(meta.DataSource), dataSourceName) {
				return &meta, nil
			}
		case "dataSource":
			value, err := parsePropertyScalar(row.PropertyValue)
			if err != nil {
				return nil, err
			}
			if strings.EqualFold(strings.TrimSpace(value), dataSourceName) {
				return r.mergeBindingProperties(rows, dataSourceName)
			}
		}
	}

	return nil, ErrDataSourceNotFound
}

func (r *PostgresMetadataRepository) loadControlProperties(ctx context.Context, tenantID, appID uuid.UUID) ([]controlPropertyRow, error) {
	var rows []controlPropertyRow
	err := r.db.WithContext(ctx).
		Table("control_properties cp").
		Select("cp.property_name, cp.property_value").
		Joins("JOIN controls c ON c.id = cp.control_id AND c.tenant_id = cp.tenant_id").
		Joins("JOIN screens s ON s.id = c.screen_id AND s.tenant_id = c.tenant_id").
		Where("cp.tenant_id = ? AND s.application_id = ? AND c.deleted_at IS NULL AND s.deleted_at IS NULL", tenantID, appID).
		Where("cp.property_name IN ?", []string{"dataBinding", "dataSource", "filter", "sort", "limit"}).
		Find(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("databinding: load control properties: %w", err)
	}
	return rows, nil
}

func (r *PostgresMetadataRepository) mergeBindingProperties(rows []controlPropertyRow, dataSourceName string) (*ControlBindingMetadata, error) {
	meta := ControlBindingMetadata{DataSource: dataSourceName}
	for _, row := range rows {
		value, err := parsePropertyScalar(row.PropertyValue)
		if err != nil {
			return nil, err
		}
		switch row.PropertyName {
		case "filter":
			meta.Filter = value
		case "sort":
			meta.Sort = value
		case "limit":
			if parsed, err := parseLimitValue(row.PropertyValue); err == nil {
				meta.Limit = parsed
			}
		}
	}
	return &meta, nil
}

func parseDataBindingProperty(raw datatypes.JSON) (ControlBindingMetadata, bool, error) {
	if len(raw) == 0 {
		return ControlBindingMetadata{}, false, nil
	}
	var direct ControlBindingMetadata
	if err := json.Unmarshal(raw, &direct); err == nil && strings.TrimSpace(direct.DataSource) != "" {
		return direct, true, nil
	}
	var wrapped map[string]interface{}
	if err := json.Unmarshal(raw, &wrapped); err != nil {
		return ControlBindingMetadata{}, false, fmt.Errorf("databinding: parse dataBinding property: %w", err)
	}
	if value, ok := wrapped["value"].(map[string]interface{}); ok {
		bytes, err := json.Marshal(value)
		if err != nil {
			return ControlBindingMetadata{}, false, err
		}
		if err := json.Unmarshal(bytes, &direct); err != nil {
			return ControlBindingMetadata{}, false, err
		}
		if strings.TrimSpace(direct.DataSource) != "" {
			return direct, true, nil
		}
	}
	return ControlBindingMetadata{}, false, nil
}

func parsePropertyScalar(raw datatypes.JSON) (string, error) {
	if len(raw) == 0 {
		return "", nil
	}
	var direct string
	if err := json.Unmarshal(raw, &direct); err == nil {
		return strings.TrimSpace(direct), nil
	}
	var wrapped map[string]interface{}
	if err := json.Unmarshal(raw, &wrapped); err != nil {
		return "", fmt.Errorf("databinding: parse property value: %w", err)
	}
	if value, ok := wrapped["value"].(string); ok {
		return strings.TrimSpace(value), nil
	}
	if formula, ok := wrapped["formula"].(string); ok {
		return strings.TrimSpace(formula), nil
	}
	return "", nil
}

func parseLimitValue(raw datatypes.JSON) (int, error) {
	var direct int
	if err := json.Unmarshal(raw, &direct); err == nil {
		return direct, nil
	}
	var wrapped map[string]interface{}
	if err := json.Unmarshal(raw, &wrapped); err != nil {
		return 0, err
	}
	switch value := wrapped["value"].(type) {
	case float64:
		return int(value), nil
	case int:
		return value, nil
	}
	return 0, nil
}
