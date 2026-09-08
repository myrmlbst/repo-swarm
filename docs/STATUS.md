# Current Implementation Status

## Done:

The full pipeline works end to end now: submit a repo through `POST /v1/analyses`, and a real result — a proposal, findings, per-agent trace — actually lands in the database. Verified live: `queued` → `running` → `complete` in ~76s, 15 real findings written, 5 `analysis_runs` rows with real per-agent timing, all through the real HTTP API with real auth.

RAG is real: Voyage AI embeddings + pgvector on Supabase, chunked and indexed, actually retrieved at query time — not a hardcoded knowledge block in a prompt. See [DESIGNDOC.md § 6](DESIGNDOC.md#6-retrieval-layer) for the full breakdown. The one honest caveat: the `cloud_docs`/`security` collections are a small hand-authored corpus (`agents/knowledge/`, ~8 short docs each), not a real scrape of AWS/OWASP documentation — the retrieval mechanism is real, the corpus behind it is a stand-in.

- `api/` — a standalone Fastify + TypeScript service. Endpoints:
  - `POST /v1/analyses` — submit a GitHub repo URL, returns `{ id, status: "queued" }`, and pushes the id onto a Redis queue for the worker to pick up
  - `GET /v1/analyses` — list your own analyses (now includes `proposal`, `review_approved`)
  - `GET /v1/analyses/:id` — fetch one (yours only)
  - `GET /v1/analyses/:id/findings` — the findings a completed analysis produced
  - `GET /v1/analyses/:id/trace` — per-agent execution record (status, timing; `tokens_used`/`cost_usd`/`retrieval_count` columns exist but aren't populated yet)
  - `POST /v1/api-keys` / `GET /v1/api-keys` / `DELETE /v1/api-keys/:id` — programmatic API key management
  - `GET /v1/me` — resolves whoever the bearer token belongs to
- `supabase/migrations/` — `api_keys`, `analyses` (now with `proposal`/`review_approved` columns), `usage_counters`, `rag_chunks`, `analysis_runs`, `findings` — all with row-level security
- Full request/response reference: [docs/API.md](docs/API.md)
- Auth is Supabase Auth (email/password + GitHub OAuth). Sign-up/login happen client-side against Supabase directly (no proxy endpoints); the API verifies the resulting session JWT, or a `rsw_live_...` API key, on every protected route.
- Rate limiting + quotas, both keyed on identity (an API key when one was used, otherwise the logged-in user — see `api/src/lib/identity.ts`), so session-based web dashboard usage is capped too, not just programmatic API-key access:
  - Rate limiting: Redis (`@upstash/redis`) `INCR`/`EXPIRE` per identity per rolling minute (`api/src/lib/rateLimit.ts`), applied to every authenticated route. `429` + a real `Retry-After` on exceed.
  - Quotas: a Postgres function (`check_and_increment_quota` in `supabase/migrations/0003_usage_counters.sql`) atomically checks-and-increments the current month's analysis count, row-locked so concurrent requests can't race past the limit. `429 {"error": "Monthly analysis quota exceeded"}` with a `Retry-After` until next month.
  - Both verified live against the real Supabase + Upstash backends: rate limit correctly rejected the 4th request in a window, quota correctly rejected the 3rd analysis in a period, without letting either race through.
- `web/` — a Next.js frontend: a login screen (email/password + "Continue with GitHub"), and a dashboard to submit a repo URL and see your own analyses with their status. Talks to `api/` directly from the browser using the logged-in session token. **Not yet updated to display `proposal`/findings** now that they exist — still just shows status.
- `agents/` — a standalone TypeScript module for the agent layer, runnable without `api/`:
  - [`agents/src/orchestrator.ts`](agents/src/orchestrator.ts) — calls Claude (forced tool-use, so the plan is always valid JSON) to decide which specialist agents a request needs and what to ask each, then runs them in the fixed dependency order from [DESIGNDOC.md § 3](DESIGNDOC.md#3-architecture): `code_agent` alone → `{cloud_agent, security_agent}` in parallel → `architecture_agent` → `review_agent`. Now also records per-agent start/finish timing (`runs`) alongside `results`.
  - [`agents/src/worker.ts`](agents/src/worker.ts) — the piece that actually wires the orchestrator into the product (DESIGNDOC.md § 9: agent workers run separately from the API, scaling independently). Polls the same Redis queue `api/` pushes onto, runs the orchestrator per analysis, flattens every agent's output into `findings` rows, writes `analysis_runs`, and updates the `analyses` row (`status`, `proposal`, `review_approved`, `completed_at`). `npm run worker`; `scripts/dev.sh` now starts it alongside `api/`/`web/`.
  - [`agents/src/agents/`](agents/src/agents/) — one file per specialist agent, each doing real Claude reasoning (forced tool-use, validated with Zod):
    - `codeAgent.ts` — clones the repo, indexes it into the `repository` collection, retrieves relevant chunks, and extracts structured facts (framework, database, auth, external services, issues).
    - `cloudAgent.ts` — retrieves from the `cloud_docs` collection and proposes an AWS architecture from the Code Agent's facts.
    - `securityAgent.ts` — retrieves from the `security` collection and flags production security risks from the Code Agent's facts.
    - `architectureAgent.ts` — reconciles the Cloud and Security agents' output into one proposal.
    - `reviewAgent.ts` — critiques that proposal for claims unsupported by the Code Agent's facts. Also sees the developer's original request, so it disputes unsupported _specifics_ (e.g. "ECS Fargate specifically" when nothing demands that over a simpler option) without re-litigating the premise of what was actually asked for (e.g. "deploy this on AWS" isn't a hallucination just because the repo itself doesn't say so).
  - [`agents/src/lib/rag/`](agents/src/lib/rag/) — the RAG pipeline: `embeddings.ts` (Voyage AI), `vectorStore.ts` (pgvector on Supabase, namespace-scoped search), `chunk.ts`, `retrieve.ts` (multi-query retrieval + merge). See [DESIGNDOC.md § 6](DESIGNDOC.md#6-retrieval-layer).
  - Caching: `code_agent` (`agents/src/lib/codeFactsCache.ts`) checks Redis for that commit's structured facts before doing anything else — `git ls-remote` gets the commit SHA with no clone, and a cache hit skips cloning, indexing, embedding, and the Claude call entirely. Verified live: repeat run on the same commit dropped from 29.98s to 4.58s with byte-identical output. Note: never triggers during eval runs, since `eval/`'s fixtures get a fresh commit SHA every run — see below.
  - [`agents/knowledge/`](agents/knowledge/) — the hand-authored `cloud_docs`/`security` corpus; seeded into pgvector by `agents/scripts/seedKnowledge.ts` (`npm run seed-knowledge`).
  - [`agents/src/lib/`](agents/src/lib/) — also: the Claude tool-calling helper, the repo-clone helper, and two guardrails from [DESIGNDOC.md § 7](DESIGNDOC.md#7-guardrails) — `redact.ts` (regex-based secret redaction on repo content before it's indexed) and prompt-injection resistance (repo content is wrapped in an `<UNTRUSTED_REPOSITORY_CONTENT>` delimiter in `codeAgent.ts`'s system prompt).
  - [`agents/src/runner.ts`](agents/src/runner.ts) — standalone CLI entry point: `npm run dev -- <repo_url> "<question>"` (independent of the queue/worker above).
  - [`agents/eval/`](agents/eval/) — the golden-repo eval suite (DESIGNDOC.md § 8): 5 hand-crafted fixtures under `golden-repos/`, each with a real known issue (a hardcoded secret, a publicly-accessible DB, missing containerization, disabled TLS verification, an overly broad IAM policy) and a hand-labeled `expected-findings.json`. `eval/run.ts` scaffolds each fixture into a real temp git repo, runs `code_agent` → `{cloud_agent, security_agent}` against it (bypassing the orchestrator's LLM planning step for determinism), and scores the findings against the expected list using an LLM judge for semantic matching (`eval/lib/judge.ts`) — not exact string matching. `npm run eval`. Infra verified working end-to-end; **no completed scored run yet** (each attempt so far hit an expired credential mid-run) — see Not Built Yet.

---

## Not Built Yet:

- A completed golden-repo eval run with real precision/recall numbers — the suite is built and its infrastructure verified, just hasn't finished a full run yet.
- `tokens_used`/`cost_usd`/`retrieval_count` on `analysis_runs` — columns exist, unpopulated. Needs a signature change through `callTool.ts` and every agent to actually capture.
- The prompt-injection guardrail has no test (DESIGNDOC § 7 calls for one — a golden-repo fixture with an injection attempt, asserting it's ignored; the eval harness could support this now).
- `web/` doesn't display `proposal`/findings yet — the dashboard shows status only.
- Partial-failure handling: if any agent throws, the whole analysis is marked `failed` — no partial-credit/partial-results yet.
- The `incidents` collection (no agent uses it)
- Deployment
- A CI workflow (nothing runs `typecheck`/tests automatically on push)
