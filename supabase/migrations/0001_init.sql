-- Vertical slice: auth (Supabase Auth, built-in) + API + DB.
-- Agent-produced tables (analysis_runs, findings, usage_counters) are
-- intentionally deferred until the agent layer exists (see DESIGNDOC.md).

create extension if not exists pgcrypto;

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists api_keys_user_id_idx on api_keys(user_id);

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repo_url text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'complete', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists analyses_user_id_idx on analyses(user_id);

-- RLS: the API talks to Postgres with the service-role key (which bypasses
-- RLS) after verifying the caller itself in src/lib/auth.ts. These policies
-- are defense-in-depth for any future path that queries Postgres directly
-- with a user's own session (e.g. a frontend using the Supabase client).

alter table api_keys enable row level security;
alter table analyses enable row level security;

create policy "users manage their own api keys"
  on api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage their own analyses"
  on analyses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
