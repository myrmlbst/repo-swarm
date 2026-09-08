import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { buildApp } from "../app";
import { env } from "../env";

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const app = buildApp();
let userId: string;
let token: string;

before(async () => {
  const email = `ratelimit-test-${Date.now()}@example.com`;
  const password = "T3stPassword!23456";

  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
    },
  );
  if (createErr || !created?.user) {
    throw new Error(`setup: create test user failed: ${createErr?.message}`);
  }
  userId = created.user.id;

  const { data: session, error: signInErr } =
    await anon.auth.signInWithPassword({
      email,
      password,
    });
  if (signInErr || !session?.session?.access_token) {
    throw new Error(`setup: sign in failed: ${signInErr?.message}`);
  }
  token = session.session.access_token;
});

after(async () => {
  await app.close();
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test(`allows up to ${env.RATE_LIMIT_PER_MINUTE} requests/minute, then rejects with 429 + Retry-After`, async () => {
  const headers = { authorization: `Bearer ${token}` };

  // GET /v1/me touches no quota, so this exercises rate limiting in
  // isolation using the real configured limit.
  for (let i = 1; i <= env.RATE_LIMIT_PER_MINUTE; i++) {
    const res = await app.inject({ method: "GET", url: "/v1/me", headers });
    assert.equal(
      res.statusCode,
      200,
      `request ${i} of ${env.RATE_LIMIT_PER_MINUTE} should be under the limit`,
    );
  }

  const limited = await app.inject({ method: "GET", url: "/v1/me", headers });
  assert.equal(limited.statusCode, 429);
  const retryAfter = Number(limited.headers["retry-after"]);
  assert.ok(
    retryAfter > 0 && retryAfter <= 60,
    `expected a sane Retry-After, got ${retryAfter}`,
  );
});
