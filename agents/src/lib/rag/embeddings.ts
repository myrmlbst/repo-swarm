import { env } from "../../env";

const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";

interface VoyageEmbeddingsResponse {
  data: { embedding: number[]; index: number }[];
}

/**
 * Voyage distinguishes "document" (things being indexed) from "query"
 * (things being searched for) — using the right one improves retrieval
 * quality, since the two get embedded slightly differently under the hood.
 */
type InputType = "document" | "query";

const MAX_RETRIES = 5;
const DEFAULT_RETRY_DELAY_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  // No Retry-After header: back off linearly. Voyage's free-tier-without-a-
  // payment-method limit is 3 requests/minute, so a short fixed wait isn't
  // enough — this is deliberately slow rather than fast-and-flaky.
  return DEFAULT_RETRY_DELAY_MS * attempt;
}

async function embed(
  texts: string[],
  inputType: InputType,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(VOYAGE_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: env.VOYAGE_MODEL,
        input_type: inputType,
      }),
    });

    if (response.ok) {
      const parsed = (await response.json()) as VoyageEmbeddingsResponse;
      return parsed.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      const body = await response.text();
      throw new Error(
        `Voyage embeddings request failed (${response.status}): ${body}`,
      );
    }

    const delay = retryDelayMs(response, attempt);
    console.warn(
      `Voyage embeddings request rate-limited (attempt ${attempt}/${MAX_RETRIES}), retrying in ${Math.round(delay / 1000)}s...`,
    );
    await sleep(delay);
  }

  throw new Error("unreachable"); // loop always returns or throws
}

const MAX_BATCH_SIZE = 64;

async function embedInBatches(
  texts: string[],
  inputType: InputType,
): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    results.push(...(await embed(batch, inputType)));
  }
  return results;
}

export function embedDocuments(texts: string[]): Promise<number[][]> {
  return embedInBatches(texts, "document");
}

export function embedQueries(texts: string[]): Promise<number[][]> {
  return embedInBatches(texts, "query");
}
