package formula

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/google/uuid"
)

// Dispatcher routes formulas to runtime function handlers.
type Dispatcher struct {
	evaluator *valueEvaluator
}

func NewDispatcher() *Dispatcher {
	return &Dispatcher{evaluator: newValueEvaluator()}
}

func (d *Dispatcher) Dispatch(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	if rtCtx == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "runtime context is required", nil)
	}
	if rtCtx.State == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "state manager is required", nil)
	}

	trimmed := strings.TrimSpace(formula)
	if strings.Contains(trimmed, ";") {
		return d.execStatements(rtCtx, trimmed)
	}
	switch {
	case strings.HasPrefix(strings.ToUpper(trimmed), "CLEARCOLLECT("):
		return d.execClearCollect(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "COLLECT("):
		return d.execCollect(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "SET("):
		return d.execSet(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "UPDATECONTEXT("):
		return d.execUpdateContext(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "PATCH("):
		return d.execPatch(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "REMOVE("):
		return d.execRemove(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "DEFAULTS("):
		return d.execDefaults(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "CLEAR("):
		return d.execClear(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "FIRST("):
		return d.execFirst(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "LAST("):
		return d.execLast(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "COUNTROWS("):
		return d.execCountRows(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "NAVIGATE("):
		return d.execNavigate(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "LOOKUP("):
		return d.execLookUp(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "FILTER("):
		return d.execFilter(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "SUBMITFORM("):
		return d.execSubmitForm(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "RESETFORM("):
		return d.execResetForm(rtCtx, trimmed)
	case strings.HasPrefix(strings.ToUpper(trimmed), "NEWFORM("):
		return d.execSetFormMode(rtCtx, trimmed, "NewForm", "New")
	case strings.HasPrefix(strings.ToUpper(trimmed), "EDITFORM("):
		return d.execSetFormMode(rtCtx, trimmed, "EditForm", "Edit")
	case strings.HasPrefix(strings.ToUpper(trimmed), "VIEWFORM("):
		return d.execSetFormMode(rtCtx, trimmed, "ViewForm", "View")
	case strings.HasPrefix(strings.ToUpper(trimmed), "IF("):
		return d.execIf(rtCtx, trimmed)
	case strings.EqualFold(strings.TrimSpace(trimmed), "Back()"):
		return d.execBack(rtCtx, trimmed)
	default:
		return d.evaluator.evaluate(rtCtx, trimmed)
	}
}

func (d *Dispatcher) execStatements(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	parts := splitStatements(formula)
	if len(parts) == 0 {
		return nil, newFormulaError("INVALID_FORMULA", "formula is empty", nil)
	}
	var last any
	var err error
	for _, part := range parts {
		last, err = d.Dispatch(rtCtx, part)
		if err != nil {
			return nil, err
		}
	}
	return last, nil
}

func (d *Dispatcher) execSet(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	varName, valueExpr, ok := parseSetFormula(formula)
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Set() formula", nil)
	}
	value, err := d.evaluator.evaluate(rtCtx, valueExpr)
	if err != nil {
		return nil, err
	}
	rtCtx.State.SetVariable(varName, value)
	if rtCtx.Events != nil {
		rtCtx.RecordRefresh(rtCtx.Events.VariableChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, varName))
	}
	return value, nil
}

func (d *Dispatcher) execUpdateContext(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	values, ok := parseUpdateContextFormula(formula)
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid UpdateContext() formula", nil)
	}
	screen := rtCtx.Session.Screen
	if screen == "" {
		screen = "Default"
	}
	rtCtx.State.UpdateContext(screen, values)
	if rtCtx.Events != nil {
		keys := make([]string, 0, len(values))
		for key := range values {
			keys = append(keys, key)
		}
		rtCtx.RecordRefresh(rtCtx.Events.ContextChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, screen, keys))
	}
	return values, nil
}

func (d *Dispatcher) execCollect(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	collection, objectLiteral, ok := parseTwoArgCall(formula, "Collect")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Collect() formula", nil)
	}
	item, err := parseRecordObject(objectLiteral)
	if err != nil {
		return nil, err
	}
	rtCtx.State.Collect(collection, item)
	if rtCtx.Events != nil {
		rtCtx.RecordRefresh(rtCtx.Events.CollectionChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, collection))
	}
	return rtCtx.State.CountRows(collection), nil
}

func (d *Dispatcher) execClearCollect(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	collection, objectLiteral, ok := parseTwoArgCall(formula, "ClearCollect")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid ClearCollect() formula", nil)
	}
	item, err := parseRecordObject(objectLiteral)
	if err != nil {
		return nil, err
	}
	rtCtx.State.ClearCollect(collection, []any{item})
	if rtCtx.Events != nil {
		rtCtx.RecordRefresh(rtCtx.Events.CollectionChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, collection))
	}
	return rtCtx.State.CountRows(collection), nil
}

func (d *Dispatcher) execClear(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	collection, ok := parseSingleIdentifierCall(formula, "Clear")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Clear() formula", nil)
	}
	rtCtx.State.Clear(collection)
	return 0, nil
}

func (d *Dispatcher) execFirst(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	reference, ok := parseSingleIdentifierCall(formula, "First")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid First() formula", nil)
	}
	items := resolveTableItems(rtCtx, reference)
	if len(items) == 0 {
		return nil, nil
	}
	return items[0], nil
}

func (d *Dispatcher) execLast(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	reference, ok := parseSingleIdentifierCall(formula, "Last")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Last() formula", nil)
	}
	items := resolveTableItems(rtCtx, reference)
	if len(items) == 0 {
		return nil, nil
	}
	return items[len(items)-1], nil
}

func (d *Dispatcher) execCountRows(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	reference, ok := parseSingleIdentifierCall(formula, "CountRows")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid CountRows() formula", nil)
	}
	return len(resolveTableItems(rtCtx, reference)), nil
}

func resolveTableItems(rtCtx *RuntimeFormulaContext, reference string) []any {
	reference = strings.TrimSpace(reference)
	if reference == "" || rtCtx == nil {
		return nil
	}
	if strings.Contains(reference, ".") && rtCtx.Gallery != nil {
		if value, ok := rtCtx.Gallery.ResolveReference(reference); ok {
			if items, ok := value.([]any); ok {
				return items
			}
		}
	}
	if rtCtx.State != nil {
		if collection := rtCtx.State.GetCollection(reference); len(collection) > 0 {
			return collection
		}
	}
	if items, ok := queryEntityTable(rtCtx, reference); ok {
		return items
	}
	return nil
}

func queryEntityTable(rtCtx *RuntimeFormulaContext, name string) ([]any, bool) {
	if rtCtx == nil || rtCtx.Resolver == nil || rtCtx.DataSources == nil {
		return nil, false
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, false
	}
	binding, query, err := rtCtx.Resolver.Resolve(rtCtx.Ctx, rtCtx.User.TenantID, rtCtx.App.AppID, name, databinding.QueryOverrides{})
	if err != nil {
		return nil, false
	}
	query.TenantID = rtCtx.User.TenantID
	query.UserID = rtCtx.User.UserID
	source, err := rtCtx.DataSources.ForKind(binding.Kind)
	if err != nil {
		return nil, false
	}
	result, err := source.Query(rtCtx.Ctx, query)
	if err != nil {
		return nil, false
	}
	items := make([]any, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, map[string]interface{}(item))
	}
	return items, true
}

func (d *Dispatcher) execDefaults(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	dataSource, ok := parseSingleIdentifierCall(formula, "Defaults")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Defaults() formula", nil)
	}
	if rtCtx.Resolver == nil || rtCtx.DataSources == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "data services are unavailable", nil)
	}
	binding, _, err := rtCtx.Resolver.Resolve(rtCtx.Ctx, rtCtx.User.TenantID, rtCtx.App.AppID, dataSource, databinding.QueryOverrides{})
	if err != nil {
		if errors.Is(err, databinding.ErrDataSourceNotFound) {
			return nil, newFormulaError("DATASOURCE_NOT_FOUND", err.Error(), nil)
		}
		return nil, newFormulaError("RUNTIME_ERROR", err.Error(), nil)
	}
	_ = binding
	return databinding.DataItem{}, nil
}

func (d *Dispatcher) execPatch(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	dataSource, objectLiteral, ok := parseTwoArgCall(formula, "Patch")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Patch() formula", nil)
	}
	record, err := parseRecordObject(objectLiteral)
	if err != nil {
		return nil, err
	}
	if rtCtx.Resolver == nil || rtCtx.DataSources == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "data services are unavailable", nil)
	}

	binding, _, err := rtCtx.Resolver.Resolve(rtCtx.Ctx, rtCtx.User.TenantID, rtCtx.App.AppID, dataSource, databinding.QueryOverrides{})
	if err != nil {
		if errors.Is(err, databinding.ErrDataSourceNotFound) {
			return nil, newFormulaError("DATASOURCE_NOT_FOUND", err.Error(), nil)
		}
		return nil, newFormulaError("RUNTIME_ERROR", err.Error(), nil)
	}

	source, err := rtCtx.DataSources.ForKind(binding.Kind)
	if err != nil {
		return nil, newFormulaError("RUNTIME_ERROR", err.Error(), nil)
	}

	key := databinding.DataSourceKey{Kind: binding.Kind, EntityID: binding.EntityID}
	patch := map[string]interface{}{}
	for field, value := range record {
		switch field {
		case "recordId", "version":
			continue
		default:
			patch[field] = value
		}
	}

	if recordIDRaw, ok := record["recordId"].(string); ok && strings.TrimSpace(recordIDRaw) != "" {
		recordID, parseErr := parseUUID(recordIDRaw)
		if parseErr != nil {
			return nil, newFormulaError("INVALID_FORMULA", "invalid recordId in Patch()", nil)
		}
		version := 0
		if raw, hasVersion := record["version"]; hasVersion {
			switch typed := raw.(type) {
			case float64:
				version = int(typed)
			case int:
				version = typed
			case int64:
				version = int(typed)
			default:
				return nil, newFormulaError("INVALID_FORMULA", "version is required for Patch() updates", nil)
			}
		}
		item, updateErr := source.Update(rtCtx.Ctx, rtCtx.User.TenantID, rtCtx.User.UserID, key, recordID, patch, version)
		if updateErr != nil {
			return nil, mapRuntimeDataError(updateErr)
		}
		result := dereferenceDataItem(item)
		if rtCtx.Events != nil {
			rtCtx.RecordRefresh(rtCtx.Events.DatasourceChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, dataSource))
		}
		return result, nil
	}

	item, createErr := source.Create(rtCtx.Ctx, rtCtx.User.TenantID, rtCtx.User.UserID, key, patch)
	if createErr != nil {
		return nil, mapRuntimeDataError(createErr)
	}
	result := dereferenceDataItem(item)
	if rtCtx.Events != nil {
		rtCtx.RecordRefresh(rtCtx.Events.DatasourceChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, dataSource))
	}
	return result, nil
}

func (d *Dispatcher) execRemove(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	dataSource, secondArg, ok := parseTwoArgCall(formula, "Remove")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Remove() formula", nil)
	}
	if rtCtx.Resolver == nil || rtCtx.DataSources == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "data services are unavailable", nil)
	}

	binding, _, err := rtCtx.Resolver.Resolve(rtCtx.Ctx, rtCtx.User.TenantID, rtCtx.App.AppID, dataSource, databinding.QueryOverrides{})
	if err != nil {
		if errors.Is(err, databinding.ErrDataSourceNotFound) {
			return nil, newFormulaError("DATASOURCE_NOT_FOUND", err.Error(), nil)
		}
		return nil, newFormulaError("RUNTIME_ERROR", err.Error(), nil)
	}

	source, err := rtCtx.DataSources.ForKind(binding.Kind)
	if err != nil {
		return nil, newFormulaError("RUNTIME_ERROR", err.Error(), nil)
	}
	key := databinding.DataSourceKey{Kind: binding.Kind, EntityID: binding.EntityID}

	if binding.Kind == databinding.DataSourceKindStorage {
		deleter, ok := source.(interface {
			DeleteByObjectKey(ctx context.Context, tenantID, userID uuid.UUID, key databinding.DataSourceKey, objectKey string) error
		})
		if !ok {
			return nil, newFormulaError("RUNTIME_ERROR", "storage delete is unavailable", nil)
		}
		objectKey, keyErr := resolveRemoveObjectKey(d, rtCtx, secondArg)
		if keyErr != nil {
			return nil, keyErr
		}
		if delErr := deleter.DeleteByObjectKey(rtCtx.Ctx, rtCtx.User.TenantID, rtCtx.User.UserID, key, objectKey); delErr != nil {
			return nil, mapRuntimeDataError(delErr)
		}
	} else {
		recordID, idErr := resolveRemoveRecordID(d, rtCtx, secondArg)
		if idErr != nil {
			return nil, idErr
		}
		if delErr := source.Delete(rtCtx.Ctx, rtCtx.User.TenantID, rtCtx.User.UserID, key, recordID); delErr != nil {
			return nil, mapRuntimeDataError(delErr)
		}
	}

	if rtCtx.Events != nil {
		rtCtx.RecordRefresh(rtCtx.Events.DatasourceChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, dataSource))
	}
	return true, nil
}

func resolveRemoveRecordID(d *Dispatcher, rtCtx *RuntimeFormulaContext, secondArg string) (uuid.UUID, error) {
	trimmed := strings.TrimSpace(secondArg)
	if strings.HasPrefix(trimmed, "{") {
		record, err := parseRecordObject(trimmed)
		if err != nil {
			return uuid.Nil, err
		}
		return recordIDFromMap(record)
	}
	value, err := d.evaluator.evaluate(rtCtx, trimmed)
	if err != nil {
		return uuid.Nil, err
	}
	switch typed := value.(type) {
	case string:
		return parseUUID(strings.TrimSpace(typed))
	case map[string]interface{}:
		return recordIDFromMap(typed)
	case databinding.DataItem:
		return recordIDFromMap(map[string]interface{}(typed))
	default:
		return uuid.Nil, newFormulaError("INVALID_FORMULA", "Remove() second argument must be a recordId or record", nil)
	}
}

func recordIDFromMap(record map[string]interface{}) (uuid.UUID, error) {
	if record == nil {
		return uuid.Nil, newFormulaError("INVALID_FORMULA", "Remove() requires a recordId", nil)
	}
	for _, field := range []string{"recordId", "id"} {
		if raw, ok := record[field]; ok && raw != nil {
			text := strings.TrimSpace(fmt.Sprint(raw))
			if text == "" {
				continue
			}
			id, err := parseUUID(text)
			if err != nil {
				continue
			}
			return id, nil
		}
	}
	return uuid.Nil, newFormulaError("INVALID_FORMULA", "Remove() record must include recordId", nil)
}

func resolveRemoveObjectKey(d *Dispatcher, rtCtx *RuntimeFormulaContext, secondArg string) (string, error) {
	trimmed := strings.TrimSpace(secondArg)
	if strings.HasPrefix(trimmed, "{") {
		record, err := parseRecordObject(trimmed)
		if err != nil {
			return "", err
		}
		return objectKeyFromRecord(record)
	}
	value, err := d.evaluator.evaluate(rtCtx, trimmed)
	if err != nil {
		return "", err
	}
	switch typed := value.(type) {
	case string:
		if strings.TrimSpace(typed) == "" {
			return "", newFormulaError("INVALID_FORMULA", "Remove() requires an object key", nil)
		}
		return strings.TrimSpace(typed), nil
	case map[string]interface{}:
		return objectKeyFromRecord(typed)
	case databinding.DataItem:
		return objectKeyFromRecord(map[string]interface{}(typed))
	default:
		return "", newFormulaError("INVALID_FORMULA", "Remove() second argument must be a key or record", nil)
	}
}

func objectKeyFromRecord(record map[string]interface{}) (string, error) {
	if record == nil {
		return "", newFormulaError("INVALID_FORMULA", "Remove() requires an object key", nil)
	}
	for _, field := range []string{"key", "id"} {
		if raw, ok := record[field]; ok && raw != nil {
			key := strings.TrimSpace(fmt.Sprint(raw))
			if key != "" {
				return key, nil
			}
		}
	}
	return "", newFormulaError("INVALID_FORMULA", "Remove() record must include key or id", nil)
}

func (d *Dispatcher) execNavigate(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	screen, ok := parseSingleIdentifierCall(formula, "Navigate")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Navigate() formula", nil)
	}
	if rtCtx.Navigation == nil {
		return nil, newFormulaError("NAVIGATION_NOT_IMPLEMENTED", "navigation service is unavailable", nil)
	}
	if err := rtCtx.Navigation.Navigate(screen); err != nil {
		var formulaErr *FormulaError
		if errors.As(err, &formulaErr) {
			return nil, formulaErr
		}
		return nil, newFormulaError("NAVIGATION_NOT_IMPLEMENTED", err.Error(), nil)
	}
	return true, nil
}

func (d *Dispatcher) execLookUp(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	dataSource, predicate, ok := parseTwoArgCall(formula, "LookUp")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid LookUp() formula", nil)
	}
	if rtCtx.Resolver == nil || rtCtx.DataSources == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "data services are unavailable", nil)
	}
	expr, err := databinding.ParseFilterExpr(predicate)
	if err != nil {
		return nil, newFormulaError("INVALID_FORMULA", err.Error(), nil)
	}
	if expr.Empty() {
		return nil, newFormulaError("INVALID_FORMULA", "LookUp() requires a predicate", nil)
	}

	binding, query, err := rtCtx.Resolver.Resolve(rtCtx.Ctx, rtCtx.User.TenantID, rtCtx.App.AppID, dataSource, databinding.QueryOverrides{
		Filter: predicate,
		Limit:  1,
	})
	if err != nil {
		if errors.Is(err, databinding.ErrDataSourceNotFound) {
			return nil, newFormulaError("DATASOURCE_NOT_FOUND", err.Error(), nil)
		}
		return nil, mapRuntimeDataError(err)
	}
	query.TenantID = rtCtx.User.TenantID
	query.UserID = rtCtx.User.UserID
	query.Limit = 1
	query.FilterExpr = expr

	source, err := rtCtx.DataSources.ForKind(binding.Kind)
	if err != nil {
		return nil, newFormulaError("RUNTIME_ERROR", err.Error(), nil)
	}
	result, err := source.Query(rtCtx.Ctx, query)
	if err != nil {
		return nil, mapRuntimeDataError(err)
	}
	if result == nil || len(result.Items) == 0 {
		return nil, nil
	}
	return dereferenceDataItem(&result.Items[0]), nil
}

func (d *Dispatcher) execFilter(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	dataSource, predicate, ok := parseTwoArgCall(formula, "Filter")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Filter() formula", nil)
	}
	if rtCtx.Resolver == nil || rtCtx.DataSources == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "data services are unavailable", nil)
	}
	expr, err := databinding.ParseFilterExpr(predicate)
	if err != nil {
		return nil, newFormulaError("INVALID_FORMULA", err.Error(), nil)
	}
	if expr.Empty() {
		return nil, newFormulaError("INVALID_FORMULA", "Filter() requires a predicate", nil)
	}

	binding, query, err := rtCtx.Resolver.Resolve(rtCtx.Ctx, rtCtx.User.TenantID, rtCtx.App.AppID, dataSource, databinding.QueryOverrides{
		Filter: predicate,
	})
	if err != nil {
		if errors.Is(err, databinding.ErrDataSourceNotFound) {
			return nil, newFormulaError("DATASOURCE_NOT_FOUND", err.Error(), nil)
		}
		return nil, mapRuntimeDataError(err)
	}
	query.TenantID = rtCtx.User.TenantID
	query.UserID = rtCtx.User.UserID
	query.FilterExpr = expr

	source, err := rtCtx.DataSources.ForKind(binding.Kind)
	if err != nil {
		return nil, newFormulaError("RUNTIME_ERROR", err.Error(), nil)
	}
	result, err := source.Query(rtCtx.Ctx, query)
	if err != nil {
		return nil, mapRuntimeDataError(err)
	}
	if result == nil || len(result.Items) == 0 {
		return []any{}, nil
	}
	rows := make([]any, 0, len(result.Items))
	for i := range result.Items {
		rows = append(rows, dereferenceDataItem(&result.Items[i]))
	}
	return rows, nil
}

func (d *Dispatcher) execSubmitForm(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	formName, ok := parseSingleIdentifierCall(formula, "SubmitForm")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid SubmitForm() formula", nil)
	}
	if rtCtx.FormActions == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "form actions are unavailable", nil)
	}
	dataSource, err := rtCtx.FormActions.SubmitForm(formName)
	if err != nil {
		return nil, mapFormActionError(err)
	}
	if rtCtx.Events != nil {
		rtCtx.RecordRefresh(rtCtx.Events.FormChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, formName))
		if strings.TrimSpace(dataSource) != "" {
			rtCtx.RecordRefresh(rtCtx.Events.DatasourceChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, dataSource))
		}
	}
	return true, nil
}

func (d *Dispatcher) execResetForm(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	formName, ok := parseSingleIdentifierCall(formula, "ResetForm")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid ResetForm() formula", nil)
	}
	if rtCtx.FormActions == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "form actions are unavailable", nil)
	}
	if err := rtCtx.FormActions.ResetForm(formName); err != nil {
		return nil, mapFormActionError(err)
	}
	if rtCtx.Events != nil {
		rtCtx.RecordRefresh(rtCtx.Events.FormChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, formName))
	}
	return true, nil
}

func (d *Dispatcher) execSetFormMode(rtCtx *RuntimeFormulaContext, formula, actionName, mode string) (any, error) {
	formName, ok := parseSingleIdentifierCall(formula, actionName)
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid "+actionName+" formula", nil)
	}
	if rtCtx.FormActions == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "form actions are unavailable", nil)
	}
	if err := rtCtx.FormActions.SetFormMode(formName, mode); err != nil {
		return nil, mapFormActionError(err)
	}
	if rtCtx.Events != nil {
		rtCtx.RecordRefresh(rtCtx.Events.FormChanged(rtCtx.Session.SessionID, rtCtx.App.AppID, formName))
	}
	return true, nil
}

func (d *Dispatcher) execIf(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	condition, trueExpr, falseExpr, ok := parseIfFormula(formula)
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid If() formula", nil)
	}
	condValue, err := d.evaluator.evaluate(rtCtx, condition)
	if err != nil {
		return nil, err
	}
	if isTruthy(condValue) {
		return d.evalIfBranch(rtCtx, trueExpr)
	}
	return d.evalIfBranch(rtCtx, falseExpr)
}

func (d *Dispatcher) evalIfBranch(rtCtx *RuntimeFormulaContext, expression string) (any, error) {
	value, err := d.evaluator.evaluate(rtCtx, expression)
	if err == nil {
		return value, nil
	}
	expression = strings.TrimSpace(expression)
	if identifierPattern.MatchString(expression) {
		return expression, nil
	}
	return nil, err
}

func (d *Dispatcher) execBack(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	name, content, ok := parseCallContent(formula)
	if !ok || !strings.EqualFold(name, "Back") || strings.TrimSpace(content) != "" {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Back() formula", nil)
	}
	if rtCtx == nil || rtCtx.State == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "state manager is required", nil)
	}
	previous, ok := rtCtx.State.GetVariable("varPreviousScreen")
	if !ok {
		return nil, newFormulaError("RUNTIME_ERROR", "no previous screen", nil)
	}
	screen, ok := previous.(string)
	if !ok || strings.TrimSpace(screen) == "" {
		return nil, newFormulaError("RUNTIME_ERROR", "no previous screen", nil)
	}
	if rtCtx.Navigation == nil {
		return nil, newFormulaError("RUNTIME_ERROR", "navigation is unavailable", nil)
	}
	return true, rtCtx.Navigation.Navigate(strings.TrimSpace(screen))
}

func isTruthy(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return strings.TrimSpace(typed) != ""
	case nil:
		return false
	case float64:
		return typed != 0
	case int:
		return typed != 0
	default:
		return true
	}
}

func mapFormActionError(err error) error {
	if err == nil {
		return nil
	}
	return newFormulaError("RUNTIME_ERROR", err.Error(), nil)
}

func dereferenceDataItem(item *databinding.DataItem) databinding.DataItem {
	if item == nil {
		return databinding.DataItem{}
	}
	return *item
}
