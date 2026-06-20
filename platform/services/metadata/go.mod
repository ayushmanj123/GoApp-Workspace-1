module github.com/goapps-platform/metadata-service

go 1.25.0

require (
	github.com/goapps-platform/shared v0.0.0
	github.com/gofiber/fiber/v2 v2.52.6
	github.com/golang-migrate/migrate/v4 v4.18.3
	github.com/google/uuid v1.6.0
	gorm.io/datatypes v1.2.7
	gorm.io/driver/postgres v1.5.11
	gorm.io/gorm v1.30.0
)

require (
	github.com/gabriel-vasile/mimetype v1.4.13 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.30.3 // indirect
	github.com/joho/godotenv v1.5.1 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	golang.org/x/crypto v0.52.0 // indirect
	golang.org/x/sys v0.45.0 // indirect
	golang.org/x/text v0.37.0 // indirect
)

replace github.com/goapps-platform/shared => ../../packages/shared/go
