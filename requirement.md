# Personal Learning Pipeline — Implementation Plan

> A system that captures links you share to a Telegram bot, extracts the content, generates structured learning notes, produces a NotebookLM-style podcast, and surfaces everything in a personal web app.

This document is written to be handed to **Claude Code** as the source of truth for implementation. It contains architecture, schema, phased deliverables, environment variables, and acceptance criteria for each phase.

---

## 1. Problem & Goal

**Problem.** I (a Salesforce developer) constantly share interesting technical links (LinkedIn posts, Substack articles, YouTube videos, blog posts) to my own WhatsApp/Telegram as a "read later" pile. I never actually go back to read them.

**Goal.** Replace that broken loop with an automated pipeline:

1. I share a link to a personal Telegram bot.
2. The system extracts the article/video content.
3. An LLM generates structured learning notes.
4. A TTS pipeline produces a short two-host podcast episode for that content.
5. Everything is browsable from a personal web app (links → notes → podcast → search).

**Non-goals (v1).**
- Multi-user / public product. This is single-user.
- Mobile native app. The web app must be mobile-friendly, but no React Native.
- Real-time collaboration features.

---

## 2. High-Level Architecture

```
                ┌──────────────────────┐
                │  Me (phone/desktop)  │
                └──────────┬───────────┘
                           │ shares link
                           ▼
                ┌──────────────────────┐
                │   Telegram Bot       │  (python-telegram-bot, webhook)
                │   (FastAPI endpoint) │
                └──────────┬───────────┘
                           │ inserts row
                           ▼
                ┌──────────────────────┐
                │  Supabase Postgres   │  ◄──── Web App reads
                │  + Supabase Storage  │        (Next.js)
                └──────────┬───────────┘
                           │ NOTIFY / cron-poll
                           ▼
                ┌──────────────────────┐
                │  Worker (FastAPI     │
                │  background tasks    │
                │  OR a separate       │
                │  Railway worker svc) │
                └──────────┬───────────┘
                           │
        ┌──────────────────┼────────────────────┐
        ▼                  ▼                    ▼
 ┌─────────────┐   ┌──────────────┐    ┌──────────────────┐
 │ Extractors  │   │ Notes (LLM)  │    │ Podcast (LLM+TTS)│
 │ - article   │   │ - Anthropic  │    │ - script → audio │
 │ - youtube   │   │   Claude API │    │ - ElevenLabs or  │
 │ - linkedin  │   │              │    │   OpenAI TTS     │
 └─────────────┘   └──────────────┘    └──────────────────┘
        │                  │                    │
        └──────────────────┴────────────────────┘
                           │ writes results back
                           ▼
                ┌──────────────────────┐
                │  Supabase            │
                └──────────────────────┘
```

---

## 3. Tech Stack (locked in)

| Layer | Choice | Reason |
|---|---|---|
| Input channel | **Telegram Bot** | Free, official API, no ToS issues. WhatsApp personal-account automation is not viable. |
| Backend API | **Python + FastAPI** | Best ecosystem for content extraction (trafilatura, yt-dlp, readability) + LLM SDKs. |
| Background jobs | FastAPI `BackgroundTasks` for v1; **Celery + Redis** if/when needed | Start simple. |
| Database | **Supabase Postgres** | User asked for it. Hosted, easy auth later. |
| File storage | **Supabase Storage** | Same platform; bucket for audio + extracted text. |
| Web app | **Next.js (App Router) + Tailwind** | Mobile-friendly, deploys cleanly to Railway. |
| Hosting | **Railway** | User asked for it. Deploy: 1× web (Next.js), 1× api (FastAPI). |
| LLM (notes + script) | **Anthropic Claude API** (`claude-sonnet-4-5` or current Sonnet) | User is in the Claude ecosystem. |
| TTS | **ElevenLabs** (primary) or **OpenAI TTS** (fallback) | Two distinct voices for the two-host format. |
| Source control | **GitHub** | Monorepo with `/api` and `/web`. |
| Secrets | Railway env vars + `.env.local` for dev | |

---

## 4. The "NotebookLM-style podcast" reality check

**NotebookLM does not have a public API.** Google has not shipped one as of this writing. You have three options; the plan implements **Option A** and leaves **Option C** as an opt-in manual path.

- **Option A — Programmatic (default).** LLM generates a two-speaker dialogue script (Host A curious / Host B explainer), then TTS renders each speaker with a different voice. Audio segments are concatenated. Result: a 5–10 min episode per link, fully automated. Quality is good with ElevenLabs Turbo v2.
- **Option B — Single narrator.** Cheaper. One voice reads a summary essay. Less engaging.
- **Option C — Manual NotebookLM hand-off.** App generates a clean text bundle and opens a "Send to NotebookLM" deeplink/clipboard action. You paste it in NotebookLM and upload the resulting audio back to the app via a Telegram command (`/podcast <link_id>`). Use this for "important" pieces only.

The DB schema and worker pipeline support all three; **default is A**.

---

## 5. Database Schema (Supabase / Postgres)

All tables live in the `public` schema. Use `uuid` PKs (`gen_random_uuid()`). RLS off for v1 (single-user, server-side access only). Add timestamps `created_at`, `updated_at` to every table (defaults `now()`).

```sql
-- 5.1 Shared links: the raw inbox
create table links (
  id              uuid primary key default gen_random_uuid(),
  url             text not null,
  source_type     text check (source_type in ('youtube','substack','linkedin','medium','github','article','unknown')) default 'unknown',
  source_platform text,                    -- where it was shared from, e.g. 'telegram'
  raw_message     text,                    -- the original Telegram message text
  title           text,
  author          text,
  status          text not null default 'received'
                  check (status in ('received','extracting','extracted','notes_ready','podcast_ready','failed')),
  error           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index on links (status);
create index on links (created_at desc);

-- 5.2 Extracted content (text body, transcript, metadata)
create table contents (
  id              uuid primary key default gen_random_uuid(),
  link_id         uuid not null references links(id) on delete cascade,
  extraction_method text,                  -- 'trafilatura' | 'yt-dlp' | 'linkedin-fallback' | 'manual-paste'
  text            text,                    -- the extracted article text or transcript
  word_count      int,
  language        text default 'en',
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz default now()
);
create index on contents (link_id);

-- 5.3 Generated notes (markdown)
create table notes (
  id              uuid primary key default gen_random_uuid(),
  link_id         uuid not null references links(id) on delete cascade,
  markdown        text not null,           -- the rendered notes
  summary         text,                    -- one-paragraph TLDR
  key_takeaways   jsonb default '[]'::jsonb, -- array of strings
  tags            text[] default '{}',
  model           text,                    -- e.g. 'claude-sonnet-4-5'
  tokens_in       int,
  tokens_out      int,
  created_at      timestamptz default now()
);
create index on notes (link_id);
create index on notes using gin (tags);

-- 5.4 Podcast episodes
create table podcasts (
  id              uuid primary key default gen_random_uuid(),
  link_id         uuid not null references links(id) on delete cascade,
  script          text,                    -- the two-speaker dialogue script
  audio_path      text,                    -- Supabase Storage path, e.g. 'podcasts/<link_id>.mp3'
  audio_url       text,                    -- public/signed URL
  duration_sec    int,
  mode            text check (mode in ('two_host','single_narrator','manual_notebooklm')) default 'two_host',
  tts_provider    text,                    -- 'elevenlabs' | 'openai'
  voices          jsonb default '{}'::jsonb,
  created_at      timestamptz default now()
);
create index on podcasts (link_id);
```

**Storage buckets:**

- `podcasts` — final mp3s, one per link.
- `extracted` — optional raw HTML / transcript dumps for debugging.

---

## 6. Repo Layout

```
learning-pipeline/
├── api/                          # FastAPI service (Railway service #1)
│   ├── app/
│   │   ├── main.py               # FastAPI app + Telegram webhook
│   │   ├── config.py             # pydantic-settings, reads env
│   │   ├── db.py                 # supabase-py client
│   │   ├── telegram/
│   │   │   ├── handlers.py       # /start, /list, /podcast, on_message
│   │   │   └── webhook.py
│   │   ├── extractors/
│   │   │   ├── router.py         # detect source_type, dispatch
│   │   │   ├── article.py        # trafilatura
│   │   │   ├── youtube.py        # yt-dlp + youtube-transcript-api
│   │   │   └── linkedin.py       # best-effort + paste fallback
│   │   ├── notes/
│   │   │   └── generate.py       # Claude API call, prompt in /prompts
│   │   ├── podcast/
│   │   │   ├── script.py         # Claude generates dialogue
│   │   │   ├── tts_elevenlabs.py
│   │   │   ├── tts_openai.py
│   │   │   └── stitch.py         # pydub concatenation
│   │   ├── worker/
│   │   │   └── pipeline.py       # the full extract → notes → podcast flow
│   │   └── routes/
│   │       ├── links.py          # GET /links, GET /links/:id
│   │       ├── notes.py
│   │       └── podcasts.py
│   ├── prompts/
│   │   ├── notes_system.md
│   │   └── podcast_script_system.md
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
│
├── web/                          # Next.js app (Railway service #2)
│   ├── app/
│   │   ├── page.tsx              # inbox list
│   │   ├── links/[id]/page.tsx   # notes + audio player
│   │   ├── search/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   ├── lib/supabase.ts
│   ├── package.json
│   └── next.config.mjs
│
├── docs/
│   └── learning-pipeline-plan.md # this file
├── .github/workflows/ci.yml
└── README.md
```

---

## 7. Phased Plan

Each phase is independently shippable and testable. Claude Code should complete one phase fully — including the acceptance test — before moving on.

### Phase 0 — Project bootstrap (½ day)

**Deliverables**
- GitHub repo with the layout in §6.
- Supabase project created; run the SQL from §5; create the two storage buckets.
- Railway project with two services pointed at `/api` and `/web`. Env vars wired (see §8).
- Telegram bot created via `@BotFather`; token in env.
- Bare FastAPI app deploys successfully (`GET /healthz` returns 200).
- Bare Next.js app deploys successfully and reads a row from Supabase.

**Acceptance test.** Visit the deployed Railway URLs. Both respond. `curl /healthz` on the API returns `{"ok": true}`.

---

### Phase 1 — Telegram inbox (1 day)

**Goal.** I share a link to my bot; a row appears in `links` with status `received`. Bot replies with a confirmation and a link ID.

**Deliverables**
- `POST /telegram/webhook` endpoint in FastAPI.
- Set Telegram webhook to that URL (via `setWebhook` once on deploy; document the command).
- Handler logic:
  - On `/start`: greet, explain usage.
  - On any message containing a URL: extract URL(s), detect `source_type` by domain, insert row(s) into `links`, reply `✅ saved (id: <short_id>)`.
  - On `/list`: show last 10 links and statuses.
- Minimal web app page: list all links from `links` newest first.

**Acceptance test.** Share a Substack URL and a YouTube URL from my phone to the bot. Both appear in the web app within 2 seconds, with the correct `source_type`.

---

### Phase 2 — Content extraction (1–2 days)

**Goal.** For each `received` link, pull the actual content into `contents` and move the link to `extracted`.

**Deliverables**
- `extractors/router.py` dispatches by `source_type`.
- **Articles / Substack / Medium / generic blogs:** `trafilatura` (fall back to `readability-lxml`). Capture `title`, `author`, full text.
- **YouTube:** `youtube-transcript-api` for transcript; fall back to `yt-dlp --write-auto-sub` if no transcript; capture video title + channel.
- **LinkedIn:** best-effort fetch with a real User-Agent. If extraction returns <200 chars, set status to `extracted` with `extraction_method='linkedin-fallback'` and an empty body, and **send the user a Telegram message**: `⚠️ Couldn't read LinkedIn post <id>. Reply to this message with the post text and I'll save it.` Handle the reply by populating `contents.text`.
- **GitHub:** if URL is a repo, fetch README via the GitHub API; if a file, fetch raw.
- Pipeline runs via FastAPI `BackgroundTasks` triggered immediately after insert in Phase 1.
- Failures set `links.status = 'failed'` and `links.error`.

**Acceptance test.** Share 5 links of mixed types. Within 1 minute, all 5 have rows in `contents`. LinkedIn paste fallback works end-to-end.

---

### Phase 3 — Learning notes (1 day)

**Goal.** Every extracted link gets a markdown notes doc via Claude.

**Deliverables**
- `prompts/notes_system.md` — a tight system prompt that produces:
  - **TL;DR** (2–3 sentences)
  - **Key takeaways** (5–8 bullets)
  - **Concepts & terminology** (a glossary if relevant)
  - **Code or examples** (preserved verbatim if present)
  - **Why it matters for a Salesforce developer** (1 short section that connects the content to my world — skip if not applicable)
  - **Follow-up questions / things to dig deeper into**
- `notes/generate.py` calls Claude with the extracted text, parses the response, writes to `notes`.
- Web app: clicking a link opens a detail page that renders the notes markdown (use `react-markdown` + `rehype-highlight`).
- Update `links.status` → `notes_ready`.
- Tag inference: ask the model to also output 3–6 tags in a JSON block; store in `notes.tags`.

**Acceptance test.** Open the web app on my phone, tap a link from yesterday's shares, read the notes. Notes are useful, formatted correctly, and tags are sensible.

---

### Phase 4 — Podcast generation (2 days)

**Goal.** Each `notes_ready` link automatically becomes a 5–10 min two-host podcast episode I can play in the web app.

**Deliverables**
- `prompts/podcast_script_system.md` — produces a dialogue between **Host A** (curious learner, asks the right dumb questions) and **Host B** (calm expert, explains clearly with analogies). Output format is strictly:
  ```
  A: ...
  B: ...
  A: ...
  ```
  No stage directions, no emojis, no `[Host A]:` labels. Target 1,200–1,800 words.
- `podcast/script.py` calls Claude, saves to `podcasts.script`.
- `podcast/tts_elevenlabs.py`:
  - Two voices (e.g. `Rachel` for A, `Adam` for B — make configurable).
  - One API call per line; collect mp3 segments.
- `podcast/stitch.py`:
  - Use `pydub` (requires ffmpeg in the Docker image — add `apt-get install -y ffmpeg`).
  - Concatenate with 250ms silence between turns.
  - Export as mp3, 64–96 kbps mono is fine.
- Upload to Supabase Storage bucket `podcasts/`, save path + signed URL into `podcasts`.
- Update `links.status` → `podcast_ready`. Telegram message: `🎧 Episode ready: <web app URL>/links/<id>`.
- Web app detail page gets an inline `<audio>` player.

**Acceptance test.** Share a 2,000-word Substack article. Within 5 minutes, get a Telegram notification with the episode link. Audio plays in the browser. Two distinct voices. Sounds coherent, not robotic.

**Cost guardrails.**
- Skip podcast generation if `contents.word_count < 400` (set a `skip_podcast` flag on the link).
- Cap script length at 2,000 words.
- Log estimated cost per episode in `podcasts.metadata`.

---

### Phase 5 — Web app polish & search (1–2 days)

**Goal.** The app is genuinely pleasant to use on a phone during a commute.

**Deliverables**
- **Home** — list of links grouped by date, with status pill, title, source favicon, and (if ready) a small play button to start the podcast inline.
- **Detail** — title, source, original link, audio player at the top (sticky on scroll), notes below.
- **Search** — Postgres full-text search over `notes.markdown` and `notes.summary`. Filter by tag and source_type.
- **Bulk actions** — mark as read, archive.
- **Mobile audio** — Media Session API so lock screen controls work (title, artwork, play/pause).
- **Auth** — Supabase Auth with a single allowed email (mine). Magic link.
- **PWA basics** — `manifest.json`, installable icon, offline shell.

**Acceptance test.** Install as a PWA on iOS. Background audio playback works. Search finds a term I remember from a note I read last week.

---

### Phase 6 (optional) — Manual NotebookLM bridge

**Goal.** For "important" articles, route to NotebookLM instead of the automated TTS.

**Deliverables**
- `/podcast <link_id> notebooklm` command in Telegram.
- Web app button "Use NotebookLM instead" on the link detail page.
- That action:
  1. Generates a clean text bundle (title + extracted content + key context) and saves it to Supabase Storage.
  2. Sends a Telegram message with the bundle as a `.txt` attachment.
  3. Sets `podcasts.mode = 'manual_notebooklm'` and `podcasts.audio_path = null`.
- After I produce the audio in NotebookLM, I send `/upload <link_id>` and reply with the mp3. The bot uploads it to Storage and fills in `audio_url`.

---

## 8. Environment Variables

Document all of these in `api/.env.example` and `web/.env.example`. Wire them into Railway service variables.

**API service**
```
# Server
PORT=8080
PUBLIC_BASE_URL=https://<api>.up.railway.app

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USER_IDS=     # comma-separated; reject everyone else

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=     # server-only, never expose to web

# LLM
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5

# TTS
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_A=Rachel
ELEVENLABS_VOICE_B=Adam
OPENAI_API_KEY=                # fallback

# YouTube
YOUTUBE_COOKIES_FILE=          # optional, for age-gated videos
```

**Web service**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=
```

---

## 9. Key Implementation Notes

- **Telegram webhook security.** Verify the `X-Telegram-Bot-Api-Secret-Token` header against a secret set when calling `setWebhook`. Reject otherwise.
- **Allowlist users.** Use `TELEGRAM_ALLOWED_USER_IDS` to reject any message that isn't from me. This is a personal app.
- **Idempotency.** If the same URL is shared twice within 24h, return the existing `link_id` instead of creating a duplicate.
- **YouTube transcripts** are sometimes machine-generated and ugly. Strip filler ("uh", "you know") with a regex pass before sending to the LLM.
- **LinkedIn login walls** are real. Don't try to defeat them. The paste fallback is the supported path.
- **ffmpeg in Docker.** Required for `pydub`. Add to the Python base image.
- **Audio file sizes.** A 10-minute mono mp3 at 80 kbps is ~6 MB. Supabase free tier gives 1 GB storage — that's ~150 episodes. Plenty for v1.
- **Cost back-of-napkin per episode.** Claude notes (~$0.01–0.03) + Claude script (~$0.02–0.05) + ElevenLabs TTS (~$0.10–0.30 depending on tier). Roughly **$0.15–$0.40 per article**. Add a daily cap if you want.
- **Logging.** Structured logs (JSON) with `link_id` on every line. Makes debugging the pipeline a hundred times easier.

---

## 10. Prompts (starter content)

### `prompts/notes_system.md`

```
You are a technical learning assistant for a Salesforce developer who likes
to learn broadly. You will receive the full text of an article, blog post,
or video transcript. Produce a notes document in Markdown with these sections,
in this order, using these exact headings:

## TL;DR
2–3 sentences. No fluff.

## Key Takeaways
5–8 bullets. Each bullet is one specific, concrete idea, not a topic.

## Concepts & Terminology
Only include if there are genuinely new or jargon-heavy terms. Otherwise omit
the whole section. Format as a definition list.

## Examples / Code
If the source contains code, preserve it verbatim in fenced blocks with the
correct language tag. Otherwise omit.

## Why It Matters for a Salesforce Developer
A short, honest paragraph. If there is no plausible connection, write:
"Not directly relevant to Salesforce work — included for general learning."
Do not force a connection.

## Follow-Up Questions
3–5 questions worth investigating further.

After the markdown, on a new line, output a single JSON object on one line:
{"tags": ["tag1","tag2","tag3"]}
Use 3–6 lowercase tags, kebab-case if multi-word.
```

### `prompts/podcast_script_system.md`

```
You are writing a podcast dialogue between two hosts about a piece of
technical content. The audience is a curious software developer who wants
to learn while commuting.

Host A: Curious, asks clarifying questions, occasionally summarizes back
what they understood. Not dumb — just genuinely curious.
Host B: The explainer. Calm, uses analogies, gives concrete examples,
acknowledges trade-offs.

Rules:
- Output ONLY the dialogue. No intro labels, no stage directions, no
  emojis, no "[Music]".
- Format: each line starts with "A: " or "B: " and nothing else.
- Length: 1,200–1,800 words total.
- Open with Host A framing what they're about to discuss (don't say "welcome
  to the podcast" — just dive in conversationally).
- Close with Host B giving one practical takeaway the listener could try
  this week.
- Do not invent facts that aren't in the source. If something is unclear in
  the source, have Host B say so.
```

---

## 11. Testing Approach

- **Unit.** Each extractor has a test with a saved HTML fixture. Each prompt has a test that asserts the output structure.
- **Integration.** A `tests/e2e_pipeline.py` that POSTs a fake Telegram update with a known URL, waits, and asserts a `podcast_ready` row.
- **Manual.** A `/debug/run <link_id>` endpoint that re-runs the full pipeline for a single link. Invaluable.

---

## 12. Out of Scope for v1 (explicit non-goals)

- Mobile native app.
- Multi-user support, billing, public sharing.
- WhatsApp integration (revisit only if Telegram proves insufficient).
- Real NotebookLM API integration (no public API exists; revisit if Google ships one).
- Video summarization beyond the transcript (no frame analysis).
- Real-time progress UI. Polling every 5s in the web app is fine.

---

## 13. Open Questions for the User (resolve before/during Phase 4)

1. ElevenLabs subscription tier? Free tier is 10k chars/month — burns through ~5 episodes. Starter ($5/mo) is 30k chars. Confirm.
2. Voice preference: any specific ElevenLabs voices you've heard and liked?
3. Daily cap on automated podcast generation (e.g. max 5/day)?
4. Retention: keep everything forever, or auto-archive after 90 days?

---

## 14. Suggested Order of Operations for Claude Code

1. Read this whole document.
2. Execute Phase 0. Confirm deployment URLs back to me.
3. Execute Phase 1. Pause for me to test from my phone.
4. Execute Phase 2. Pause for me to test with mixed sources.
5. Execute Phase 3. Pause for me to read sample notes.
6. Execute Phase 4. Pause for me to listen to a sample episode.
7. Execute Phase 5.
8. (Optional) Phase 6.

Do not skip the pauses. Each one is a real-world acceptance check.

---

**End of plan.**