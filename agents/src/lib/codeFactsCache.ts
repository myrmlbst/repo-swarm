import { redis } from "./redisClient";
import type { CodeFacts } from "../types";

// Commit-keyed content is immutable, so correctness doesn't need a TTL —
// this is purely to bound storage growth over time (DESIGNDOC.md § 6).
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface CachedCodeFacts {
  summary: string;
  facts: CodeFacts;
}

// v2: CodeFacts.issues changed shape (plain strings -> {description,
// sourcePath} objects, for citations). Bumping the key prefix means old
// cached entries are simply never looked up again — cheaper and safer than
// migrating them in place, and they age out via TTL regardless.
function cacheKey(repoUrl: string, commitSha: string): string {
  return `code_facts_v2:${repoUrl}@${commitSha}`;
}

export async function getCachedCodeFacts(
  repoUrl: string,
  commitSha: string,
): Promise<CachedCodeFacts | null> {
  const cached = await redis.get<CachedCodeFacts>(cacheKey(repoUrl, commitSha));
  return cached ?? null;
}

export async function setCachedCodeFacts(
  repoUrl: string,
  commitSha: string,
  value: CachedCodeFacts,
): Promise<void> {
  await redis.set(cacheKey(repoUrl, commitSha), value, { ex: TTL_SECONDS });
}
