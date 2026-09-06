import type { AuthUser } from "./auth";

/**
 * What rate limits/quotas are keyed on: an API key when the request used
 * one, otherwise the logged-in user (covers session-based web dashboard
 * usage, which has no api_key_id to key on).
 */
export type Identity =
  { kind: "api_key"; apiKeyId: string } | { kind: "user"; userId: string };

export function identityFor(user: AuthUser): Identity {
  return user.authMethod === "api_key" && user.apiKeyId
    ? { kind: "api_key", apiKeyId: user.apiKeyId }
    : { kind: "user", userId: user.id };
}

export function identityKey(identity: Identity): string {
  return identity.kind === "api_key"
    ? `api_key:${identity.apiKeyId}`
    : `user:${identity.userId}`;
}
