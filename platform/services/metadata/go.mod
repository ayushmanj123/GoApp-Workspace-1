module github.com/goapps-platform/metadata-service

go 1.22

require (
	github.com/goapps-platform/shared v0.0.0
	github.com/gofiber/fiber/v2 v2.52.6
	github.com/golang-migrate/migrate/v4 v4.18.3
	github.com/google/uuid v1.6.0
	gorm.io/datatypes v1.2.7
	gorm.io/driver/postgres v1.5.11
	gorm.io/gorm v1.25.12
)

replace github.com/goapps-platform/shared => ../../packages/shared/go
