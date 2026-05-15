# Readback

Personal learning pipeline: share a link to a Telegram bot → extract content → Claude-generated notes → two-host podcast episode → browse in a web app.

## Architecture

```
Me → Telegram Bot → Supabase Postgres ← Next.js web app
                          ↓
              Worker (FastAPI background tasks)
                 ↙          ↓          ↘
          Extractors     Notes (Claude)  Podcast (Claude + ElevenLabs)
```

- **`api/`** — FastAPI service: Telegram webhook, content extraction, LLM notes, podcast generation
- **`web/`** — Next.js app: browse links, read notes, play episodes

## Quick Start

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `docs/schema.sql` in the SQL editor
3. Create two storage buckets: `podcasts` and `extracted`

### 2. Telegram Bot

1. Message `@BotFather` → `/newbot` → save the token as `TELEGRAM_BOT_TOKEN`
2. Get your Telegram user ID from `@userinfobot` and set `TELEGRAM_ALLOWED_USER_IDS`
3. After deploying the API, register the webhook:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=<API_URL>/telegram/webhook&secret_token=<YOUR_SECRET>"
```

### 3. Environment Variables

Copy `.env.example` files and fill in all values:

```bash
cp api/.env.example api/.env
cp web/.env.example web/.env.local
```

### 4. Local Development

**API**
```bash
cd api
pip install -e .
uvicorn app.main:app --reload --port 8080
# GET http://localhost:8080/healthz → {"ok": true}
```

**Web**
```bash
cd web
npm install
npm run dev
# http://localhost:3000
```

### 5. Railway Deployment

Create a Railway project with two services:
- Service 1: root directory `api/`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Service 2: root directory `web/`, framework Next.js

Wire all env vars from `api/.env.example` and `web/.env.example` into Railway's service variables.

## Phases

| Phase | Description | Status |
|---|---|---|
| 0 | Project bootstrap | ✅ Done |
| 1 | Telegram inbox | 🔜 Next |
| 2 | Content extraction | ⏳ Pending |
| 3 | Learning notes (Claude) | ⏳ Pending |
| 4 | Podcast generation (ElevenLabs) | ⏳ Pending |
| 5 | Web app polish & search | ⏳ Pending |
| 6 | Manual NotebookLM bridge | Optional |

See [requirement.md](requirement.md) for the full plan.
