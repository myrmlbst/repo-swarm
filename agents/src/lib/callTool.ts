import { anthropic } from "./anthropicClient";
import { env } from "../env";

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    // strict mode (see callClaudeTool) requires this explicitly on every
    // object schema, including nested ones inside `properties` — always
    // pass false.
    additionalProperties: boolean;
  };
}

/**
 * Calls Claude with a single tool and forces it, so the response is always
 * that tool's structured input rather than free text. Callers validate the
 * returned value against their own schema.
 */
export async function callClaudeTool(params: {
  system: string;
  user: string;
  tool: ToolSpec;
  maxTokens?: number;
}): Promise<unknown> {
  const message = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: params.maxTokens ?? 1536,
    system: params.system,
    // strict: true makes the API guarantee the response matches
    // input_schema (all `required` fields present, correct types) instead
    // of just hinting at it — without this, a forced tool call can still
    // come back missing a "required" field.
    tools: [{ ...params.tool, strict: true }],
    tool_choice: { type: "tool", name: params.tool.name },
    messages: [{ role: "user", content: params.user }],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Claude did not call the "${params.tool.name}" tool`);
  }

  return toolUse.input;
}
