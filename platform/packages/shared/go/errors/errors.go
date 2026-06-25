// Package errors provides typed application errors for GoApps Platform services.
package errors

import (
	"errors"
	"fmt"
	"net/http"
)

// AppError is a structured error with HTTP status and machine-readable code.
type AppError struct {
	Code          string
	Message       string
	HTTPStatus    int
	Details       map[string]interface{}
	CorrelationID string
	Cause         error
}

func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error {
	return e.Cause
}

// WithCorrelationID returns a copy tagged with the request correlation ID.
func (e *AppError) WithCorrelationID(requestID string) *AppError {
	if e == nil {
		return nil
	}
	copy := *e
	copy.CorrelationID = requestID
	return &copy
}

// WithDetails returns a copy with additional error details (e.g. validation fields).
func (e *AppError) WithDetails(details map[string]interface{}) *AppError {
	if e == nil {
		return nil
	}
	copy := *e
	if len(details) == 0 {
		copy.Details = nil
		return &copy
	}
	copy.Details = make(map[string]interface{}, len(details))
	for key, value := range details {
		copy.Details[key] = value
	}
	return &copy
}

// New creates a new AppError with the given code, message, and HTTP status.
func New(code, message string, httpStatus int) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		HTTPStatus: httpStatus,
	}
}

// Wrap wraps an underlying error with an AppError. Internal causes are not exposed to clients.
func Wrap(cause error, code, message string, httpStatus int) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		HTTPStatus: httpStatus,
		Cause:      cause,
	}
}

// Common error constructors used across services.

func BadRequest(message string) *AppError {
	return New("BAD_REQUEST", message, http.StatusBadRequest)
}

func Unauthorized(message string) *AppError {
	return New("UNAUTHORIZED", message, http.StatusUnauthorized)
}

func Forbidden(message string) *AppError {
	return New("FORBIDDEN", message, http.StatusForbidden)
}

func NotFound(message string) *AppError {
	return New("NOT_FOUND", message, http.StatusNotFound)
}

func Conflict(message string) *AppError {
	return New("CONFLICT", message, http.StatusConflict)
}

func Validation(message string, details map[string]interface{}) *AppError {
	return New("VALIDATION_ERROR", message, http.StatusBadRequest).WithDetails(details)
}

func Internal(message string) *AppError {
	return New("INTERNAL_ERROR", message, http.StatusInternalServerError)
}

// Sanitize returns a client-safe AppError, hiding internal causes for 5xx responses.
func Sanitize(err error, requestID string) *AppError {
	if err == nil {
		return nil
	}
	if appErr := AsAppError(err); appErr != nil {
		safe := *appErr
		safe.CorrelationID = requestID
		if safe.HTTPStatus >= http.StatusInternalServerError && safe.Cause != nil {
			safe.Cause = nil
		}
		return &safe
	}
	return Internal("internal server error").WithCorrelationID(requestID)
}

// IsAppError checks whether err is an AppError.
func IsAppError(err error) bool {
	var appErr *AppError
	return errors.As(err, &appErr)
}

// AsAppError extracts an AppError from err, or returns nil.
func AsAppError(err error) *AppError {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr
	}
	return nil
}

// HTTPStatusFromError returns the HTTP status for an error. Defaults to 500.
func HTTPStatusFromError(err error) int {
	if appErr := AsAppError(err); appErr != nil {
		return appErr.HTTPStatus
	}
	return http.StatusInternalServerError
}
