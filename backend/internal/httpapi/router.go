package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"study-tracker-backend/internal/auth"
	"study-tracker-backend/internal/config"
	"study-tracker-backend/internal/store"
)

// Deps are the collaborators the API needs.
type Deps struct {
	Config config.Config
	Store  store.Store
	Issuer *auth.Issuer
	Logger *slog.Logger
}

type api struct {
	cfg    config.Config
	store  store.Store
	issuer *auth.Issuer
}

// NewRouter assembles middleware and routes. It is the single place that
// knows the URL layout.
func NewRouter(d Deps) http.Handler {
	a := &api{cfg: d.Config, store: d.Store, issuer: d.Issuer}

	authn := &auth.Authenticator{
		Issuer: d.Issuer,
		Users:  d.Store,
		OnUnauthorized: func(w http.ResponseWriter, r *http.Request) {
			writeError(w, r, http.StatusUnauthorized, "unauthorized")
		},
		OnError: handleErr,
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(requestLogger(d.Logger))
	r.Use(recoverer(d.Logger))
	r.Use(middleware.Timeout(d.Config.RequestTimeout))
	r.Use(maxBody(d.Config.MaxBodyBytes))
	// go-chi/cors treats an empty AllowedOrigins as "allow everything", so the
	// middleware is only mounted when an explicit allow-list exists. Without
	// it no CORS headers are emitted and browsers deny cross-origin calls.
	if len(d.Config.CORSOrigins) > 0 {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   d.Config.CORSOrigins,
			AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
			ExposedHeaders:   []string{"Content-Disposition"},
			AllowCredentials: false,
			MaxAge:           300,
		}))
	}

	limited := func(limit int, window time.Duration) func(http.Handler) http.Handler {
		return httprate.Limit(limit, window,
			httprate.WithKeyFuncs(httprate.KeyByIP),
			httprate.WithLimitHandler(func(w http.ResponseWriter, r *http.Request) {
				writeError(w, r, http.StatusTooManyRequests, "too many requests, slow down")
			}),
		)
	}

	r.NotFound(func(w http.ResponseWriter, r *http.Request) { writeError(w, r, http.StatusNotFound, "route not found") })
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, r, http.StatusMethodNotAllowed, "method not allowed")
	})

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", a.health)

		r.Group(func(r chi.Router) {
			r.Use(limited(d.Config.AuthRateLimit, d.Config.AuthRateWindow))
			r.Post("/auth/register", a.register)
			r.Post("/auth/login", a.login)
		})

		r.With(limited(d.Config.FeedbackRateLimit, d.Config.FeedbackRateWindow), authn.Optional).
			Post("/feedback", a.createFeedback)

		r.Group(func(r chi.Router) {
			r.Use(authn.Require)
			r.Get("/auth/me", a.me)

			r.Get("/projects", a.listProjects)
			r.Post("/projects", a.createProject)
			r.Put("/projects/{id}", a.updateProject)
			r.Delete("/projects/{id}", a.deleteProject)

			r.Get("/sessions", a.listSessions)
			r.Post("/sessions", a.createSession)
			r.Delete("/sessions/{id}", a.deleteSession)

			r.Get("/stats/dashboard", a.dashboardStats)
			r.Get("/settings", a.getSettings)
			r.Post("/settings", a.updateSettings)
			r.Get("/export", a.export)
		})
	})

	return r
}

// userID returns the authenticated user. Handlers behind Require may rely on
// it; a missing id is a programming error and panics into the recoverer.
func userID(r *http.Request) int64 {
	id, ok := auth.UserIDFrom(r.Context())
	if !ok {
		panic("handler reached without authenticated user")
	}
	return id
}
