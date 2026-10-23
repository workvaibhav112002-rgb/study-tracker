# Study Tracker & Pomodoro

A multi-user study tracker with a drift-free Pomodoro timer, projects, focus ratings, streaks and analytics.
Go API on Postgres, React frontend. Runs entirely on free tiers.

| Layer    | Tech                                   | Hosting                     |
|----------|----------------------------------------|-----------------------------|
| API      | Go 1.26, chi, pgx, JWT (HS256), bcrypt | Render (free web service)   |
| Database | PostgreSQL 16                          | Neon (free tier, no expiry) |
| Frontend | React 18, TypeScript, Vite, Tailwind   | Vercel (free)               |
| CI       | GitHub Actions                         | free for public repos       |

## Features

- **Pomodoro timer** that survives tab switches and background throttling (countdown derives from a target timestamp). Pause keeps the remaining time; logged duration is the time actually spent running.
- **Projects** with colours and daily targets; **sessions** with 1–5 focus rating and notes; manual back-dated entries.
- **Analytics** computed in *your* timezone: today, rolling 7 days, 14-day trend, per-project split, streak.
- **Accounts**: per-user isolation enforced in SQL and at the database level (a session can only reference a project owned by the same user).
- **Export** your data as JSON. **Feedback** widget with per-IP rate limiting.
- Accessible dialogs (focus trap, Escape, ARIA), toasts for every error, cold-start banner for the free tier.

## Architecture

```
backend/
  cmd/server/            entrypoint: config → pool → migrations → router → graceful shutdown
  internal/config/       env loading, fail-fast validation
  internal/store/        Store interface + domain models
  internal/store/postgres/  pgx implementation, embedded SQL migrations (advisory-locked runner)
  internal/auth/         JWT issuer/parser, bcrypt, Require/Optional middleware
  internal/httpapi/      router, middleware, validation, handlers, integration tests
frontend/src/
  api/client.ts          typed client: retries, cold-start detection, 401 → logout
  hooks/                 useAuth, useAppData, useTimer
  lib/timer.ts           pure timer state machine (unit tested)
  components/ui/         Modal, Button, Field, StarRating, Toast, ConfirmDialog
  components/            feature screens
```

### Request hardening
Request IDs, structured JSON logs, panic recovery, 20 s request timeout, 64 KB body limit, HTTP server
timeouts, SIGTERM graceful shutdown, strict CORS allow-list, per-IP rate limits on `/auth/*` (10/min) and
`/feedback` (5/10 min), consistent `{"error","request_id"}` envelope, no driver errors leaked to clients.

## API

All routes are under `/api`. Authenticated routes need `Authorization: Bearer <token>`.

| Method | Path                  | Auth | Notes                                                     |
|--------|-----------------------|------|-----------------------------------------------------------|
| GET    | /health               | no   | 200 when the database answers, 503 otherwise              |
| POST   | /auth/register        | no   | `{email,password,name}` → 201 `{token,user}`; 409 if taken |
| POST   | /auth/login           | no   | → 200 `{token,user}`; 401 `invalid credentials`           |
| GET    | /auth/me              | yes  |                                                           |
| GET    | /projects             | yes  | includes `total_minutes`                                  |
| POST   | /projects             | yes  | `{name,color,description,target_minutes_per_day}`         |
| PUT    | /projects/{id}        | yes  | full replace; 404 if not yours; 409 on duplicate name     |
| DELETE | /projects/{id}        | yes  | cascades to sessions                                      |
| GET    | /sessions             | yes  | `?project_id=&limit=` (limit clamped to 500)              |
| POST   | /sessions             | yes  | 404 if `project_id` is not yours                          |
| DELETE | /sessions/{id}        | yes  |                                                           |
| GET    | /stats/dashboard      | yes  | `?tz=Asia/Kolkata` (IANA name, default UTC)               |
| GET    | /settings             | yes  |                                                           |
| POST   | /settings             | yes  | validated ranges                                          |
| GET    | /export               | yes  | JSON download of everything you own                       |
| POST   | /feedback             | opt. | rate limited; attaches user id if a token is present      |

## Deploy (zero cost)

### 1. Database — Neon
1. Create a free project at <https://neon.tech> (choose **AWS us-west-2 / Oregon** to sit next to Render).
2. Copy the connection string. It looks like
   `postgresql://USER:PASSWORD@ep-xxx.us-west-2.aws.neon.tech/neondb?sslmode=require`.
   Use the **direct** endpoint (not `-pooler`).

### 2. API — Render
1. Create a **Blueprint** from this repo (or make sure the existing service uses the root `Dockerfile`
   with Root Directory empty). `render.yaml` defines everything else.
2. In the service's Environment tab set `DATABASE_URL` to the Neon string.
   `JWT_SECRET` is generated by Render; `CORS_ORIGINS` defaults to `https://*.vercel.app,http://localhost:5173`.
   Add your custom domain to `CORS_ORIGINS` if you use one.
3. Deploy. Migrations run automatically on boot. `GET /api/health` should return `{"status":"ok"}`.

The free instance sleeps after 15 minutes idle and takes 30–60 s to wake. The frontend shows a banner and
retries automatically. To keep it warm for free, add a 5-minute ping of `/api/health` at
<https://cron-job.org> or <https://uptimerobot.com>. The GitHub Actions `keepalive` workflow does the same on a
best-effort basis.

### 3. Frontend — Vercel
Import the repo with **Root Directory = `frontend`**. No environment variables are required: production builds
call `https://study-tracker-s2ck.onrender.com` directly. To point at a different API set `VITE_API_URL`.

## Local development

Prerequisites: Go 1.26+ (the toolchain downloads automatically), Node 20+, a Postgres connection string
(a Neon **dev branch** is free; there is no Docker requirement).

```bash
cp .env.example .env     # fill DATABASE_URL and a 32+ byte JWT_SECRET
./run.sh                 # API on :8080, Vite on :5173 (proxies /api)
```

### Tests

```bash
cd backend && go test -race ./...     # spins up an embedded Postgres on first run (downloads ~50 MB once)
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

Set `TEST_DATABASE_URL` to run the backend suite against an existing database instead (CI does this).

## Configuration

| Variable              | Required | Default                                  |
|-----------------------|----------|------------------------------------------|
| `DATABASE_URL`        | yes      |                                          |
| `JWT_SECRET`          | yes      | must be ≥ 32 bytes                       |
| `CORS_ORIGINS`        | no       | none (comma separated, `*` subdomains ok)|
| `APP_ENV`             | no       | `development` (`production` → JSON logs) |
| `PORT`                | no       | `8080`                                   |
| `JWT_TTL`             | no       | `168h`                                   |
| `AUTH_RATE_LIMIT`     | no       | `10` per `AUTH_RATE_WINDOW` (`1m`)       |
| `FEEDBACK_RATE_LIMIT` | no       | `5` per `FEEDBACK_RATE_WINDOW` (`10m`)   |
| `REQUEST_TIMEOUT`     | no       | `20s`                                    |
| `SHUTDOWN_TIMEOUT`    | no       | `15s`                                    |

## Known trade-offs

- The JWT is kept in `localStorage`. Moving to httpOnly cookies across the Vercel→Render origin split would
  need `SameSite=None` plus CSRF protection; out of scope for now. Tokens expire after 7 days and are rejected
  as soon as the user row disappears.
- Per-IP rate limiting trusts `X-Forwarded-For` from the platform proxy.
- Free-tier cold starts are mitigated, not eliminated.
