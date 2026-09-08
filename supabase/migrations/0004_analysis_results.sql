-- Somewhere for a real analysis result to land (DESIGNDOC.md § 4), now that
-- the orchestrator is wired into POST /v1/analyses via a queue + worker.

-- Architecture Agent's `findings` array is often empty in practice — the
-- actual deliverable lives in its free-text proposal, which the `findings`
-- table below has no place for. `review_approved` mirrors Review Agent's
-- top-level verdict (DESIGNDOC.md § 11's open question: how much of the
-- critique to surface vs. just filter with — this makes the verdict itself
-- visible without deciding that question yet).
alter table analyses add column if not exists proposal text;
alter table analyses add column if not exists review_approved boolean;

create table if not exists analysis_runs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses(id) on delete cascade,
  agent_name text not null,
  status text not null check (status in ('complete', 'failed')),
  error text,
  -- Not populated yet — needs a signature change through callTool.ts and
  -- every agent to actually capture; the columns exist to match the design
  -- (DESIGNDOC.md § 4) without guessing values in the meantime.
  tokens_used integer,
  cost_usd numeric,
  retrieval_count integer,
  started_at timestamptz not null,
  finished_at timestamptz not null
);

create index if not exists analysis_runs_analysis_id_idx on analysis_runs (analysis_id);

create table if not exists findings (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses(id) on delete cascade,
  agent_name text not null,
  severity text not null check (severity in ('info', 'warn', 'critical')),
  title text not null,
  detail text not null,
  source_refs jsonb not null default '{}'::jsonb,
  -- Review Agent's disputes land as their own rows (disputed = true) rather
  -- than retroactively flagging an existing row — free-text matching back
  -- to a specific finding is fragile, and Architecture Agent's structured
  -- findings are often empty anyway (see the `proposal` column above).
  disputed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists findings_analysis_id_idx on findings (analysis_id);

alter table analysis_runs enable row level security;
alter table findings enable row level security;

-- Same defense-in-depth reasoning as 0001_init.sql: the API uses the
-- service-role key and enforces ownership itself. These are read-only
-- (users don't write analysis_runs/findings directly — the worker does).
create policy "users view their own analysis runs"
  on analysis_runs for select
  using (
    exists (
      select 1 from analyses
      where analyses.id = analysis_runs.analysis_id
        and analyses.user_id = auth.uid()
    )
  );

create policy "users view their own findings"
  on findings for select
  using (
    exists (
      select 1 from analyses
      where analyses.id = findings.analysis_id
        and analyses.user_id = auth.uid()
    )
  );
