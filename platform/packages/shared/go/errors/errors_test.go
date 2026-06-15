package errors_test

import (
	"errors"
	"net/http"
	"testing"

	apperrors "github.com/goapps-platform/shared/errors"
)

func TestAppError(t *testing.T) {
	err := apperrors.BadRequest("invalid field")
	if err.Code != "BAD_REQUEST" {
		t.Fatalf("expected BAD_REQUEST, got %s", err.Code)
	}
	if err.HTTPStatus != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", err.HTTPStatus)
	}
}

func TestWrap(t *testing.T) {
	cause := errors.New("connection refused")
	err := apperrors.Wrap(cause, "DB_ERROR", "database unavailable", http.StatusServiceUnavailable)

	if !errors.Is(err, cause) {
		t.Fatal("expected wrapped cause")
	}
	if apperrors.HTTPStatusFromError(err) != http.StatusServiceUnavailable {
		t.Fatal("expected 503 status")
	}
}

func TestAsAppError(t *testing.T) {
	err := apperrors.Unauthorized("missing token")
	if !apperrors.IsAppError(err) {
		t.Fatal("expected AppError")
	}
	if apperrors.AsAppError(errors.New("other")) != nil {
		t.Fatal("expected nil for non-AppError")
	}
}
