import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "./env";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import { analysisRoutes } from "./routes/analyses";
import { apiKeyRoutes } from "./routes/apiKeys";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: env.allowedOrigins,
  });

  // A bodyless request (e.g. DELETE) with `Content-Type: application/json` is
  // a normal thing for HTTP clients to send. Fastify's default parser 400s on
  // it; treat an empty body as "no body" instead of rejecting the request.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      if (body === "") {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.register(healthRoutes);
  app.register(meRoutes);
  app.register(analysisRoutes);
  app.register(apiKeyRoutes);

  return app;
}
