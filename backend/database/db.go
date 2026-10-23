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

	// Recommended SQLite connection pool settings
	db.SetMaxOpenConns(1)

	// Enable WAL mode & foreign keys
	if _, err := db.Exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;"); err != nil {
		return nil, fmt.Errorf("failed to set pragma: %w", err)
	}

	if err := createTables(db); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	if err := seedDefaults(db); err != nil {
		log.Printf("Warning: failed to seed defaults: %v", err)
	}

	DB = db
	return db, nil
}

func createTables(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS projects (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			color TEXT NOT NULL DEFAULT '#3b82f6',
			description TEXT DEFAULT '',
			target_minutes_per_day INTEGER DEFAULT 60,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL,
			start_time DATETIME NOT NULL,
			end_time DATETIME NOT NULL,
			duration_seconds INTEGER NOT NULL,
			session_type TEXT NOT NULL DEFAULT 'pomodoro',
			focus_rating INTEGER DEFAULT 5,
			notes TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return err
		}
	}
	return nil
}

func seedDefaults(db *sql.DB) error {
	// Seed default projects if none exist
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM projects").Scan(&count); err == nil && count == 0 {
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
				"INSERT INTO projects (name, color, description, target_minutes_per_day) VALUES (?, ?, ?, ?)",
				p.name, p.color, p.desc, p.target,
			)
		}
	}

	// Seed default settings if empty
	defaultSettings := map[string]string{
		"work_duration":        "25",
		"short_break_duration": "5",
		"long_break_duration":  "15",
		"long_break_interval":  "4",
		"auto_start_breaks":    "false",
		"sound_enabled":        "true",
	}

	for k, v := range defaultSettings {
		_, _ = db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", k, v)
	}

	return nil
}
