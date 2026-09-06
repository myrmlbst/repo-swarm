import type { FastifyInstance } from "fastify";
import { requireAuth } from "../lib/auth";
import { rateLimit } from "../lib/rateLimit";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/me",
    { preHandler: [requireAuth, rateLimit] },
    async (request) => request.user,
  );
}
