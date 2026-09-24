package formula

import (
	"fmt"
	"sort"
	"strings"
)

func (d *Dispatcher) execNotify(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	name, content, ok := parseCallContent(formula)
	if !ok || !strings.EqualFold(name, "Notify") || strings.TrimSpace(content) == "" {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Notify() formula", nil)
	}
	messageExpr := strings.TrimSpace(content)
	if comma := findFirstTopLevelComma(content); comma != -1 {
		messageExpr = strings.TrimSpace(content[:comma])
	}
	message, err := d.evaluator.evaluate(rtCtx, messageExpr)
	if err != nil {
		return nil, err
	}
	return fmt.Sprint(message), nil
}

func (d *Dispatcher) execReset(_ *RuntimeFormulaContext, formula string) (any, error) {
	if _, ok := parseSingleIdentifierCall(formula, "Reset"); !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Reset() formula", nil)
	}
	return true, nil
}

func (d *Dispatcher) execSelect(_ *RuntimeFormulaContext, formula string) (any, error) {
	if _, ok := parseSingleIdentifierCall(formula, "Select"); !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Select() formula", nil)
	}
	return true, nil
}

func (d *Dispatcher) execLaunch(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	name, content, ok := parseCallContent(formula)
	if !ok || !strings.EqualFold(name, "Launch") || strings.TrimSpace(content) == "" {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Launch() formula", nil)
	}
	targetExpr := strings.TrimSpace(content)
	if comma := findFirstTopLevelComma(content); comma != -1 {
		targetExpr = strings.TrimSpace(content[:comma])
	}
	target, err := d.evaluator.evaluate(rtCtx, targetExpr)
	if err != nil && identifierPattern.MatchString(targetExpr) {
		if rtCtx.Navigation == nil {
			return nil, newFormulaError("NAVIGATION_NOT_IMPLEMENTED", "navigation service is unavailable", nil)
		}
		if navErr := rtCtx.Navigation.Navigate(targetExpr); navErr != nil {
			return nil, newFormulaError("NAVIGATION_NOT_IMPLEMENTED", navErr.Error(), nil)
		}
		return true, nil
	}
	if err != nil {
		return nil, err
	}
	text := fmt.Sprint(target)
	if strings.HasPrefix(strings.ToLower(text), "http://") || strings.HasPrefix(strings.ToLower(text), "https://") {
		return text, nil
	}
	if rtCtx.Navigation == nil {
		return nil, newFormulaError("NAVIGATION_NOT_IMPLEMENTED", "navigation service is unavailable", nil)
	}
	if navErr := rtCtx.Navigation.Navigate(text); navErr != nil {
		return nil, newFormulaError("NAVIGATION_NOT_IMPLEMENTED", navErr.Error(), nil)
	}
	return true, nil
}

func (d *Dispatcher) execSort(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	collection, fieldExpr, ok := parseTwoArgCall(formula, "Sort")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Sort() formula", nil)
	}
	return d.sortCollection(rtCtx, collection, fieldExpr, false)
}

func (d *Dispatcher) execSortByColumns(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	collection, fieldExpr, orderExpr, ok := parseThreeArgCall(formula, "SortByColumns")
	if !ok {
		collection, fieldExpr, ok = parseTwoArgCall(formula, "SortByColumns")
		if !ok {
			return nil, newFormulaError("INVALID_FORMULA", "invalid SortByColumns() formula", nil)
		}
		orderExpr = ""
	}
	descending := strings.Contains(strings.ToLower(orderExpr), "desc")
	return d.sortCollection(rtCtx, collection, fieldExpr, descending)
}

func (d *Dispatcher) sortCollection(rtCtx *RuntimeFormulaContext, collection, fieldExpr string, descending bool) (any, error) {
	field := strings.Trim(strings.TrimSpace(fieldExpr), `"`)
	items := append([]any(nil), rtCtx.State.GetCollection(collection)...)
	sort.SliceStable(items, func(i, j int) bool {
		order := compareFields(recordField(items[i], field), recordField(items[j], field))
		if descending {
			return order > 0
		}
		return order < 0
	})
	rtCtx.State.SetCollection(collection, items)
	return items, nil
}

func (d *Dispatcher) execSearch(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	collection, rest, ok := parseTwoArgCall(formula, "Search")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid Search() formula", nil)
	}
	comma := findFirstTopLevelComma(rest)
	textExpr := rest
	fieldExpr := ""
	if comma != -1 {
		textExpr = strings.TrimSpace(rest[:comma])
		fieldExpr = strings.TrimSpace(rest[comma+1:])
	}
	textValue, err := d.evaluator.evaluate(rtCtx, textExpr)
	if err != nil {
		textValue = strings.Trim(textExpr, `"`)
	}
	needle := strings.ToLower(fmt.Sprint(textValue))
	field := strings.Trim(fieldExpr, `"`)
	matched := make([]any, 0)
	for _, item := range rtCtx.State.GetCollection(collection) {
		haystack := strings.ToLower(fmt.Sprint(recordField(item, field)))
		if field == "" {
			haystack = strings.ToLower(fmt.Sprint(item))
		}
		if strings.Contains(haystack, needle) {
			matched = append(matched, item)
		}
	}
	rtCtx.State.SetCollection(collection, matched)
	return matched, nil
}

func (d *Dispatcher) execForAll(rtCtx *RuntimeFormulaContext, formula string) (any, error) {
	collection, body, ok := parseTwoArgCall(formula, "ForAll")
	if !ok {
		return nil, newFormulaError("INVALID_FORMULA", "invalid ForAll() formula", nil)
	}
	previous := rtCtx.Overlay
	var last any
	for _, item := range rtCtx.State.GetCollection(collection) {
		overlay := map[string]interface{}{}
		for key, value := range previous {
			overlay[key] = value
		}
		record, _ := item.(map[string]interface{})
		if record == nil {
			record = map[string]interface{}{"Value": item}
		}
		overlay["ThisRecord"] = record
		overlay["ThisItem"] = record
		rtCtx.Overlay = overlay
		var err error
		last, err = d.Dispatch(rtCtx, body)
		if err != nil {
			rtCtx.Overlay = previous
			return nil, err
		}
	}
	rtCtx.Overlay = previous
	return last, nil
}

func recordField(item any, field string) any {
	record, ok := item.(map[string]interface{})
	if !ok || field == "" {
		return item
	}
	if value, exists := record[field]; exists {
		return value
	}
	for key, value := range record {
		if strings.EqualFold(key, field) {
			return value
		}
	}
	return nil
}

func compareFields(left, right any) int {
	leftNumber, leftOK := toFloat64(left)
	rightNumber, rightOK := toFloat64(right)
	if leftOK && rightOK {
		switch {
		case leftNumber < rightNumber:
			return -1
		case leftNumber > rightNumber:
			return 1
		default:
			return 0
		}
	}
	return strings.Compare(fmt.Sprint(left), fmt.Sprint(right))
}
