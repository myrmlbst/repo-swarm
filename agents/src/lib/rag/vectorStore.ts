import { createClient } from "@supabase/supabase-js";
import { env } from "../../env";

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type Collection = "repository" | "cloud_docs" | "security" | "incidents";

export interface Chunk {
  sourcePath: string;
  content: string;
}

export interface RetrievedChunk {
  id: string;
  sourcePath: string;
  content: string;
  similarity: number;
}

/** Replaces every chunk in `collection`/`namespace` with `chunks`. */
export async function upsertChunks(
  collection: Collection,
  namespace: string,
  chunks: (Chunk & { embedding: number[] })[],
): Promise<void> {
  await clearNamespace(collection, namespace);
  if (chunks.length === 0) return;

  const { error } = await supabase.from("rag_chunks").insert(
    chunks.map((c) => ({
      collection,
      namespace,
      source_path: c.sourcePath,
      content: c.content,
      embedding: c.embedding,
    })),
  );

  if (error) {
    throw new Error(
      `Failed to insert chunks into ${collection}/${namespace}: ${error.message}`,
    );
  }
}

export async function clearNamespace(
  collection: Collection,
  namespace: string,
): Promise<void> {
  const { error } = await supabase
    .from("rag_chunks")
    .delete()
    .eq("collection", collection)
    .eq("namespace", namespace);

  if (error) {
    throw new Error(
      `Failed to clear ${collection}/${namespace}: ${error.message}`,
    );
  }
}

/**
 * Cosine-similarity search scoped to one collection + namespace (see
 * match_rag_chunks in supabase/migrations/0002_rag_pgvector.sql) — a query
 * can never return chunks from a different namespace.
 */
export async function search(
  collection: Collection,
  namespace: string,
  queryEmbedding: number[],
  matchCount: number,
): Promise<RetrievedChunk[]> {
  const { data, error } = await supabase.rpc("match_rag_chunks", {
    p_collection: collection,
    p_namespace: namespace,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
  });

  if (error) {
    throw new Error(
      `Search failed for ${collection}/${namespace}: ${error.message}`,
    );
  }

  return (data ?? []).map(
    (row: {
      id: string;
      source_path: string;
      content: string;
      similarity: number;
    }) => ({
      id: row.id,
      sourcePath: row.source_path,
      content: row.content,
      similarity: row.similarity,
    }),
  );
}
