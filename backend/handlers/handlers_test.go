package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

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

func TestProjectAndSessionFlow(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Test Create Project
	pBody := `{"name":"Test Project","color":"#ff0000","description":"Unit test","target_minutes_per_day":60}`
	req := httptest.NewRequest("POST", "/api/projects", bytes.NewBufferString(pBody))
	w := httptest.NewRecorder()
	handlers.CreateProject(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created, got %d, body: %s", w.Code, w.Body.String())
	}

	var createdProject models.Project
	if err := json.Unmarshal(w.Body.Bytes(), &createdProject); err != nil {
		t.Fatalf("Failed to decode created project: %v", err)
	}
	if createdProject.ID == 0 {
		t.Fatal("Expected valid project ID")
	}

	// 2. Test Create Session
	sBody, _ := json.Marshal(map[string]interface{}{
		"project_id":       createdProject.ID,
		"duration_seconds": 1500, // 25 mins
		"session_type":     "pomodoro",
		"focus_rating":     5,
		"notes":            "Great focus session",
	})
	req = httptest.NewRequest("POST", "/api/sessions", bytes.NewBuffer(sBody))
	w = httptest.NewRecorder()
	handlers.CreateSession(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for session, got %d, body: %s", w.Code, w.Body.String())
	}

	// 3. Test Dashboard Stats
	req = httptest.NewRequest("GET", "/api/stats/dashboard", nil)
	w = httptest.NewRecorder()
	handlers.GetDashboardStats(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for stats, got %d", w.Code)
	}

	var stats models.DashboardStats
	if err := json.Unmarshal(w.Body.Bytes(), &stats); err != nil {
		t.Fatalf("Failed to decode stats: %v", err)
	}

	if stats.TodayMinutes != 25 {
		t.Fatalf("Expected TodayMinutes to be 25, got %d", stats.TodayMinutes)
	}
	if stats.CompletedPomodoros != 1 {
		t.Fatalf("Expected CompletedPomodoros to be 1, got %d", stats.CompletedPomodoros)
	}

	// 4. Test Settings
	req = httptest.NewRequest("GET", "/api/settings", nil)
	w = httptest.NewRecorder()
	handlers.GetSettings(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for settings, got %d", w.Code)
	}

	var settings models.Settings
	if err := json.Unmarshal(w.Body.Bytes(), &settings); err != nil {
		t.Fatalf("Failed to decode settings: %v", err)
	}
	if settings.WorkDuration != 25 {
		t.Fatalf("Expected default WorkDuration 25, got %d", settings.WorkDuration)
	}
}
