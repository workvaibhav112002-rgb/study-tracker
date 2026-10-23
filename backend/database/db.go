package database

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dataSourceName string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dataSourceName)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	db.SetMaxOpenConns(1)

	// Enable WAL mode & foreign keys
	if _, err := db.Exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;"); err != nil {
		return nil, fmt.Errorf("failed to set pragma: %w", err)
	}

	if err := createTables(db); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	DB = db
	return db, nil
}

func createTables(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			name TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS projects (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			color TEXT NOT NULL DEFAULT '#3b82f6',
			description TEXT DEFAULT '',
			target_minutes_per_day INTEGER DEFAULT 60,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
			UNIQUE(user_id, name)
		);`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			project_id INTEGER NOT NULL,
			start_time DATETIME NOT NULL,
			end_time DATETIME NOT NULL,
			duration_seconds INTEGER NOT NULL,
			session_type TEXT NOT NULL DEFAULT 'pomodoro',
			focus_rating INTEGER DEFAULT 5,
			notes TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS settings (
			user_id INTEGER NOT NULL,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			PRIMARY KEY(user_id, key),
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS feedback (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER DEFAULT 0,
			email TEXT DEFAULT '',
			type TEXT NOT NULL DEFAULT 'general',
			message TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user_start ON sessions(user_id, start_time);`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			log.Printf("Migration notice: %v (continuing)", err)
		}
	}

	// Automatic schema column migrations for existing databases
	migrations := []string{
		"ALTER TABLE projects ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;",
		"ALTER TABLE sessions ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;",
		"ALTER TABLE settings ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;",
	}
	for _, m := range migrations {
		_, _ = db.Exec(m)
	}

	return nil
}

// SeedDefaultProjectsForUser gives a new user initial study categories
func SeedDefaultProjectsForUser(db *sql.DB, userID int64) error {
	defaultProjects := []struct {
		name   string
		color  string
		desc   string
		target int
	}{
		{"Go Programming", "#00ADD8", "Mastering Go backend development & distributed systems", 90},
		{"Algorithms & DSA", "#8B5CF6", "Problem solving, data structures, and LeetCode practice", 60},
		{"System Design", "#10B981", "Scalability, microservices, databases, and architectures", 45},
	}

	for _, p := range defaultProjects {
		_, _ = db.Exec(
			"INSERT OR IGNORE INTO projects (user_id, name, color, description, target_minutes_per_day) VALUES (?, ?, ?, ?, ?)",
			userID, p.name, p.color, p.desc, p.target,
		)
	}

	defaultSettings := map[string]string{
		"work_duration":        "25",
		"short_break_duration": "5",
		"long_break_duration":  "15",
		"long_break_interval":  "4",
		"auto_start_breaks":    "false",
		"sound_enabled":        "true",
	}

	for k, v := range defaultSettings {
		_, _ = db.Exec("INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)", userID, k, v)
	}

	return nil
}
