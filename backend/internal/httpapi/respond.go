// Package httpapi wires the REST API: router, middleware, handlers, validation.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/getsentry/sentry-go"
	"github.com/go-chi/chi/v5/middleware"

	"study-tracker-backend/internal/store"
)

// ErrorBody is the single error envelope every failure response uses.
type ErrorBody struct {
	Error     string `json:"error"`
	RequestID string `json:"request_id,omitempty"`
}

// ValidationError is a client mistake that maps to 400 with its message.
type ValidationError struct{ Msg string }

func (e *ValidationError) Error() string { return e.Msg }

func invalid(format string, args ...any) error {
	return &ValidationError{Msg: fmt.Sprintf(format, args...)}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func writeError(w http.ResponseWriter, r *http.Request, status int, msg string) {
	writeJSON(w, status, ErrorBody{Error: msg, RequestID: middleware.GetReqID(r.Context())})
}

// handleErr maps domain and transport errors to responses. Unknown errors
// are logged with the request id and returned as an opaque 500.
func handleErr(w http.ResponseWriter, r *http.Request, err error) {
	var ve *ValidationError
	var mbe *http.MaxBytesError
	switch {
	case errors.As(err, &ve):
		writeError(w, r, http.StatusBadRequest, ve.Msg)
	case errors.Is(err, store.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "not found")
	case errors.Is(err, store.ErrConflict):
		writeError(w, r, http.StatusConflict, "already exists")
	case errors.Is(err, store.ErrInvalid):
		writeError(w, r, http.StatusBadRequest, "invalid data")
	case errors.As(err, &mbe):
		writeError(w, r, http.StatusRequestEntityTooLarge, "request body too large")
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		writeError(w, r, http.StatusServiceUnavailable, "request timed out")
	default:
		captureError(r, err)
		slog.ErrorContext(r.Context(), "internal error",
			"err", err, "request_id", middleware.GetReqID(r.Context()), "method", r.Method, "path", r.URL.Path)
		writeError(w, r, http.StatusInternalServerError, "internal server error")
	}
}

// decodeJSON reads one JSON object into dst, treating malformed input and
// oversized bodies as client errors.
func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			return err
		}
		if errors.Is(err, io.EOF) {
			return invalid("request body is required")
		}
		return invalid("invalid JSON body")
	}
	return nil
}

// captureError reports to Sentry when it is configured; a no-op otherwise.
func captureError(r *http.Request, err error) {
	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetTag("request_id", middleware.GetReqID(r.Context()))
		scope.SetTag("method", r.Method)
		scope.SetTag("path", r.URL.Path)
		sentry.CaptureException(err)
	})
}
