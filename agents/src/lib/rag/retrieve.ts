import { embedQueries } from "./embeddings";
import { search, type Collection, type RetrievedChunk } from "./vectorStore";

/**
 * Runs several canonical queries against one collection/namespace, merges
 * the results (deduped by chunk id, keeping the best similarity score seen),
 * and returns the top `maxTotal` overall.
 */
export async function retrieveKnowledge(params: {
  collection: Collection;
  namespace: string;
  queries: string[];
  kPerQuery?: number;
  maxTotal?: number;
}): Promise<RetrievedChunk[]> {
  const kPerQuery = params.kPerQuery ?? 4;
  const maxTotal = params.maxTotal ?? 12;

  const queryEmbeddings = await embedQueries(params.queries);

  const resultsPerQuery = await Promise.all(
    queryEmbeddings.map((embedding) =>
      search(params.collection, params.namespace, embedding, kPerQuery),
    ),
  );

  const byId = new Map<string, RetrievedChunk>();
  for (const results of resultsPerQuery) {
    for (const chunk of results) {
      const existing = byId.get(chunk.id);
      if (!existing || chunk.similarity > existing.similarity) {
        byId.set(chunk.id, chunk);
      }
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxTotal);
}
