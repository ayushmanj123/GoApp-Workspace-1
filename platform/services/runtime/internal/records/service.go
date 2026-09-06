package records

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"strings"
	"time"

	runtimemetrics "github.com/goapps-platform/runtime-service/internal/metrics"
	"github.com/google/uuid"
)

// uniquenessRepo is implemented by PostgresRepository for unique/key checks.
type uniquenessRepo interface {
	ExistsWithFieldValue(ctx context.Context, tenantID, entityID uuid.UUID, fieldName string, value interface{}, excludeRecordID *uuid.UUID) (bool, error)
	ExistsWithKeyValues(ctx context.Context, tenantID, entityID uuid.UUID, fieldNames []string, data map[string]interface{}, excludeRecordID *uuid.UUID) (bool, error)
}

type linkRepo interface {
	AssociateLinks(ctx context.Context, tenantID, relationshipID, leftID, rightID, userID uuid.UUID) error
	DisassociateLinks(ctx context.Context, tenantID, relationshipID, leftID, rightID, userID uuid.UUID) error
	ListLinkedRecordIDs(ctx context.Context, tenantID, relationshipID, recordID uuid.UUID, fromLeft bool) ([]uuid.UUID, error)
	RelationshipExists(ctx context.Context, tenantID, relationshipID uuid.UUID) (bool, uuid.UUID, uuid.UUID, error)
}

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
		if uniqErr := s.enforceUniqueness(ctx, schema, data, nil); uniqErr != nil {
			return uniqErr
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
	if err := s.enforceUniqueness(ctx, schema, merged, &recordID); err != nil {
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

// ImportCSVResult summarizes a CSV import.
type ImportCSVResult struct {
	Created int                    `json:"created"`
	Failed  int                    `json:"failed"`
	Errors  []ImportRowError       `json:"errors,omitempty"`
	DryRun  bool                   `json:"dryRun"`
}

// ImportRowError describes a single failed import row.
type ImportRowError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

const maxImportRows = 2000

// ImportCSV creates records from a CSV reader. mapping maps CSV header → field name.
func (s *Service) ImportCSV(ctx context.Context, tenantID, userID, entityID uuid.UUID, reader io.Reader, mapping map[string]string, dryRun bool) (*ImportCSVResult, error) {
	schema, err := s.schema.GetEntitySchema(ctx, tenantID, entityID)
	if err != nil {
		return nil, err
	}
	csvReader := csv.NewReader(reader)
	csvReader.TrimLeadingSpace = true
	headers, err := csvReader.Read()
	if err != nil {
		return nil, &ValidationError{Message: "failed to read CSV header"}
	}
	result := &ImportCSVResult{DryRun: dryRun}
	rowNum := 1
	for {
		row, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		rowNum++
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportRowError{Row: rowNum, Message: err.Error()})
			continue
		}
		if result.Created+result.Failed >= maxImportRows {
			result.Errors = append(result.Errors, ImportRowError{Row: rowNum, Message: fmt.Sprintf("import limited to %d rows", maxImportRows)})
			break
		}
		data := map[string]interface{}{}
		for i, header := range headers {
			if i >= len(row) {
				break
			}
			fieldName := mapping[strings.TrimSpace(header)]
			if fieldName == "" {
				fieldName = strings.TrimSpace(header)
			}
			if fieldName == "" {
				continue
			}
			data[fieldName] = coerceCSVValue(schema, fieldName, row[i])
		}
		if err := ValidateCreateData(schema, data); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportRowError{Row: rowNum, Message: err.Error()})
			continue
		}
		if err := s.enforceUniqueness(ctx, schema, data, nil); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportRowError{Row: rowNum, Message: err.Error()})
			continue
		}
		if dryRun {
			result.Created++
			continue
		}
		if _, err := s.Create(ctx, tenantID, userID, entityID, data); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportRowError{Row: rowNum, Message: err.Error()})
			continue
		}
		result.Created++
	}
	return result, nil
}

func coerceCSVValue(schema *EntitySchema, fieldName, raw string) interface{} {
	raw = strings.TrimSpace(raw)
	var fieldType string
	for _, f := range schema.Fields {
		if f.Name == fieldName {
			fieldType = f.FieldType
			break
		}
	}
	switch fieldType {
	case "boolean":
		lower := strings.ToLower(raw)
		return lower == "true" || lower == "1" || lower == "yes"
	case "number", "integer", "decimal", "currency":
		var n float64
		if _, err := fmt.Sscanf(raw, "%f", &n); err == nil {
			return n
		}
		return raw
	case "choices":
		parts := strings.Split(raw, "|")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				out = append(out, p)
			}
		}
		return out
	default:
		return raw
	}
}

// Associate links two records in an N:N relationship.
func (s *Service) Associate(ctx context.Context, tenantID, userID, relationshipID, leftRecordID, rightRecordID uuid.UUID) error {
	links, ok := s.repo.(linkRepo)
	if !ok {
		return fmt.Errorf("link repository unavailable")
	}
	okRel, _, _, err := links.RelationshipExists(ctx, tenantID, relationshipID)
	if err != nil {
		return err
	}
	if !okRel {
		return ErrNotFound
	}
	return links.AssociateLinks(ctx, tenantID, relationshipID, leftRecordID, rightRecordID, userID)
}

// Disassociate removes an N:N link.
func (s *Service) Disassociate(ctx context.Context, tenantID, userID, relationshipID, leftRecordID, rightRecordID uuid.UUID) error {
	links, ok := s.repo.(linkRepo)
	if !ok {
		return fmt.Errorf("link repository unavailable")
	}
	return links.DisassociateLinks(ctx, tenantID, relationshipID, leftRecordID, rightRecordID, userID)
}

// ListRelated returns related record IDs for an N:N relationship.
func (s *Service) ListRelated(ctx context.Context, tenantID, relationshipID, recordID uuid.UUID, fromLeft bool) ([]uuid.UUID, error) {
	links, ok := s.repo.(linkRepo)
	if !ok {
		return nil, fmt.Errorf("link repository unavailable")
	}
	okRel, _, _, err := links.RelationshipExists(ctx, tenantID, relationshipID)
	if err != nil {
		return nil, err
	}
	if !okRel {
		return nil, ErrNotFound
	}
	return links.ListLinkedRecordIDs(ctx, tenantID, relationshipID, recordID, fromLeft)
}

func (s *Service) enforceUniqueness(ctx context.Context, schema *EntitySchema, data map[string]interface{}, exclude *uuid.UUID) error {
	checker, ok := s.repo.(uniquenessRepo)
	if !ok {
		return nil
	}
	for _, field := range schema.Fields {
		if !field.IsUnique {
			continue
		}
		value, present := data[field.Name]
		if !present || isEmptyValue(value) {
			continue
		}
		exists, err := checker.ExistsWithFieldValue(ctx, schema.TenantID, schema.EntityID, field.Name, value, exclude)
		if err != nil {
			return err
		}
		if exists {
			return &ValidationError{Field: field.Name, Message: "value must be unique"}
		}
	}
	for _, key := range schema.Keys {
		exists, err := checker.ExistsWithKeyValues(ctx, schema.TenantID, schema.EntityID, key.FieldNames, data, exclude)
		if err != nil {
			return err
		}
		if exists {
			return &ValidationError{Field: key.Name, Message: "alternate key conflict"}
		}
	}
	return nil
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
