/**
 * Route/auth tests via Fastify's app.inject() — calls handlers in-process,
 * no port binding, no separate server process needed (unlike
 * scripts/smoke-test.ts, which is the same coverage but against a real
 * running server + real HTTP, useful as a final end-to-end sanity check).
 * Still hits the real Supabase project (a throwaway confirmed user, cleaned
 * up after) — there's no mocking layer in this codebase to fake that with.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { buildApp } from "./app";
import { env } from "./env";

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
  const email = `app-test-${Date.now()}@example.com`;
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

test("GET /v1/me without auth -> 401", async () => {
  const res = await app.inject({ method: "GET", url: "/v1/me" });
  assert.equal(res.statusCode, 401);
});

test("GET /v1/me with a session token -> 200, matching id", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.id, userId);
  assert.equal(body.authMethod, "session");
});

test("POST /v1/analyses rejects a non-github URL -> 400", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/v1/analyses",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: { repo_url: "https://gitlab.com/octocat/hello" },
  });
  assert.equal(res.statusCode, 400);
});

test("POST /v1/analyses creates a queued analysis, listable and fetchable", async () => {
  const create = await app.inject({
    method: "POST",
    url: "/v1/analyses",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: { repo_url: "https://github.com/octocat/Hello-World" },
  });
  assert.equal(create.statusCode, 201);
  const created = create.json();
  assert.equal(created.status, "queued");

  const list = await app.inject({
    method: "GET",
    url: "/v1/analyses",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(list.statusCode, 200);
  assert.ok(
    list.json().analyses.some((a: { id: string }) => a.id === created.id),
  );

  const single = await app.inject({
    method: "GET",
    url: `/v1/analyses/${created.id}`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(single.statusCode, 200);
});

test("GET /v1/analyses/:id for an unknown id -> 404", async () => {
  const res = await app.inject({
    method: "GET",
    url: "/v1/analyses/00000000-0000-0000-0000-000000000000",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 404);
});

test("API keys: mint via session, use via key, session-only creation enforced, revoke works", async () => {
  const createKey = await app.inject({
    method: "POST",
    url: "/v1/api-keys",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: { name: "app-test-key" },
  });
  assert.equal(createKey.statusCode, 201);
  const key = createKey.json();
  assert.equal(typeof key.key, "string");

  const meViaKey = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: `Bearer ${key.key}` },
  });
  assert.equal(meViaKey.statusCode, 200);
  assert.equal(meViaKey.json().authMethod, "api_key");

  const keyViaKey = await app.inject({
    method: "POST",
    url: "/v1/api-keys",
    headers: {
      authorization: `Bearer ${key.key}`,
      "content-type": "application/json",
    },
    payload: { name: "should-fail" },
  });
  assert.equal(keyViaKey.statusCode, 403);

  const listKeys = await app.inject({
    method: "GET",
    url: "/v1/api-keys",
    headers: { authorization: `Bearer ${token}` },
  });
  const found = listKeys
    .json()
    .api_keys.find((k: { id: string }) => k.id === key.id);
  assert.ok(found, "created key should appear in the list");
  assert.ok(
    !("key" in found) && !("key_hash" in found),
    "list must never expose the key/hash",
  );

  const revoke = await app.inject({
    method: "DELETE",
    url: `/v1/api-keys/${key.id}`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(revoke.statusCode, 204);

  const afterRevoke = await app.inject({
    method: "GET",
    url: "/v1/me",
    headers: { authorization: `Bearer ${key.key}` },
  });
  assert.equal(afterRevoke.statusCode, 401);
});
