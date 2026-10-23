package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"study-tracker-backend/auth"
	"study-tracker-backend/database"
	"study-tracker-backend/handlers"
	"study-tracker-backend/models"
)

func setupTestDB(t *testing.T) func() {
	tmpFile, err := os.CreateTemp("", "test_study_*.db")
	if err != nil {
		t.Fatalf("Failed to create temp db: %v", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()

	db, err := database.InitDB(tmpPath)
	if err != nil {
		t.Fatalf("Failed to init db: %v", err)
	}

	return func() {
		db.Close()
		os.Remove(tmpPath)
	}
}

func TestMultiTenantAuthAndIsolation(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Register User A
	userABody := `{"email":"alice@test.com","password":"password123","name":"Alice"}`
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(userABody))
	w := httptest.NewRecorder()
	handlers.Register(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for register, got %d: %s", w.Code, w.Body.String())
	}

	var authA models.AuthResponse
	_ = json.Unmarshal(w.Body.Bytes(), &authA)
	if authA.Token == "" || authA.User.ID == 0 {
		t.Fatal("Expected valid auth response with token and user ID")
	}

	// 2. Register User B
	userBBody := `{"email":"bob@test.com","password":"password456","name":"Bob"}`
	req = httptest.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(userBBody))
	w = httptest.NewRecorder()
	handlers.Register(w, req)

	var authB models.AuthResponse
	_ = json.Unmarshal(w.Body.Bytes(), &authB)

	// 3. Alice creates a project
	ctxA := context.WithValue(context.Background(), auth.UserIDKey, authA.User.ID)
	pBody := `{"name":"Alice Project","color":"#ff0000","target_minutes_per_day":60}`
	req = httptest.NewRequest("POST", "/api/projects", bytes.NewBufferString(pBody)).WithContext(ctxA)
	w = httptest.NewRecorder()
	handlers.CreateProject(w, req)

	var projectA models.Project
	_ = json.Unmarshal(w.Body.Bytes(), &projectA)

	// 4. Alice logs a 30m session
	sBody, _ := json.Marshal(map[string]interface{}{
		"project_id":       projectA.ID,
		"duration_seconds": 1800,
		"session_type":     "pomodoro",
		"focus_rating":     5,
		"notes":            "Alice studying",
	})
	req = httptest.NewRequest("POST", "/api/sessions", bytes.NewBuffer(sBody)).WithContext(ctxA)
	w = httptest.NewRecorder()
	handlers.CreateSession(w, req)

	// 5. Check Alice Stats (should have 30 mins)
	req = httptest.NewRequest("GET", "/api/stats/dashboard", nil).WithContext(ctxA)
	w = httptest.NewRecorder()
	handlers.GetDashboardStats(w, req)

	var statsA models.DashboardStats
	_ = json.Unmarshal(w.Body.Bytes(), &statsA)
	if statsA.TodayMinutes != 30 {
		t.Fatalf("Expected Alice to have 30 today_minutes, got %d", statsA.TodayMinutes)
	}

	// 6. Check Bob Stats (MUST HAVE 0 MINS - strict data isolation!)
	ctxB := context.WithValue(context.Background(), auth.UserIDKey, authB.User.ID)
	req = httptest.NewRequest("GET", "/api/stats/dashboard", nil).WithContext(ctxB)
	w = httptest.NewRecorder()
	handlers.GetDashboardStats(w, req)

	var statsB models.DashboardStats
	_ = json.Unmarshal(w.Body.Bytes(), &statsB)
	if statsB.TodayMinutes != 0 {
		t.Fatalf("DATA LEAK: Bob should have 0 today_minutes, got %d", statsB.TodayMinutes)
	}
}
