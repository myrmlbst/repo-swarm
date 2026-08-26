import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAuth } from "../lib/auth";

const createAnalysisSchema = z.object({
  repo_url: z
    .string()
    .url()
    .refine((url) => new URL(url).hostname === "github.com", {
      message: "repo_url must be a github.com repository URL",
    }),
});

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/analyses",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = createAnalysisSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.flatten().fieldErrors });
      }

      const { data, error } = await supabaseAdmin
        .from("analyses")
        .insert({
          user_id: request.user!.id,
          repo_url: parsed.data.repo_url,
          status: "queued",
        })
        .select("id, status")
        .single();

      if (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Failed to create analysis" });
      }

      return reply.code(201).send(data);
    },
  );

  app.get(
    "/v1/analyses",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("analyses")
        .select("id, repo_url, status, created_at, completed_at")
        .eq("user_id", request.user!.id)
        .order("created_at", { ascending: false });

      if (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Failed to list analyses" });
      }

      return reply.send({ analyses: data });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/v1/analyses/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("analyses")
        .select("id, repo_url, status, created_at, completed_at")
        .eq("id", request.params.id)
        .eq("user_id", request.user!.id)
        .maybeSingle();

      if (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch analysis" });
      }
      if (!data) {
        return reply.code(404).send({ error: "Analysis not found" });
      }

      return reply.send(data);
    },
  );
}
