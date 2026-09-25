import { z } from "zod";

export const findingSchema = z.object({
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warn", "critical"]),
  sources: z.array(z.string()).optional().default([]),
});

export const findingsArrayJsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      detail: { type: "string" },
      severity: { type: "string", enum: ["info", "warn", "critical"] },
      sources: {
        type: "array",
        items: { type: "string" },
        description:
          "Exact file/doc paths (from the '--- path ---' headers of the excerpts you were given) that support this finding. Empty if it isn't tied to a specific excerpt.",
      },
    },
    required: ["title", "detail", "severity", "sources"],
    additionalProperties: false,
  },
};
