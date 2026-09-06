package records

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Repository persists entity records.
type Repository interface {
	Create(ctx context.Context, record *EntityRecord) error
	GetByID(ctx context.Context, tenantID, entityID, recordID uuid.UUID) (*EntityRecord, error)
	List(ctx context.Context, tenantID, entityID uuid.UUID, opts ListOptions) ([]EntityRecord, int64, error)
	Update(ctx context.Context, record *EntityRecord, expectedVersion int) error
	SoftDelete(ctx context.Context, tenantID, entityID, recordID, userID uuid.UUID) error
}

// SchemaRepository loads entity metadata for validation.
type SchemaRepository interface {
	GetEntitySchema(ctx context.Context, tenantID, entityID uuid.UUID) (*EntitySchema, error)
}

type recordRow struct {
	ID         uuid.UUID      `gorm:"column:id;primaryKey"`
	TenantID   uuid.UUID      `gorm:"column:tenant_id"`
	EntityID   uuid.UUID      `gorm:"column:entity_id"`
	Data       datatypes.JSON `gorm:"column:data;type:jsonb"`
	Version    int            `gorm:"column:version"`
	CreatedOn  time.Time      `gorm:"column:created_on"`
	CreatedBy  *uuid.UUID     `gorm:"column:created_by"`
	ModifiedOn time.Time      `gorm:"column:modified_on"`
	ModifiedBy *uuid.UUID     `gorm:"column:modified_by"`
	DeletedOn  *time.Time     `gorm:"column:deleted_on"`
	DeletedBy  *uuid.UUID     `gorm:"column:deleted_by"`
}

func (recordRow) TableName() string {
	return "entity_records"
}

type entityRow struct {
	ID       uuid.UUID  `gorm:"column:id;primaryKey"`
	TenantID uuid.UUID  `gorm:"column:tenant_id"`
	Name     string     `gorm:"column:name"`
	DeletedAt *time.Time `gorm:"column:deleted_at"`
}

func (entityRow) TableName() string {
	return "entities"
}

type entityFieldRow struct {
	ID         uuid.UUID      `gorm:"column:id;primaryKey"`
	Name       string         `gorm:"column:name"`
	FieldType  string         `gorm:"column:field_type"`
	IsRequired bool           `gorm:"column:is_required"`
	IsUnique   bool           `gorm:"column:is_unique"`
	OptionsJSON datatypes.JSON `gorm:"column:options_json;type:jsonb"`
	ConfigJSON  datatypes.JSON `gorm:"column:config_json;type:jsonb"`
}

func (entityFieldRow) TableName() string {
	return "entity_fields"
}

type entityKeyRow struct {
	Name     string         `gorm:"column:name"`
	FieldIDs datatypes.JSON `gorm:"column:field_ids;type:jsonb"`
}

func (entityKeyRow) TableName() string {
	return "entity_keys"
}

type recordLinkRow struct {
	ID             uuid.UUID  `gorm:"column:id;primaryKey"`
	TenantID       uuid.UUID  `gorm:"column:tenant_id"`
	RelationshipID uuid.UUID  `gorm:"column:relationship_id"`
	LeftRecordID   uuid.UUID  `gorm:"column:left_record_id"`
	RightRecordID  uuid.UUID  `gorm:"column:right_record_id"`
	CreatedOn      time.Time  `gorm:"column:created_on"`
	CreatedBy      *uuid.UUID `gorm:"column:created_by"`
	DeletedOn      *time.Time `gorm:"column:deleted_on"`
	DeletedBy      *uuid.UUID `gorm:"column:deleted_by"`
}

func (recordLinkRow) TableName() string {
	return "entity_record_links"
}

// PostgresRepository stores records in PostgreSQL.
type PostgresRepository struct {
	db *gorm.DB
}

// NewPostgresRepository creates a PostgreSQL-backed record repository.
func NewPostgresRepository(db *gorm.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) Create(ctx context.Context, record *EntityRecord) error {
	row, err := toRecordRow(record)
	if err != nil {
		return err
	}
	if err := r.db.WithContext(ctx).Create(&row).Error; err != nil {
		return fmt.Errorf("records: create: %w", err)
	}
	*record = fromRecordRow(row)
	return nil
}

func (r *PostgresRepository) GetByID(ctx context.Context, tenantID, entityID, recordID uuid.UUID) (*EntityRecord, error) {
	var row recordRow
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND entity_id = ? AND deleted_on IS NULL", recordID, tenantID, entityID).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("records: get by id: %w", err)
	}
	rec := fromRecordRow(row)
	return &rec, nil
}

func (r *PostgresRepository) List(ctx context.Context, tenantID, entityID uuid.UUID, opts ListOptions) ([]EntityRecord, int64, error) {
	base := r.db.WithContext(ctx).Model(&recordRow{}).
		Where("tenant_id = ? AND entity_id = ? AND deleted_on IS NULL", tenantID, entityID)

	filtered, err := applyFilterExpr(base, opts.FilterExpr)
	if err != nil {
		return nil, 0, err
	}
	base = filtered

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("records: count: %w", err)
	}

	orderClause, err := buildOrderClause(opts)
	if err != nil {
		return nil, 0, err
	}

	var rows []recordRow
	if err := base.Order(orderClause).Limit(opts.Limit).Offset(opts.Offset).Find(&rows).Error; err != nil {
		return nil, 0, fmt.Errorf("records: list: %w", err)
	}

	items := make([]EntityRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, fromRecordRow(row))
	}
	return items, total, nil
}

func (r *PostgresRepository) Update(ctx context.Context, record *EntityRecord, expectedVersion int) error {
	row, err := toRecordRow(record)
	if err != nil {
		return err
	}

	result := r.db.WithContext(ctx).Model(&recordRow{}).
		Where("id = ? AND tenant_id = ? AND entity_id = ? AND version = ? AND deleted_on IS NULL",
			record.ID, record.TenantID, record.EntityID, expectedVersion).
		Updates(map[string]interface{}{
			"data":        row.Data,
			"version":     gorm.Expr("version + 1"),
			"modified_on": record.ModifiedOn,
			"modified_by": record.ModifiedBy,
		})
	if result.Error != nil {
		return fmt.Errorf("records: update: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		var existing recordRow
		err := r.db.WithContext(ctx).
			Where("id = ? AND tenant_id = ? AND entity_id = ? AND deleted_on IS NULL",
				record.ID, record.TenantID, record.EntityID).
			First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("records: update conflict check: %w", err)
		}
		return ErrVersionConflict
	}

	updated, err := r.GetByID(ctx, record.TenantID, record.EntityID, record.ID)
	if err != nil {
		return err
	}
	*record = *updated
	return nil
}

func (r *PostgresRepository) SoftDelete(ctx context.Context, tenantID, entityID, recordID, userID uuid.UUID) error {
	now := time.Now().UTC()
	result := r.db.WithContext(ctx).Model(&recordRow{}).
		Where("id = ? AND tenant_id = ? AND entity_id = ? AND deleted_on IS NULL", recordID, tenantID, entityID).
		Updates(map[string]interface{}{
			"deleted_on": now,
			"deleted_by": userID,
			"modified_on": now,
			"modified_by": userID,
		})
	if result.Error != nil {
		return fmt.Errorf("records: soft delete: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *PostgresRepository) GetEntitySchema(ctx context.Context, tenantID, entityID uuid.UUID) (*EntitySchema, error) {
	var entity entityRow
	err := r.db.WithContext(ctx).
		Select("id, tenant_id, name").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", entityID, tenantID).
		First(&entity).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrEntityNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("records: load entity: %w", err)
	}

	var fieldRows []entityFieldRow
	if err := r.db.WithContext(ctx).
		Model(&entityFieldRow{}).
		Select("id, name, field_type, is_required, is_unique, options_json, config_json").
		Where("tenant_id = ? AND entity_id = ? AND deleted_at IS NULL", tenantID, entityID).
		Order("name ASC").
		Find(&fieldRows).Error; err != nil {
		return nil, fmt.Errorf("records: load entity fields: %w", err)
	}

	fieldIDToName := make(map[uuid.UUID]string, len(fieldRows))
	fields := make([]FieldSchema, 0, len(fieldRows))
	for _, row := range fieldRows {
		fieldIDToName[row.ID] = row.Name
		var options []string
		if len(row.OptionsJSON) > 0 {
			_ = json.Unmarshal(row.OptionsJSON, &options)
		}
		var config map[string]interface{}
		if len(row.ConfigJSON) > 0 {
			_ = json.Unmarshal(row.ConfigJSON, &config)
		}
		fields = append(fields, FieldSchema{
			Name:       row.Name,
			FieldType:  row.FieldType,
			IsRequired: row.IsRequired,
			IsUnique:   row.IsUnique,
			Options:    options,
			Config:     config,
		})
	}

	var keyRows []entityKeyRow
	_ = r.db.WithContext(ctx).
		Model(&entityKeyRow{}).
		Select("name, field_ids").
		Where("tenant_id = ? AND entity_id = ? AND deleted_at IS NULL", tenantID, entityID).
		Find(&keyRows).Error

	keys := make([]EntityKeySchema, 0, len(keyRows))
	for _, row := range keyRows {
		var ids []uuid.UUID
		_ = json.Unmarshal(row.FieldIDs, &ids)
		names := make([]string, 0, len(ids))
		for _, id := range ids {
			if name, ok := fieldIDToName[id]; ok {
				names = append(names, name)
			}
		}
		if len(names) > 0 {
			keys = append(keys, EntityKeySchema{Name: row.Name, FieldNames: names})
		}
	}

	return &EntitySchema{
		EntityID: entity.ID,
		TenantID: entity.TenantID,
		Name:     entity.Name,
		Fields:   fields,
		Keys:     keys,
	}, nil
}

// ExistsWithFieldValue returns true if another non-deleted record has the same JSON field value.
func (r *PostgresRepository) ExistsWithFieldValue(ctx context.Context, tenantID, entityID uuid.UUID, fieldName string, value interface{}, excludeRecordID *uuid.UUID) (bool, error) {
	q := r.db.WithContext(ctx).Model(&recordRow{}).
		Where("tenant_id = ? AND entity_id = ? AND deleted_on IS NULL", tenantID, entityID).
		Where("data ->> ? = ?", fieldName, fmt.Sprint(value))
	if excludeRecordID != nil {
		q = q.Where("id <> ?", *excludeRecordID)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		return false, fmt.Errorf("records: unique check: %w", err)
	}
	return count > 0, nil
}

// ExistsWithKeyValues checks composite alternate key uniqueness.
func (r *PostgresRepository) ExistsWithKeyValues(ctx context.Context, tenantID, entityID uuid.UUID, fieldNames []string, data map[string]interface{}, excludeRecordID *uuid.UUID) (bool, error) {
	q := r.db.WithContext(ctx).Model(&recordRow{}).
		Where("tenant_id = ? AND entity_id = ? AND deleted_on IS NULL", tenantID, entityID)
	for _, name := range fieldNames {
		q = q.Where("data ->> ? = ?", name, fmt.Sprint(data[name]))
	}
	if excludeRecordID != nil {
		q = q.Where("id <> ?", *excludeRecordID)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		return false, fmt.Errorf("records: key check: %w", err)
	}
	return count > 0, nil
}

// AssociateLinks creates an N:N association between two records.
func (r *PostgresRepository) AssociateLinks(ctx context.Context, tenantID, relationshipID, leftID, rightID, userID uuid.UUID) error {
	row := recordLinkRow{
		ID:             uuid.New(),
		TenantID:       tenantID,
		RelationshipID: relationshipID,
		LeftRecordID:   leftID,
		RightRecordID:  rightID,
		CreatedOn:      time.Now().UTC(),
		CreatedBy:      &userID,
	}
	if err := r.db.WithContext(ctx).Create(&row).Error; err != nil {
		return fmt.Errorf("records: associate: %w", err)
	}
	return nil
}

// DisassociateLinks soft-deletes an N:N association.
func (r *PostgresRepository) DisassociateLinks(ctx context.Context, tenantID, relationshipID, leftID, rightID, userID uuid.UUID) error {
	now := time.Now().UTC()
	result := r.db.WithContext(ctx).Model(&recordLinkRow{}).
		Where("tenant_id = ? AND relationship_id = ? AND left_record_id = ? AND right_record_id = ? AND deleted_on IS NULL",
			tenantID, relationshipID, leftID, rightID).
		Updates(map[string]interface{}{
			"deleted_on": now,
			"deleted_by": userID,
		})
	if result.Error != nil {
		return fmt.Errorf("records: disassociate: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// ListLinkedRecordIDs returns related record IDs for an N:N relationship from one side.
func (r *PostgresRepository) ListLinkedRecordIDs(ctx context.Context, tenantID, relationshipID, recordID uuid.UUID, fromLeft bool) ([]uuid.UUID, error) {
	var rows []recordLinkRow
	q := r.db.WithContext(ctx).
		Where("tenant_id = ? AND relationship_id = ? AND deleted_on IS NULL", tenantID, relationshipID)
	if fromLeft {
		q = q.Where("left_record_id = ?", recordID)
	} else {
		q = q.Where("right_record_id = ?", recordID)
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("records: list links: %w", err)
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		if fromLeft {
			ids = append(ids, row.RightRecordID)
		} else {
			ids = append(ids, row.LeftRecordID)
		}
	}
	return ids, nil
}

// RelationshipExists returns true when the metadata relationship row exists for the tenant.
func (r *PostgresRepository) RelationshipExists(ctx context.Context, tenantID, relationshipID uuid.UUID) (bool, uuid.UUID, uuid.UUID, error) {
	type relRow struct {
		ID            uuid.UUID `gorm:"column:id"`
		LeftEntityID  uuid.UUID `gorm:"column:left_entity_id"`
		RightEntityID uuid.UUID `gorm:"column:right_entity_id"`
	}
	var row relRow
	err := r.db.WithContext(ctx).Table("entity_relationships").
		Select("id, left_entity_id, right_entity_id").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", relationshipID, tenantID).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, uuid.Nil, uuid.Nil, nil
	}
	if err != nil {
		return false, uuid.Nil, uuid.Nil, err
	}
	return true, row.LeftEntityID, row.RightEntityID, nil
}

func buildOrderClause(opts ListOptions) (string, error) {
	direction := strings.ToUpper(opts.OrderDirection)
	switch opts.OrderBy {
	case "created_on", "modified_on", "version":
		return fmt.Sprintf("%s %s", opts.OrderBy, direction), nil
	default:
		// JSONB field ordering; field name validated against schema before reaching here.
		return fmt.Sprintf("data->>%s %s", quoteLiteral(opts.OrderBy), direction), nil
	}
}

func quoteLiteral(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}

func toRecordRow(record *EntityRecord) (recordRow, error) {
	payload, err := json.Marshal(record.Data)
	if err != nil {
		return recordRow{}, fmt.Errorf("records: marshal data: %w", err)
	}
	return recordRow{
		ID:         record.ID,
		TenantID:   record.TenantID,
		EntityID:   record.EntityID,
		Data:       datatypes.JSON(payload),
		Version:    record.Version,
		CreatedOn:  record.CreatedOn,
		CreatedBy:  record.CreatedBy,
		ModifiedOn: record.ModifiedOn,
		ModifiedBy: record.ModifiedBy,
		DeletedOn:  record.DeletedOn,
		DeletedBy:  record.DeletedBy,
	}, nil
}

func fromRecordRow(row recordRow) EntityRecord {
	data := map[string]interface{}{}
	if len(row.Data) > 0 {
		_ = json.Unmarshal(row.Data, &data)
	}
	return EntityRecord{
		ID:         row.ID,
		TenantID:   row.TenantID,
		EntityID:   row.EntityID,
		Data:       data,
		Version:    row.Version,
		CreatedOn:  row.CreatedOn,
		CreatedBy:  row.CreatedBy,
		ModifiedOn: row.ModifiedOn,
		ModifiedBy: row.ModifiedBy,
		DeletedOn:  row.DeletedOn,
		DeletedBy:  row.DeletedBy,
	}
}
