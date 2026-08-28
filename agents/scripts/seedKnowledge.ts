/**
 * Seeds the hand-authored cloud_docs/security corpus (agents/knowledge/)
 * into the rag_chunks table, under the shared "global" namespace. Idempotent
 * — safe to re-run after editing the corpus, since it replaces the whole
 * namespace rather than appending.
 *
 * Usage: npm run seed-knowledge
 */
import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { chunkText } from "../src/lib/rag/chunk";
import { embedDocuments } from "../src/lib/rag/embeddings";
import { upsertChunks, type Collection } from "../src/lib/rag/vectorStore";

const KNOWLEDGE_DIR = join(__dirname, "..", "knowledge");
const NAMESPACE = "global";

async function seedCollection(collection: Collection): Promise<void> {
  const dir = join(KNOWLEDGE_DIR, collection);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));

  const chunks: { sourcePath: string; content: string }[] = [];
  for (const file of files) {
    const content = await readFile(join(dir, file), "utf-8");
    for (const chunk of chunkText(content)) {
      chunks.push({ sourcePath: basename(file), content: chunk });
    }
  }

  console.log(
    `${collection}: embedding ${chunks.length} chunks from ${files.length} files...`,
  );
  const embeddings = await embedDocuments(chunks.map((c) => c.content));

  await upsertChunks(
    collection,
    NAMESPACE,
    chunks.map((c, i) => ({ ...c, embedding: embeddings[i] })),
  );
  console.log(
    `${collection}: seeded ${chunks.length} chunks into namespace "${NAMESPACE}".`,
  );
}

async function main() {
  await seedCollection("cloud_docs");
  await seedCollection("security");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
