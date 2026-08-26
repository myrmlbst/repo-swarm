import type { FastifyInstance } from "fastify";
import { requireAuth } from "../lib/auth";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/me",
    { preHandler: requireAuth },
    async (request) => request.user,
  );
}
