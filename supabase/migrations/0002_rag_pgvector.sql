-- RAG retrieval layer (DESIGNDOC.md § 6): namespaced chunks + embeddings for
-- the `repository`, `cloud_docs`, and `security` collections.
--
-- `repository` chunks are per-analysis working storage: code_agent indexes a
-- clone under a namespace unique to that run and deletes it when done, so
-- one query never has a chance to return another run's chunks (DESIGNDOC's
-- isolation requirement) — there's no cross-run cache yet.
-- `cloud_docs`/`security` chunks are a small hand-authored corpus, seeded
-- once into the `global` namespace by `agents/scripts/seedKnowledge.ts` and
-- read by every run.

create extension if not exists vector;

create table if not exists rag_chunks (
  id uuid primary key default gen_random_uuid(),
  collection text not null
    check (collection in ('repository', 'cloud_docs', 'security', 'incidents')),
  namespace text not null,
  source_path text not null,
  content text not null,
  -- dimension matches the embedding model in agents/src/lib/rag/embeddings.ts
  -- (voyage-3, 1024 dims) — both must change together.
  embedding vector(1024) not null,
  created_at timestamptz not null default now()
);

create index if not exists rag_chunks_collection_namespace_idx
  on rag_chunks (collection, namespace);

create index if not exists rag_chunks_embedding_idx
  on rag_chunks using hnsw (embedding vector_cosine_ops);

-- Similarity search scoped to one collection + namespace, so a query can
-- never return chunks from a different analysis's repository namespace or a
-- different collection.
create or replace function match_rag_chunks(
  p_collection text,
  p_namespace text,
  p_query_embedding vector(1024),
  p_match_count int
)
returns table (
  id uuid,
  source_path text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    rag_chunks.id,
    rag_chunks.source_path,
    rag_chunks.content,
    1 - (rag_chunks.embedding <=> p_query_embedding) as similarity
  from rag_chunks
  where rag_chunks.collection = p_collection
    and rag_chunks.namespace = p_namespace
  order by rag_chunks.embedding <=> p_query_embedding
  limit p_match_count;
$$;

-- Service-role key bypasses RLS (see 0001_init.sql's note on this), but this
-- table holds no user data directly tied to auth.uid(), so no per-user
-- policy applies here — isolation is enforced by collection+namespace
-- scoping in match_rag_chunks, not RLS.
alter table rag_chunks enable row level security;
