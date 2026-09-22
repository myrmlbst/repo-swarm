// USD per million tokens. Source: Anthropic's published pricing (checked
// 2026-09-09). Add a model here before relying on cost_usd for it — an
// unlisted model returns null (no cost recorded) rather than a guessed
// number, since a wrong cost is worse than a missing one.
const PRICING_PER_MILLION_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "claude-sonnet-5": { input: 2.0, output: 10.0 },
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = PRICING_PER_MILLION_TOKENS[model];
  if (!pricing) return null;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}
