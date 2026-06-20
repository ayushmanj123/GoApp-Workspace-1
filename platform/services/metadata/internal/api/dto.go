package api

import (
	"time"

	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/api/contracts"
)

// Aliases to keep backwards compatibility for callers importing internal/api

type CreateApplicationRequest = contracts.CreateApplicationRequest
type UpdateApplicationRequest = contracts.UpdateApplicationRequest

type CreateScreenRequest = contracts.CreateScreenRequest
type CreateControlRequest = contracts.CreateControlRequest
type UpdatePropertiesRequest = contracts.UpdatePropertiesRequest
type CreateFormulaRequest = contracts.CreateFormulaRequest
type UpdateFormulaRequest = contracts.UpdateFormulaRequest

type ListOptions = contracts.ListOptions

type PagedResponse = contracts.PagedResponse

// helper aliases
func ParseUUIDPtr(s *string) *uuid.UUID { return contracts.ParseUUIDPtr(s) }
func NowUTC() time.Time { return contracts.NowUTC() }
