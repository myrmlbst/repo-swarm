import { z } from "zod";
import { callClaudeTool } from "../lib/callTool";
import { findResult } from "../lib/priorResults";
import { findingSchema, findingsArrayJsonSchema } from "../lib/findingSchema";
import type {
  AgentContext,
  AgentResult,
  ArchitectureProposal,
  CodeFacts,
  SecurityFindings,
  SpecialistAgent,
} from "../types";

const proposalSchema = z.object({
  proposal: z.string(),
  services: z.array(z.string()).optional(),
  findings: z.array(findingSchema).optional(),
});

const SUBMIT_ARCHITECTURE_TOOL = {
  name: "submit_architecture",
  description: "Submit the combined architecture proposal.",
  input_schema: {
    type: "object" as const,
    properties: {
      proposal: {
        type: "string",
        description:
          "One coherent architecture proposal combining the cloud and security input.",
      },
      services: {
        type: "array",
        items: { type: "string" },
        description: "The union of AWS services in the final proposal.",
      },
      findings: {
        ...findingsArrayJsonSchema,
        description: "The combined, de-duplicated findings from both inputs.",
      },
    },
    required: ["proposal", "services", "findings"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are the Architecture Agent in a multi-agent software architecture \
assistant. You receive a proposed AWS deployment from the Cloud Agent and a list of security \
findings from the Security Agent, and combine them into one coherent architecture proposal — not \
just concatenated, but reconciled: if a security finding implies a change to the cloud proposal \
(e.g. "database publicly accessible" implies "put RDS in a private subnet"), fold that into the \
proposal text and the services list, not just the findings list.

Call submit_architecture with the combined result.`;

function buildUserPrompt(
  task: string,
  cloudProposal: ArchitectureProposal | null,
  securityFindings: SecurityFindings | null,
  codeFacts: CodeFacts | null,
): string {
  return `Task: ${task}

Code Agent findings:
${codeFacts ? JSON.stringify(codeFacts, null, 2) : "(none available)"}

Cloud Agent proposal:
${cloudProposal ? JSON.stringify(cloudProposal, null, 2) : "(none available)"}

Security Agent findings:
${securityFindings ? JSON.stringify(securityFindings, null, 2) : "(none available)"}`;
}

export const architectureAgent: SpecialistAgent = {
  name: "architecture_agent",
  async run(context: AgentContext): Promise<AgentResult> {
    const codeResult = findResult(context.priorResults, "code_agent");
    const cloudResult = findResult(context.priorResults, "cloud_agent");
    const securityResult = findResult(context.priorResults, "security_agent");

    const codeFacts = (codeResult?.data as CodeFacts | undefined) ?? null;
    const cloudProposal =
      (cloudResult?.data as ArchitectureProposal | undefined) ?? null;
    const securityFindings =
      (securityResult?.data as SecurityFindings | undefined) ?? null;

    const { input, usage } = await callClaudeTool({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(
        context.task,
        cloudProposal,
        securityFindings,
        codeFacts,
      ),
      tool: SUBMIT_ARCHITECTURE_TOOL,
      maxTokens: 4096,
    });

    const parsed = proposalSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(
        `architecture_agent: model returned an invalid proposal: ${parsed.error.message}`,
      );
    }

    const data: ArchitectureProposal = {
      proposal: parsed.data.proposal,
      services: parsed.data.services ?? [],
      findings: parsed.data.findings ?? [],
    };

    return {
      agent: "architecture_agent",
      task: context.task,
      summary: parsed.data.proposal,
      data,
      usage,
    };
  },
};
