package fakes

import (
	"context"
	"fmt"
	"time"

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

type fakeApplicationVersionRepo struct {
	data map[uuid.UUID]models.ApplicationVersion
}

func newFakeApplicationVersionRepo() *fakeApplicationVersionRepo {
	return &fakeApplicationVersionRepo{data: map[uuid.UUID]models.ApplicationVersion{}}
}
func (r *fakeApplicationVersionRepo) Create(ctx context.Context, entity *models.ApplicationVersion) error {
	if entity.ID == uuid.Nil {
		entity.ID = uuid.New()
	}
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeApplicationVersionRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.ApplicationVersion, error) {
	e, ok := r.data[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &e, nil
}
func (r *fakeApplicationVersionRepo) List(ctx context.Context, limit int, offset int) ([]models.ApplicationVersion, error) {
	out := []models.ApplicationVersion{}
	for _, v := range r.data {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeApplicationVersionRepo) Update(ctx context.Context, entity *models.ApplicationVersion) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeApplicationVersionRepo) Delete(ctx context.Context, id uuid.UUID) error {
	delete(r.data, id)
	return nil
}
func (r *fakeApplicationVersionRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.ApplicationVersion, error) {
	return r.List(ctx, limit, offset)
}
func (r *fakeApplicationVersionRepo) ListByField(ctx context.Context, field string, value any, limit int, offset int) ([]models.ApplicationVersion, error) {
	if field != "application_id" {
		return nil, nil
	}
	appID := value.(uuid.UUID)
	out := []models.ApplicationVersion{}
	for _, v := range r.data {
		if v.ApplicationID == appID {
			out = append(out, v)
		}
	}
	return out, nil
}

type fakeApplicationSnapshotRepo struct {
	data map[uuid.UUID]models.ApplicationSnapshot
}

func newFakeApplicationSnapshotRepo() *fakeApplicationSnapshotRepo {
	return &fakeApplicationSnapshotRepo{data: map[uuid.UUID]models.ApplicationSnapshot{}}
}
func (r *fakeApplicationSnapshotRepo) Create(ctx context.Context, entity *models.ApplicationSnapshot) error {
	if entity.ID == uuid.Nil {
		entity.ID = uuid.New()
	}
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeApplicationSnapshotRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.ApplicationSnapshot, error) {
	e, ok := r.data[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &e, nil
}
func (r *fakeApplicationSnapshotRepo) List(ctx context.Context, limit int, offset int) ([]models.ApplicationSnapshot, error) {
	out := []models.ApplicationSnapshot{}
	for _, v := range r.data {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeApplicationSnapshotRepo) Update(ctx context.Context, entity *models.ApplicationSnapshot) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeApplicationSnapshotRepo) Delete(ctx context.Context, id uuid.UUID) error {
	delete(r.data, id)
	return nil
}
func (r *fakeApplicationSnapshotRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.ApplicationSnapshot, error) {
	return r.List(ctx, limit, offset)
}
func (r *fakeApplicationSnapshotRepo) ListByField(ctx context.Context, field string, value any, limit int, offset int) ([]models.ApplicationSnapshot, error) {
	if field != "application_version_id" {
		return nil, nil
	}
	versionID := value.(uuid.UUID)
	out := []models.ApplicationSnapshot{}
	for _, v := range r.data {
		if v.ApplicationVersionID == versionID {
			out = append(out, v)
		}
	}
	return out, nil
}

// fake environment repo
type fakeEnvironmentRepo struct{ data map[uuid.UUID]models.Environment }

func newFakeEnvironmentRepo() *fakeEnvironmentRepo {
	return &fakeEnvironmentRepo{data: map[uuid.UUID]models.Environment{}}
}
func (r *fakeEnvironmentRepo) Create(ctx context.Context, entity *models.Environment) error {
	if entity.ID == uuid.Nil {
		entity.ID = uuid.New()
	}
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeEnvironmentRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Environment, error) {
	e, ok := r.data[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &e, nil
}
func (r *fakeEnvironmentRepo) List(ctx context.Context, limit int, offset int) ([]models.Environment, error) {
	out := []models.Environment{}
	for _, v := range r.data {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeEnvironmentRepo) Update(ctx context.Context, entity *models.Environment) error {
	if _, ok := r.data[entity.ID]; !ok {
		return gorm.ErrRecordNotFound
	}
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeEnvironmentRepo) Delete(ctx context.Context, id uuid.UUID) error {
	delete(r.data, id)
	return nil
}
func (r *fakeEnvironmentRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.Environment, error) {
	return r.List(ctx, limit, offset)
}
func (r *fakeEnvironmentRepo) ListByField(ctx context.Context, field string, value any, limit int, offset int) ([]models.Environment, error) {
	if field != "application_id" {
		return nil, nil
	}
	appID := value.(uuid.UUID)
	out := []models.Environment{}
	for _, v := range r.data {
		if v.ApplicationID == appID {
			out = append(out, v)
		}
	}
	return out, nil
}

// fake audit log repo
type fakeAuditLogRepo struct{ data map[uuid.UUID]models.AuditLog }

func newFakeAuditLogRepo() *fakeAuditLogRepo {
	return &fakeAuditLogRepo{data: map[uuid.UUID]models.AuditLog{}}
}
func (r *fakeAuditLogRepo) Create(ctx context.Context, entity *models.AuditLog) error {
	if entity.ID == uuid.Nil {
		entity.ID = uuid.New()
	}
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakeAuditLogRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.AuditLog, error) {
	e, ok := r.data[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &e, nil
}
func (r *fakeAuditLogRepo) List(ctx context.Context, limit int, offset int) ([]models.AuditLog, error) {
	out := []models.AuditLog{}
	for _, v := range r.data {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakeAuditLogRepo) Update(ctx context.Context, entity *models.AuditLog) error {
	return fmt.Errorf("fake: audit_logs is append-only")
}
func (r *fakeAuditLogRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return fmt.Errorf("fake: audit_logs is append-only")
}
func (r *fakeAuditLogRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.AuditLog, error) {
	return r.List(ctx, limit, offset)
}

// fake package repo (publish artifact metadata: packages table)
type fakePackageRepo struct{ data map[uuid.UUID]models.Package }

func newFakePackageRepo() *fakePackageRepo {
	return &fakePackageRepo{data: map[uuid.UUID]models.Package{}}
}
func (r *fakePackageRepo) Create(ctx context.Context, entity *models.Package) error {
	if entity.ID == uuid.Nil {
		entity.ID = uuid.New()
	}
	for _, existing := range r.data {
		if existing.ApplicationVersionID == entity.ApplicationVersionID {
			return fmt.Errorf("fake: package already exists for application_version_id %s", entity.ApplicationVersionID)
		}
		if entity.PackageHash != "" && existing.PackageHash == entity.PackageHash {
			return fmt.Errorf("fake: package_hash %s already exists", entity.PackageHash)
		}
	}
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakePackageRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Package, error) {
	e, ok := r.data[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return &e, nil
}
func (r *fakePackageRepo) List(ctx context.Context, limit int, offset int) ([]models.Package, error) {
	out := []models.Package{}
	for _, v := range r.data {
		out = append(out, v)
	}
	return out, nil
}
func (r *fakePackageRepo) Update(ctx context.Context, entity *models.Package) error {
	r.data[entity.ID] = *entity
	return nil
}
func (r *fakePackageRepo) Delete(ctx context.Context, id uuid.UUID) error {
	delete(r.data, id)
	return nil
}
func (r *fakePackageRepo) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]models.Package, error) {
	return r.List(ctx, limit, offset)
}
func (r *fakePackageRepo) ListByField(ctx context.Context, field string, value any, limit int, offset int) ([]models.Package, error) {
	if field != "application_version_id" {
		return nil, nil
	}
	versionID := value.(uuid.UUID)
	out := []models.Package{}
	for _, v := range r.data {
		if v.ApplicationVersionID == versionID {
			out = append(out, v)
		}
	}
	return out, nil
}

type fakeGenericRepo[T any] struct{ data map[uuid.UUID]T }

func newFakeGenericRepo[T any]() *fakeGenericRepo[T] {
	return &fakeGenericRepo[T]{data: map[uuid.UUID]T{}}
}
func (r *fakeGenericRepo[T]) Create(ctx context.Context, entity *T) error { return nil }
func (r *fakeGenericRepo[T]) GetByID(ctx context.Context, id uuid.UUID) (*T, error) {
	return nil, gorm.ErrRecordNotFound
}
func (r *fakeGenericRepo[T]) List(ctx context.Context, limit int, offset int) ([]T, error) {
	return nil, nil
}
func (r *fakeGenericRepo[T]) Update(ctx context.Context, entity *T) error { return nil }
func (r *fakeGenericRepo[T]) Delete(ctx context.Context, id uuid.UUID) error { return nil }
func (r *fakeGenericRepo[T]) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]T, error) {
	return nil, nil
}

// fake tenant session
type fakeTenantSession struct {
	apps                 *fakeApplicationRepo
	screens              *fakeScreenRepo
	controls             *fakeControlRepo
	controlProps         *fakeControlPropertyRepo
	formulas             *fakeFormulaRepo
	versions             *fakeApplicationVersionRepo
	snapshots            *fakeApplicationSnapshotRepo
	environments         *fakeEnvironmentRepo
	auditLogs            *fakeAuditLogRepo
	componentDefinitions *fakeGenericRepo[models.ComponentDefinition]
	entities             *fakeGenericRepo[models.Entity]
	entityFields         *fakeGenericRepo[models.EntityField]
	solutionPackages     *fakeGenericRepo[models.SolutionPackage]
	solutionPackageComponents *fakeGenericRepo[models.SolutionPackageComponent]
	connectors           *fakeGenericRepo[models.Connector]
	connectorActions     *fakeGenericRepo[models.ConnectorAction]
	packages             *fakePackageRepo
}

func (s *fakeTenantSession) Users() repositories.UserRepository               { return nil }
func (s *fakeTenantSession) Applications() repositories.ApplicationRepository { return s.apps }
func (s *fakeTenantSession) Environments() repositories.EnvironmentRepository { return s.environments }
func (s *fakeTenantSession) ApplicationVersions() repositories.ApplicationVersionRepository {
	return s.versions
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
func (s *fakeTenantSession) Connectors() repositories.ConnectorRepository             { return s.connectors }
func (s *fakeTenantSession) ConnectorActions() repositories.ConnectorActionRepository { return s.connectorActions }
func (s *fakeTenantSession) Secrets() repositories.SecretRepository { return nil }
func (s *fakeTenantSession) EnvironmentSecretOverrides() repositories.EnvironmentSecretOverrideRepository {
	return nil
}
func (s *fakeTenantSession) ConnectorUserConnections() repositories.ConnectorUserConnectionRepository {
	return nil
}
func (s *fakeTenantSession) Workflows() repositories.WorkflowRepository { return nil }
func (s *fakeTenantSession) WorkflowRuns() repositories.WorkflowRunRepository {
	return nil
}
func (s *fakeTenantSession) Permissions() repositories.PermissionRepository { return nil }
func (s *fakeTenantSession) AuditLogs() repositories.AuditLogRepository               { return s.auditLogs }
func (s *fakeTenantSession) Packages() repositories.PackageRepository                 { return s.packages }
func (s *fakeTenantSession) ApplicationSnapshots() repositories.ApplicationSnapshotRepository {
	return s.snapshots
}
func (s *fakeTenantSession) ComponentDefinitions() repositories.ComponentDefinitionRepository {
	return s.componentDefinitions
}
func (s *fakeTenantSession) Entities() repositories.EntityRepository         { return s.entities }
func (s *fakeTenantSession) EntityFields() repositories.EntityFieldRepository { return s.entityFields }
func (s *fakeTenantSession) SolutionPackages() repositories.SolutionPackageRepository {
	return s.solutionPackages
}
func (s *fakeTenantSession) SolutionPackageComponents() repositories.SolutionPackageComponentRepository {
	return s.solutionPackageComponents
}
func (s *fakeTenantSession) Transaction(ctx context.Context, fn func(session repositories.TenantSession) error) error {
	return fn(s)
}

// fake store
type FakeStore struct {
	apps                 *fakeApplicationRepo
	screens              *fakeScreenRepo
	controls             *fakeControlRepo
	controlProps         *fakeControlPropertyRepo
	formulas             *fakeFormulaRepo
	versions             *fakeApplicationVersionRepo
	snapshots            *fakeApplicationSnapshotRepo
	environments         *fakeEnvironmentRepo
	auditLogs            *fakeAuditLogRepo
	componentDefinitions *fakeGenericRepo[models.ComponentDefinition]
	entities             *fakeGenericRepo[models.Entity]
	entityFields         *fakeGenericRepo[models.EntityField]
	solutionPackages     *fakeGenericRepo[models.SolutionPackage]
	solutionPackageComponents *fakeGenericRepo[models.SolutionPackageComponent]
	connectors           *fakeGenericRepo[models.Connector]
	connectorActions     *fakeGenericRepo[models.ConnectorAction]
	packages             *fakePackageRepo
}

func NewFakeStore() *FakeStore {
	return &FakeStore{
		apps:                 newFakeApplicationRepo(),
		screens:              newFakeScreenRepo(),
		controls:             newFakeControlRepo(),
		controlProps:         newFakeControlPropertyRepo(),
		formulas:             newFakeFormulaRepo(),
		versions:             newFakeApplicationVersionRepo(),
		snapshots:            newFakeApplicationSnapshotRepo(),
		environments:         newFakeEnvironmentRepo(),
		auditLogs:            newFakeAuditLogRepo(),
		componentDefinitions: newFakeGenericRepo[models.ComponentDefinition](),
		entities:             newFakeGenericRepo[models.Entity](),
		entityFields:         newFakeGenericRepo[models.EntityField](),
		solutionPackages:     newFakeGenericRepo[models.SolutionPackage](),
		solutionPackageComponents: newFakeGenericRepo[models.SolutionPackageComponent](),
		connectors:           newFakeGenericRepo[models.Connector](),
		connectorActions:     newFakeGenericRepo[models.ConnectorAction](),
		packages:             newFakePackageRepo(),
	}
}

// Expose internals for tests (convenience)
func (s *FakeStore) Apps() *fakeApplicationRepo                 { return s.apps }
func (s *FakeStore) ScreensRepo() *fakeScreenRepo               { return s.screens }
func (s *FakeStore) ControlsRepo() *fakeControlRepo             { return s.controls }
func (s *FakeStore) ControlPropsRepo() *fakeControlPropertyRepo { return s.controlProps }
func (s *FakeStore) FormulasRepo() *fakeFormulaRepo             { return s.formulas }
func (s *FakeStore) VersionsRepo() *fakeApplicationVersionRepo  { return s.versions }
func (s *FakeStore) SnapshotsRepo() *fakeApplicationSnapshotRepo { return s.snapshots }
func (s *FakeStore) EnvironmentsRepo() *fakeEnvironmentRepo     { return s.environments }
func (s *FakeStore) AuditLogsRepo() *fakeAuditLogRepo           { return s.auditLogs }
func (s *FakeStore) PackagesRepo() *fakePackageRepo             { return s.packages }
func (s *FakeStore) Tenants() repositories.TenantRepository { return nil }
func (s *FakeStore) FindWorkflowByIDUnscoped(ctx context.Context, id uuid.UUID) (*models.Workflow, error) {
	return nil, fmt.Errorf("not implemented")
}
func (s *FakeStore) ClaimDueScheduledWorkflows(ctx context.Context, now time.Time, limit int) ([]models.Workflow, error) {
	return nil, fmt.Errorf("not implemented")
}
func (s *FakeStore) WithTenant(ctx context.Context, tenantID uuid.UUID) repositories.TenantSession {
	return &fakeTenantSession{
		apps:                 s.apps,
		screens:              s.screens,
		controls:             s.controls,
		controlProps:         s.controlProps,
		formulas:             s.formulas,
		versions:             s.versions,
		snapshots:            s.snapshots,
		environments:         s.environments,
		auditLogs:            s.auditLogs,
		componentDefinitions: s.componentDefinitions,
		entities:             s.entities,
		entityFields:         s.entityFields,
		solutionPackages:     s.solutionPackages,
		solutionPackageComponents: s.solutionPackageComponents,
		connectors:           s.connectors,
		connectorActions:     s.connectorActions,
		packages:             s.packages,
	}
}
