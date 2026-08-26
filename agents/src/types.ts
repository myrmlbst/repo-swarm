export const AGENT_NAMES = [
  "code_agent",
  "cloud_agent",
  "security_agent",
  "architecture_agent",
  "review_agent",
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

export interface Task {
  agent: AgentName;
  task: string;
}

export interface TaskPlan {
  tasks: Task[];
}

export interface AgentRequest {
  repoUrl: string;
  question: string;
}

export interface AgentResult {
  agent: AgentName;
  task: string;
  summary: string;
  data?: unknown;
}

/**
 * What a specialist agent sees when it runs: the original request, its own
 * task from the plan, and the results of whichever agents the fixed
 * dependency graph (see DESIGNDOC.md § 3) runs before it.
 */
export interface AgentContext {
  request: AgentRequest;
  task: string;
  priorResults: AgentResult[];
}

export interface SpecialistAgent {
  name: AgentName;
  run(context: AgentContext): Promise<AgentResult>;
}

export interface OrchestratorResult {
  plan: TaskPlan;
  results: AgentResult[];
}
