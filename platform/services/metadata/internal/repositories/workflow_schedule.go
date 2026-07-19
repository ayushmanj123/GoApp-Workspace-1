package repositories

import (
	"fmt"
	"strings"
	"time"

	"github.com/robfig/cron/v3"
)

var standardCronParser = cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)

// ParseScheduleCron validates a 5-field cron expression.
func ParseScheduleCron(expr string) (cron.Schedule, error) {
	expr = strings.TrimSpace(expr)
	if expr == "" {
		return nil, fmt.Errorf("cron expression is required")
	}
	sched, err := standardCronParser.Parse(expr)
	if err != nil {
		return nil, fmt.Errorf("invalid cron expression: %w", err)
	}
	return sched, nil
}

// NextScheduleRunAt returns the next fire time after `from` in the given IANA timezone.
func NextScheduleRunAt(cronExpr, timezone string, from time.Time) (*time.Time, error) {
	sched, err := ParseScheduleCron(cronExpr)
	if err != nil {
		return nil, err
	}
	tz := strings.TrimSpace(timezone)
	if tz == "" {
		tz = "UTC"
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}
	next := sched.Next(from.In(loc)).UTC()
	return &next, nil
}
