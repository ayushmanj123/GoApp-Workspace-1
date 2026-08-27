package databinding

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

const googleSheetsMaxRows = 500

// GoogleSheetsDataSource executes CRUD against Google Sheets via the Sheets API v4.
type GoogleSheetsDataSource struct {
	repo    GoogleSheetsConnectorRepository
	rest    *RestDataSource
	client  *http.Client
	timeout time.Duration
}

func NewGoogleSheetsDataSource(repo GoogleSheetsConnectorRepository, rest *RestDataSource) *GoogleSheetsDataSource {
	return &GoogleSheetsDataSource{
		repo:    repo,
		rest:    rest,
		client:  &http.Client{Timeout: 20 * time.Second},
		timeout: 20 * time.Second,
	}
}

func (d *GoogleSheetsDataSource) Kind() DataSourceKind {
	return DataSourceKindGoogleSheets
}

func (d *GoogleSheetsDataSource) Query(ctx context.Context, input QueryInput) (*QueryResult, error) {
	cfg, token, err := d.resolve(ctx, input.TenantID, input.UserID, input.EntityID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}
	rows, headers, err := d.fetchSheetRows(ctx, cfg, token)
	if err != nil {
		return nil, err
	}
	items := d.rowsToItems(cfg, headers, rows)
	if !input.FilterExpr.Empty() {
		filtered := make([]DataItem, 0, len(items))
		for _, item := range items {
			if MatchFilterExpr(map[string]interface{}(item), input.FilterExpr) {
				filtered = append(filtered, item)
			}
		}
		items = filtered
	}
	limit := input.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := input.Offset
	if offset < 0 {
		offset = 0
	}
	total := int64(len(items))
	if offset >= len(items) {
		return &QueryResult{Items: []DataItem{}, Count: total}, nil
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return &QueryResult{Items: items[offset:end], Count: total}, nil
}

func (d *GoogleSheetsDataSource) Get(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID) (*DataItem, error) {
	cfg, token, err := d.resolve(ctx, tenantID, userID, key.EntityID, EnvironmentIDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	rows, headers, err := d.fetchSheetRows(ctx, cfg, token)
	if err != nil {
		return nil, err
	}
	items := d.rowsToItems(cfg, headers, rows)
	for i := range items {
		if id, ok := parseRecordUUID(items[i]["recordId"]); ok && id == recordID {
			item := items[i]
			return &item, nil
		}
	}
	return nil, ErrDataSourceNotFound
}

func (d *GoogleSheetsDataSource) Create(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, data map[string]interface{}) (*DataItem, error) {
	cfg, token, err := d.resolve(ctx, tenantID, userID, key.EntityID, EnvironmentIDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	_, headers, err := d.fetchSheetRows(ctx, cfg, token)
	if err != nil {
		return nil, err
	}
	if len(headers) == 0 {
		return nil, fmt.Errorf("databinding: google sheets create requires a header row")
	}
	payload := cloneSheetPayload(data)
	if cfg.KeyColumn != "" {
		if _, ok := sheetPayloadLookup(payload, cfg.KeyColumn); !ok {
			headerName := matchHeaderName(headers, cfg.KeyColumn)
			payload[headerName] = uuid.New().String()
		}
	}
	row := make([]interface{}, len(headers))
	for i, col := range headers {
		if v, ok := sheetPayloadLookup(payload, col); ok {
			row[i] = v
		} else {
			row[i] = ""
		}
	}
	rangeStr := url.QueryEscape(fmt.Sprintf("'%s'!A:ZZ", cfg.SheetName))
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
		cfg.SpreadsheetID, rangeStr)
	body, err := json.Marshal(map[string]interface{}{"values": [][]interface{}{row}})
	if err != nil {
		return nil, err
	}
	if _, err := d.googleRequest(ctx, token, http.MethodPost, apiURL, body); err != nil {
		return nil, err
	}
	recordKey := ""
	if cfg.KeyColumn != "" {
		if v, ok := sheetPayloadLookup(payload, cfg.KeyColumn); ok {
			recordKey = fmt.Sprintf("%v", v)
		}
	}
	item := d.buildItem(cfg, headers, row, len(d.mustRows(ctx, cfg, token))+1, recordKey)
	return &item, nil
}

func (d *GoogleSheetsDataSource) Update(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID, data map[string]interface{}, _ int) (*DataItem, error) {
	cfg, token, err := d.resolve(ctx, tenantID, userID, key.EntityID, EnvironmentIDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	rows, headers, err := d.fetchSheetRows(ctx, cfg, token)
	if err != nil {
		return nil, err
	}
	rowIndex := -1
	var existing []interface{}
	for i, row := range rows {
		item := d.buildItem(cfg, headers, row, cfg.HeaderRow+1+i, "")
		if id, ok := parseRecordUUID(item["recordId"]); ok && id == recordID {
			rowIndex = cfg.HeaderRow + 1 + i
			existing = row
			break
		}
	}
	if rowIndex < 0 {
		return nil, ErrDataSourceNotFound
	}
	payload := cloneSheetPayload(data)
	updated := make([]interface{}, len(headers))
	for i, col := range headers {
		if v, ok := sheetPayloadLookup(payload, col); ok {
			updated[i] = v
		} else if i < len(existing) {
			updated[i] = existing[i]
		} else {
			updated[i] = ""
		}
	}
	rangeStr := url.QueryEscape(fmt.Sprintf("'%s'!A%d:ZZ%d", cfg.SheetName, rowIndex, rowIndex))
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s?valueInputOption=USER_ENTERED",
		cfg.SpreadsheetID, rangeStr)
	body, err := json.Marshal(map[string]interface{}{"values": [][]interface{}{updated}})
	if err != nil {
		return nil, err
	}
	if _, err := d.googleRequest(ctx, token, http.MethodPut, apiURL, body); err != nil {
		return nil, err
	}
	recordKey := ""
	if cfg.KeyColumn != "" {
		for i, col := range headers {
			if strings.EqualFold(col, cfg.KeyColumn) && i < len(updated) {
				recordKey = fmt.Sprintf("%v", updated[i])
				break
			}
		}
	}
	item := d.buildItem(cfg, headers, updated, rowIndex, recordKey)
	return &item, nil
}

func (d *GoogleSheetsDataSource) Delete(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID) error {
	cfg, token, err := d.resolve(ctx, tenantID, userID, key.EntityID, EnvironmentIDFromContext(ctx))
	if err != nil {
		return err
	}
	rows, headers, err := d.fetchSheetRows(ctx, cfg, token)
	if err != nil {
		return err
	}
	sheetID, err := d.sheetID(ctx, cfg, token)
	if err != nil {
		return err
	}
	for i, row := range rows {
		item := d.buildItem(cfg, headers, row, cfg.HeaderRow+1+i, "")
		if id, ok := parseRecordUUID(item["recordId"]); ok && id == recordID {
			rowIndex := cfg.HeaderRow + i
			apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s:batchUpdate", cfg.SpreadsheetID)
			payload := map[string]interface{}{
				"requests": []map[string]interface{}{
					{
						"deleteDimension": map[string]interface{}{
							"range": map[string]interface{}{
								"sheetId":    sheetID,
								"dimension":  "ROWS",
								"startIndex": rowIndex,
								"endIndex":   rowIndex + 1,
							},
						},
					},
				},
			}
			body, err := json.Marshal(payload)
			if err != nil {
				return err
			}
			_, err = d.googleRequest(ctx, token, http.MethodPost, apiURL, body)
			return err
		}
	}
	return ErrDataSourceNotFound
}

func (d *GoogleSheetsDataSource) resolve(ctx context.Context, tenantID, userID, connectorID uuid.UUID, environmentID *uuid.UUID) (*GoogleSheetsConnectorConfig, string, error) {
	if d == nil || d.repo == nil {
		return nil, "", fmt.Errorf("databinding: google sheets datasource is not configured")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, connectorID, coalesceEnvironmentID(environmentID, ctx), userID)
	if err != nil {
		return nil, "", err
	}
	if cfg.SpreadsheetID == "" || cfg.SheetName == "" {
		return nil, "", fmt.Errorf("databinding: google sheets connector requires spreadsheet_id and sheet_name")
	}
	restCfg := &RestConnectorConfig{
		ConnectorID: cfg.ConnectorID,
		Name:        cfg.Name,
		Auth:        cfg.Auth,
	}
	token, err := d.rest.oauthAccessToken(ctx, restCfg, userID)
	if err != nil {
		return nil, "", err
	}
	return cfg, token, nil
}

func (d *GoogleSheetsDataSource) fetchSheetRows(ctx context.Context, cfg *GoogleSheetsConnectorConfig, token string) ([][]interface{}, []string, error) {
	rangeStr := url.QueryEscape(fmt.Sprintf("'%s'!A%d:ZZ", cfg.SheetName, cfg.HeaderRow))
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s", cfg.SpreadsheetID, rangeStr)
	body, err := d.googleRequest(ctx, token, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, nil, err
	}
	var parsed struct {
		Values [][]interface{} `json:"values"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, nil, err
	}
	if len(parsed.Values) == 0 {
		return nil, []string{}, nil
	}
	headers := make([]string, 0, len(parsed.Values[0]))
	for _, cell := range parsed.Values[0] {
		headers = append(headers, strings.TrimSpace(fmt.Sprintf("%v", cell)))
	}
	rows := parsed.Values[1:]
	if len(rows) > googleSheetsMaxRows {
		rows = rows[:googleSheetsMaxRows]
	}
	return rows, headers, nil
}

func (d *GoogleSheetsDataSource) mustRows(ctx context.Context, cfg *GoogleSheetsConnectorConfig, token string) [][]interface{} {
	rows, _, _ := d.fetchSheetRows(ctx, cfg, token)
	return rows
}

func (d *GoogleSheetsDataSource) rowsToItems(cfg *GoogleSheetsConnectorConfig, headers []string, rows [][]interface{}) []DataItem {
	items := make([]DataItem, 0, len(rows))
	for i, row := range rows {
		recordKey := ""
		if cfg.KeyColumn != "" {
			for j, col := range headers {
				if strings.EqualFold(col, cfg.KeyColumn) && j < len(row) {
					recordKey = fmt.Sprintf("%v", row[j])
					break
				}
			}
		}
		items = append(items, d.buildItem(cfg, headers, row, cfg.HeaderRow+1+i, recordKey))
	}
	return items
}

func (d *GoogleSheetsDataSource) buildItem(cfg *GoogleSheetsConnectorConfig, headers []string, row []interface{}, rowNumber int, recordKey string) DataItem {
	item := DataItem{}
	for i, col := range headers {
		if col == "" {
			continue
		}
		if i < len(row) {
			item[col] = row[i]
		} else {
			item[col] = ""
		}
	}
	if recordKey == "" {
		recordKey = fmt.Sprintf("row:%d", rowNumber)
	}
	item["recordId"] = sheetRecordUUID(cfg.ConnectorID, recordKey).String()
	item["entityId"] = cfg.ConnectorID.String()
	item["version"] = 0
	item["_rowNumber"] = rowNumber
	return item
}

func sheetRecordUUID(connectorID uuid.UUID, key string) uuid.UUID {
	return uuid.NewSHA1(uuid.NameSpaceURL, []byte(fmt.Sprintf("google_sheets:%s:%s", connectorID, key)))
}

func parseRecordUUID(value interface{}) (uuid.UUID, bool) {
	switch typed := value.(type) {
	case string:
		id, err := uuid.Parse(strings.TrimSpace(typed))
		return id, err == nil
	case uuid.UUID:
		return typed, typed != uuid.Nil
	default:
		return uuid.Nil, false
	}
}

func cloneSheetPayload(data map[string]interface{}) map[string]interface{} {
	out := map[string]interface{}{}
	for key, value := range data {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		switch key {
		case "recordId", "entityId", "version", "_rowNumber":
			continue
		default:
			out[key] = value
		}
	}
	return out
}

func sheetPayloadLookup(payload map[string]interface{}, col string) (interface{}, bool) {
	if v, ok := payload[col]; ok {
		return v, true
	}
	for k, v := range payload {
		if strings.EqualFold(k, col) {
			return v, true
		}
	}
	return nil, false
}

func matchHeaderName(headers []string, keyColumn string) string {
	for _, h := range headers {
		if strings.EqualFold(h, keyColumn) {
			return h
		}
	}
	if keyColumn != "" {
		return keyColumn
	}
	if len(headers) > 0 {
		return headers[0]
	}
	return "Id"
}

func (d *GoogleSheetsDataSource) sheetID(ctx context.Context, cfg *GoogleSheetsConnectorConfig, token string) (int, error) {
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s?fields=sheets.properties", cfg.SpreadsheetID)
	body, err := d.googleRequest(ctx, token, http.MethodGet, apiURL, nil)
	if err != nil {
		return 0, err
	}
	var parsed struct {
		Sheets []struct {
			Properties struct {
				SheetID int    `json:"sheetId"`
				Title   string `json:"title"`
			} `json:"properties"`
		} `json:"sheets"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return 0, err
	}
	for _, sh := range parsed.Sheets {
		if strings.EqualFold(sh.Properties.Title, cfg.SheetName) {
			return sh.Properties.SheetID, nil
		}
	}
	return 0, fmt.Errorf("databinding: sheet %q not found", cfg.SheetName)
}

func (d *GoogleSheetsDataSource) googleRequest(ctx context.Context, token, method, apiURL string, payload []byte) ([]byte, error) {
	var reader io.Reader
	if len(payload) > 0 {
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, apiURL, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	if len(payload) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := d.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("databinding: google sheets request failed: %w", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("databinding: google sheets api returned %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
}
