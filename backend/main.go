package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"study-tracker-backend/auth"
	"study-tracker-backend/database"
	"study-tracker-backend/handlers"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		execDir, err := os.Getwd()
		if err != nil {
			dbPath = "study_tracker.db"
		} else {
			dbPath = filepath.Join(execDir, "..", "study_tracker.db")
		}
	}

	log.Printf("Initializing database at: %s", dbPath)
	db, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Fatal: Database initialization failed: %v", err)
	}
	defer db.Close()

	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// API Routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"status":"ok"}`))
		})

		// Public Auth Endpoints
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", handlers.Register)
			r.Post("/login", handlers.Login)
		})

		// Public Feedback endpoint (supports feedback from any user)
		r.Post("/feedback", handlers.CreateFeedback)

		// Protected Routes (Requires JWT Token)
		r.Group(func(r chi.Router) {
			r.Use(auth.AuthMiddleware)

			r.Get("/auth/me", handlers.GetMe)

			// Projects
			r.Get("/projects", handlers.GetProjects)
			r.Post("/projects", handlers.CreateProject)
			r.Put("/projects/{id}", handlers.UpdateProject)
			r.Delete("/projects/{id}", handlers.DeleteProject)

			// Sessions
			r.Get("/sessions", handlers.GetSessions)
			r.Post("/sessions", handlers.CreateSession)
			r.Delete("/sessions/{id}", handlers.DeleteSession)

			// Stats
			r.Get("/stats/dashboard", handlers.GetDashboardStats)

			// Settings
			r.Get("/settings", handlers.GetSettings)
			r.Post("/settings", handlers.UpdateSettings)

			// Export
			r.Get("/export", handlers.ExportData)
		})
	})

	addr := fmt.Sprintf("0.0.0.0:%s", port)
	log.Printf("Study Tracker Backend (Go) listening on http://0.0.0.0:%s", port)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
