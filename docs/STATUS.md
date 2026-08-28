# Current Implementation Status

## Done:
The application layer's API, database, and auth; and the full agent layer — orchestrator, all five specialist agents, and real RAG retrieval — with real Claude-driven reasoning, running standalone (see `agents/` below). Submitting a repo via the API still just queues a row — the orchestrator isn't wired into the API yet.

RAG is real: Voyage AI embeddings + pgvector on Supabase, chunked and indexed, actually retrieved at query time — not a hardcoded knowledge block in a prompt. See [DESIGNDOC.md § 6](DESIGNDOC.md#6-retrieval-layer) for the full breakdown. The one honest caveat: the `cloud_docs`/`security` collections are a small hand-authored corpus (`agents/knowledge/`, ~8 short docs each), not a real scrape of AWS/OWASP documentation — the retrieval mechanism is real, the corpus behind it is a stand-in.

- `api/` — a standalone Fastify + TypeScript service. Endpoints:
  - `POST /v1/analyses` — submit a GitHub repo URL, returns `{ id, status: "queued" }`
  - `GET /v1/analyses` — list your own analyses
  - `GET /v1/analyses/:id` — fetch one (yours only)
  - `POST /v1/api-keys` / `GET /v1/api-keys` / `DELETE /v1/api-keys/:id` — programmatic API key management
  - `GET /v1/me` — resolves whoever the bearer token belongs to
- `supabase/migrations/` — the `api_keys` and `analyses` tables, with row-level security
- Full request/response reference: [docs/API.md](docs/API.md)
- Auth is Supabase Auth (email/password + GitHub OAuth). Sign-up/login happen client-side against Supabase directly (no proxy endpoints); the API verifies the resulting session JWT, or a `rsw_live_...` API key, on every protected route.
- `web/` — a Next.js frontend: a login screen (email/password + "Continue with GitHub"), and a dashboard to submit a repo URL and see your own analyses with their status. Talks to `api/` directly from the browser using the logged-in session token.
- `agents/` — a standalone TypeScript module for the agent layer, runnable without `api/`:
  - [`agents/src/orchestrator.ts`](agents/src/orchestrator.ts) — calls Claude (forced tool-use, so the plan is always valid JSON) to decide which specialist agents a request needs and what to ask each, then runs them in the fixed dependency order from [DESIGNDOC.md § 3](DESIGNDOC.md#3-architecture): `code_agent` alone → `{cloud_agent, security_agent}` in parallel → `architecture_agent` → `review_agent`.
  - [`agents/src/agents/`](agents/src/agents/) — one file per specialist agent, each doing real Claude reasoning (forced tool-use, validated with Zod):
    - `codeAgent.ts` — clones the repo, indexes it into the `repository` collection, retrieves relevant chunks, and extracts structured facts (framework, database, auth, external services, issues).
    - `cloudAgent.ts` — retrieves from the `cloud_docs` collection and proposes an AWS architecture from the Code Agent's facts.
    - `securityAgent.ts` — retrieves from the `security` collection and flags production security risks from the Code Agent's facts.
    - `architectureAgent.ts` — reconciles the Cloud and Security agents' output into one proposal.
    - `reviewAgent.ts` — critiques that proposal for claims unsupported by the Code Agent's facts. Also sees the developer's original request, so it disputes unsupported _specifics_ (e.g. "ECS Fargate specifically" when nothing demands that over a simpler option) without re-litigating the premise of what was actually asked for (e.g. "deploy this on AWS" isn't a hallucination just because the repo itself doesn't say so).
  - [`agents/src/lib/rag/`](agents/src/lib/rag/) — the RAG pipeline: `embeddings.ts` (Voyage AI), `vectorStore.ts` (pgvector on Supabase, namespace-scoped search), `chunk.ts`, `retrieve.ts` (multi-query retrieval + merge). See [DESIGNDOC.md § 6](DESIGNDOC.md#6-retrieval-layer).
  - [`agents/knowledge/`](agents/knowledge/) — the hand-authored `cloud_docs`/`security` corpus; seeded into pgvector by `agents/scripts/seedKnowledge.ts` (`npm run seed-knowledge`).
  - [`agents/src/lib/`](agents/src/lib/) — also: the Claude tool-calling helper, the repo-clone helper, and two guardrails from [DESIGNDOC.md § 7](DESIGNDOC.md#7-guardrails) — `redact.ts` (regex-based secret redaction on repo content before it's indexed) and prompt-injection resistance (repo content is wrapped in an `<UNTRUSTED_REPOSITORY_CONTENT>` delimiter in `codeAgent.ts`'s system prompt).
  - [`agents/src/runner.ts`](agents/src/runner.ts) — CLI entry point: `npm run dev -- <repo_url> "<question>"`.

---

## Not Built Yet:
- The `incidents` collection (no agent uses it)
- Caching
- Rate limiting/quotas
- The golden-repo eval suite
- Deployment
- Wiring the orchestrator into `POST /v1/analyses`
