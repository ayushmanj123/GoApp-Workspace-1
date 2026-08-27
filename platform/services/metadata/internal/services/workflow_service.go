package services

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/shared/secrets"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	TriggerManual   = "manual"
	TriggerSchedule = "schedule"
	TriggerWebhook  = "webhook"

	maxWebhookBodyBytes = 64 * 1024
	maxWebhookPayloadPreview = 4096
)

// WorkflowDefinition is the JSON shape for workflows.definition.
type WorkflowDefinition struct {
	Trigger WorkflowTrigger `json:"trigger"`
	Steps   []WorkflowStep  `json:"steps"`
}

type WorkflowTrigger struct {
	Type     string `json:"type"`
	Cron     string `json:"cron,omitempty"`
	Timezone string `json:"timezone,omitempty"`
	Enabled  *bool  `json:"enabled,omitempty"`
}

type WorkflowStep struct {
	ID          string          `json:"id"`
	Type        string          `json:"type"`
	ConnectorID string          `json:"connector_id"`
	ActionName  string          `json:"action_name"`
	Body        json.RawMessage `json:"body,omitempty"`
}

// WorkflowRunResult is stored in workflow_runs.result.
type WorkflowRunResult struct {
	Steps []WorkflowStepResult `json:"steps"`
	Error string               `json:"error,omitempty"`
}

type WorkflowStepResult struct {
	StepID      string `json:"step_id"`
	Status      string `json:"status"`
	HTTPStatus  int    `json:"http_status,omitempty"`
	Error       string `json:"error,omitempty"`
	BodyPreview string `json:"body_preview,omitempty"`
}

// WorkflowRunOptions controls how a run is recorded and attributed.
type WorkflowRunOptions struct {
	TriggerSource string
	UserID        uuid.UUID
	Payload       json.RawMessage
}

// WorkflowService manages workflow definitions and runs.
type WorkflowService struct {
	store  repositories.Store
	runner *WorkflowRunner
}

func NewWorkflowService(store repositories.Store) *WorkflowService {
	return &WorkflowService{
		store:  store,
		runner: NewWorkflowRunner(),
	}
}

func (s *WorkflowService) Create(ctx context.Context, tenantID, appID uuid.UUID, name string, definition json.RawMessage) (*models.Workflow, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	def, err := parseAndValidateDefinition(definition)
	if err != nil {
		return nil, err
	}
	sess := s.store.WithTenant(ctx, tenantID)
	if err := s.validateStepsExist(ctx, sess, appID, def.Steps); err != nil {
		return nil, err
	}
	raw, err := json.Marshal(def)
	if err != nil {
		return nil, fmt.Errorf("marshal definition: %w", err)
	}
	wf := &models.Workflow{
		TenantID:      tenantID,
		ApplicationID: appID,
		Name:          name,
		Definition:    datatypes.JSON(raw),
	}
	if err := applyTriggerColumns(wf, def, time.Now().UTC()); err != nil {
		return nil, err
	}
	if err := sess.Workflows().Create(ctx, wf); err != nil {
		return nil, fmt.Errorf("create workflow: %w", err)
	}
	return wf, nil
}

func (s *WorkflowService) Get(ctx context.Context, tenantID, id uuid.UUID) (*models.Workflow, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	wf, err := sess.Workflows().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get workflow: %w", err)
	}
	return wf, nil
}

func (s *WorkflowService) Update(ctx context.Context, tenantID, id uuid.UUID, name *string, definition json.RawMessage) (*models.Workflow, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	wf, err := sess.Workflows().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get workflow: %w", err)
	}
	if name != nil {
		trimmed := strings.TrimSpace(*name)
		if trimmed == "" {
			return nil, fmt.Errorf("name is required")
		}
		wf.Name = trimmed
	}
	if len(definition) > 0 {
		def, err := parseAndValidateDefinition(definition)
		if err != nil {
			return nil, err
		}
		if err := s.validateStepsExist(ctx, sess, wf.ApplicationID, def.Steps); err != nil {
			return nil, err
		}
		raw, err := json.Marshal(def)
		if err != nil {
			return nil, fmt.Errorf("marshal definition: %w", err)
		}
		wf.Definition = datatypes.JSON(raw)
		if err := applyTriggerColumns(wf, def, time.Now().UTC()); err != nil {
			return nil, err
		}
	}
	if err := sess.Workflows().Update(ctx, wf); err != nil {
		return nil, fmt.Errorf("update workflow: %w", err)
	}
	return wf, nil
}

func (s *WorkflowService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	if err := sess.Workflows().Delete(ctx, id); err != nil {
		return fmt.Errorf("delete workflow: %w", err)
	}
	return nil
}

func (s *WorkflowService) ListByApplication(ctx context.Context, tenantID, appID uuid.UUID, limit, offset int) ([]models.Workflow, int64, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if repo, ok := any(sess.Workflows()).(byFieldRepo[models.Workflow]); ok {
		items, err := repo.ListByField(ctx, "application_id", appID, limit, offset)
		if err != nil {
			return nil, 0, fmt.Errorf("list workflows: %w", err)
		}
		return items, int64(len(items)), nil
	}
	items, err := sess.Workflows().ListByTenant(ctx, tenantID, 500, 0)
	if err != nil {
		return nil, 0, fmt.Errorf("list workflows: %w", err)
	}
	out := make([]models.Workflow, 0)
	for _, item := range items {
		if item.ApplicationID == appID {
			out = append(out, item)
		}
	}
	return out, int64(len(out)), nil
}

func (s *WorkflowService) ListRuns(ctx context.Context, tenantID, workflowID uuid.UUID, limit, offset int) ([]models.WorkflowRun, int64, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if _, err := sess.Workflows().GetByID(ctx, workflowID); err != nil {
		return nil, 0, fmt.Errorf("get workflow: %w", err)
	}
	if repo, ok := any(sess.WorkflowRuns()).(byFieldRepo[models.WorkflowRun]); ok {
		items, err := repo.ListByField(ctx, "workflow_id", workflowID, limit, offset)
		if err != nil {
			return nil, 0, fmt.Errorf("list runs: %w", err)
		}
		return items, int64(len(items)), nil
	}
	items, err := sess.WorkflowRuns().ListByTenant(ctx, tenantID, 500, 0)
	if err != nil {
		return nil, 0, fmt.Errorf("list runs: %w", err)
	}
	out := make([]models.WorkflowRun, 0)
	for _, item := range items {
		if item.WorkflowID == workflowID {
			out = append(out, item)
		}
	}
	return out, int64(len(out)), nil
}

// Run executes a workflow synchronously and persists the run.
func (s *WorkflowService) Run(ctx context.Context, tenantID, workflowID uuid.UUID, opts WorkflowRunOptions) (*models.WorkflowRun, error) {
	source := strings.ToLower(strings.TrimSpace(opts.TriggerSource))
	if source == "" {
		source = TriggerManual
	}
	sess := s.store.WithTenant(ctx, tenantID)
	wf, err := sess.Workflows().GetByID(ctx, workflowID)
	if err != nil {
		return nil, fmt.Errorf("get workflow: %w", err)
	}
	def, err := parseAndValidateDefinition(json.RawMessage(wf.Definition))
	if err != nil {
		return nil, err
	}

	started := time.Now().UTC()
	var triggeredBy *uuid.UUID
	if opts.UserID != uuid.Nil {
		triggeredBy = &opts.UserID
	}
	run := &models.WorkflowRun{
		TenantID:      tenantID,
		WorkflowID:    workflowID,
		Status:        "running",
		TriggerSource: source,
		TriggeredBy:   triggeredBy,
		StartedOn:     started,
		Result:        datatypes.JSON([]byte(`{"steps":[]}`)),
	}
	if len(opts.Payload) > 0 {
		run.TriggerPayload = datatypes.JSON(opts.Payload)
	}
	if err := sess.WorkflowRuns().Create(ctx, run); err != nil {
		return nil, fmt.Errorf("create run: %w", err)
	}

	result, runErr := s.runner.Execute(ctx, sess, tenantID, opts.UserID, def.Steps)
	finished := time.Now().UTC()
	run.FinishedOn = &finished
	if runErr != nil {
		run.Status = "failed"
		if result.Error == "" {
			result.Error = runErr.Error()
		}
	} else {
		run.Status = "succeeded"
	}
	raw, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("marshal run result: %w", err)
	}
	run.Result = datatypes.JSON(raw)
	if err := sess.WorkflowRuns().Update(ctx, run); err != nil {
		return nil, fmt.Errorf("update run: %w", err)
	}
	return run, nil
}

// RotateWebhookSecret generates a new webhook bearer token, stores it encrypted, and returns plaintext once.
func (s *WorkflowService) RotateWebhookSecret(ctx context.Context, tenantID, workflowID uuid.UUID) (string, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	wf, err := sess.Workflows().GetByID(ctx, workflowID)
	if err != nil {
		return "", fmt.Errorf("get workflow: %w", err)
	}
	plaintext, err := generateWebhookToken()
	if err != nil {
		return "", err
	}
	existing := ""
	if wf.WebhookSecretID != nil {
		existing = wf.WebhookSecretID.String()
	}
	secretID, err := upsertWorkflowWebhookSecret(ctx, sess, tenantID, wf.ApplicationID, wf.Name, plaintext, existing)
	if err != nil {
		return "", err
	}
	sid, err := uuid.Parse(secretID)
	if err != nil {
		return "", fmt.Errorf("invalid secret id: %w", err)
	}
	wf.WebhookSecretID = &sid
	wf.WebhookEnabled = true
	// Keep definition in sync if trigger is webhook.
	def, parseErr := parseAndValidateDefinition(json.RawMessage(wf.Definition))
	if parseErr == nil && def.Trigger.Type == TriggerWebhook {
		enabled := true
		def.Trigger.Enabled = &enabled
		raw, _ := json.Marshal(def)
		wf.Definition = datatypes.JSON(raw)
		wf.TriggerType = TriggerWebhook
		wf.WebhookEnabled = true
	}
	if err := sess.Workflows().Update(ctx, wf); err != nil {
		return "", fmt.Errorf("update workflow: %w", err)
	}
	return plaintext, nil
}

// RunWebhook authenticates a public hook request and executes the workflow.
func (s *WorkflowService) RunWebhook(ctx context.Context, workflowID uuid.UUID, bearerToken string, body []byte) (*models.WorkflowRun, error) {
	bearerToken = strings.TrimSpace(bearerToken)
	if bearerToken == "" {
		return nil, fmt.Errorf("webhook unauthorized: missing bearer token")
	}
	wf, err := s.store.FindWorkflowByIDUnscoped(ctx, workflowID)
	if err != nil {
		if err == gorm.ErrRecordNotFound || strings.Contains(err.Error(), "record not found") {
			return nil, fmt.Errorf("webhook not found")
		}
		return nil, err
	}
	if !wf.WebhookEnabled {
		return nil, fmt.Errorf("webhook disabled")
	}
	if wf.WebhookSecretID == nil {
		return nil, fmt.Errorf("webhook unauthorized: secret not configured")
	}
	sess := s.store.WithTenant(ctx, wf.TenantID)
	sec, err := sess.Secrets().GetByID(ctx, *wf.WebhookSecretID)
	if err != nil || sec == nil {
		return nil, fmt.Errorf("webhook unauthorized: secret not found")
	}
	key, err := secrets.LoadMasterKeyFromEnv()
	if err != nil {
		return nil, fmt.Errorf("load secrets master key: %w", err)
	}
	plain, err := secrets.Decrypt(key, sec.Ciphertext, sec.Nonce)
	if err != nil {
		return nil, fmt.Errorf("webhook unauthorized: decrypt failed")
	}
	if subtle.ConstantTimeCompare(plain, []byte(bearerToken)) != 1 {
		return nil, fmt.Errorf("webhook unauthorized: invalid token")
	}
	if len(body) > maxWebhookBodyBytes {
		return nil, fmt.Errorf("webhook body too large (max %d bytes)", maxWebhookBodyBytes)
	}
	payload := truncateJSONPayload(body)
	return s.Run(ctx, wf.TenantID, workflowID, WorkflowRunOptions{
		TriggerSource: TriggerWebhook,
		UserID:        uuid.Nil,
		Payload:       payload,
	})
}

func truncateJSONPayload(body []byte) json.RawMessage {
	if len(body) == 0 {
		return nil
	}
	preview := body
	if len(preview) > maxWebhookPayloadPreview {
		preview = preview[:maxWebhookPayloadPreview]
	}
	// Prefer storing valid JSON when possible; otherwise wrap as string.
	if json.Valid(preview) {
		return json.RawMessage(preview)
	}
	wrapped, err := json.Marshal(string(preview))
	if err != nil {
		return nil
	}
	return wrapped
}

func generateWebhookToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return "", fmt.Errorf("generate webhook token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func upsertWorkflowWebhookSecret(
	ctx context.Context,
	sess repositories.TenantSession,
	tenantID, appID uuid.UUID,
	workflowName, plaintext, existingSecretID string,
) (string, error) {
	key, err := secrets.LoadMasterKeyFromEnv()
	if err != nil {
		return "", fmt.Errorf("load secrets master key: %w", err)
	}
	ciphertext, nonce, err := secrets.Encrypt(key, []byte(plaintext))
	if err != nil {
		return "", fmt.Errorf("encrypt secret: %w", err)
	}
	secretName := fmt.Sprintf("workflow:%s:webhook", strings.TrimSpace(workflowName))

	if existingSecretID != "" {
		id, err := uuid.Parse(existingSecretID)
		if err == nil {
			sec, getErr := sess.Secrets().GetByID(ctx, id)
			if getErr == nil && sec != nil {
				sec.Name = secretName
				sec.Ciphertext = ciphertext
				sec.Nonce = nonce
				appCopy := appID
				sec.ApplicationID = &appCopy
				if err := sess.Secrets().Update(ctx, sec); err != nil {
					return "", fmt.Errorf("update secret: %w", err)
				}
				return sec.ID.String(), nil
			}
		}
	}

	appCopy := appID
	sec := &models.Secret{
		TenantID:      tenantID,
		ApplicationID: &appCopy,
		Name:          secretName,
		Ciphertext:    ciphertext,
		Nonce:         nonce,
	}
	if err := sess.Secrets().Create(ctx, sec); err != nil {
		return "", fmt.Errorf("create secret: %w", err)
	}
	return sec.ID.String(), nil
}

func applyTriggerColumns(wf *models.Workflow, def *WorkflowDefinition, now time.Time) error {
	wf.TriggerType = def.Trigger.Type
	wf.ScheduleCron = nil
	wf.ScheduleTimezone = nil
	wf.ScheduleEnabled = false
	wf.ScheduleNextRunAt = nil
	wf.WebhookEnabled = false
	// Preserve existing webhook_secret_id on type changes.

	switch def.Trigger.Type {
	case TriggerManual:
		return nil
	case TriggerSchedule:
		cronExpr := strings.TrimSpace(def.Trigger.Cron)
		tz := strings.TrimSpace(def.Trigger.Timezone)
		if tz == "" {
			tz = "UTC"
		}
		wf.ScheduleCron = &cronExpr
		wf.ScheduleTimezone = &tz
		enabled := true
		if def.Trigger.Enabled != nil {
			enabled = *def.Trigger.Enabled
		}
		wf.ScheduleEnabled = enabled
		if enabled {
			next, err := repositories.NextScheduleRunAt(cronExpr, tz, now)
			if err != nil {
				return err
			}
			wf.ScheduleNextRunAt = next
		}
		return nil
	case TriggerWebhook:
		enabled := true
		if def.Trigger.Enabled != nil {
			enabled = *def.Trigger.Enabled
		}
		wf.WebhookEnabled = enabled
		return nil
	default:
		return fmt.Errorf("trigger.type must be manual, schedule, or webhook")
	}
}

func parseAndValidateDefinition(raw json.RawMessage) (*WorkflowDefinition, error) {
	if len(raw) == 0 {
		raw = json.RawMessage(`{"trigger":{"type":"manual"},"steps":[]}`)
	}
	var def WorkflowDefinition
	if err := json.Unmarshal(raw, &def); err != nil {
		return nil, fmt.Errorf("invalid definition: %w", err)
	}
	if strings.TrimSpace(def.Trigger.Type) == "" {
		def.Trigger.Type = TriggerManual
	}
	tt := strings.ToLower(strings.TrimSpace(def.Trigger.Type))
	switch tt {
	case TriggerManual:
		def.Trigger.Type = TriggerManual
		def.Trigger.Cron = ""
		def.Trigger.Timezone = ""
		def.Trigger.Enabled = nil
	case TriggerSchedule:
		def.Trigger.Type = TriggerSchedule
		cronExpr := strings.TrimSpace(def.Trigger.Cron)
		if cronExpr == "" {
			return nil, fmt.Errorf("trigger.cron is required for schedule")
		}
		if _, err := repositories.ParseScheduleCron(cronExpr); err != nil {
			return nil, err
		}
		def.Trigger.Cron = cronExpr
		tz := strings.TrimSpace(def.Trigger.Timezone)
		if tz == "" {
			tz = "UTC"
		}
		if _, err := time.LoadLocation(tz); err != nil {
			return nil, fmt.Errorf("trigger.timezone is invalid: %w", err)
		}
		def.Trigger.Timezone = tz
		if def.Trigger.Enabled == nil {
			enabled := true
			def.Trigger.Enabled = &enabled
		}
	case TriggerWebhook:
		def.Trigger.Type = TriggerWebhook
		def.Trigger.Cron = ""
		def.Trigger.Timezone = ""
		if def.Trigger.Enabled == nil {
			enabled := true
			def.Trigger.Enabled = &enabled
		}
	default:
		return nil, fmt.Errorf("trigger.type must be manual, schedule, or webhook")
	}

	if def.Steps == nil {
		def.Steps = []WorkflowStep{}
	}
	seen := map[string]struct{}{}
	for i := range def.Steps {
		step := &def.Steps[i]
		if strings.TrimSpace(step.ID) == "" {
			step.ID = fmt.Sprintf("step-%d", i+1)
		}
		if _, ok := seen[step.ID]; ok {
			return nil, fmt.Errorf("duplicate step id %q", step.ID)
		}
		seen[step.ID] = struct{}{}
		if !strings.EqualFold(step.Type, "connector_action") {
			return nil, fmt.Errorf("step %q type must be connector_action", step.ID)
		}
		step.Type = "connector_action"
		if strings.TrimSpace(step.ConnectorID) == "" {
			return nil, fmt.Errorf("step %q connector_id is required", step.ID)
		}
		if _, err := uuid.Parse(step.ConnectorID); err != nil {
			return nil, fmt.Errorf("step %q connector_id is invalid", step.ID)
		}
		if strings.TrimSpace(step.ActionName) == "" {
			return nil, fmt.Errorf("step %q action_name is required", step.ID)
		}
	}
	return &def, nil
}

func (s *WorkflowService) validateStepsExist(ctx context.Context, sess repositories.TenantSession, appID uuid.UUID, steps []WorkflowStep) error {
	for _, step := range steps {
		connectorID, err := uuid.Parse(step.ConnectorID)
		if err != nil {
			return fmt.Errorf("step %q: invalid connector_id", step.ID)
		}
		connector, err := sess.Connectors().GetByID(ctx, connectorID)
		if err != nil || connector == nil {
			return fmt.Errorf("step %q: connector not found", step.ID)
		}
		if connector.ApplicationID != appID {
			return fmt.Errorf("step %q: connector belongs to a different application", step.ID)
		}
		if !strings.EqualFold(connector.ConnectorType, "rest") {
			return fmt.Errorf("step %q: only rest connectors are supported", step.ID)
		}
		actions, err := listConnectorActions(ctx, sess, connectorID)
		if err != nil {
			return err
		}
		found := false
		for _, a := range actions {
			if strings.EqualFold(a.ActionName, step.ActionName) {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("step %q: action %q not found on connector", step.ID, step.ActionName)
		}
	}
	return nil
}

func listConnectorActions(ctx context.Context, sess repositories.TenantSession, connectorID uuid.UUID) ([]models.ConnectorAction, error) {
	if repo, ok := any(sess.ConnectorActions()).(byFieldRepo[models.ConnectorAction]); ok {
		items, err := repo.ListByField(ctx, "connector_id", connectorID, 200, 0)
		if err != nil {
			return nil, fmt.Errorf("list connector actions: %w", err)
		}
		return items, nil
	}
	return nil, fmt.Errorf("connector actions repository unavailable")
}
