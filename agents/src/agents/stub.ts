import type {
  AgentContext,
  AgentName,
  AgentResult,
  SpecialistAgent,
} from "../types";

/**
 * Placeholder for a specialist agent that hasn't been implemented yet.
 * Returns a clearly-marked stub result so it can't be mistaken for a real
 * finding once the orchestrator is wired up to a real workflow.
 */
export function createStubAgent(name: AgentName): SpecialistAgent {
  return {
    name,
    async run(context: AgentContext): Promise<AgentResult> {
      return {
        agent: name,
        task: context.task,
        summary: `[stub] ${name} has no real implementation yet; task received: "${context.task}"`,
        data: { stub: true },
      };
    },
  };
}
