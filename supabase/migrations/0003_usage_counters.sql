-- Quota tracking (DESIGNDOC.md § 5): one row per identity per period.
-- "Identity" is either an API key or a logged-in session user — exactly one
-- of api_key_id/user_id is set per row, so both auth paths (api_key_id for
-- programmatic access, user_id for the web dashboard) get their own quota
-- without conflating a user's session usage with any one API key's usage.

create table if not exists usage_counters (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references api_keys(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  period_start date not null,
  analyses_used integer not null default 0,
  tokens_used bigint not null default 0,
  updated_at timestamptz not null default now(),

  check (
    (api_key_id is not null and user_id is null)
    or (api_key_id is null and user_id is not null)
  )
);

-- Exactly one row per (identity, period) — lets quota increments use a
-- single atomic upsert (`insert ... on conflict do update`) instead of a
-- read-then-write race.
create unique index if not exists usage_counters_api_key_period_idx
  on usage_counters (api_key_id, period_start)
  where api_key_id is not null;

create unique index if not exists usage_counters_user_period_idx
  on usage_counters (user_id, period_start)
  where user_id is not null;

alter table usage_counters enable row level security;

-- Same defense-in-depth reasoning as 0001_init.sql: the API uses the
-- service-role key and enforces identity itself, these policies matter only
-- for any future path querying with a user's own session.
create policy "users view their own usage"
  on usage_counters for select
  using (auth.uid() = user_id);

-- Atomically checks the current period's usage against p_limit and, if under
-- it, increments and allows; if at/over it, leaves the counter untouched and
-- rejects. `for update` row-locks the counter row so two concurrent requests
-- for the same identity+period can't both read "under limit" and both get
-- through — the second one blocks until the first's transaction commits.
create or replace function check_and_increment_quota(
  p_api_key_id uuid,
  p_user_id uuid,
  p_period_start date,
  p_limit int
)
returns table (allowed boolean, analyses_used int)
language plpgsql
as $$
declare
  v_current int;
begin
  if p_api_key_id is not null then
    insert into usage_counters (api_key_id, period_start, analyses_used)
    values (p_api_key_id, p_period_start, 0)
    on conflict (api_key_id, period_start) where api_key_id is not null
    do nothing;

    select usage_counters.analyses_used into v_current
    from usage_counters
    where usage_counters.api_key_id = p_api_key_id
      and usage_counters.period_start = p_period_start
    for update;
  else
    insert into usage_counters (user_id, period_start, analyses_used)
    values (p_user_id, p_period_start, 0)
    on conflict (user_id, period_start) where user_id is not null
    do nothing;

    select usage_counters.analyses_used into v_current
    from usage_counters
    where usage_counters.user_id = p_user_id
      and usage_counters.period_start = p_period_start
    for update;
  end if;

  if v_current >= p_limit then
    return query select false, v_current;
    return;
  end if;

  update usage_counters
  set analyses_used = usage_counters.analyses_used + 1, updated_at = now()
  where (p_api_key_id is not null and usage_counters.api_key_id = p_api_key_id and usage_counters.period_start = p_period_start)
     or (p_user_id is not null and usage_counters.user_id = p_user_id and usage_counters.period_start = p_period_start)
  returning usage_counters.analyses_used into v_current;

  return query select true, v_current;
end;
$$;
