import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAuth } from "../lib/auth";
import { rateLimit } from "../lib/rateLimit";
import { generateApiKey } from "../lib/apiKeys";

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
});

export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  // Only a logged-in session (not another API key) may mint new API keys.
  app.post(
    "/v1/api-keys",
    { preHandler: [requireAuth, rateLimit] },
    async (request, reply) => {
      if (request.user!.authMethod !== "session") {
        return reply.code(403).send({
          error: "API keys can only be created from a logged-in session",
        });
      }

      const parsed = createApiKeySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.flatten().fieldErrors });
      }

      const generated = generateApiKey();

      const { data, error } = await supabaseAdmin
        .from("api_keys")
        .insert({
          user_id: request.user!.id,
          name: parsed.data.name,
          key_hash: generated.keyHash,
          key_prefix: generated.keyPrefix,
        })
        .select("id, name, key_prefix, created_at")
        .single();

      if (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Failed to create API key" });
      }

      // fullKey is only ever returned here; only the hash is stored.
      return reply.code(201).send({ ...data, key: generated.fullKey });
    },
  );

  app.get(
    "/v1/api-keys",
    { preHandler: [requireAuth, rateLimit] },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("api_keys")
        .select("id, name, key_prefix, created_at, revoked_at")
        .eq("user_id", request.user!.id)
        .order("created_at", { ascending: false });

      if (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Failed to list API keys" });
      }

      return reply.send({ api_keys: data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/v1/api-keys/:id",
    { preHandler: [requireAuth, rateLimit] },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", request.params.id)
        .eq("user_id", request.user!.id)
        .select("id")
        .maybeSingle();

      if (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Failed to revoke API key" });
      }
      if (!data) {
        return reply.code(404).send({ error: "API key not found" });
      }

      return reply.code(204).send();
    },
  );
}
