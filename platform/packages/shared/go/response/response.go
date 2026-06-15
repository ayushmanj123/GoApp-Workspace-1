// Package response defines the standard API response envelope for GoApps Platform.
package response

import (
	"time"
)

// APIError represents an error in the API response envelope.
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Meta holds request metadata included in every response.
type Meta struct {
	RequestID string    `json:"requestId"`
	Timestamp time.Time `json:"timestamp"`
}

// Envelope is the standard API response format used across all services.
type Envelope struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

// OK builds a successful response envelope.
func OK(data interface{}, requestID string) Envelope {
	return Envelope{
		Success: true,
		Data:    data,
		Meta:    newMeta(requestID),
	}
}

// Fail builds an error response envelope.
func Fail(code, message, requestID string) Envelope {
	return Envelope{
		Success: false,
		Error: &APIError{
			Code:    code,
			Message: message,
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
