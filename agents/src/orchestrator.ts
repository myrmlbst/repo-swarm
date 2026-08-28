import { z } from "zod";
import { callClaudeTool } from "./lib/callTool";
import { agentRegistry } from "./agents";
import { AGENT_NAMES } from "./types";
import type {
  AgentRequest,
  AgentResult,
  OrchestratorResult,
  Task,
  TaskPlan,
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

async function planWithClaude(request: AgentRequest): Promise<TaskPlan> {
  const input = await callClaudeTool({
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

  return parsed.data;
}

function taskFor(tasks: Task[], agent: Task["agent"]): Task | undefined {
  return tasks.find((t) => t.agent === agent);
}

/**
 * Runs the specialist agents in the fixed dependency order from
 * DESIGNDOC.md § 3: code_agent (alone) -> {cloud_agent, security_agent} (in
 * parallel) -> architecture_agent -> review_agent. Any agent not present in
 * the plan is simply skipped.
 */
async function executePlan(
  request: AgentRequest,
  plan: TaskPlan,
): Promise<AgentResult[]> {
  const results: AgentResult[] = [];

  const codeTask = taskFor(plan.tasks, "code_agent");
  if (codeTask) {
    const result = await agentRegistry.code_agent.run({
      request,
      task: codeTask.task,
      priorResults: results,
    });
    results.push(result);
  }

  const parallelTasks = [
    taskFor(plan.tasks, "cloud_agent"),
    taskFor(plan.tasks, "security_agent"),
  ].filter((t): t is Task => t !== undefined);

  if (parallelTasks.length > 0) {
    const parallelResults = await Promise.all(
      parallelTasks.map((t) =>
        agentRegistry[t.agent].run({
          request,
          task: t.task,
          priorResults: results,
        }),
      ),
    );
    results.push(...parallelResults);
  }

  const architectureTask = taskFor(plan.tasks, "architecture_agent");
  if (architectureTask) {
    const result = await agentRegistry.architecture_agent.run({
      request,
      task: architectureTask.task,
      priorResults: results,
    });
    results.push(result);
  }

  const reviewTask = taskFor(plan.tasks, "review_agent");
  if (reviewTask) {
    const result = await agentRegistry.review_agent.run({
      request,
      task: reviewTask.task,
      priorResults: results,
    });
    results.push(result);
  }

  return results;
}

export async function runOrchestrator(
  request: AgentRequest,
): Promise<OrchestratorResult> {
  const plan = await planWithClaude(request);
  const results = await executePlan(request, plan);
  return { plan, results };
}
