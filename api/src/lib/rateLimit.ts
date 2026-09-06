import type { FastifyReply, FastifyRequest } from "fastify";
import { redis } from "./redisClient";
import { identityFor, identityKey } from "./identity";
import { env } from "../env";

const WINDOW_SECONDS = 60;

/**
 * Fastify preHandler: must run after requireAuth (reads request.user).
 * Redis INCR + EXPIRE per identity per rolling minute — a shared counter,
 * not an in-memory one, since the app needs to run as more than one
 * instance (DESIGNDOC.md § 5).
 */
export async function rateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user) return; // requireAuth already short-circuited with 401

  const key = `ratelimit:${identityKey(identityFor(request.user))}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  if (count > env.RATE_LIMIT_PER_MINUTE) {
    const ttl = await redis.ttl(key);
    await reply
      .code(429)
      .header("Retry-After", String(ttl > 0 ? ttl : WINDOW_SECONDS))
      .send({ error: "Rate limit exceeded" });
  }
}
