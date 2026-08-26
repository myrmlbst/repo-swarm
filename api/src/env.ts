import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  ALLOWED_ORIGINS: z
    .string()
    .default(
      "http://localhost:3000,http://localhost:3001,http://localhost:3100",
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = {
  ...parsed.data,
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(",").map((origin) =>
    origin.trim(),
  ),
};
