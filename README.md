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
- **Resilient timer**: survives reloads and closed tabs, syncs across tabs, counts pauses and tab switches as an
  honest **interruption score**, and finishes with an OS notification, a favicon countdown and a screen wake lock.
- **Daily goal rings** per project, a **year heatmap**, **best hours of the day**, week-over-week delta.
- **Tasks** per project with pomodoro estimates, linked to sessions.
- **Calendar feed**: a private iCal URL so sessions appear in Google or Apple Calendar.
- **Sign in with Google**, **magic links** (passwordless sign-in and signup) and **password reset** by email,
  each switched on by a single env var and hidden until configured.
- **Weekly review** every Monday, a **command palette** (Ctrl/Cmd+K), **zen mode** (F), a **landing page**,
  **shareable stat cards**, **ambient sounds** synthesized in the browser, **light theme** and five accents,
  and a timer that follows you **across devices**.
- **Export / import** your data as JSON. Change password and delete account. **Feedback** widget with rate limiting.
- Installable **PWA** with offline shell. Accessible dialogs (focus trap, Escape, ARIA), toasts for every error,
  cold-start banner for the free tier. Optional Sentry error reporting on both ends.

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
| GET    | /config               | no   | which optional features are on (`email_enabled`, `google_client_id`) |
| POST   | /auth/forgot-password | no   | `{email}` → always 200; emails a 1-hour reset link (needs SMTP) |
| POST   | /auth/reset-password  | no   | `{token,new_password}` → 200 `{token,user}`; invalidates old sessions |
| POST   | /auth/magic-link      | no   | `{email}` → 200; emails a 15-minute sign-in link, creates the account if new |
| POST   | /auth/magic           | no   | `{token}` → 200 `{token,user}`                            |
| POST   | /auth/google          | no   | `{credential}` Google ID token → 200 `{token,user}`; links by verified email |
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
| POST   | /import               | yes  | restore an export; upserts projects, skips duplicate sessions (2 MB) |
| GET    | /tasks                | yes  | `?project_id=&done=`                                      |
| POST   | /tasks                | yes  | `{project_id,title,estimate_pomodoros}`                   |
| PUT    | /tasks/{id}           | yes  | `{title,estimate_pomodoros}`                              |
| PUT    | /tasks/{id}/done      | yes  | `{done:bool}`                                             |
| PUT    | /tasks/order          | yes  | `{ids:[...]}` reorder                                     |
| DELETE | /tasks/{id}           | yes  |                                                           |
| GET    | /stats/goals          | yes  | today vs each project's daily target (`?tz=`)             |
| GET    | /stats/heatmap        | yes  | `?tz=&days=365` dense day series                          |
| GET    | /stats/hours          | yes  | 24 local hour buckets                                     |
| POST   | /auth/change-password | yes  | returns a new token; all older tokens stop working        |
| DELETE | /auth/me              | yes  | `{password}` deletes the account and everything it owns   |
| POST   | /auth/calendar-token  | yes  | creates/rotates the feed token (shown once)               |
| DELETE | /auth/calendar-token  | yes  | revokes the feed                                          |
| GET    | /calendar/{token}.ics | no   | iCal feed, last 180 days, rate limited                    |
| POST   | /feedback             | opt. | rate limited; attaches user id if a token is present      |

## Deploy (zero cost)

### 1. Database — Neon
The repo is linked to a Neon project via `neon.ts` / `.neon`. With the Neon CLI (needs Node 22+):

```bash
npx -y -p node@22 -p neon@latest neon login
npx -y -p node@22 -p neon@latest neon deploy      # applies neon.ts, writes .env.local
```

`.env.local` (gitignored) then holds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
Use **`DATABASE_URL_UNPOOLED`** for the Go server: it is a long-running process with a 5-connection
pool, holds an advisory lock during migrations, and benefits from prepared statements. The pooled
endpoint also works (the server switches pgx to the simple protocol when it sees a `-pooler` host).

Without the CLI: create a free project at <https://neon.tech> and copy the **direct** connection string
(`...neon.tech/neondb?sslmode=require`) from the dashboard.

### 2. API — Render
1. Create a **Blueprint** from this repo (or make sure the existing service uses the root `Dockerfile`
   with Root Directory empty). `render.yaml` defines everything else.
2. In the service's Environment tab set `DATABASE_URL` to the Neon **direct** string (the value of
   `DATABASE_URL_UNPOOLED` in `.env.local`).
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

Prerequisites: Go 1.26+ (the toolchain downloads automatically), Node 20+ (22+ for the Neon CLI).
No Docker needed.

```bash
npx -y -p node@22 -p neon@latest neon deploy   # or: cp .env.example .env and fill DATABASE_URL
echo 'JWT_SECRET=<32+ random characters>' >> .env
./run.sh                 # loads .env.local then .env; API on :8080, Vite on :5173 (proxies /api)
```

For an isolated dev database: `neon checkout dev --create` makes a 7-day auto-expiring branch (see `neon.ts`).

### Tests

```bash
cd backend && go test -race ./...     # spins up an embedded Postgres on first run (downloads ~50 MB once)
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
cd frontend && API_URL=http://localhost:8080 npm run test:e2e   # Playwright, needs the API running
```

CI runs all of the above plus the Docker build on every push. Dependabot opens weekly grouped update PRs.

### Backups

Neon's free tier keeps 6 hours of point-in-time restore. For longer retention the `db-backup` workflow
runs `pg_dump` every Monday and keeps the file as a workflow artifact for 90 days. Enable it by adding a
repository **secret** `DATABASE_URL` (the Neon direct string) and a repository **variable**
`DB_BACKUP_ENABLED` = `true` under Settings → Secrets and variables → Actions.

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
| `CALENDAR_RATE_LIMIT` | no       | `30` per `CALENDAR_RATE_WINDOW` (`1m`)   |
| `REQUEST_TIMEOUT`     | no       | `20s`                                    |
| `SHUTDOWN_TIMEOUT`    | no       | `15s`                                    |
| `SENTRY_DSN`          | no       | enables error reporting when set         |
| `APP_URL`             | no       | frontend origin used in emailed links (defaults to the Vercel URL) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | no | enables password reset and magic links (any STARTTLS relay; Brevo's free tier works) |
| `GOOGLE_CLIENT_ID`    | no       | enables "Continue with Google"           |

Frontend (Vercel): `VITE_API_URL` (optional override), `VITE_SENTRY_DSN` (optional).

## Optional sign-in features (free)

**Email (password reset + magic links).** Create a free account at <https://www.brevo.com>, verify a sender
address under *Senders*, then *SMTP & API → SMTP → Generate key*. On Render set `SMTP_HOST=smtp-relay.brevo.com`,
`SMTP_PORT=587`, `SMTP_USER=<your Brevo login email>`, `SMTP_PASS=<the SMTP key>`, `SMTP_FROM=<the verified sender>`.
The free tier allows 300 emails a day.

**Google sign-in.** In <https://console.cloud.google.com> create a project, *APIs & Services → Credentials →
Create credentials → OAuth client ID → Web application*. Authorised JavaScript origins: your Vercel URL and
`http://localhost:5173`. No redirect URIs are needed. Copy the client ID into `GOOGLE_CLIENT_ID` on Render.

## Known trade-offs

- The JWT is kept in `localStorage`. Moving to httpOnly cookies across the Vercel→Render origin split would
  need `SameSite=None` plus CSRF protection; out of scope for now. Tokens expire after 7 days and are rejected
  as soon as the user row disappears.
- Per-IP rate limiting trusts `X-Forwarded-For` from the platform proxy.
- Free-tier cold starts are mitigated, not eliminated.
