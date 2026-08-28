const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 150;

/**
 * Splits text into overlapping chunks, breaking on paragraph boundaries
 * where possible so a chunk doesn't cut a sentence in half. Character-based,
 * not token-based — simple and dependency-free, good enough at this scale.
 */
export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current.length + paragraph.length + 2 <= CHUNK_SIZE) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }

    if (current) chunks.push(current);

    if (paragraph.length <= CHUNK_SIZE) {
      current = paragraph;
    } else {
      // A single paragraph longer than CHUNK_SIZE: hard-slice it.
      for (let i = 0; i < paragraph.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        chunks.push(paragraph.slice(i, i + CHUNK_SIZE));
      }
      current = "";
    }
  }

  if (current) chunks.push(current);
  return chunks.filter((c) => c.trim().length > 0);
}
