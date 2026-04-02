# ReplyBot — Instagram DM Automation MVP

Auto-reply to Instagram comments with DMs. Set keyword triggers, define response messages, and let the system handle the rest.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SYSTEM ARCHITECTURE                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐     ┌──────────────────────────────────────┐       │
│  │  Instagram   │     │         Next.js Application          │       │
│  │   User       │     │                                      │       │
│  │  comments    │     │  ┌────────────┐   ┌──────────────┐  │       │
│  │  "GUIDE"     │────▶│  │ /api/webhook│──▶│  Webhook     │  │       │
│  │  on a post   │     │  │ /instagram  │   │  Processor   │  │       │
│  └─────────────┘     │  └────────────┘   └──────┬───────┘  │       │
│                       │                          │          │       │
│                       │                ┌─────────▼────────┐ │       │
│                       │                │ Keyword Matcher   │ │       │
│                       │                │ (finds trigger)   │ │       │
│                       │                └─────────┬────────┘ │       │
│                       │                          │          │       │
│  ┌─────────────┐     │  ┌────────────┐   ┌──────▼───────┐  │       │
│  │  Dashboard   │◀───│  │ React UI   │   │   BullMQ     │  │       │
│  │  (Browser)   │     │  │ Pages      │   │   Queue      │  │       │
│  └─────────────┘     │  └────────────┘   └──────┬───────┘  │       │
│                       │                          │          │       │
│                       └──────────────────────────┼──────────┘       │
│                                                  │                  │
│                        ┌─────────────────────────▼────────────┐     │
│                        │        DM Worker Process             │     │
│                        │                                      │     │
│                        │  ┌──────────────┐  ┌──────────────┐ │     │
│                        │  │ Rate Limiter  │  │ Retry Logic  │ │     │
│                        │  │ (180/hr/acct) │  │ (3 attempts) │ │     │
│                        │  └──────┬───────┘  └──────────────┘ │     │
│                        │         │                            │     │
│                        └─────────┼────────────────────────────┘     │
│                                  │                                  │
│                        ┌─────────▼────────────┐                     │
│                        │  Instagram Graph API  │                    │
│                        │  POST /{ig_id}/msgs   │                    │
│                        └──────────────────────┘                     │
│                                                                      │
│  ┌─────────────┐     ┌──────────────┐                               │
│  │ PostgreSQL   │     │    Redis     │                               │
│  │ Users,       │     │ Job queue,   │                               │
│  │ Triggers,    │     │ Rate limit   │                               │
│  │ DM Logs      │     │ counters     │                               │
│  └─────────────┘     └──────────────┘                               │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
Comment posted on Instagram
       │
       ▼
Meta sends webhook POST ──▶ /api/webhook/instagram
       │
       ▼
Parse event (extract comment text, user ID, media ID)
       │
       ▼
Find Instagram account in DB by IG user ID
       │
       ▼
Run keyword matcher against active triggers
       │
       ├── No match ──▶ Return 200, do nothing
       │
       └── Match found ──▶ Create DmLog (status: QUEUED)
                                  │
                                  ▼
                           Enqueue BullMQ job
                                  │
                                  ▼
                           DM Worker picks up job
                                  │
                                  ▼
                           Check rate limit (180/hr)
                                  │
                           ├── Over limit ──▶ Retry with backoff
                           │
                           └── Under limit ──▶ POST to IG Graph API
                                                      │
                                               ├── Success ──▶ Update log: SENT
                                               └── Failure ──▶ Retry or FAILED
```

---

## Tech Stack

| Layer      | Technology                       |
|------------|----------------------------------|
| Frontend   | Next.js 14 (App Router), Tailwind CSS |
| Backend    | Next.js API Routes (Express-compatible) |
| Database   | PostgreSQL + Prisma ORM          |
| Queue      | BullMQ + Redis                   |
| Auth       | JWT sessions (jose library)      |
| API        | Instagram Graph API v19.0        |
| Deploy     | Vercel (app) + Railway (DB/Redis/Worker) |

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- Docker (for local PostgreSQL + Redis)
- A Meta Developer account with an app configured
- An Instagram Business/Creator account linked to a Facebook Page

### 1. Clone & Install

```bash
git clone <repo-url>
cd insta-dm-automation
npm install
```

### 2. Start Infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL on port 5432 and Redis on port 6379.

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL` — already set for Docker defaults
- `REDIS_URL` — already set for Docker defaults
- `META_APP_ID` / `META_APP_SECRET` — from Meta Developer Portal
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` — any random string you choose
- `JWT_SECRET` — generate with: `openssl rand -hex 32`

### 4. Initialize Database

```bash
npx prisma generate
npx prisma db push
npm run db:seed   # Optional: creates test data
```

### 5. Start Development

Terminal 1 — Next.js app:
```bash
npm run dev
```

Terminal 2 — DM Worker:
```bash
npm run worker:dev
```

App runs at **http://localhost:3000**

---

## Meta App Configuration

### Step 1: Create Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app → Select "Business" type
3. Add products: **Instagram Graph API**, **Webhooks**

### Step 2: Configure OAuth

In your Meta app settings:
- Valid OAuth Redirect URI: `https://yourdomain.com/api/auth/callback`
- For local dev: `http://localhost:3000/api/auth/callback`

### Step 3: Required Permissions

Request these permissions in App Review:
- `instagram_basic`
- `instagram_manage_messages`
- `instagram_manage_comments`
- `pages_show_list`
- `pages_manage_metadata`

### Step 4: Configure Webhooks

1. In Meta app dashboard → Webhooks → Instagram
2. Callback URL: `https://yourdomain.com/api/webhook/instagram`
3. Verify Token: Same value as `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` in your `.env`
4. Subscribe to: `comments`

> **Note**: Webhooks require HTTPS. For local development, use [ngrok](https://ngrok.com/):
> ```bash
> ngrok http 3000
> ```
> Then use the ngrok URL as your webhook callback.

---

## Database Schema

```
┌──────────────────┐     ┌──────────────────────┐
│      users       │     │  instagram_accounts   │
├──────────────────┤     ├──────────────────────┤
│ id         (PK)  │◄───┤ user_id       (FK)   │
│ email            │     │ ig_user_id    (UQ)   │
│ name             │     │ ig_username          │
│ created_at       │     │ page_id              │
│ updated_at       │     │ access_token         │
└──────────────────┘     │ token_expires_at     │
                         │ is_active            │
                         └────────┬─────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                                       │
    ┌─────────▼────────┐               ┌──────────────▼──────┐
    │     triggers      │               │      dm_logs        │
    ├──────────────────┤               ├─────────────────────┤
    │ id         (PK)  │◄─────────────┤ trigger_id    (FK)  │
    │ account_id (FK)  │               │ account_id    (FK)  │
    │ keyword    (UQ*) │               │ comment_id          │
    │ response_message │               │ comment_text        │
    │ is_active        │               │ commenter_ig_id     │
    │ match_count      │               │ commenter_username  │
    │ created_at       │               │ media_id            │
    └──────────────────┘               │ dm_message_sent     │
    * unique per account               │ status (enum)       │
                                       │ error_message       │
                                       │ sent_at             │
                                       │ retry_count         │
                                       └─────────────────────┘

    DmStatus: QUEUED | SENDING | SENT | FAILED | RATE_LIMITED
```

---

## API Routes

| Method | Endpoint                    | Auth | Description                     |
|--------|----------------------------|------|---------------------------------|
| GET    | `/api/auth/instagram`       | No   | Redirect to Meta OAuth          |
| GET    | `/api/auth/callback`        | No   | OAuth callback, creates session |
| GET    | `/api/auth/me`              | Yes  | Current user + accounts         |
| POST   | `/api/auth/logout`          | Yes  | Clear session                   |
| GET    | `/api/webhook/instagram`    | No   | Webhook verification (Meta)     |
| POST   | `/api/webhook/instagram`    | No   | Receive comment events          |
| GET    | `/api/triggers`             | Yes  | List triggers                   |
| POST   | `/api/triggers`             | Yes  | Create trigger                  |
| PATCH  | `/api/triggers`             | Yes  | Toggle trigger active/inactive  |
| DELETE | `/api/triggers?id=xxx`      | Yes  | Delete trigger                  |
| GET    | `/api/logs?page=1&status=X` | Yes  | Paginated DM logs               |
| GET    | `/api/analytics`            | Yes  | Dashboard stats                 |

---

## Deployment

### Option A: Vercel + Railway

**Vercel** (Next.js app):
```bash
npm i -g vercel
vercel --prod
```

Set env vars in Vercel dashboard.

**Railway** (PostgreSQL + Redis + Worker):
1. Create PostgreSQL service → copy connection string
2. Create Redis service → copy URL
3. Create Worker service → deploy from repo, set start command: `npm run worker`

### Option B: Single VPS (DigitalOcean/Hetzner)

```bash
# On server
git clone <repo>
cd insta-dm-automation
cp .env.example .env
# Edit .env with production values

docker-compose up -d        # DB + Redis
npm install --production
npx prisma db push
npm run build
npm run start &              # Next.js on port 3000
npm run worker &             # BullMQ worker

# Use nginx/caddy as reverse proxy with SSL
```

---

## Rate Limiting

Instagram enforces ~200 API messages per hour per page. The system handles this:

1. **Redis counter** per account — increments on each DM, expires after 1 hour
2. **Threshold set to 180** (buffer below 200 limit)
3. **When exceeded**: Job status → `RATE_LIMITED`, BullMQ retries with exponential backoff (5s → 10s → 20s)
4. **Worker concurrency**: 5 simultaneous jobs, max 10/second throughput

---

## 2–3 Day Implementation Plan

### Day 1: Core Backend
- [x] Prisma schema + DB setup
- [x] Auth flow (Instagram OAuth → JWT session)
- [x] Webhook endpoint (verification + event parsing)
- [x] Keyword matching service
- [x] Webhook processor (comment → trigger match → queue)
- [x] BullMQ queue setup
- [x] DM worker with rate limiting + retries

### Day 2: Frontend + API Routes
- [x] Login page with Instagram OAuth button
- [x] Dashboard with stats
- [x] Automations page (list/create/delete triggers)
- [x] New trigger form with live preview
- [x] Logs page with filtering + pagination
- [x] API routes for triggers, logs, analytics
- [x] Middleware for auth protection

### Day 3: Polish + Deploy
- [ ] Test full flow with real Instagram account
- [ ] Deploy to Vercel + Railway
- [ ] Configure Meta webhooks with production URL
- [ ] Add error monitoring (Sentry optional)
- [ ] Test rate limiting under load

---

## Project Structure

```
insta-dm-automation/
├── prisma/
│   ├── schema.prisma          # Database models
│   └── seed.ts                # Dev seed data
├── src/
│   ├── app/
│   │   ├── globals.css        # Tailwind + custom styles
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Root redirect
│   │   ├── login/
│   │   │   └── page.tsx       # Login page
│   │   ├── (authenticated)/
│   │   │   ├── layout.tsx     # Sidebar shell
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx   # Stats + recent activity
│   │   │   ├── automations/
│   │   │   │   ├── page.tsx   # Trigger list
│   │   │   │   ├── trigger-actions.tsx
│   │   │   │   └── new/
│   │   │   │       └── page.tsx  # Create trigger form
│   │   │   └── logs/
│   │   │       ├── page.tsx   # Activity logs table
│   │   │       └── log-filters.tsx
│   │   ├── _components/
│   │   │   └── sidebar.tsx    # Navigation sidebar
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── instagram/route.ts  # OAuth redirect
│   │       │   ├── callback/route.ts   # OAuth callback
│   │       │   ├── me/route.ts         # Current user
│   │       │   └── logout/route.ts
│   │       ├── webhook/
│   │       │   └── instagram/route.ts  # Webhook handler
│   │       ├── triggers/route.ts       # CRUD triggers
│   │       ├── logs/route.ts           # Paginated logs
│   │       └── analytics/route.ts      # Stats
│   ├── lib/
│   │   ├── prisma.ts          # DB client singleton
│   │   ├── queue.ts           # BullMQ setup
│   │   └── session.ts         # JWT session management
│   ├── services/
│   │   ├── instagram.ts       # Graph API client
│   │   ├── keyword-matcher.ts # Trigger matching logic
│   │   └── webhook-processor.ts
│   ├── workers/
│   │   └── dm-worker.ts       # BullMQ worker process
│   └── middleware.ts          # Route protection
├── docker-compose.yml         # Local PostgreSQL + Redis
├── .env.example
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```
