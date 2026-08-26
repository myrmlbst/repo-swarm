import { randomBytes, createHash } from "node:crypto";

const KEY_PREFIX = "rsw_live_";

/** A freshly generated key, shown to the user exactly once. */
export interface GeneratedApiKey {
  fullKey: string;
  keyPrefix: string;
  keyHash: string;
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(24).toString("base64url");
  const fullKey = `${KEY_PREFIX}${secret}`;
  return {
    fullKey,
    keyPrefix: fullKey.slice(0, KEY_PREFIX.length + 6),
    keyHash: hashApiKey(fullKey),
  };
}

export function hashApiKey(fullKey: string): string {
  return createHash("sha256").update(fullKey).digest("hex");
}

export function looksLikeApiKey(token: string): boolean {
  return token.startsWith(KEY_PREFIX);
}
