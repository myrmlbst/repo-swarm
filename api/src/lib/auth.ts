import type { FastifyReply, FastifyRequest } from "fastify";
import { supabaseAdmin } from "./supabaseAdmin";
import { hashApiKey, looksLikeApiKey } from "./apiKeys";

export interface AuthUser {
  id: string;
  email: string | null;
  authMethod: "session" | "api_key";
  /** The api_keys row id — set only when authMethod is "api_key". Used to key rate limits/quotas per key rather than per user. */
  apiKeyId?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

class AuthError extends Error {}

function extractBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AuthError("Missing or malformed Authorization header");
  }
  return header.slice("Bearer ".length).trim();
}

async function resolveApiKey(token: string): Promise<AuthUser> {
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();

  if (error || !data || data.revoked_at) {
    throw new AuthError("Invalid or revoked API key");
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.admin.getUserById(data.user_id);
  if (userError || !userData?.user) {
    throw new AuthError("API key's user no longer exists");
  }

  return {
    id: userData.user.id,
    email: userData.user.email ?? null,
    authMethod: "api_key",
    apiKeyId: data.id,
  };
}

async function resolveSession(token: string): Promise<AuthUser> {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw new AuthError("Invalid or expired session token");
  }
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    authMethod: "session",
  };
}

export async function authenticate(request: FastifyRequest): Promise<AuthUser> {
  const token = extractBearerToken(request);
  return looksLikeApiKey(token) ? resolveApiKey(token) : resolveSession(token);
}

/** Fastify preHandler: populates request.user or short-circuits with 401. */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    request.user = await authenticate(request);
  } catch (err) {
    const message = err instanceof AuthError ? err.message : "Unauthorized";
    await reply.code(401).send({ error: message });
  }
}
