import knowledgeSourceUrls from "./sources.json";

/**
 * Resolves a knowledge-doc citation (e.g. "ecs-fargate.md", from
 * Finding.source_refs) to the real external AWS/OWASP page it's based on.
 * Duplicated from agents/knowledge/sources.json — agents/ and web/ are
 * separate packages that don't share code, so this must be kept in sync by
 * hand (same pattern as QUEUE_KEY between api/ and agents/).
 *
 * A repo-code path (e.g. "src/components/HomePage.jsx") or a knowledge doc
 * without a faithful 1:1 external source simply isn't a key here — callers
 * fall back to showing the bare filename.
 */
const SOURCE_URLS: Record<string, string> = knowledgeSourceUrls;

export function sourceUrlFor(sourcePath: string): string | null {
  return SOURCE_URLS[sourcePath] ?? null;
}
