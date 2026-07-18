package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrEnvironmentNotFound = errors.New("environment not found")
	ErrVersionNotReleased  = errors.New("version is not released")
	ErrVersionMismatch     = errors.New("version does not belong to application")
)

// EnvironmentService manages per-application deployment environments
// (development / test / production) and their promoted version pointer.
type EnvironmentService struct {
	store repositories.Store
}

func NewEnvironmentService(store repositories.Store) *EnvironmentService {
	return &EnvironmentService{store: store}
}

func (s *EnvironmentService) List(ctx context.Context, tenantID, appID uuid.UUID) ([]contracts.EnvironmentDTO, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if _, err := sess.Applications().GetByID(ctx, appID); err != nil {
		return nil, fmt.Errorf("list environments: application not found: %w", err)
	}
	items, err := s.listByApplication(ctx, sess, tenantID, appID)
	if err != nil {
		return nil, err
	}
	out := make([]contracts.EnvironmentDTO, 0, len(items))
	for i := range items {
		dto, dtoErr := s.toDTO(ctx, sess, &items[i])
		if dtoErr != nil {
			return nil, dtoErr
		}
		out = append(out, dto)
	}
	return out, nil
}

func (s *EnvironmentService) Get(ctx context.Context, tenantID, appID, envID uuid.UUID) (*contracts.EnvironmentDTO, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	env, err := s.getOwned(ctx, sess, appID, envID)
	if err != nil {
		return nil, err
	}
	dto, err := s.toDTO(ctx, sess, env)
	if err != nil {
		return nil, err
	}
	return &dto, nil
}

func (s *EnvironmentService) Create(ctx context.Context, tenantID, appID uuid.UUID, name, environmentType string) (*contracts.EnvironmentDTO, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if _, err := sess.Applications().GetByID(ctx, appID); err != nil {
		return nil, fmt.Errorf("create environment: application not found: %w", err)
	}
	env := &models.Environment{
		TenantID:        tenantID,
		ApplicationID:   appID,
		Name:            strings.TrimSpace(name),
		EnvironmentType: environmentType,
	}
	if err := sess.Environments().Create(ctx, env); err != nil {
		return nil, fmt.Errorf("create environment: %w", err)
	}
	dto, err := s.toDTO(ctx, sess, env)
	if err != nil {
		return nil, err
	}
	return &dto, nil
}

func (s *EnvironmentService) Update(ctx context.Context, tenantID, appID, envID uuid.UUID, updates map[string]interface{}) (*contracts.EnvironmentDTO, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	env, err := s.getOwned(ctx, sess, appID, envID)
	if err != nil {
		return nil, err
	}
	if v, ok := updates["name"].(string); ok {
		env.Name = strings.TrimSpace(v)
	}
	if v, ok := updates["environment_type"].(string); ok {
		env.EnvironmentType = v
	}
	if err := sess.Environments().Update(ctx, env); err != nil {
		return nil, fmt.Errorf("update environment: %w", err)
	}
	dto, err := s.toDTO(ctx, sess, env)
	if err != nil {
		return nil, err
	}
	return &dto, nil
}

func (s *EnvironmentService) Delete(ctx context.Context, tenantID, appID, envID uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	if _, err := s.getOwned(ctx, sess, appID, envID); err != nil {
		return err
	}
	if err := sess.Environments().Delete(ctx, envID); err != nil {
		return fmt.Errorf("delete environment: %w", err)
	}
	return nil
}

// Promote points an environment's current_version_id at a released
// application version, e.g. moving a build from staging into production.
func (s *EnvironmentService) Promote(ctx context.Context, tenantID, appID, envID, versionID uuid.UUID) (*contracts.EnvironmentDTO, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	env, err := s.getOwned(ctx, sess, appID, envID)
	if err != nil {
		return nil, err
	}
	version, err := sess.ApplicationVersions().GetByID(ctx, versionID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("promote: version not found: %w", err)
		}
		return nil, fmt.Errorf("promote: load version: %w", err)
	}
	if version.ApplicationID != appID {
		return nil, ErrVersionMismatch
	}
	if version.Status != "released" {
		return nil, ErrVersionNotReleased
	}

	env.CurrentVersionID = &version.ID
	if err := sess.Environments().Update(ctx, env); err != nil {
		return nil, fmt.Errorf("promote: update environment: %w", err)
	}
	dto, err := s.toDTO(ctx, sess, env)
	if err != nil {
		return nil, err
	}
	return &dto, nil
}

func (s *EnvironmentService) getOwned(ctx context.Context, sess repositories.TenantSession, appID, envID uuid.UUID) (*models.Environment, error) {
	env, err := sess.Environments().GetByID(ctx, envID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEnvironmentNotFound
		}
		return nil, fmt.Errorf("get environment: %w", err)
	}
	if env.ApplicationID != appID {
		return nil, ErrEnvironmentNotFound
	}
	return env, nil
}

func (s *EnvironmentService) listByApplication(ctx context.Context, sess repositories.TenantSession, tenantID, appID uuid.UUID) ([]models.Environment, error) {
	if repo, ok := any(sess.Environments()).(byFieldRepo[models.Environment]); ok {
		items, err := repo.ListByField(ctx, "application_id", appID, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("list environments: %w", err)
		}
		return items, nil
	}
	items, err := sess.Environments().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("list environments: %w", err)
	}
	var filtered []models.Environment
	for _, item := range items {
		if item.ApplicationID == appID {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *EnvironmentService) toDTO(ctx context.Context, sess repositories.TenantSession, env *models.Environment) (contracts.EnvironmentDTO, error) {
	dto := contracts.EnvironmentDTO{
		ID:               env.ID,
		TenantID:         env.TenantID,
		ApplicationID:    env.ApplicationID,
		Name:             env.Name,
		EnvironmentType:  env.EnvironmentType,
		CurrentVersionID: env.CurrentVersionID,
		CreatedOn:        env.CreatedOn,
		CreatedBy:        env.CreatedBy,
		ModifiedOn:       env.ModifiedOn,
		ModifiedBy:       env.ModifiedBy,
	}
	if env.CurrentVersionID != nil {
		version, err := sess.ApplicationVersions().GetByID(ctx, *env.CurrentVersionID)
		if err == nil {
			dto.CurrentVersion = &version.Version
		}
	}
	return dto, nil
}
