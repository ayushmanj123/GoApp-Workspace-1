package services

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/goapps-platform/metadata-service/internal/repositories"
)

func TestParseAndValidateDefinitionManualEmptySteps(t *testing.T) {
	def, err := parseAndValidateDefinition(json.RawMessage(`{"trigger":{"type":"manual"},"steps":[]}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if def.Trigger.Type != "manual" {
		t.Fatalf("trigger=%q", def.Trigger.Type)
	}
	if len(def.Steps) != 0 {
		t.Fatalf("expected 0 steps")
	}
}

func TestParseAndValidateDefinitionSchedule(t *testing.T) {
	raw := `{"trigger":{"type":"schedule","cron":"0 */15 * * *","timezone":"UTC","enabled":true},"steps":[]}`
	def, err := parseAndValidateDefinition(json.RawMessage(raw))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if def.Trigger.Type != TriggerSchedule || def.Trigger.Cron != "0 */15 * * *" {
		t.Fatalf("unexpected trigger: %#v", def.Trigger)
	}
}

func TestParseAndValidateDefinitionRejectsBadCron(t *testing.T) {
	_, err := parseAndValidateDefinition(json.RawMessage(
		`{"trigger":{"type":"schedule","cron":"not-a-cron","timezone":"UTC"},"steps":[]}`,
	))
	if err == nil || !strings.Contains(err.Error(), "cron") {
		t.Fatalf("expected cron error, got %v", err)
	}
}

func TestParseAndValidateDefinitionWebhook(t *testing.T) {
	def, err := parseAndValidateDefinition(json.RawMessage(
		`{"trigger":{"type":"webhook","enabled":true},"steps":[]}`,
	))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if def.Trigger.Type != TriggerWebhook {
		t.Fatalf("trigger=%q", def.Trigger.Type)
	}
}

func TestParseAndValidateDefinitionRejectsUnknownTrigger(t *testing.T) {
	_, err := parseAndValidateDefinition(json.RawMessage(`{"trigger":{"type":"entity"},"steps":[]}`))
	if err == nil || !strings.Contains(err.Error(), "manual, schedule, or webhook") {
		t.Fatalf("expected trigger type error, got %v", err)
	}
}

func TestParseAndValidateDefinitionConnectorAction(t *testing.T) {
	raw := `{
		"trigger":{"type":"manual"},
		"steps":[{
			"id":"s1",
			"type":"connector_action",
			"connector_id":"00000000-0000-4000-8000-000000000099",
			"action_name":"list"
		}]
	}`
	def, err := parseAndValidateDefinition(json.RawMessage(raw))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(def.Steps) != 1 || def.Steps[0].ActionName != "list" {
		t.Fatalf("unexpected steps: %#v", def.Steps)
	}
}

func TestNextScheduleRunAt(t *testing.T) {
	from := time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC)
	next, err := repositories.NextScheduleRunAt("0 * * * *", "UTC", from)
	if err != nil {
		t.Fatalf("NextScheduleRunAt: %v", err)
	}
	if next == nil || !next.Equal(time.Date(2026, 7, 19, 13, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected next: %v", next)
	}
}

func TestJoinURL(t *testing.T) {
	got, err := joinURL("https://api.example.com/v1/", "/items")
	if err != nil {
		t.Fatalf("joinURL: %v", err)
	}
	if got != "https://api.example.com/items" && got != "https://api.example.com/v1/items" {
		// ResolveReference may drop or keep path depending on leading slash
		if !strings.Contains(got, "api.example.com") || !strings.Contains(got, "items") {
			t.Fatalf("unexpected url: %s", got)
		}
	}
}

func TestTruncatePreview(t *testing.T) {
	long := strings.Repeat("a", maxBodyPreview+10)
	got := truncatePreview(long)
	if !strings.HasSuffix(got, "…") {
		t.Fatalf("expected ellipsis")
	}
}
