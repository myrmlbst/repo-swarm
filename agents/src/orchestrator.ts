import { z } from "zod";
import { callClaudeTool } from "./lib/callTool";
import { agentRegistry } from "./agents";
import { AGENT_NAMES } from "./types";
import type {
  AgentRequest,
  AgentResult,
  AgentRunRecord,
  OrchestratorResult,
  Task,
  TaskPlan,
  Usage,
} from "./types";

const taskPlanSchema = z.object({
  tasks: z
    .array(
      z.object({
        agent: z.enum(AGENT_NAMES),
        task: z.string().min(1),
      }),
    )
    .min(1),
});

const SUBMIT_PLAN_TOOL = {
  name: "submit_task_plan",
  description:
    "Submit the task plan for this request: which specialist agents should run and what each should do.",
  input_schema: {
    type: "object" as const,
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            agent: { type: "string", enum: AGENT_NAMES },
            task: {
              type: "string",
              description: "What this agent should do, in one sentence.",
            },
          },
          required: ["agent", "task"],
          additionalProperties: false,
        },
      },
    },
    required: ["tasks"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are the orchestrator in a multi-agent software architecture assistant. \
Given a developer's request about a repository, decide which of the following specialist agents \
are needed and what each one's task should be. Only include an agent if its work is actually \
relevant to the request.

- code_agent: understands the repository itself (framework, dependencies, data stores, auth, \
existing issues) by retrieving over the indexed source.
- cloud_agent: designs an AWS deployment architecture, using code_agent's findings about the \
application.
- security_agent: identifies production security risks, using code_agent's findings.
- architecture_agent: combines cloud_agent's and security_agent's output into one coherent \
proposal. Include it whenever cloud_agent and/or security_agent are included.
- review_agent: critiques architecture_agent's proposal for unsupported claims before it goes \
back to the user. Include it whenever architecture_agent is included.

Note: cloud_agent and security_agent depend on code_agent's output, and architecture_agent/ \
review_agent run after them in that order — but you only decide which agents are needed and \
what to ask each one; the calling system takes care of running them in the right order.

Call submit_task_plan with the resulting plan. Do not include agents that aren't needed.`;

async function planWithClaude(
  request: AgentRequest,
): Promise<{ plan: TaskPlan; usage: Usage }> {
  const { input, usage } = await callClaudeTool({
    system: SYSTEM_PROMPT,
    user: `Repository: ${request.repoUrl}\n\nDeveloper request: ${request.question}`,
    tool: SUBMIT_PLAN_TOOL,
    maxTokens: 1024,
  });

  const parsed = taskPlanSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Orchestrator: model returned an invalid task plan: ${parsed.error.message}`,
    );
  }

  return { plan: parsed.data, usage };
}

function taskFor(tasks: Task[], agent: Task["agent"]): Task | undefined {
  return tasks.find((t) => t.agent === agent);
}

/** Rejection type that keeps the runs recorded before a failure, so the worker can still persist a trace. */
export class OrchestratorError extends Error {
  constructor(
    message: string,
    readonly runs: AgentRunRecord[],
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "OrchestratorError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Wraps one agent's run() with timing, recorded into `runs` (on failure too, before rethrowing). */
async function runTimed(
  task: Task,
  request: AgentRequest,
  priorResults: AgentResult[],
  runs: AgentRunRecord[],
): Promise<AgentResult> {
  const startedAt = new Date().toISOString();
  let result: AgentResult;
  try {
    result = await agentRegistry[task.agent].run({
      request,
      task: task.task,
      priorResults,
    });
  } catch (error) {
    runs.push({
      agent: task.agent,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "failed",
      error: errorMessage(error),
    });
    throw error;
  }
  runs.push({
    agent: task.agent,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: "complete",
    usage: result.usage,
    retrievalCount: result.retrievalCount,
  });
  return result;
}

/**
 * Runs the specialist agents in the fixed dependency order from
 * DESIGNDOC.md § 3: code_agent (alone) -> {cloud_agent, security_agent} (in
 * parallel) -> architecture_agent -> review_agent. Any agent not present in
 * the plan is simply skipped. If any agent throws, this rejects (no later
 * stage runs), but every run recorded so far — including the failed one —
 * has already been pushed onto the caller's `runs` array.
 */
async function executePlan(
  request: AgentRequest,
  plan: TaskPlan,
  runs: AgentRunRecord[],
): Promise<AgentResult[]> {
  const results: AgentResult[] = [];

  const codeTask = taskFor(plan.tasks, "code_agent");
  if (codeTask) {
    results.push(await runTimed(codeTask, request, results, runs));
  }

  const parallelTasks = [
    taskFor(plan.tasks, "cloud_agent"),
    taskFor(plan.tasks, "security_agent"),
  ].filter((t): t is Task => t !== undefined);

  if (parallelTasks.length > 0) {
    // allSettled, not all: if one agent fails the other still runs to
    // completion, so its run record (and cost) lands in `runs` before we throw.
    const settled = await Promise.allSettled(
      parallelTasks.map((t) => runTimed(t, request, results, runs)),
    );
    const failed = settled.find(
      (s): s is PromiseRejectedResult => s.status === "rejected",
    );
    if (failed) throw failed.reason;
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(s.value);
    }
  }

  const architectureTask = taskFor(plan.tasks, "architecture_agent");
  if (architectureTask) {
    results.push(await runTimed(architectureTask, request, results, runs));
  }

  const reviewTask = taskFor(plan.tasks, "review_agent");
  if (reviewTask) {
    results.push(await runTimed(reviewTask, request, results, runs));
  }

  return results;
}

export async function runOrchestrator(
  request: AgentRequest,
): Promise<OrchestratorResult> {
  const runs: AgentRunRecord[] = [];

  const planStartedAt = new Date().toISOString();
  let plan: TaskPlan;
  try {
    const planned = await planWithClaude(request);
    plan = planned.plan;
    runs.push({
      agent: "orchestrator",
      startedAt: planStartedAt,
      finishedAt: new Date().toISOString(),
      status: "complete",
      usage: planned.usage,
    });
  } catch (error) {
    runs.push({
      agent: "orchestrator",
      startedAt: planStartedAt,
      finishedAt: new Date().toISOString(),
      status: "failed",
      error: errorMessage(error),
    });
    throw new OrchestratorError(errorMessage(error), runs, { cause: error });
  }

  try {
    const results = await executePlan(request, plan, runs);
    return { plan, results, runs };
  } catch (error) {
    throw new OrchestratorError(errorMessage(error), runs, { cause: error });
  }
}
