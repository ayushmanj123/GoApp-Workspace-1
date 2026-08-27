package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/scaffold"
	"github.com/google/uuid"
)

// ExcelAppSheetInput maps one worksheet tab to a connector.
type ExcelAppSheetInput struct {
	SheetName     string `json:"sheet_name"`
	ConnectorName string `json:"connector_name"`
	KeyColumn     string `json:"key_column"`
	HeaderRow     int    `json:"header_row"`
}

// ExcelAppScaffoldInput is the request to create an Excel App from Google Sheets.
type ExcelAppScaffoldInput struct {
	AppName              string               `json:"app_name"`
	SpreadsheetID        string               `json:"spreadsheet_id"`
	Sheets               []ExcelAppSheetInput `json:"sheets"`
	Template             string               `json:"template"`
	BootstrapConnectorID uuid.UUID            `json:"bootstrap_connector_id"`
}

// ExcelAppScaffoldResult is returned after scaffolding.
type ExcelAppScaffoldResult struct {
	ApplicationID uuid.UUID   `json:"application_id"`
	ConnectorIDs  []uuid.UUID `json:"connector_ids"`
}

// ExcelAppService orchestrates Excel App creation.
type ExcelAppService struct {
	store        repositories.Store
	appSvc       *ApplicationService
	connectorSvc *ConnectorService
}

func NewExcelAppService(store repositories.Store) *ExcelAppService {
	return &ExcelAppService{
		store:        store,
		appSvc:       NewApplicationService(store),
		connectorSvc: NewConnectorService(store),
	}
}

func (s *ExcelAppService) Scaffold(ctx context.Context, tenantID, userID uuid.UUID, input ExcelAppScaffoldInput) (*ExcelAppScaffoldResult, error) {
	if strings.TrimSpace(input.AppName) == "" {
		return nil, fmt.Errorf("app_name is required")
	}
	if strings.TrimSpace(input.SpreadsheetID) == "" {
		return nil, fmt.Errorf("spreadsheet_id is required")
	}
	if len(input.Sheets) == 0 {
		return nil, fmt.Errorf("at least one sheet is required")
	}
	if input.BootstrapConnectorID == uuid.Nil {
		return nil, fmt.Errorf("bootstrap_connector_id is required")
	}

	template := scaffold.TemplateGalleryForm
	if input.Template == "datatable_form" {
		template = scaffold.TemplateDataTableForm
	}

	sess := s.store.WithTenant(ctx, tenantID)
	bootstrap, err := sess.Connectors().GetByID(ctx, input.BootstrapConnectorID)
	if err != nil {
		return nil, fmt.Errorf("bootstrap connector: %w", err)
	}
	if bootstrap.ConnectorType != "google_sheets" {
		return nil, fmt.Errorf("bootstrap connector must be google_sheets")
	}

	// Ensure bootstrap points at the target spreadsheet so preview can run.
	bootstrapCfg, err := parseAuthConfig(bootstrap.AuthConfig)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(bootstrapCfg.SpreadsheetID) != strings.TrimSpace(input.SpreadsheetID) {
		authRaw, _ := json.Marshal(map[string]interface{}{
			"type":             "oauth_authorization_code",
			"spreadsheet_id":   input.SpreadsheetID,
			"sheet_name":       input.Sheets[0].SheetName,
			"header_row":       1,
			"connection_scope": "user",
		})
		merged, mergeErr := mergeGoogleSheetsOAuthDefaults(authRaw)
		if mergeErr != nil {
			return nil, mergeErr
		}
		persisted, persistErr := s.connectorSvc.persistAuthConfig(ctx, sess, tenantID, bootstrap.ApplicationID, bootstrap.Name, bootstrap.AuthenticationType, merged, bootstrap.AuthConfig)
		if persistErr != nil {
			return nil, persistErr
		}
		bootstrap.AuthConfig = persisted
		if err := sess.Connectors().Update(ctx, bootstrap); err != nil {
			return nil, fmt.Errorf("update bootstrap spreadsheet: %w", err)
		}
	}

	primarySheet := input.Sheets[0]
	primaryName := strings.TrimSpace(primarySheet.ConnectorName)
	if primaryName == "" {
		primaryName = strings.TrimSpace(primarySheet.SheetName)
	}
	preview, err := s.connectorSvc.PreviewGoogleSheet(ctx, tenantID, input.BootstrapConnectorID, userID, primarySheet.SheetName, 1)
	if err != nil {
		return nil, fmt.Errorf("preview primary sheet %q: %w", primarySheet.SheetName, err)
	}
	if len(preview.Columns) == 0 {
		return nil, fmt.Errorf("primary sheet %q has no header columns; add a header row and try again", primarySheet.SheetName)
	}
	previewCols := preview.Columns

	var result *ExcelAppScaffoldResult
	err = sess.Transaction(ctx, func(txSess repositories.TenantSession) error {
		desc := "excel_app:" + strings.TrimSpace(input.SpreadsheetID)
		app := &models.Application{
			Name:        strings.TrimSpace(input.AppName),
			Description: desc,
			TenantID:    tenantID,
			Status:      "draft",
		}
		if err := txSess.Applications().Create(ctx, app); err != nil {
			return fmt.Errorf("create application: %w", err)
		}
		// Seed a default screen so Studio opens; scaffold deletes Screen1.
		screen := &models.Screen{
			TenantID:      tenantID,
			ApplicationID: app.ID,
			Name:          "Screen1",
			DisplayOrder:  0,
			LayoutType:    "responsive",
		}
		if err := txSess.Screens().Create(ctx, screen); err != nil {
			return fmt.Errorf("create default screen: %w", err)
		}

		connectorIDs := make([]uuid.UUID, 0, len(input.Sheets))
		primarySource := primaryName

		for i, sheet := range input.Sheets {
			name := strings.TrimSpace(sheet.ConnectorName)
			if name == "" {
				name = strings.TrimSpace(sheet.SheetName)
			}
			if name == "" {
				return fmt.Errorf("connector_name or sheet_name is required for each sheet")
			}
			headerRow := sheet.HeaderRow
			if headerRow <= 0 {
				headerRow = 1
			}
			authRaw, _ := json.Marshal(map[string]interface{}{
				"type":             "oauth_authorization_code",
				"spreadsheet_id":   input.SpreadsheetID,
				"sheet_name":       sheet.SheetName,
				"key_column":       sheet.KeyColumn,
				"header_row":       headerRow,
				"connection_scope": "user",
			})
			merged, mergeErr := mergeGoogleSheetsOAuthDefaults(authRaw)
			if mergeErr != nil {
				return mergeErr
			}
			persistedAuth, persistErr := s.connectorSvc.persistAuthConfig(ctx, txSess, tenantID, app.ID, name, "oauth_authorization_code", merged, nil)
			if persistErr != nil {
				return persistErr
			}
			conn := &models.Connector{
				TenantID:           tenantID,
				ApplicationID:      app.ID,
				Name:               name,
				ConnectorType:      "google_sheets",
				AuthenticationType: "oauth_authorization_code",
				AuthConfig:         persistedAuth,
			}
			if err := txSess.Connectors().Create(ctx, conn); err != nil {
				return fmt.Errorf("create connector %s: %w", name, err)
			}
			connectorIDs = append(connectorIDs, conn.ID)
			if err := s.copyOAuthFromBootstrap(ctx, txSess, tenantID, userID, bootstrap, conn.ID); err != nil {
				return err
			}
			if i == 0 {
				primarySource = name
			}
		}

		if err := scaffold.CreateCRUDApp(ctx, txSess, scaffold.CRUDAppInput{
			TenantID:       tenantID,
			ApplicationID:  app.ID,
			DataSourceName: primarySource,
			Template:       template,
			Columns:        previewCols,
		}); err != nil {
			return fmt.Errorf("scaffold app: %w", err)
		}

		result = &ExcelAppScaffoldResult{
			ApplicationID: app.ID,
			ConnectorIDs:  connectorIDs,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *ExcelAppService) copyOAuthFromBootstrap(ctx context.Context, sess repositories.TenantSession, tenantID, userID uuid.UUID, bootstrap *models.Connector, targetConnectorID uuid.UUID) error {
	bootstrapCfg, err := parseAuthConfig(bootstrap.AuthConfig)
	if err != nil {
		return err
	}
	scope := normalizeConnectionScope(bootstrapCfg.ConnectionScope)
	if scope == "" {
		scope = "user"
	}
	if scope == "user" {
		if userID == uuid.Nil {
			return fmt.Errorf("user id required to copy oauth connection")
		}
		conn, err := findUserConnection(ctx, sess, bootstrap.ID, userID)
		if err != nil {
			return err
		}
		if conn == nil {
			return fmt.Errorf("bootstrap connector is not connected")
		}
		existing, err := findUserConnection(ctx, sess, targetConnectorID, userID)
		if err != nil {
			return err
		}
		if existing != nil {
			existing.RefreshSecretID = conn.RefreshSecretID
			return sess.ConnectorUserConnections().Update(ctx, existing)
		}
		row := &models.ConnectorUserConnection{
			TenantID:        tenantID,
			ConnectorID:     targetConnectorID,
			UserID:          userID,
			RefreshSecretID: conn.RefreshSecretID,
		}
		return sess.ConnectorUserConnections().Create(ctx, row)
	}
	target, err := sess.Connectors().GetByID(ctx, targetConnectorID)
	if err != nil {
		return err
	}
	targetCfg, err := parseAuthConfig(target.AuthConfig)
	if err != nil {
		return err
	}
	targetCfg.RefreshSecretID = bootstrapCfg.RefreshSecretID
	out, err := json.Marshal(targetCfg)
	if err != nil {
		return err
	}
	target.AuthConfig = out
	return sess.Connectors().Update(ctx, target)
}
