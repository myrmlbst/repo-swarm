/**
 * Testing quota at its real default (50/month) would mean 51 real requests
 * — and since the default rate limit (30/min) is lower than that, the rate
 * limiter would trip first and the quota limit would never actually be
 * reached. So this file overrides both env vars (raise the rate limit out
 * of the way, lower the quota so the test is fast) before anything else is
 * imported — `require` (this project compiles to CommonJS) runs in program
 * order, unlike a hoisted `import`, so the env vars are set in time for
 * `env.ts`'s `dotenv`/zod parsing to pick them up. Node's test runner runs
 * each file in its own process, so this doesn't affect any other test file.
 */
process.env.RATE_LIMIT_PER_MINUTE = "1000";
process.env.ANALYSES_QUOTA_PER_MONTH = "3";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildApp } = require("../app") as typeof import("../app");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { env } = require("../env") as typeof import("../env");

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
  assert.equal(
    env.ANALYSES_QUOTA_PER_MONTH,
    3,
    "env override didn't take effect",
  );

  const email = `quota-test-${Date.now()}@example.com`;
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

test(`allows up to ${3} analyses this period, then rejects with 429 + Retry-After`, async () => {
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const payload = { repo_url: "https://github.com/octocat/Hello-World" };

  for (let i = 1; i <= env.ANALYSES_QUOTA_PER_MONTH; i++) {
    const res = await app.inject({
      method: "POST",
      url: "/v1/analyses",
      headers,
      payload,
    });
    assert.equal(
      res.statusCode,
      201,
      `analysis ${i} of ${env.ANALYSES_QUOTA_PER_MONTH} should be under quota`,
    );
  }

  const overQuota = await app.inject({
    method: "POST",
    url: "/v1/analyses",
    headers,
    payload,
  });
  assert.equal(overQuota.statusCode, 429);
  assert.equal(overQuota.json().error, "Monthly analysis quota exceeded");
  assert.ok(Number(overQuota.headers["retry-after"]) > 0);
});
