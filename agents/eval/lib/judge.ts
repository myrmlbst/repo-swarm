import { z } from "zod";
import { callClaudeTool } from "../../src/lib/callTool";

const judgeSchema = z.object({
  expected_matches: z.array(
    z.object({
      expected_index: z.number(),
      matched: z.boolean(),
    }),
  ),
  actual_matches: z.array(
    z.object({
      actual_index: z.number(),
      supported_by_expected: z.boolean(),
    }),
  ),
});

const SCORE_TOOL = {
  name: "score_findings",
  description:
    "Score how well the actual findings cover the hand-labeled expected findings.",
  input_schema: {
    type: "object" as const,
    properties: {
      expected_matches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            expected_index: { type: "number" },
            matched: {
              type: "boolean",
              description:
                "true if some actual finding conveys this same underlying issue.",
            },
          },
          required: ["expected_index", "matched"],
          additionalProperties: false,
        },
      },
      actual_matches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            actual_index: { type: "number" },
            supported_by_expected: {
              type: "boolean",
              description:
                "true if this finding corresponds to one of the expected findings.",
            },
          },
          required: ["actual_index", "supported_by_expected"],
          additionalProperties: false,
        },
      },
    },
    required: ["expected_matches", "actual_matches"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are grading a security/architecture agent's findings against a \
hand-labeled ground-truth list, for a precision/recall eval. Match on the underlying issue, not \
exact wording — "hardcoded API key in source" and "OpenAI key is hardcoded in index.js" describe \
the same issue.

For each EXPECTED finding, mark "matched": true if ANY actual finding conveys that same issue.
For each ACTUAL finding, mark "supported_by_expected": true if it corresponds to one of the \
expected findings — an actual finding about something not on the expected list is unsupported for \
this scoring exercise, even if it's a reasonable observation on its own.

Call score_findings with your judgment.`;

export interface JudgeResult {
  recall: number;
  precision: number;
  matchedExpectedCount: number;
  totalExpected: number;
  supportedActualCount: number;
  totalActual: number;
  unmatchedExpected: string[];
  unsupportedActual: string[];
}

export async function scoreFindings(
  expected: string[],
  actual: string[],
): Promise<JudgeResult> {
  if (expected.length === 0) {
    throw new Error("scoreFindings: expected findings list must not be empty");
  }

  if (actual.length === 0) {
    return {
      recall: 0,
      precision: 1, // vacuously true — no actual findings means no false positives either
      matchedExpectedCount: 0,
      totalExpected: expected.length,
      supportedActualCount: 0,
      totalActual: 0,
      unmatchedExpected: expected,
      unsupportedActual: [],
    };
  }

  const user = `Expected findings:
${expected.map((f, i) => `${i}. ${f}`).join("\n")}

Actual findings:
${actual.map((f, i) => `${i}. ${f}`).join("\n")}`;

  const { input } = await callClaudeTool({
    system: SYSTEM_PROMPT,
    user,
    tool: SCORE_TOOL,
    maxTokens: 2048,
  });

  const parsed = judgeSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `scoreFindings: judge returned invalid output: ${parsed.error.message}`,
    );
  }

  const matchedExpectedCount = parsed.data.expected_matches.filter(
    (m) => m.matched,
  ).length;
  const supportedActualCount = parsed.data.actual_matches.filter(
    (m) => m.supported_by_expected,
  ).length;

  const unmatchedExpected = parsed.data.expected_matches
    .filter((m) => !m.matched)
    .map((m) => expected[m.expected_index])
    .filter((f): f is string => f !== undefined);

  const unsupportedActual = parsed.data.actual_matches
    .filter((m) => !m.supported_by_expected)
    .map((m) => actual[m.actual_index])
    .filter((f): f is string => f !== undefined);

  return {
    recall: matchedExpectedCount / expected.length,
    precision: supportedActualCount / actual.length,
    matchedExpectedCount,
    totalExpected: expected.length,
    supportedActualCount,
    totalActual: actual.length,
    unmatchedExpected,
    unsupportedActual,
  };
}
