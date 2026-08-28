/**
 * Integration test against the real Supabase/pgvector backend — requires
 * agents/.env to be filled in (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * VOYAGE_API_KEY). Run with `npm test`.
 *
 * Covers the isolation requirement DESIGNDOC.md § 6 calls out explicitly:
 * a query scoped to one namespace must never return another namespace's
 * chunks — the property that keeps one analysis's repo content from
 * leaking into a different analysis's results.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { embedDocuments, embedQueries } from "./embeddings";
import { upsertChunks, clearNamespace, search } from "./vectorStore";

test("search never returns chunks from a different namespace", async () => {
  const namespaceA = `test-isolation-a-${Date.now()}`;
  const namespaceB = `test-isolation-b-${Date.now()}`;

  const contentA =
    "The application uses PostgreSQL as its primary database, connected via a pool.";
  const contentB =
    "The frontend is built with React and Tailwind CSS for styling.";

  try {
    const [embeddingA, embeddingB] = await embedDocuments([contentA, contentB]);

    await upsertChunks("repository", namespaceA, [
      { sourcePath: "db.ts", content: contentA, embedding: embeddingA },
    ]);
    await upsertChunks("repository", namespaceB, [
      { sourcePath: "App.tsx", content: contentB, embedding: embeddingB },
    ]);

    const [queryEmbedding] = await embedQueries([
      "database connection configuration",
    ]);

    const resultsInA = await search(
      "repository",
      namespaceA,
      queryEmbedding,
      5,
    );
    const resultsInB = await search(
      "repository",
      namespaceB,
      queryEmbedding,
      5,
    );

    assert.ok(
      resultsInA.some((r) => r.content === contentA),
      "expected namespace A's own chunk to be found in namespace A",
    );
    assert.ok(
      resultsInA.every((r) => r.content !== contentB),
      "namespace A's search results must never include namespace B's content",
    );
    assert.ok(
      resultsInB.every((r) => r.content !== contentA),
      "namespace B's search results must never include namespace A's content",
    );
  } finally {
    await clearNamespace("repository", namespaceA);
    await clearNamespace("repository", namespaceB);
  }
});
