package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"study-tracker-backend/auth"
	"study-tracker-backend/database"
	"study-tracker-backend/models"
)

func Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if req.Email == "" || !strings.Contains(req.Email, "@") {
		http.Error(w, `{"error": "Valid email is required"}`, http.StatusBadRequest)
		return
	}
	if len(req.Password) < 6 {
		http.Error(w, `{"error": "Password must be at least 6 characters"}`, http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		req.Name = strings.Split(req.Email, "@")[0]
	}

	// Check if user already exists
	var existingID int64
	err := database.DB.QueryRow("SELECT id FROM users WHERE email = ?", req.Email).Scan(&existingID)
	if err == nil {
		http.Error(w, `{"error": "Email is already registered"}`, http.StatusConflict)
		return
	} else if err != sql.ErrNoRows {
		http.Error(w, `{"error": "Database error checking user"}`, http.StatusInternalServerError)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error": "Failed to encrypt password"}`, http.StatusInternalServerError)
		return
	}

	result, err := database.DB.Exec(
		"INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
		req.Email, string(hashedPassword), req.Name,
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to create user account"}`, http.StatusInternalServerError)
		return
	}

	userID, _ := result.LastInsertId()

	// Seed default projects for this user
	_ = database.SeedDefaultProjectsForUser(database.DB, userID)

	// Generate JWT
	token, err := auth.GenerateToken(userID, req.Email)
	if err != nil {
		http.Error(w, `{"error": "Failed to generate session token"}`, http.StatusInternalServerError)
		return
	}

	user := models.User{
		ID:    userID,
		Email: req.Email,
		Name:  req.Name,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(models.AuthResponse{
		Token: token,
		User:  user,
	})
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	err := database.DB.QueryRow(
		"SELECT id, email, password_hash, name, created_at FROM users WHERE email = ?",
		req.Email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.CreatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error": "Invalid email or password"}`, http.StatusUnauthorized)
		return
	} else if err != nil {
		http.Error(w, `{"error": "Database error during login"}`, http.StatusInternalServerError)
		return
	}

	// Compare bcrypt password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, `{"error": "Invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Email)
	if err != nil {
		http.Error(w, `{"error": "Failed to generate session token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.AuthResponse{
		Token: token,
		User:  user,
	})
}

func GetMe(w http.ResponseWriter, r *http.Request) {
	userID, err := auth.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var user models.User
	err = database.DB.QueryRow(
		"SELECT id, email, name, created_at FROM users WHERE id = ?",
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt)

	if err != nil {
		http.Error(w, `{"error": "User not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}
