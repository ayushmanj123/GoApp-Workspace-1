package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type stubWorkflowSession struct {
	connector *models.Connector
	actions   []models.ConnectorAction
}

func (s *stubWorkflowSession) Users() repositories.UserRepository               { return nil }
func (s *stubWorkflowSession) Applications() repositories.ApplicationRepository { return nil }
func (s *stubWorkflowSession) Environments() repositories.EnvironmentRepository { return nil }
func (s *stubWorkflowSession) ApplicationVersions() repositories.ApplicationVersionRepository {
	return nil
}
func (s *stubWorkflowSession) Screens() repositories.ScreenRepository                    { return nil }
func (s *stubWorkflowSession) Controls() repositories.ControlRepository                  { return nil }
func (s *stubWorkflowSession) ControlProperties() repositories.ControlPropertyRepository { return nil }
func (s *stubWorkflowSession) Formulas() repositories.FormulaRepository                  { return nil }
func (s *stubWorkflowSession) Events() repositories.EventRepository                      { return nil }
func (s *stubWorkflowSession) Variables() repositories.VariableRepository                { return nil }
func (s *stubWorkflowSession) Collections() repositories.CollectionRepository            { return nil }
func (s *stubWorkflowSession) Connectors() repositories.ConnectorRepository {
	return &stubConnectorRepo{c: s.connector}
}
func (s *stubWorkflowSession) ConnectorActions() repositories.ConnectorActionRepository {
	return &stubActionRepo{items: s.actions}
}
func (s *stubWorkflowSession) Secrets() repositories.SecretRepository { return nil }
func (s *stubWorkflowSession) EnvironmentSecretOverrides() repositories.EnvironmentSecretOverrideRepository {
	return nil
}
func (s *stubWorkflowSession) ConnectorUserConnections() repositories.ConnectorUserConnectionRepository {
	return nil
}
func (s *stubWorkflowSession) Workflows() repositories.WorkflowRepository       { return nil }
func (s *stubWorkflowSession) WorkflowRuns() repositories.WorkflowRunRepository { return nil }
func (s *stubWorkflowSession) Permissions() repositories.PermissionRepository   { return nil }
func (s *stubWorkflowSession) AuditLogs() repositories.AuditLogRepository       { return nil }
func (s *stubWorkflowSession) Packages() repositories.PackageRepository         { return nil }
func (s *stubWorkflowSession) ApplicationSnapshots() repositories.ApplicationSnapshotRepository {
	return nil
}
func (s *stubWorkflowSession) ComponentDefinitions() repositories.ComponentDefinitionRepository {
	return nil
}
func (s *stubWorkflowSession) Entities() repositories.EntityRepository         { return nil }
func (s *stubWorkflowSession) EntityFields() repositories.EntityFieldRepository { return nil }
func (s *stubWorkflowSession) EntityKeys() repositories.EntityKeyRepository     { return nil }
func (s *stubWorkflowSession) EntityRelationships() repositories.EntityRelationshipRepository {
	return nil
}
func (s *stubWorkflowSession) SolutionPackages() repositories.SolutionPackageRepository {
	return nil
}
func (s *stubWorkflowSession) SolutionPackageComponents() repositories.SolutionPackageComponentRepository {
	return nil
}
func (s *stubWorkflowSession) Transaction(ctx context.Context, fn func(session repositories.TenantSession) error) error {
	return fn(s)
}

type stubConnectorRepo struct{ c *models.Connector }

func (r *stubConnectorRepo) Create(context.Context, *models.Connector) error { return nil }
func (r *stubConnectorRepo) GetByID(context.Context, uuid.UUID) (*models.Connector, error) {
	return r.c, nil
}
func (r *stubConnectorRepo) List(context.Context, int, int) ([]models.Connector, error) {
	return nil, nil
}
func (r *stubConnectorRepo) Update(context.Context, *models.Connector) error { return nil }
func (r *stubConnectorRepo) Delete(context.Context, uuid.UUID) error         { return nil }
func (r *stubConnectorRepo) ListByTenant(context.Context, uuid.UUID, int, int) ([]models.Connector, error) {
	return nil, nil
}

type stubActionRepo struct{ items []models.ConnectorAction }

func (r *stubActionRepo) Create(context.Context, *models.ConnectorAction) error { return nil }
func (r *stubActionRepo) GetByID(context.Context, uuid.UUID) (*models.ConnectorAction, error) {
	return nil, nil
}
func (r *stubActionRepo) List(context.Context, int, int) ([]models.ConnectorAction, error) {
	return nil, nil
}
func (r *stubActionRepo) Update(context.Context, *models.ConnectorAction) error { return nil }
func (r *stubActionRepo) Delete(context.Context, uuid.UUID) error               { return nil }
func (r *stubActionRepo) ListByTenant(context.Context, uuid.UUID, int, int) ([]models.ConnectorAction, error) {
	return nil, nil
}
func (r *stubActionRepo) ListByField(_ context.Context, field string, value any, _, _ int) ([]models.ConnectorAction, error) {
	if field != "connector_id" {
		return nil, nil
	}
	return r.items, nil
}

func TestWorkflowRunnerExecuteNoneAuth(t *testing.T) {
	var hit bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hit = true
		if r.URL.Path != "/items" {
			t.Fatalf("path=%s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"ok":true}]`))
	}))
	defer server.Close()

	connectorID := uuid.New()
	sess := &stubWorkflowSession{
		connector: &models.Connector{
			ID:                 connectorID,
			ConnectorType:      "rest",
			AuthenticationType: "none",
			BaseURL:            server.URL,
			AuthConfig:         datatypes.JSON([]byte(`{"type":"none"}`)),
		},
		actions: []models.ConnectorAction{
			{ConnectorID: connectorID, ActionName: "list", HTTPMethod: "GET", Endpoint: "/items"},
		},
	}

	runner := NewWorkflowRunner()
	runner.client = server.Client()
	result, err := runner.Execute(context.Background(), sess, uuid.New(), uuid.New(), []WorkflowStep{
		{
			ID:          "s1",
			Type:        "connector_action",
			ConnectorID: connectorID.String(),
			ActionName:  "list",
		},
	})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if !hit {
		t.Fatal("expected HTTP hit")
	}
	if len(result.Steps) != 1 || result.Steps[0].Status != "succeeded" {
		raw, _ := json.Marshal(result)
		t.Fatalf("unexpected result: %s", raw)
	}
}
