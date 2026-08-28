import type { AgentName, AgentResult } from "../types";

export function findResult(
  results: AgentResult[],
  agent: AgentName,
): AgentResult | undefined {
  return results.find((r) => r.agent === agent);
}
