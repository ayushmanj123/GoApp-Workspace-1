package records

import (
	"context"
	"time"

	runtimemetrics "github.com/goapps-platform/runtime-service/internal/metrics"
	"github.com/google/uuid"
)

// Service implements entity record business logic.
type Service struct {
	repo   Repository
	schema SchemaRepository
}

// NewService creates a record service.
func NewService(repo Repository, schema SchemaRepository) *Service {
	return &Service{
		repo:   repo,
		schema: schema,
	}
}

// Create inserts a new record after schema validation.
func (s *Service) Create(ctx context.Context, tenantID, userID, entityID uuid.UUID, data map[string]interface{}) (record *EntityRecord, err error) {
	err = runtimemetrics.TimeRecords("create", func() error {
		schema, schemaErr := s.schema.GetEntitySchema(ctx, tenantID, entityID)
		if schemaErr != nil {
			return schemaErr
		}
		if validationErr := ValidateCreateData(schema, data); validationErr != nil {
			return validationErr
		}

		now := time.Now().UTC()
		record = &EntityRecord{
			ID:         uuid.New(),
			TenantID:   tenantID,
			EntityID:   entityID,
			Data:       cloneMap(data),
			Version:    1,
			CreatedOn:  now,
			CreatedBy:  &userID,
			ModifiedOn: now,
			ModifiedBy: &userID,
		}
		if repoErr := s.repo.Create(ctx, record); repoErr != nil {
			return repoErr
		}
		return nil
	})
	return record, err
}

// Get returns a single record scoped to tenant and entity.
func (s *Service) Get(ctx context.Context, tenantID, entityID, recordID uuid.UUID) (*EntityRecord, error) {
	if _, err := s.schema.GetEntitySchema(ctx, tenantID, entityID); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, entityID, recordID)
}

// List returns paginated records for an entity.
func (s *Service) List(ctx context.Context, tenantID, entityID uuid.UUID, opts ListOptions) (items []EntityRecord, total int64, err error) {
	err = runtimemetrics.TimeRecords("list", func() error {
		schema, schemaErr := s.schema.GetEntitySchema(ctx, tenantID, entityID)
		if schemaErr != nil {
			return schemaErr
		}
		normalized, normalizeErr := NormalizeListOptions(opts, schema)
		if normalizeErr != nil {
			return normalizeErr
		}
		items, total, err = s.repo.List(ctx, tenantID, entityID, normalized)
		return err
	})
	return items, total, err
}

// Update applies a partial data patch with optimistic concurrency.
func (s *Service) Update(ctx context.Context, tenantID, userID, entityID, recordID uuid.UUID, patch map[string]interface{}, expectedVersion int) (*EntityRecord, error) {
	schema, err := s.schema.GetEntitySchema(ctx, tenantID, entityID)
	if err != nil {
		return nil, err
	}
	if err := ValidateUpdateData(schema, patch); err != nil {
		return nil, err
	}

	existing, err := s.repo.GetByID(ctx, tenantID, entityID, recordID)
	if err != nil {
		return nil, err
	}

	merged := cloneMap(existing.Data)
	for key, value := range patch {
		merged[key] = value
	}
	if err := ValidateCreateData(schema, merged); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	existing.Data = merged
	existing.ModifiedOn = now
	existing.ModifiedBy = &userID

	if err := s.repo.Update(ctx, existing, expectedVersion); err != nil {
		return nil, err
	}
	return existing, nil
}

// Delete soft-deletes a record.
func (s *Service) Delete(ctx context.Context, tenantID, userID, entityID, recordID uuid.UUID) error {
	if _, err := s.schema.GetEntitySchema(ctx, tenantID, entityID); err != nil {
		return err
	}
	return s.repo.SoftDelete(ctx, tenantID, entityID, recordID, userID)
}

// GetEntitySchema returns entity metadata for validation.
func (s *Service) GetEntitySchema(ctx context.Context, tenantID, entityID uuid.UUID) (*EntitySchema, error) {
	return s.schema.GetEntitySchema(ctx, tenantID, entityID)
}

func cloneMap(src map[string]interface{}) map[string]interface{} {
	if src == nil {
		return map[string]interface{}{}
	}
	dst := make(map[string]interface{}, len(src))
	for key, value := range src {
		dst[key] = value
	}
	return dst
}
