package httpapi

import (
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/go-chi/chi/v5/middleware"
)

// requestLogger emits one structured line per request.
func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			start := time.Now()
			defer func() {
				logger.Info("request",
					"method", r.Method,
					"path", r.URL.Path,
					"status", ww.Status(),
					"bytes", ww.BytesWritten(),
					"duration_ms", time.Since(start).Milliseconds(),
					"ip", r.RemoteAddr,
					"request_id", middleware.GetReqID(r.Context()),
				)
			}()
			next.ServeHTTP(ww, r)
		})
	}
}

// recoverer converts panics into a JSON 500 and logs the stack.
func recoverer(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					if rec == http.ErrAbortHandler {
						panic(rec)
					}
					sentry.CurrentHub().Recover(rec)
					logger.Error("panic", "err", rec, "stack", string(debug.Stack()),
						"request_id", middleware.GetReqID(r.Context()), "path", r.URL.Path)
					writeError(w, r, http.StatusInternalServerError, "internal server error")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// maxBody caps request bodies so JSON decoding is bounded.
func maxBody(n int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, n)
			}
			next.ServeHTTP(w, r)
		})
	}
}
