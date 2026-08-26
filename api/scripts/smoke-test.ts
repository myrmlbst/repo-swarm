/**
 * End-to-end smoke test against a running dev server + real Supabase project.
 * Creates a throwaway confirmed user, exercises every route, cleans up after itself.
 *
 * Usage: npm run dev (in one terminal), then npm run smoke-test (in another).
 */
import { createClient } from "@supabase/supabase-js";
import { env } from "../src/env";

interface MeResponse {
  id: string;
  email: string | null;
  authMethod: "session" | "api_key";
}
interface AnalysisResponse {
  id: string;
  status: string;
}
interface AnalysesListResponse {
  analyses: { id: string }[];
}
interface ApiKeyCreateResponse {
  id: string;
  key: string;
}
interface ApiKeysListResponse {
  api_keys: Record<string, unknown>[];
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

const API_BASE = process.env.API_BASE ?? `http://localhost:${env.PORT}`;

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed++;
    console.log(`ok   - ${label}`);
  } else {
    failed++;
    console.error(`FAIL - ${label}`, detail ?? "");
  }
}

async function main(): Promise<void> {
  const email = `smoke-test-${Date.now()}@example.com`;
  const password = "Sm0keTest!23456";
  let userId: string | undefined;

  try {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    check("create test user", !createErr && !!created?.user, createErr);
    userId = created?.user?.id;
    if (!userId) throw new Error("cannot continue without a test user");

    const { data: session, error: signInErr } =
      await anon.auth.signInWithPassword({
        email,
        password,
      });
    check(
      "sign in as test user",
      !signInErr && !!session?.session?.access_token,
      signInErr,
    );
    const token = session?.session?.access_token;
    if (!token) throw new Error("cannot continue without a session token");

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const noAuth = await fetch(`${API_BASE}/v1/me`);
    check("GET /v1/me without auth -> 401", noAuth.status === 401);

    const me = await fetch(`${API_BASE}/v1/me`, { headers: authHeaders });
    const meBody = await json<MeResponse>(me);
    check(
      "GET /v1/me -> 200 with matching id",
      me.status === 200 && meBody.id === userId,
      meBody,
    );

    const badRepo = await fetch(`${API_BASE}/v1/analyses`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ repo_url: "https://gitlab.com/octocat/hello" }),
    });
    check("POST /v1/analyses non-github url -> 400", badRepo.status === 400);

    const createAnalysis = await fetch(`${API_BASE}/v1/analyses`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        repo_url: "https://github.com/octocat/Hello-World",
      }),
    });
    const analysisBody = await json<AnalysisResponse>(createAnalysis);
    check(
      "POST /v1/analyses -> 201 queued",
      createAnalysis.status === 201 && analysisBody.status === "queued",
      analysisBody,
    );

    const list = await fetch(`${API_BASE}/v1/analyses`, {
      headers: authHeaders,
    });
    const listBody = await json<AnalysesListResponse>(list);
    check(
      "GET /v1/analyses includes created id",
      list.status === 200 &&
        listBody.analyses?.some(
          (a: { id: string }) => a.id === analysisBody.id,
        ),
      listBody,
    );

    const single = await fetch(`${API_BASE}/v1/analyses/${analysisBody.id}`, {
      headers: authHeaders,
    });
    check("GET /v1/analyses/:id -> 200", single.status === 200);

    const missing = await fetch(
      `${API_BASE}/v1/analyses/00000000-0000-0000-0000-000000000000`,
      { headers: authHeaders },
    );
    check("GET /v1/analyses/:id unknown -> 404", missing.status === 404);

    const createKey = await fetch(`${API_BASE}/v1/api-keys`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "smoke-test-key" }),
    });
    const keyBody = await json<ApiKeyCreateResponse>(createKey);
    check(
      "POST /v1/api-keys -> 201 with full key",
      createKey.status === 201 && typeof keyBody.key === "string",
      keyBody,
    );

    const apiKeyHeaders = {
      Authorization: `Bearer ${keyBody.key}`,
      "Content-Type": "application/json",
    };

    const meViaKey = await fetch(`${API_BASE}/v1/me`, {
      headers: apiKeyHeaders,
    });
    const meViaKeyBody = await json<MeResponse>(meViaKey);
    check(
      "GET /v1/me via api key -> matching id, authMethod api_key",
      meViaKey.status === 200 &&
        meViaKeyBody.id === userId &&
        meViaKeyBody.authMethod === "api_key",
      meViaKeyBody,
    );

    const keyViaKey = await fetch(`${API_BASE}/v1/api-keys`, {
      method: "POST",
      headers: apiKeyHeaders,
      body: JSON.stringify({ name: "should-fail" }),
    });
    check("POST /v1/api-keys via api key -> 403", keyViaKey.status === 403);

    const listKeys = await fetch(`${API_BASE}/v1/api-keys`, {
      headers: authHeaders,
    });
    const listKeysBody = await json<ApiKeysListResponse>(listKeys);
    const found = listKeysBody.api_keys?.find((k) => k.id === keyBody.id);
    check(
      "GET /v1/api-keys hides full key",
      listKeys.status === 200 &&
        !!found &&
        !("key" in found) &&
        !("key_hash" in found),
      listKeysBody,
    );

    const revoke = await fetch(`${API_BASE}/v1/api-keys/${keyBody.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    check("DELETE /v1/api-keys/:id -> 204", revoke.status === 204);

    const afterRevoke = await fetch(`${API_BASE}/v1/me`, {
      headers: apiKeyHeaders,
    });
    check("revoked api key -> 401", afterRevoke.status === 401);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
