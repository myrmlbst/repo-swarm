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

/** Matches the `findings` table's severity enum in DESIGNDOC.md § 4. */
export type Severity = "info" | "warn" | "critical";

export interface Finding {
  title: string;
  detail: string;
  severity: Severity;
}

/** code_agent's `AgentResult.data` shape. */
export interface CodeFacts {
  framework: string | null;
  language: string | null;
  database: string | null;
  containerized: boolean;
  authentication: string | null;
  external_services: string[];
  issues: string[];
}

/** cloud_agent's and architecture_agent's `AgentResult.data` shape. */
export interface ArchitectureProposal {
  proposal: string;
  services: string[];
  findings: Finding[];
}

/** security_agent's `AgentResult.data` shape. */
export interface SecurityFindings {
  findings: Finding[];
}

/** review_agent's `AgentResult.data` shape. */
export interface ReviewCritique {
  disputed: { claim: string; reason: string }[];
  approved: boolean;
}
