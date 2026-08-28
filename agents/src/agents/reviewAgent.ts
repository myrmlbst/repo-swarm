import { z } from "zod";
import { callClaudeTool } from "../lib/callTool";
import { findResult } from "../lib/priorResults";
import type {
  AgentContext,
  AgentResult,
  ArchitectureProposal,
  CodeFacts,
  ReviewCritique,
  SpecialistAgent,
} from "../types";

const critiqueSchema = z.object({
  disputed: z
    .array(
      z.object({
        claim: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
  approved: z.boolean(),
});

const SUBMIT_REVIEW_TOOL = {
  name: "submit_review",
  description: "Submit the critique of the architecture proposal.",
  input_schema: {
    type: "object" as const,
    properties: {
      disputed: {
        type: "array",
        items: {
          type: "object",
          properties: {
            claim: {
              type: "string",
              description:
                "The specific claim or recommendation being disputed.",
            },
            reason: {
              type: "string",
              description:
                "Why it's unsupported, e.g. nothing in the repo justifies it.",
            },
          },
          required: ["claim", "reason"],
          additionalProperties: false,
        },
        description:
          "Claims in the proposal that aren't backed by the Code Agent's findings.",
      },
      approved: {
        type: "boolean",
        description:
          "true if the proposal is well-supported overall (disputed items can still exist).",
      },
    },
    required: ["disputed", "approved"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are the Review Agent in a multi-agent software architecture assistant. \
Your job is not to propose another solution — it's to attack the existing one. Given the developer's \
original request, the Code Agent's ground-truth facts about the repository, and the Architecture \
Agent's combined proposal, find contradictions, hallucinations, and unsupported claims: \
recommendations that aren't backed by anything in the Code Agent's findings (e.g. a proposal that \
adds Redis or WebSockets when nothing in the repo suggests that need).

The developer's request sets the premise — it is not itself something to dispute. If they asked for \
an AWS deployment, "this should be deployed on AWS" is a given, not an unsupported claim, even \
though nothing in the code itself says so; only dispute specifics *within* that premise that aren't \
backed by the Code Agent's findings (e.g. a specific service choice, a claimed need, a made-up \
number). Don't dispute claims that ARE supported by the Code Agent's findings or the developer's own \
request, even if you'd have made a different choice yourself — this is about unsupported claims, not \
second-guessing every decision or re-litigating what was asked for. If you find nothing to dispute, \
return an empty "disputed" array; don't invent a critique just to have one.

Call submit_review with your critique.`;

function buildUserPrompt(
  task: string,
  developerRequest: string,
  proposal: ArchitectureProposal | null,
  codeFacts: CodeFacts | null,
): string {
  return `Task: ${task}

Developer's original request (sets the premise — not itself disputable):
${developerRequest}

Code Agent findings (ground truth about the repo):
${codeFacts ? JSON.stringify(codeFacts, null, 2) : "(none available)"}

Architecture Agent proposal to review:
${proposal ? JSON.stringify(proposal, null, 2) : "(none available)"}`;
}

export const reviewAgent: SpecialistAgent = {
  name: "review_agent",
  async run(context: AgentContext): Promise<AgentResult> {
    const codeResult = findResult(context.priorResults, "code_agent");
    const architectureResult = findResult(
      context.priorResults,
      "architecture_agent",
    );

    const codeFacts = (codeResult?.data as CodeFacts | undefined) ?? null;
    const proposal =
      (architectureResult?.data as ArchitectureProposal | undefined) ?? null;

    const input = await callClaudeTool({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(
        context.task,
        context.request.question,
        proposal,
        codeFacts,
      ),
      tool: SUBMIT_REVIEW_TOOL,
      maxTokens: 2048,
    });

    const parsed = critiqueSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(
        `review_agent: model returned an invalid critique: ${parsed.error.message}`,
      );
    }

    const data: ReviewCritique = {
      disputed: parsed.data.disputed ?? [],
      approved: parsed.data.approved,
    };

    const summary =
      data.disputed.length > 0
        ? `Disputed ${data.disputed.length} claim(s): ${data.disputed.map((d) => d.claim).join("; ")}`
        : "No unsupported claims found.";

    return {
      agent: "review_agent",
      task: context.task,
      summary,
      data,
    };
  },
};
