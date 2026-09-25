import { z } from "zod";
import { callClaudeTool } from "../lib/callTool";
import { findResult } from "../lib/priorResults";
import { findingSchema, findingsArrayJsonSchema } from "../lib/findingSchema";
import { retrieveKnowledge } from "../lib/rag/retrieve";
import type {
  AgentContext,
  AgentResult,
  ArchitectureProposal,
  CodeFacts,
  SpecialistAgent,
} from "../types";

const proposalSchema = z.object({
  proposal: z.string(),
  services: z.array(z.string()).optional(),
  findings: z.array(findingSchema).optional(),
});

const SUBMIT_CLOUD_PROPOSAL_TOOL = {
  name: "submit_cloud_proposal",
  description: "Submit the proposed AWS deployment architecture.",
  input_schema: {
    type: "object" as const,
    properties: {
      proposal: {
        type: "string",
        description:
          "Prose description of the proposed AWS architecture, referencing the app's actual stack.",
      },
      services: {
        type: "array",
        items: { type: "string" },
        description:
          "AWS services used in the proposal (e.g. ECS Fargate, RDS, ALB).",
      },
      findings: {
        ...findingsArrayJsonSchema,
        description: "Specific recommendations, each with a severity.",
      },
    },
    required: ["proposal", "services", "findings"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are the Cloud Agent in a multi-agent software architecture assistant. \
You receive structured facts about a repository from the Code Agent (not the repository itself) \
and design an AWS deployment architecture appropriate for that specific app — not a generic \
template. Reference the app's actual framework, database, and external services in your proposal.

Below are excerpts retrieved from AWS service reference docs, relevant to this task, each headed by \
its exact path (a "--- path ---" line). Ground your proposal in them, and don't invent AWS behavior \
the excerpts don't support. If the excerpts don't cover something you need, say so rather than \
guessing.

For every finding you report, set sources to the doc path(s) that actually justify it. Leave it \
empty if you can't tie the finding to a specific excerpt.

Call submit_cloud_proposal with your proposal.`;

// Canonical queries against the cloud_docs collection — a stand-in for the
// model choosing its own retrieval queries, matching README.md § 3.
const RETRIEVAL_QUERIES = [
  "running containerized workloads on AWS",
  "connecting compute to a managed database",
  "storing application secrets on AWS",
  "load balancing HTTP APIs on AWS",
  "network isolation and private subnets",
  "auto scaling and observability",
];

function buildUserPrompt(
  task: string,
  codeFacts: CodeFacts | null,
  docs: { sourcePath: string; content: string }[],
): string {
  const factsBlock = codeFacts
    ? JSON.stringify(codeFacts, null, 2)
    : "(no Code Agent findings available — propose a general architecture and note the gap)";

  const docsBlock = docs
    .map((d) => `--- ${d.sourcePath} ---\n${d.content}`)
    .join("\n\n");

  return `Task: ${task}

Code Agent findings:
${factsBlock}

AWS service reference (retrieved):
${docsBlock || "(no relevant docs retrieved)"}`;
}

export const cloudAgent: SpecialistAgent = {
  name: "cloud_agent",
  async run(context: AgentContext): Promise<AgentResult> {
    const codeResult = findResult(context.priorResults, "code_agent");
    const codeFacts = (codeResult?.data as CodeFacts | undefined) ?? null;

    const docs = await retrieveKnowledge({
      collection: "cloud_docs",
      namespace: "global",
      queries: [...RETRIEVAL_QUERIES, context.task],
    });

    const { input, usage } = await callClaudeTool({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(
        context.task,
        codeFacts,
        docs.map((d) => ({ sourcePath: d.sourcePath, content: d.content })),
      ),
      tool: SUBMIT_CLOUD_PROPOSAL_TOOL,
      maxTokens: 4096,
    });

    const parsed = proposalSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(
        `cloud_agent: model returned an invalid proposal: ${parsed.error.message}`,
      );
    }

    const data: ArchitectureProposal = {
      proposal: parsed.data.proposal,
      services: parsed.data.services ?? [],
      findings: parsed.data.findings ?? [],
    };

    return {
      agent: "cloud_agent",
      task: context.task,
      summary: parsed.data.proposal,
      data,
      usage,
      retrievalCount: RETRIEVAL_QUERIES.length + 1,
    };
  },
};
