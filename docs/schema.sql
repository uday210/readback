-- Run this in the Supabase SQL editor to set up the database schema.
-- All tables are in the public schema. RLS is off for v1 (single-user, server-side only).

-- 5.1 Shared links: the raw inbox
create table links (
  id              uuid primary key default gen_random_uuid(),
  url             text not null,
  source_type     text check (source_type in ('youtube','substack','linkedin','medium','github','article','unknown')) default 'unknown',
  source_platform text,
  raw_message     text,
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

-- 5.2 Extracted content
create table contents (
  id                uuid primary key default gen_random_uuid(),
  link_id           uuid not null references links(id) on delete cascade,
  extraction_method text,
  text              text,
  word_count        int,
  language          text default 'en',
  metadata          jsonb default '{}'::jsonb,
  created_at        timestamptz default now()
);
create index on contents (link_id);

-- 5.3 Generated notes
create table notes (
  id            uuid primary key default gen_random_uuid(),
  link_id       uuid not null references links(id) on delete cascade,
  markdown      text not null,
  summary       text,
  key_takeaways jsonb default '[]'::jsonb,
  tags          text[] default '{}',
  model         text,
  tokens_in     int,
  tokens_out    int,
  created_at    timestamptz default now()
);
create index on notes (link_id);
create index on notes using gin (tags);

-- 5.4 Podcast episodes
create table podcasts (
  id           uuid primary key default gen_random_uuid(),
  link_id      uuid not null references links(id) on delete cascade,
  script       text,
  audio_path   text,
  audio_url    text,
  duration_sec int,
  mode         text check (mode in ('two_host','single_narrator','manual_notebooklm')) default 'two_host',
  tts_provider text,
  voices       jsonb default '{}'::jsonb,
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);
create index on podcasts (link_id);

-- updated_at trigger for links
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger links_updated_at
  before update on links
  for each row execute function set_updated_at();
