package fakes

import (
	"context"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Minimal in-memory fake implementations for unit tests

type fakeApplicationRepo struct {
	data map[uuid.UUID]models.Application
}

func newFakeApplicationRepo() *fakeApplicationRepo {
	return &fakeApplicationRepo{data: map[uuid.UUID]models.Application{}}
}
func (r *fakeApplicationRepo) Create(ctx context.Context, entity *models.Application) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeApplicationRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Application, error) {
	e, ok := r.data[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &e, nil
}
func (r *fakeApplicationRepo) List(ctx context.Context, limit int, offset int) ([]models.Application, error) {
	out := []models.Application{}
	for _, v := range r.data {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeApplicationRepo) Update(ctx context.Context, entity *models.Application) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeApplicationRepo) Delete(ctx context.Context, id uuid.UUID) error {
	delete(r.data, id)
	return nil
}
func (r *fakeApplicationRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.Application, error) {
	return r.List(ctx, limit, offset)
}

// fake screen repo
type fakeScreenRepo struct{ data map[uuid.UUID]models.Screen }

func newFakeScreenRepo() *fakeScreenRepo { return &fakeScreenRepo{data: map[uuid.UUID]models.Screen{}} }
func (r *fakeScreenRepo) Create(ctx context.Context, entity *models.Screen) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeScreenRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Screen, error) {
	e, ok := r.data[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &e, nil
}
func (r *fakeScreenRepo) List(ctx context.Context, limit int, offset int) ([]models.Screen, error) {
	out := []models.Screen{}
	for _, v := range r.data {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeScreenRepo) Update(ctx context.Context, entity *models.Screen) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeScreenRepo) Delete(ctx context.Context, id uuid.UUID) error {
	delete(r.data, id)
	return nil
}
func (r *fakeScreenRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.Screen, error) {
	return r.List(ctx, limit, offset)
}

// fake control repo
type fakeControlRepo struct{ data map[uuid.UUID]models.Control }

func newFakeControlRepo() *fakeControlRepo {
	return &fakeControlRepo{data: map[uuid.UUID]models.Control{}}
}
func (r *fakeControlRepo) Create(ctx context.Context, entity *models.Control) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeControlRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Control, error) {
	e, ok := r.data[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &e, nil
}
func (r *fakeControlRepo) List(ctx context.Context, limit int, offset int) ([]models.Control, error) {
	out := []models.Control{}
	for _, v := range r.data {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeControlRepo) Update(ctx context.Context, entity *models.Control) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeControlRepo) Delete(ctx context.Context, id uuid.UUID) error {
	delete(r.data, id)
	return nil
}
func (r *fakeControlRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.Control, error) {
	return r.List(ctx, limit, offset)
}

// fake control property repo
type fakeControlPropertyRepo struct {
	data map[uuid.UUID]models.ControlProperty
}

func newFakeControlPropertyRepo() *fakeControlPropertyRepo {
	return &fakeControlPropertyRepo{data: map[uuid.UUID]models.ControlProperty{}}
}
func (r *fakeControlPropertyRepo) Create(ctx context.Context, entity *models.ControlProperty) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeControlPropertyRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.ControlProperty, error) {
	e, ok := r.data[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &e, nil
}
func (r *fakeControlPropertyRepo) List(ctx context.Context, limit int, offset int) ([]models.ControlProperty, error) {
	out := []models.ControlProperty{}
	for _, v := range r.data {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeControlPropertyRepo) Update(ctx context.Context, entity *models.ControlProperty) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeControlPropertyRepo) Delete(ctx context.Context, id uuid.UUID) error {
	delete(r.data, id)
	return nil
}
func (r *fakeControlPropertyRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.ControlProperty, error) {
	return r.List(ctx, limit, offset)
}

// fake formula repo
type fakeFormulaRepo struct{ data map[uuid.UUID]models.Formula }

func newFakeFormulaRepo() *fakeFormulaRepo {
	return &fakeFormulaRepo{data: map[uuid.UUID]models.Formula{}}
}
func (r *fakeFormulaRepo) Create(ctx context.Context, entity *models.Formula) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeFormulaRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Formula, error) {
	e, ok := r.data[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &e, nil
}
func (r *fakeFormulaRepo) List(ctx context.Context, limit int, offset int) ([]models.Formula, error) {
	out := []models.Formula{}
	for _, v := range r.data {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeFormulaRepo) Update(ctx context.Context, entity *models.Formula) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeFormulaRepo) Delete(ctx context.Context, id uuid.UUID) error {
	delete(r.data, id)
	return nil
}
func (r *fakeFormulaRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.Formula, error) {
	return r.List(ctx, limit, offset)
}

// fake tenant session
type fakeTenantSession struct {
	apps         *fakeApplicationRepo
	screens      *fakeScreenRepo
	controls     *fakeControlRepo
	controlProps *fakeControlPropertyRepo
	formulas     *fakeFormulaRepo
}

func (s *fakeTenantSession) Users() repositories.UserRepository               { return nil }
func (s *fakeTenantSession) Applications() repositories.ApplicationRepository { return s.apps }
func (s *fakeTenantSession) Environments() repositories.EnvironmentRepository { return nil }
func (s *fakeTenantSession) ApplicationVersions() repositories.ApplicationVersionRepository {
	return nil
}
func (s *fakeTenantSession) Screens() repositories.ScreenRepository   { return s.screens }
func (s *fakeTenantSession) Controls() repositories.ControlRepository { return s.controls }
func (s *fakeTenantSession) ControlProperties() repositories.ControlPropertyRepository {
	return s.controlProps
}
func (s *fakeTenantSession) Formulas() repositories.FormulaRepository                 { return s.formulas }
func (s *fakeTenantSession) Events() repositories.EventRepository                     { return nil }
func (s *fakeTenantSession) Variables() repositories.VariableRepository               { return nil }
func (s *fakeTenantSession) Collections() repositories.CollectionRepository           { return nil }
func (s *fakeTenantSession) Connectors() repositories.ConnectorRepository             { return nil }
func (s *fakeTenantSession) ConnectorActions() repositories.ConnectorActionRepository { return nil }
func (s *fakeTenantSession) Permissions() repositories.PermissionRepository           { return nil }
func (s *fakeTenantSession) AuditLogs() repositories.AuditLogRepository               { return nil }
func (s *fakeTenantSession) Packages() repositories.PackageRepository                 { return nil }
func (s *fakeTenantSession) ApplicationSnapshots() repositories.ApplicationSnapshotRepository {
	return nil
}
func (s *fakeTenantSession) Transaction(ctx context.Context, fn func(session repositories.TenantSession) error) error {
	return fn(s)
}

// fake store
type FakeStore struct {
	apps         *fakeApplicationRepo
	screens      *fakeScreenRepo
	controls     *fakeControlRepo
	controlProps *fakeControlPropertyRepo
	formulas     *fakeFormulaRepo
}

func NewFakeStore() *FakeStore {
	return &FakeStore{apps: newFakeApplicationRepo(), screens: newFakeScreenRepo(), controls: newFakeControlRepo(), controlProps: newFakeControlPropertyRepo(), formulas: newFakeFormulaRepo()}
}

// Expose internals for tests (convenience)
func (s *FakeStore) Apps() *fakeApplicationRepo                 { return s.apps }
func (s *FakeStore) ScreensRepo() *fakeScreenRepo               { return s.screens }
func (s *FakeStore) ControlsRepo() *fakeControlRepo             { return s.controls }
func (s *FakeStore) ControlPropsRepo() *fakeControlPropertyRepo { return s.controlProps }
func (s *FakeStore) FormulasRepo() *fakeFormulaRepo             { return s.formulas }
func (s *FakeStore) Tenants() repositories.TenantRepository     { return nil }
func (s *FakeStore) WithTenant(ctx context.Context, tenantID uuid.UUID) repositories.TenantSession {
	return &fakeTenantSession{apps: s.apps, screens: s.screens, controls: s.controls, controlProps: s.controlProps, formulas: s.formulas}
}
