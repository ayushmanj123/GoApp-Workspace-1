// Package repositories defines repository contracts for metadata persistence.
package repositories

import (
	"context"
	"time"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/google/uuid"
)

// Repository is the common persistence contract for metadata entities.
type Repository[T any] interface {
	Create(ctx context.Context, entity *T) error
	GetByID(ctx context.Context, id uuid.UUID) (*T, error)
	List(ctx context.Context, limit int, offset int) ([]T, error)
	Update(ctx context.Context, entity *T) error
	Delete(ctx context.Context, id uuid.UUID) error
}

// TenantRepositoryContract adds tenant filtering for tenant-owned entities.
type TenantRepositoryContract[T any] interface {
	Repository[T]
	ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int, offset int) ([]T, error)
}

type TenantRepository interface{ Repository[models.Tenant] }
type UserRepository interface{ TenantRepositoryContract[models.User] }
type ApplicationRepository interface{ TenantRepositoryContract[models.Application] }
type EnvironmentRepository interface{ TenantRepositoryContract[models.Environment] }
type ApplicationVersionRepository interface{ TenantRepositoryContract[models.ApplicationVersion] }
type ScreenRepository interface{ TenantRepositoryContract[models.Screen] }
type ControlRepository interface{ TenantRepositoryContract[models.Control] }
type ControlPropertyRepository interface{ TenantRepositoryContract[models.ControlProperty] }
type FormulaRepository interface{ TenantRepositoryContract[models.Formula] }
type EventRepository interface{ TenantRepositoryContract[models.Event] }
type VariableRepository interface{ TenantRepositoryContract[models.Variable] }
type CollectionRepository interface{ TenantRepositoryContract[models.Collection] }
type ConnectorRepository interface{ TenantRepositoryContract[models.Connector] }
type ConnectorActionRepository interface{ TenantRepositoryContract[models.ConnectorAction] }
type SecretRepository interface{ TenantRepositoryContract[models.Secret] }
type EnvironmentSecretOverrideRepository interface {
	TenantRepositoryContract[models.EnvironmentSecretOverride]
}
type ConnectorUserConnectionRepository interface {
	TenantRepositoryContract[models.ConnectorUserConnection]
}
type WorkflowRepository interface{ TenantRepositoryContract[models.Workflow] }
type WorkflowRunRepository interface{ TenantRepositoryContract[models.WorkflowRun] }
type PermissionRepository interface{ TenantRepositoryContract[models.Permission] }
type AuditLogRepository interface{ TenantRepositoryContract[models.AuditLog] }
type PackageRepository interface{ TenantRepositoryContract[models.Package] }
type ApplicationSnapshotRepository interface{ TenantRepositoryContract[models.ApplicationSnapshot] }
type ComponentDefinitionRepository interface{ TenantRepositoryContract[models.ComponentDefinition] }
type EntityRepository interface{ TenantRepositoryContract[models.Entity] }
type EntityFieldRepository interface{ TenantRepositoryContract[models.EntityField] }
type EntityKeyRepository interface{ TenantRepositoryContract[models.EntityKey] }
type EntityRelationshipRepository interface {
	TenantRepositoryContract[models.EntityRelationship]
}
type SolutionPackageRepository interface {
	TenantRepositoryContract[models.SolutionPackage]
}
type SolutionPackageComponentRepository interface {
	TenantRepositoryContract[models.SolutionPackageComponent]
}

// TenantSession groups repositories that execute with tenant context applied.
type TenantSession interface {
	Users() UserRepository
	Applications() ApplicationRepository
	Environments() EnvironmentRepository
	ApplicationVersions() ApplicationVersionRepository
	Screens() ScreenRepository
	Controls() ControlRepository
	ControlProperties() ControlPropertyRepository
	Formulas() FormulaRepository
	Events() EventRepository
	Variables() VariableRepository
	Collections() CollectionRepository
	Connectors() ConnectorRepository
	ConnectorActions() ConnectorActionRepository
	Secrets() SecretRepository
	EnvironmentSecretOverrides() EnvironmentSecretOverrideRepository
	ConnectorUserConnections() ConnectorUserConnectionRepository
	Workflows() WorkflowRepository
	WorkflowRuns() WorkflowRunRepository
	Permissions() PermissionRepository
	AuditLogs() AuditLogRepository
	Packages() PackageRepository
	ApplicationSnapshots() ApplicationSnapshotRepository
	ComponentDefinitions() ComponentDefinitionRepository
	Entities() EntityRepository
	EntityFields() EntityFieldRepository
	EntityKeys() EntityKeyRepository
	EntityRelationships() EntityRelationshipRepository
	SolutionPackages() SolutionPackageRepository
	SolutionPackageComponents() SolutionPackageComponentRepository
	Transaction(ctx context.Context, fn func(session TenantSession) error) error
}

// Store groups root and tenant-scoped metadata repositories behind one dependency.
type Store interface {
	Tenants() TenantRepository
	WithTenant(ctx context.Context, tenantID uuid.UUID) TenantSession
	// FindWorkflowByIDUnscoped loads a workflow by id without tenant JWT (webhook/scheduler).
	FindWorkflowByIDUnscoped(ctx context.Context, id uuid.UUID) (*models.Workflow, error)
	// ClaimDueScheduledWorkflows locks due schedule rows, advances next_run_at, returns claimed rows.
	ClaimDueScheduledWorkflows(ctx context.Context, now time.Time, limit int) ([]models.Workflow, error)
}
