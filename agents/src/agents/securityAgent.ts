import { z } from "zod";
import { callClaudeTool } from "../lib/callTool";
import { findResult } from "../lib/priorResults";
import { findingSchema, findingsArrayJsonSchema } from "../lib/findingSchema";
import { retrieveKnowledge } from "../lib/rag/retrieve";
import type {
  AgentContext,
  AgentResult,
  CodeFacts,
  SecurityFindings,
  SpecialistAgent,
} from "../types";

const findingsSchema = z.object({
  findings: z.array(findingSchema).optional(),
});

const SUBMIT_SECURITY_FINDINGS_TOOL = {
  name: "submit_security_findings",
  description: "Submit the identified production security risks.",
  input_schema: {
    type: "object" as const,
    properties: {
      findings: findingsArrayJsonSchema,
    },
    required: ["findings"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are the Security Agent in a multi-agent software architecture assistant. \
You receive structured facts about a repository from the Code Agent (not the repository itself) \
and identify concrete production security risks — specific to what the Code Agent actually found, \
not generic advice that would apply to any app.

Below are excerpts retrieved from a security checklist, relevant to this task. Use them to decide \
what counts as a real finding vs. noise (e.g. they'll tell you a dependency being a few versions \
behind isn't a finding on its own, but a disabled TLS check is).

Only report a finding you can tie to something in the Code Agent's facts (e.g. its "issues" list, \
missing "authentication", a specific "external_services" entry). If nothing concerning stands out, \
return an empty findings array rather than inventing filler.

Call submit_security_findings with what you find.`;

// Canonical queries against the security collection — a stand-in for the
// model choosing its own retrieval queries, matching README.md § 4.
const RETRIEVAL_QUERIES = [
  "where are secrets stored",
  "how is authentication implemented",
  "are user inputs validated",
  "is there rate limiting",
  "is the database publicly accessible",
  "IAM least privilege",
];

function buildUserPrompt(
  task: string,
  codeFacts: CodeFacts | null,
  checklist: { sourcePath: string; content: string }[],
): string {
  const factsBlock = codeFacts
    ? JSON.stringify(codeFacts, null, 2)
    : "(no Code Agent findings available — return an empty findings array and note the gap is not assessable)";

  const checklistBlock = checklist
    .map((c) => `--- ${c.sourcePath} ---\n${c.content}`)
    .join("\n\n");

  return `Task: ${task}

Code Agent findings:
${factsBlock}

Security checklist (retrieved):
${checklistBlock || "(no relevant checklist items retrieved)"}`;
}

export const securityAgent: SpecialistAgent = {
  name: "security_agent",
  async run(context: AgentContext): Promise<AgentResult> {
    const codeResult = findResult(context.priorResults, "code_agent");
    const codeFacts = (codeResult?.data as CodeFacts | undefined) ?? null;

    const checklist = await retrieveKnowledge({
      collection: "security",
      namespace: "global",
      queries: [...RETRIEVAL_QUERIES, context.task],
    });

    const input = await callClaudeTool({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(
        context.task,
        codeFacts,
        checklist.map((c) => ({
          sourcePath: c.sourcePath,
          content: c.content,
        })),
      ),
      tool: SUBMIT_SECURITY_FINDINGS_TOOL,
      maxTokens: 2048,
    });

    const parsed = findingsSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(
        `security_agent: model returned invalid findings: ${parsed.error.message}`,
      );
    }

    const data: SecurityFindings = { findings: parsed.data.findings ?? [] };
    const summary =
      data.findings.length > 0
        ? `${data.findings.length} security finding(s): ${data.findings.map((f) => f.title).join("; ")}`
        : "No security findings.";

    return {
      agent: "security_agent",
      task: context.task,
      summary,
      data,
    };
  },
};
