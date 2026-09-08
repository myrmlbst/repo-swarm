import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAuth } from "../lib/auth";
import { rateLimit } from "../lib/rateLimit";
import { identityFor } from "../lib/identity";
import { checkAndIncrementQuota } from "../lib/quota";
import { redis } from "../lib/redisClient";

// Must match the key agents/src/worker.ts pops from — the two packages
// don't share code, so this is duplicated by name, not import.
const QUEUE_KEY = "analysis_queue";

const createAnalysisSchema = z.object({
  repo_url: z
    .string()
    .url()
    .refine((url) => new URL(url).hostname === "github.com", {
      message: "repo_url must be a github.com repository URL",
    }),
});

const ANALYSIS_COLUMNS =
  "id, repo_url, status, proposal, review_approved, created_at, completed_at";

/** Returns true if `analysisId` exists and belongs to `userId`. */
async function ownsAnalysis(
  userId: string,
  analysisId: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("analyses")
    .select("id")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/analyses",
    { preHandler: [requireAuth, rateLimit] },
    async (request, reply) => {
      const parsed = createAnalysisSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.flatten().fieldErrors });
      }

      const quota = await checkAndIncrementQuota(identityFor(request.user!));
      if (!quota.allowed) {
        return reply
          .code(429)
          .header("Retry-After", String(quota.retryAfterSeconds))
          .send({ error: "Monthly analysis quota exceeded" });
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

      try {
        await redis.lpush(QUEUE_KEY, data.id);
      } catch (err) {
        // The analysis row exists either way; log loudly since a failed
        // push means it'll sit "queued" forever with nothing to pick it up.
        request.log.error(
          err,
          `failed to queue analysis ${data.id} for processing`,
        );
      }

      return reply.code(201).send(data);
    },
  );

  app.get(
    "/v1/analyses",
    { preHandler: [requireAuth, rateLimit] },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("analyses")
        .select(ANALYSIS_COLUMNS)
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
    { preHandler: [requireAuth, rateLimit] },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("analyses")
        .select(ANALYSIS_COLUMNS)
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

  app.get<{ Params: { id: string } }>(
    "/v1/analyses/:id/findings",
    { preHandler: [requireAuth, rateLimit] },
    async (request, reply) => {
      if (!(await ownsAnalysis(request.user!.id, request.params.id))) {
        return reply.code(404).send({ error: "Analysis not found" });
      }

      const { data, error } = await supabaseAdmin
        .from("findings")
        .select(
          "id, agent_name, severity, title, detail, source_refs, disputed, created_at",
        )
        .eq("analysis_id", request.params.id)
        .order("created_at", { ascending: true });

      if (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch findings" });
      }

      return reply.send({ findings: data });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/v1/analyses/:id/trace",
    { preHandler: [requireAuth, rateLimit] },
    async (request, reply) => {
      if (!(await ownsAnalysis(request.user!.id, request.params.id))) {
        return reply.code(404).send({ error: "Analysis not found" });
      }

      const { data, error } = await supabaseAdmin
        .from("analysis_runs")
        .select(
          "id, agent_name, status, error, tokens_used, cost_usd, retrieval_count, started_at, finished_at",
        )
        .eq("analysis_id", request.params.id)
        .order("started_at", { ascending: true });

      if (error) {
        request.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch trace" });
      }

      return reply.send({ runs: data });
    },
  );
}
