// Package response defines the standard API response envelope for GoApps Platform.
package response

import (
	"time"

	"github.com/goapps-platform/shared/errors"
)

// APIError represents an error in the API response envelope.
type APIError struct {
	Code          string                 `json:"code"`
	Message       string                 `json:"message"`
	Details       map[string]interface{} `json:"details,omitempty"`
	CorrelationID string                 `json:"correlationId,omitempty"`
}

// Pagination describes list pagination metadata.
type Pagination struct {
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
	Total  int64 `json:"total"`
}

// Meta holds request metadata included in every response.
type Meta struct {
	RequestID  string      `json:"requestId"`
	Timestamp  time.Time   `json:"timestamp"`
	Pagination *Pagination `json:"pagination,omitempty"`
}

// Envelope is the standard API response format used across all services.
type Envelope struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Error   *APIError   `json:"error"`
	Meta    *Meta       `json:"meta"`
}

// OK builds a successful response envelope.
func OK(data interface{}, requestID string) Envelope {
	return Envelope{
		Success: true,
		Data:    data,
		Error:   nil,
		Meta:    newMeta(requestID),
	}
}

// OKPaged builds a successful list response with pagination metadata.
func OKPaged(data interface{}, requestID string, pagination Pagination) Envelope {
	meta := newMeta(requestID)
	meta.Pagination = &pagination
	return Envelope{
		Success: true,
		Data:    data,
		Error:   nil,
		Meta:    meta,
	}
}

// Fail builds an error response envelope.
func Fail(code, message, requestID string) Envelope {
	return FailWithDetails(code, message, requestID, nil)
}

// FailWithDetails builds an error response envelope with optional structured details.
func FailWithDetails(code, message, requestID string, details map[string]interface{}) Envelope {
	return Envelope{
		Success: false,
		Data:    nil,
		Error: &APIError{
			Code:          code,
			Message:       message,
			Details:       details,
			CorrelationID: requestID,
		},
		Meta: newMeta(requestID),
	}
}

// FromAppError maps a shared AppError into the standard envelope.
func FromAppError(appErr *errors.AppError, requestID string) Envelope {
	if appErr == nil {
		return Fail("INTERNAL_ERROR", "internal server error", requestID)
	}
	correlationID := requestID
	if appErr.CorrelationID != "" {
		correlationID = appErr.CorrelationID
	}
	return Envelope{
		Success: false,
		Data:    nil,
		Error: &APIError{
			Code:          appErr.Code,
			Message:       appErr.Message,
			Details:       appErr.Details,
			CorrelationID: correlationID,
		},
		Meta: newMeta(requestID),
	}
}

func newMeta(requestID string) *Meta {
	return &Meta{
		RequestID: requestID,
		Timestamp: time.Now().UTC(),
	}
}
