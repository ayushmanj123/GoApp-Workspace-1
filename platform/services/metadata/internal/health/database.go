package health

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// DatabaseChecker verifies PostgreSQL connectivity for readiness probes.
type DatabaseChecker struct {
	DB *gorm.DB
}

func (d DatabaseChecker) Name() string {
	return "database"
}

func (d DatabaseChecker) Check(c *fiber.Ctx) error {
	if d.DB == nil {
		return fiber.ErrServiceUnavailable
	}
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(c.UserContext(), 2*time.Second)
	defer cancel()
	return sqlDB.PingContext(ctx)
}
