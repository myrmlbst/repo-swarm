import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "./chunk";

test("empty or whitespace-only text produces no chunks", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   \n\n  "), []);
});

test("short text stays a single chunk", () => {
  const text = "This is a short paragraph about a database connection.";
  const chunks = chunkText(text);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], text);
});

test("short paragraphs under the size budget get merged into one chunk", () => {
  const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
  const chunks = chunkText(text);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], text);
});

test("a paragraph longer than the chunk size gets hard-sliced with overlap", () => {
  const longParagraph = "a".repeat(4000);
  const chunks = chunkText(longParagraph);

  assert.ok(chunks.length > 1, "expected more than one chunk for 4000 chars");
  for (const chunk of chunks) {
    assert.ok(
      chunk.length <= 1500,
      `chunk exceeded the 1500-char budget: ${chunk.length}`,
    );
  }
  // Every character of the original text should show up somewhere across
  // the chunks — nothing silently dropped.
  assert.ok(chunks.join("").length >= longParagraph.length);
});

test("no chunk exceeds the size budget even with many small paragraphs", () => {
  const paragraphs = Array.from(
    { length: 50 },
    (_, i) => `Paragraph number ${i}.`,
  );
  const chunks = chunkText(paragraphs.join("\n\n"));

  for (const chunk of chunks) {
    assert.ok(
      chunk.length <= 1500,
      `chunk exceeded the 1500-char budget: ${chunk.length}`,
    );
  }
  // All 50 paragraphs should still be present somewhere across the chunks.
  const joined = chunks.join("\n\n");
  for (let i = 0; i < 50; i++) {
    assert.ok(
      joined.includes(`Paragraph number ${i}.`),
      `missing paragraph ${i}`,
    );
  }
});
