import { z } from "zod";

export const findingSchema = z.object({
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warn", "critical"]),
});

export const findingsArrayJsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string" },
      detail: { type: "string" },
      severity: { type: "string", enum: ["info", "warn", "critical"] },
    },
    required: ["title", "detail", "severity"],
    additionalProperties: false,
  },
};
