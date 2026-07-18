package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	api "github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrPackageNotFound      = errors.New("package not found")
	ErrPackageMasterRO      = errors.New("master solution is read-only")
	ErrPackageManagedRO     = errors.New("managed packages cannot be edited")
	ErrInvalidComponentType = errors.New("invalid component type")
	ErrComponentNotFound    = errors.New("component not found")
	ErrComponentExists      = errors.New("component already in package")
)

type SolutionPackageService struct {
	store repositories.Store
}

func NewSolutionPackageService(store repositories.Store) *SolutionPackageService {
	return &SolutionPackageService{store: store}
}

func (s *SolutionPackageService) EnsureMaster(ctx context.Context, tenantID uuid.UUID) (*models.SolutionPackage, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	packages, err := sess.SolutionPackages().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("list packages: %w", err)
	}
	for i := range packages {
		if packages[i].IsMaster {
			return &packages[i], nil
		}
	}
	master := &models.SolutionPackage{
		TenantID:    tenantID,
		Name:        "master",
		DisplayName: "Master Solution",
		Description: "System package containing every component in the environment.",
		Version:     "1.0.0",
		Managed:     true,
		IsMaster:    true,
		Status:      "system",
	}
	if err := sess.SolutionPackages().Create(ctx, master); err != nil {
		// Race: another request may have created master concurrently.
		packages, listErr := sess.SolutionPackages().ListByTenant(ctx, tenantID, 0, 0)
		if listErr == nil {
			for i := range packages {
				if packages[i].IsMaster {
					return &packages[i], nil
				}
			}
		}
		return nil, fmt.Errorf("create master solution: %w", err)
	}
	return master, nil
}

func (s *SolutionPackageService) List(ctx context.Context, tenantID uuid.UUID) ([]api.SolutionPackageDTO, error) {
	if _, err := s.EnsureMaster(ctx, tenantID); err != nil {
		return nil, err
	}
	sess := s.store.WithTenant(ctx, tenantID)
	packages, err := sess.SolutionPackages().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("list packages: %w", err)
	}

	masterCount, err := s.masterComponentCount(ctx, sess, tenantID)
	if err != nil {
		return nil, err
	}

	out := make([]api.SolutionPackageDTO, 0, len(packages))
	for i := range packages {
		dto := toPackageDTO(&packages[i], 0)
		if packages[i].IsMaster {
			dto.ComponentCount = masterCount
		} else {
			count, countErr := s.refComponentCount(ctx, sess, tenantID, packages[i].ID)
			if countErr != nil {
				return nil, countErr
			}
			dto.ComponentCount = count
		}
		out = append(out, dto)
	}

	// Master first, then alphabetical by display name.
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].IsMaster != out[j].IsMaster {
			return out[i].IsMaster
		}
		return strings.ToLower(out[i].DisplayName) < strings.ToLower(out[j].DisplayName)
	})
	return out, nil
}

func (s *SolutionPackageService) Get(ctx context.Context, tenantID, id uuid.UUID) (*api.SolutionPackageDTO, error) {
	if _, err := s.EnsureMaster(ctx, tenantID); err != nil {
		return nil, err
	}
	sess := s.store.WithTenant(ctx, tenantID)
	pkg, err := sess.SolutionPackages().GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPackageNotFound
		}
		return nil, fmt.Errorf("get package: %w", err)
	}
	dto := toPackageDTO(pkg, 0)
	if pkg.IsMaster {
		count, countErr := s.masterComponentCount(ctx, sess, tenantID)
		if countErr != nil {
			return nil, countErr
		}
		dto.ComponentCount = count
	} else {
		count, countErr := s.refComponentCount(ctx, sess, tenantID, pkg.ID)
		if countErr != nil {
			return nil, countErr
		}
		dto.ComponentCount = count
	}
	return &dto, nil
}

func (s *SolutionPackageService) Create(ctx context.Context, tenantID uuid.UUID, name, displayName, description string) (*api.SolutionPackageDTO, error) {
	if _, err := s.EnsureMaster(ctx, tenantID); err != nil {
		return nil, err
	}
	pkg := &models.SolutionPackage{
		TenantID:    tenantID,
		Name:        strings.TrimSpace(name),
		DisplayName: strings.TrimSpace(displayName),
		Description: strings.TrimSpace(description),
		Version:     "1.0.0",
		Managed:     false,
		IsMaster:    false,
		Status:      "draft",
	}
	sess := s.store.WithTenant(ctx, tenantID)
	if err := sess.SolutionPackages().Create(ctx, pkg); err != nil {
		return nil, fmt.Errorf("create package: %w", err)
	}
	dto := toPackageDTO(pkg, 0)
	return &dto, nil
}

func (s *SolutionPackageService) Update(ctx context.Context, tenantID, id uuid.UUID, updates map[string]interface{}) (*api.SolutionPackageDTO, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	pkg, err := sess.SolutionPackages().GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPackageNotFound
		}
		return nil, fmt.Errorf("get package: %w", err)
	}
	if pkg.IsMaster {
		return nil, ErrPackageMasterRO
	}
	if pkg.Managed {
		return nil, ErrPackageManagedRO
	}
	if v, ok := updates["name"].(string); ok {
		pkg.Name = strings.TrimSpace(v)
	}
	if v, ok := updates["display_name"].(string); ok {
		pkg.DisplayName = strings.TrimSpace(v)
	}
	if v, ok := updates["description"].(string); ok {
		pkg.Description = strings.TrimSpace(v)
	}
	if v, ok := updates["version"].(string); ok {
		pkg.Version = strings.TrimSpace(v)
	}
	if err := sess.SolutionPackages().Update(ctx, pkg); err != nil {
		return nil, fmt.Errorf("update package: %w", err)
	}
	count, countErr := s.refComponentCount(ctx, sess, tenantID, pkg.ID)
	if countErr != nil {
		return nil, countErr
	}
	dto := toPackageDTO(pkg, count)
	return &dto, nil
}

func (s *SolutionPackageService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	pkg, err := sess.SolutionPackages().GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrPackageNotFound
		}
		return fmt.Errorf("get package: %w", err)
	}
	if pkg.IsMaster {
		return ErrPackageMasterRO
	}
	refs, err := s.listRefs(ctx, sess, tenantID, id)
	if err != nil {
		return err
	}
	for _, ref := range refs {
		if delErr := sess.SolutionPackageComponents().Delete(ctx, ref.ID); delErr != nil {
			return fmt.Errorf("delete package component: %w", delErr)
		}
	}
	if err := sess.SolutionPackages().Delete(ctx, id); err != nil {
		return fmt.Errorf("delete package: %w", err)
	}
	return nil
}

func (s *SolutionPackageService) ListComponents(ctx context.Context, tenantID, packageID uuid.UUID) ([]api.PackageComponentDTO, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	pkg, err := sess.SolutionPackages().GetByID(ctx, packageID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPackageNotFound
		}
		return nil, fmt.Errorf("get package: %w", err)
	}
	if pkg.IsMaster {
		return s.listMasterComponents(ctx, sess, tenantID, packageID)
	}
	refs, err := s.listRefs(ctx, sess, tenantID, packageID)
	if err != nil {
		return nil, err
	}
	out := make([]api.PackageComponentDTO, 0, len(refs))
	for _, ref := range refs {
		name, displayName, resolveErr := s.resolveComponent(ctx, sess, tenantID, ref.ComponentType, ref.ComponentID)
		if resolveErr != nil {
			// Skip orphaned refs whose target was deleted.
			continue
		}
		out = append(out, api.PackageComponentDTO{
			ID:            ref.ID,
			PackageID:     ref.PackageID,
			ComponentType: ref.ComponentType,
			ComponentID:   ref.ComponentID,
			Name:          name,
			DisplayName:   displayName,
			AddedOn:       ref.CreatedOn,
			AddedBy:       ref.CreatedBy,
		})
	}
	return out, nil
}

func (s *SolutionPackageService) AddComponent(ctx context.Context, tenantID, packageID uuid.UUID, componentType string, componentID uuid.UUID) (*api.PackageComponentDTO, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	pkg, err := sess.SolutionPackages().GetByID(ctx, packageID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPackageNotFound
		}
		return nil, fmt.Errorf("get package: %w", err)
	}
	if pkg.IsMaster {
		return nil, ErrPackageMasterRO
	}
	if pkg.Managed {
		return nil, ErrPackageManagedRO
	}
	if componentType != "app" && componentType != "table" {
		return nil, ErrInvalidComponentType
	}
	name, displayName, err := s.resolveComponent(ctx, sess, tenantID, componentType, componentID)
	if err != nil {
		return nil, err
	}
	refs, err := s.listRefs(ctx, sess, tenantID, packageID)
	if err != nil {
		return nil, err
	}
	for _, ref := range refs {
		if ref.ComponentType == componentType && ref.ComponentID == componentID {
			return nil, ErrComponentExists
		}
	}
	ref := &models.SolutionPackageComponent{
		TenantID:      tenantID,
		PackageID:     packageID,
		ComponentType: componentType,
		ComponentID:   componentID,
	}
	if err := sess.SolutionPackageComponents().Create(ctx, ref); err != nil {
		return nil, fmt.Errorf("add component: %w", err)
	}
	return &api.PackageComponentDTO{
		ID:            ref.ID,
		PackageID:     ref.PackageID,
		ComponentType: ref.ComponentType,
		ComponentID:   ref.ComponentID,
		Name:          name,
		DisplayName:   displayName,
		AddedOn:       ref.CreatedOn,
		AddedBy:       ref.CreatedBy,
	}, nil
}

func (s *SolutionPackageService) RemoveComponent(ctx context.Context, tenantID, packageID uuid.UUID, componentType string, componentID uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	pkg, err := sess.SolutionPackages().GetByID(ctx, packageID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrPackageNotFound
		}
		return fmt.Errorf("get package: %w", err)
	}
	if pkg.IsMaster {
		return ErrPackageMasterRO
	}
	if pkg.Managed {
		return ErrPackageManagedRO
	}
	refs, err := s.listRefs(ctx, sess, tenantID, packageID)
	if err != nil {
		return err
	}
	for _, ref := range refs {
		if ref.ComponentType == componentType && ref.ComponentID == componentID {
			if delErr := sess.SolutionPackageComponents().Delete(ctx, ref.ID); delErr != nil {
				return fmt.Errorf("remove component: %w", delErr)
			}
			return nil
		}
	}
	return ErrComponentNotFound
}

func (s *SolutionPackageService) masterComponentCount(ctx context.Context, sess repositories.TenantSession, tenantID uuid.UUID) (int64, error) {
	apps, err := sess.Applications().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return 0, fmt.Errorf("list applications: %w", err)
	}
	entities, err := sess.Entities().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return 0, fmt.Errorf("list entities: %w", err)
	}
	return int64(len(apps) + len(entities)), nil
}

func (s *SolutionPackageService) refComponentCount(ctx context.Context, sess repositories.TenantSession, tenantID, packageID uuid.UUID) (int64, error) {
	refs, err := s.listRefs(ctx, sess, tenantID, packageID)
	if err != nil {
		return 0, err
	}
	return int64(len(refs)), nil
}

func (s *SolutionPackageService) listRefs(ctx context.Context, sess repositories.TenantSession, tenantID, packageID uuid.UUID) ([]models.SolutionPackageComponent, error) {
	if repo, ok := any(sess.SolutionPackageComponents()).(byFieldRepo[models.SolutionPackageComponent]); ok {
		items, err := repo.ListByField(ctx, "package_id", packageID, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("list package components: %w", err)
		}
		return items, nil
	}
	items, err := sess.SolutionPackageComponents().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("list package components: %w", err)
	}
	var filtered []models.SolutionPackageComponent
	for _, item := range items {
		if item.PackageID == packageID {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *SolutionPackageService) listMasterComponents(ctx context.Context, sess repositories.TenantSession, tenantID, packageID uuid.UUID) ([]api.PackageComponentDTO, error) {
	apps, err := sess.Applications().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("list applications: %w", err)
	}
	entities, err := sess.Entities().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("list entities: %w", err)
	}
	out := make([]api.PackageComponentDTO, 0, len(apps)+len(entities))
	for _, app := range apps {
		out = append(out, api.PackageComponentDTO{
			ID:            app.ID,
			PackageID:     packageID,
			ComponentType: "app",
			ComponentID:   app.ID,
			Name:          app.Name,
			DisplayName:   app.Name,
			AddedOn:       app.CreatedOn,
		})
	}
	for _, entity := range entities {
		display := entity.DisplayName
		if display == "" {
			display = entity.Name
		}
		out = append(out, api.PackageComponentDTO{
			ID:            entity.ID,
			PackageID:     packageID,
			ComponentType: "table",
			ComponentID:   entity.ID,
			Name:          entity.Name,
			DisplayName:   display,
			AddedOn:       entity.CreatedOn,
		})
	}
	return out, nil
}

func (s *SolutionPackageService) resolveComponent(ctx context.Context, sess repositories.TenantSession, tenantID uuid.UUID, componentType string, componentID uuid.UUID) (string, string, error) {
	switch componentType {
	case "app":
		app, err := sess.Applications().GetByID(ctx, componentID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return "", "", ErrComponentNotFound
			}
			return "", "", fmt.Errorf("get application: %w", err)
		}
		if app.TenantID != tenantID {
			return "", "", ErrComponentNotFound
		}
		return app.Name, app.Name, nil
	case "table":
		entity, err := sess.Entities().GetByID(ctx, componentID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return "", "", ErrComponentNotFound
			}
			return "", "", fmt.Errorf("get entity: %w", err)
		}
		if entity.TenantID != tenantID {
			return "", "", ErrComponentNotFound
		}
		display := entity.DisplayName
		if display == "" {
			display = entity.Name
		}
		return entity.Name, display, nil
	default:
		return "", "", ErrInvalidComponentType
	}
}

func toPackageDTO(pkg *models.SolutionPackage, count int64) api.SolutionPackageDTO {
	return api.SolutionPackageDTO{
		ID:             pkg.ID,
		TenantID:       pkg.TenantID,
		Name:           pkg.Name,
		DisplayName:    pkg.DisplayName,
		Description:    pkg.Description,
		Version:        pkg.Version,
		Managed:        pkg.Managed,
		IsMaster:       pkg.IsMaster,
		Status:         pkg.Status,
		ComponentCount: count,
		CreatedOn:      pkg.CreatedOn,
		CreatedBy:      pkg.CreatedBy,
		ModifiedOn:     pkg.ModifiedOn,
		ModifiedBy:     pkg.ModifiedBy,
	}
}
