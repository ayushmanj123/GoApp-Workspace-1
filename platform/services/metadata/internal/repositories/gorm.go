package repositories

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"github.com/goapps-platform/metadata-service/internal/database"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GormRepository[T any] struct {
	db       *gorm.DB
	tenantID *uuid.UUID
	inTx     bool
}

func NewGormRepository[T any](db *gorm.DB) *GormRepository[T] {
	return &GormRepository[T]{db: db}
}

func NewTenantGormRepository[T any](db *gorm.DB, tenantID uuid.UUID) *GormRepository[T] {
	return &GormRepository[T]{db: db, tenantID: &tenantID}
}

func newTenantTxGormRepository[T any](tx *gorm.DB, tenantID uuid.UUID) *GormRepository[T] {
	return &GormRepository[T]{db: tx, tenantID: &tenantID, inTx: true}
}

func (r *GormRepository[T]) Create(ctx context.Context, entity *T) error {
	if entity == nil {
		return fmt.Errorf("repository: nil entity")
	}
	if err := r.bindTenant(entity); err != nil {
		return err
	}
	return r.execute(ctx, func(db *gorm.DB) error {
		if err := db.Create(entity).Error; err != nil {
			return fmt.Errorf("repository: create: %w", err)
		}
		return nil
	})
}

func (r *GormRepository[T]) GetByID(ctx context.Context, id uuid.UUID) (*T, error) {
	if id == uuid.Nil {
		return nil, fmt.Errorf("repository: id is required")
	}
	var entity T
	err := r.execute(ctx, func(db *gorm.DB) error {
		query := db.Where("id = ?", id)
		if r.tenantID != nil {
			query = query.Where("tenant_id = ?", *r.tenantID)
		}
		return query.First(&entity).Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err != nil {
		return nil, fmt.Errorf("repository: get by id: %w", err)
	}
	return &entity, nil
}

func (r *GormRepository[T]) List(ctx context.Context, limit int, offset int) ([]T, error) {
	var entities []T
	err := r.execute(ctx, func(db *gorm.DB) error {
		query := db.Order("created_on DESC")
		if r.tenantID != nil {
			query = query.Where("tenant_id = ?", *r.tenantID)
		}
		if limit > 0 {
			query = query.Limit(limit)
		}
		if offset > 0 {
			query = query.Offset(offset)
		}
		return query.Find(&entities).Error
	})
	if err != nil {
		return nil, fmt.Errorf("repository: list: %w", err)
	}
	return entities, nil
}

func (r *GormRepository[T]) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]T, error) {
	if tenantID == uuid.Nil {
		return nil, fmt.Errorf("repository: tenant id is required")
	}
	if r.tenantID != nil && *r.tenantID != tenantID {
		return nil, fmt.Errorf("repository: tenant mismatch")
	}
	var entities []T
	err := r.execute(ctx, func(db *gorm.DB) error {
		query := db.Where("tenant_id = ?", tenantID).Order("created_on DESC")
		if limit > 0 {
			query = query.Limit(limit)
		}
		if offset > 0 {
			query = query.Offset(offset)
		}
		return query.Find(&entities).Error
	})
	if err != nil {
		return nil, fmt.Errorf("repository: list by tenant: %w", err)
	}
	return entities, nil
}

func (r *GormRepository[T]) Update(ctx context.Context, entity *T) error {
	if entity == nil {
		return fmt.Errorf("repository: nil entity")
	}
	if err := r.bindTenant(entity); err != nil {
		return err
	}
	id, err := entityID(entity)
	if err != nil {
		return err
	}
	return r.execute(ctx, func(db *gorm.DB) error {
		query := db.Model(entity).Where("id = ?", id).Select("*")
		if r.tenantID != nil {
			query = query.Where("tenant_id = ?", *r.tenantID)
		}
		result := query.Updates(entity)
		if result.Error != nil {
			return fmt.Errorf("repository: update: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (r *GormRepository[T]) Delete(ctx context.Context, id uuid.UUID) error {
	if id == uuid.Nil {
		return fmt.Errorf("repository: id is required")
	}
	return r.execute(ctx, func(db *gorm.DB) error {
		var entity T
		query := db.Where("id = ?", id)
		if r.tenantID != nil {
			query = query.Where("tenant_id = ?", *r.tenantID)
		}
		result := query.Delete(&entity)
		if result.Error != nil {
			return fmt.Errorf("repository: delete: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (r *GormRepository[T]) execute(ctx context.Context, fn func(db *gorm.DB) error) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("repository: nil database")
	}
	if r.tenantID == nil {
		return fn(r.db.WithContext(ctx))
	}
	if r.inTx {
		return fn(r.db.WithContext(ctx))
	}
	return database.WithTenantContext(ctx, r.db, *r.tenantID, func(tx *gorm.DB) error {
		return fn(tx.WithContext(ctx))
	})
}

func (r *GormRepository[T]) bindTenant(entity *T) error {
	if r.tenantID == nil {
		return nil
	}
	value := reflect.ValueOf(entity)
	if value.Kind() != reflect.Pointer || value.IsNil() {
		return fmt.Errorf("repository: entity must be a non-nil pointer")
	}
	elem := value.Elem()
	if elem.Kind() != reflect.Struct {
		return nil
	}
	field := elem.FieldByName("TenantID")
	if !field.IsValid() || field.Type() != reflect.TypeOf(uuid.UUID{}) {
		return nil
	}
	current := field.Interface().(uuid.UUID)
	if current == uuid.Nil {
		if !field.CanSet() {
			return fmt.Errorf("repository: tenant id is required")
		}
		field.Set(reflect.ValueOf(*r.tenantID))
		return nil
	}
	if current != *r.tenantID {
		return fmt.Errorf("repository: tenant mismatch")
	}
	return nil
}

func entityID[T any](entity *T) (uuid.UUID, error) {
	value := reflect.ValueOf(entity)
	if value.Kind() != reflect.Pointer || value.IsNil() {
		return uuid.Nil, fmt.Errorf("repository: entity must be a non-nil pointer")
	}
	elem := value.Elem()
	if elem.Kind() != reflect.Struct {
		return uuid.Nil, fmt.Errorf("repository: entity must point to a struct")
	}
	field := elem.FieldByName("ID")
	if !field.IsValid() || field.Type() != reflect.TypeOf(uuid.UUID{}) {
		return uuid.Nil, fmt.Errorf("repository: entity id is required")
	}
	id := field.Interface().(uuid.UUID)
	if id == uuid.Nil {
		return uuid.Nil, fmt.Errorf("repository: id is required")
	}
	return id, nil
}

type GormStore struct {
	db      *gorm.DB
	tenants TenantRepository
}

func NewGormStore(db *gorm.DB) *GormStore {
	return &GormStore{
		db:      db,
		tenants: NewGormRepository[models.Tenant](db),
	}
}

func (s *GormStore) Tenants() TenantRepository {
	return s.tenants
}

func (s *GormStore) WithTenant(ctx context.Context, tenantID uuid.UUID) TenantSession {
	return newGormTenantSession(s.db.WithContext(ctx), tenantID, false)
}

type gormTenantSession struct {
	db                   *gorm.DB
	tenantID             uuid.UUID
	inTx                 bool
	users                UserRepository
	applications         ApplicationRepository
	environments         EnvironmentRepository
	applicationVersions  ApplicationVersionRepository
	screens              ScreenRepository
	controls             ControlRepository
	controlProperties    ControlPropertyRepository
	formulas             FormulaRepository
	events               EventRepository
	variables            VariableRepository
	collections          CollectionRepository
	connectors           ConnectorRepository
	connectorActions     ConnectorActionRepository
	permissions          PermissionRepository
	auditLogs            AuditLogRepository
	packages             PackageRepository
	applicationSnapshots ApplicationSnapshotRepository
}

func newGormTenantSession(db *gorm.DB, tenantID uuid.UUID, inTx bool) *gormTenantSession {
	session := &gormTenantSession{
		db:       db,
		tenantID: tenantID,
		inTx:     inTx,
	}
	if inTx {
		session.users = newTenantTxGormRepository[models.User](db, tenantID)
		session.applications = newTenantTxGormRepository[models.Application](db, tenantID)
		session.environments = newTenantTxGormRepository[models.Environment](db, tenantID)
		session.applicationVersions = newTenantTxGormRepository[models.ApplicationVersion](db, tenantID)
		session.screens = newTenantTxGormRepository[models.Screen](db, tenantID)
		session.controls = newTenantTxGormRepository[models.Control](db, tenantID)
		session.controlProperties = newTenantTxGormRepository[models.ControlProperty](db, tenantID)
		session.formulas = newTenantTxGormRepository[models.Formula](db, tenantID)
		session.events = newTenantTxGormRepository[models.Event](db, tenantID)
		session.variables = newTenantTxGormRepository[models.Variable](db, tenantID)
		session.collections = newTenantTxGormRepository[models.Collection](db, tenantID)
		session.connectors = newTenantTxGormRepository[models.Connector](db, tenantID)
		session.connectorActions = newTenantTxGormRepository[models.ConnectorAction](db, tenantID)
		session.permissions = newTenantTxGormRepository[models.Permission](db, tenantID)
		session.auditLogs = newTenantTxGormRepository[models.AuditLog](db, tenantID)
		session.packages = newTenantTxGormRepository[models.Package](db, tenantID)
		session.applicationSnapshots = newTenantTxGormRepository[models.ApplicationSnapshot](db, tenantID)
		return session
	}
	session.users = NewTenantGormRepository[models.User](db, tenantID)
	session.applications = NewTenantGormRepository[models.Application](db, tenantID)
	session.environments = NewTenantGormRepository[models.Environment](db, tenantID)
	session.applicationVersions = NewTenantGormRepository[models.ApplicationVersion](db, tenantID)
	session.screens = NewTenantGormRepository[models.Screen](db, tenantID)
	session.controls = NewTenantGormRepository[models.Control](db, tenantID)
	session.controlProperties = NewTenantGormRepository[models.ControlProperty](db, tenantID)
	session.formulas = NewTenantGormRepository[models.Formula](db, tenantID)
	session.events = NewTenantGormRepository[models.Event](db, tenantID)
	session.variables = NewTenantGormRepository[models.Variable](db, tenantID)
	session.collections = NewTenantGormRepository[models.Collection](db, tenantID)
	session.connectors = NewTenantGormRepository[models.Connector](db, tenantID)
	session.connectorActions = NewTenantGormRepository[models.ConnectorAction](db, tenantID)
	session.permissions = NewTenantGormRepository[models.Permission](db, tenantID)
	session.auditLogs = NewTenantGormRepository[models.AuditLog](db, tenantID)
	session.packages = NewTenantGormRepository[models.Package](db, tenantID)
	session.applicationSnapshots = NewTenantGormRepository[models.ApplicationSnapshot](db, tenantID)
	return session
}

func (s *gormTenantSession) Users() UserRepository                             { return s.users }
func (s *gormTenantSession) Applications() ApplicationRepository               { return s.applications }
func (s *gormTenantSession) Environments() EnvironmentRepository               { return s.environments }
func (s *gormTenantSession) ApplicationVersions() ApplicationVersionRepository { return s.applicationVersions }
func (s *gormTenantSession) Screens() ScreenRepository                         { return s.screens }
func (s *gormTenantSession) Controls() ControlRepository                       { return s.controls }
func (s *gormTenantSession) ControlProperties() ControlPropertyRepository      { return s.controlProperties }
func (s *gormTenantSession) Formulas() FormulaRepository                       { return s.formulas }
func (s *gormTenantSession) Events() EventRepository                           { return s.events }
func (s *gormTenantSession) Variables() VariableRepository                     { return s.variables }
func (s *gormTenantSession) Collections() CollectionRepository                 { return s.collections }
func (s *gormTenantSession) Connectors() ConnectorRepository                   { return s.connectors }
func (s *gormTenantSession) ConnectorActions() ConnectorActionRepository       { return s.connectorActions }
func (s *gormTenantSession) Permissions() PermissionRepository                 { return s.permissions }
func (s *gormTenantSession) AuditLogs() AuditLogRepository                     { return s.auditLogs }
func (s *gormTenantSession) Packages() PackageRepository                       { return s.packages }
func (s *gormTenantSession) ApplicationSnapshots() ApplicationSnapshotRepository {
	return s.applicationSnapshots
}

func (s *gormTenantSession) Transaction(ctx context.Context, fn func(session TenantSession) error) error {
	if s == nil || s.db == nil {
		return fmt.Errorf("repository: nil tenant session")
	}
	return database.WithTenantContext(ctx, s.db, s.tenantID, func(tx *gorm.DB) error {
		return fn(newGormTenantSession(tx.WithContext(ctx), s.tenantID, true))
	})
}
