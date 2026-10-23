# 📚 Study Tracker & Custom Pomodoro

A full-stack, local-first personal study and focus tracker powered by a **Go (Golang)** REST API, **SQLite** database, and a **React + TypeScript + Tailwind CSS** frontend.

---

## ✨ Features

- **Drift-Free Pomodoro Engine**: Accurately tracks countdowns using timestamp deltas even when the browser tab is minimized or in the background.
- **Customizable Intervals**: Easily configure work duration, short breaks, long breaks, and break cycle frequencies in settings.
- **Synthesized Audio Notifications**: Clean bell and gong sound chimes powered directly by the Web Audio API (zero external audio file dependencies).
- **Project & Topic Management**: Organize your learning into custom subjects with color codes and daily target study hours.
- **Focus Logging & Notes**: Rate your focus from 1 to 5 stars and log accomplishment notes after each Pomodoro session.
- **Manual Session Logging**: Retrospectively log offline study blocks, book reading, or lectures.
- **Visual Analytics Dashboard**:
  - Daily study streak counter (🔥).
  - Daily study hours over the past 14 days (interactive bar chart).
  - Time distribution across subjects (interactive donut chart).
  - Total study time and completed Pomodoro counters.
- **100% Local & Privacy First**: Zero third-party cloud trackers. All data is saved directly in a local `study_tracker.db` SQLite file.
- **Data Export & Backups**: One-click JSON backup export to protect and inspect your history.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Backend** | Go (Golang 1.22+) | High-performance compiled REST API server using Chi router |
| **Database** | SQLite3 (`mattn/go-sqlite3`) | Fast, zero-config, embedded file-based relational database |
| **Frontend** | React 18 + TypeScript + Vite | Fast HMR, type-safe components, responsive single-page application |
| **Styling** | Tailwind CSS + Lucide Icons | Dark-mode native, sleek, distraction-free UI |
| **Charts** | Recharts | SVG-based responsive data visualizations |
| **Audio** | Web Audio API | Browser-native tone synthesis for completion chimes |

---

## 🚀 Quick Start

### 1-Click Cloud Deployment (Render)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/workvaibhav112002-rgb/study-tracker)

### Local Development

To launch both the Go backend and React frontend with a single command:

```bash
cd "/home/spxlpt131/Desktop/study tracker"
./run.sh
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8080/api/health](http://localhost:8080/api/health)
- **Database File**: `study_tracker.db`

---

## 📡 REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend status check |
| `GET` | `/api/projects` | List all projects with total accumulated study minutes |
| `POST` | `/api/projects` | Create a new study project |
| `PUT` | `/api/projects/{id}` | Update project name, color, or daily target |
| `DELETE` | `/api/projects/{id}` | Delete project and cascade its sessions |
| `GET` | `/api/sessions` | Fetch session history (supports `?project_id=`, `?limit=`) |
| `POST` | `/api/sessions` | Log a study session (pomodoro or manual) |
| `DELETE` | `/api/sessions/{id}` | Delete a session entry |
| `GET` | `/api/stats/dashboard` | Aggregated metrics (today, streak, 14-day trend, project distribution) |
| `GET` | `/api/settings` | Get user's custom timer intervals |
| `POST` | `/api/settings` | Save user's timer intervals |
| `GET` | `/api/export` | Download full database backup as JSON |

---

## 💾 Database Schema

The database file `study_tracker.db` contains three relational tables:
1. `projects`: `id`, `name`, `color`, `description`, `target_minutes_per_day`, `created_at`
2. `sessions`: `id`, `project_id`, `start_time`, `end_time`, `duration_seconds`, `session_type`, `focus_rating`, `notes`, `created_at`
3. `settings`: `key`, `value`
