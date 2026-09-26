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

/** Token usage from one Claude call — real numbers from the API response's `usage` field. */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface AgentResult {
  agent: AgentName;
  task: string;
  summary: string;
  data?: unknown;
  /** Tokens from this agent's own Claude call(s) — for `analysis_runs.tokens_used`. */
  usage?: Usage;
  /** Number of retrieval queries this agent ran (code/cloud/security only). */
  retrievalCount?: number;
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

/**
 * Per-agent timing for `analysis_runs` (DESIGNDOC.md § 4) — recorded around
 * each agent's `run()` call in orchestrator.ts. A failed agent still gets a
 * record (`status: "failed"` + `error`); `runOrchestrator` then rejects with
 * an `OrchestratorError` carrying every record collected up to that point.
 */
export interface AgentRunRecord {
  /** "orchestrator" covers the task-planning call itself, not one of the five specialist agents. */
  agent: AgentName | "orchestrator";
  startedAt: string;
  finishedAt: string;
  status: "complete" | "failed";
  error?: string;
  usage?: Usage;
  retrievalCount?: number;
}

export interface OrchestratorResult {
  plan: TaskPlan;
  results: AgentResult[];
  runs: AgentRunRecord[];
}

/** Matches the `findings` table's severity enum in DESIGNDOC.md § 4. */
export type Severity = "info" | "warn" | "critical";

export interface Finding {
  title: string;
  detail: string;
  severity: Severity;
  /** File/doc paths (from retrieved chunks) that support this finding — empty if it isn't tied to a specific excerpt. */
  sources: string[];
}

export interface CodeIssue {
  description: string;
  /** The repo file this was observed in, or null for a repo-wide absence (e.g. "no rate limiting"). */
  sourcePath: string | null;
}

/** code_agent's `AgentResult.data` shape. */
export interface CodeFacts {
  framework: string | null;
  language: string | null;
  database: string | null;
  containerized: boolean;
  authentication: string | null;
  external_services: string[];
  issues: CodeIssue[];
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
