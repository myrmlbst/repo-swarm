# API Reference

Covers the application layer implemented so far in [`api/`](../api) — auth, analyses, and API keys. No agent/orchestrator endpoints exist yet (see [README.md § Current implementation status](../README.md#current-implementation-status)).

Base URL (local dev): `http://localhost:3000`

## Authentication

Every route below except `GET /healthz` requires an `Authorization: Bearer <token>` header. Two kinds of token are accepted, distinguished by prefix:

| Token type  | How to get one                                                                                                                                                                                        | Looks like                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Session JWT | Sign up / log in from the client directly against Supabase Auth (`supabase.auth.signUp`, `signInWithPassword`, or GitHub OAuth) using the project's anon key. This API never issues or proxies these. | Standard Supabase `access_token` |
| API key     | `POST /v1/api-keys` (requires a session JWT)                                                                                                                                                          | `rsw_live_...`                   |

A request with a missing, malformed, expired, or revoked token gets `401 { "error": "..." }`.

API keys can only be _created_ with a session JWT, not with another API key (prevents key chains). All other routes accept either token type interchangeably.

---

## `GET /healthz`

Liveness check. No auth.

**Response `200`**

```json
{ "ok": true }
```

---

## `GET /v1/me`

Returns the identity resolved from the bearer token. Useful for confirming auth is wired up correctly.

**Response `200`**

```json
{ "id": "uuid", "email": "user@example.com", "authMethod": "session" }
```

`authMethod` is `"session"` or `"api_key"`.

---

## `POST /v1/analyses`

Submit a GitHub repository for analysis. Only inserts a `queued` row — nothing processes it yet.

**Body**

```json
{ "repo_url": "https://github.com/octocat/Hello-World" }
```

`repo_url` must be a valid URL on `github.com`.

**Response `201`**

```json
{ "id": "uuid", "status": "queued" }
```

**Errors**

- `400` — `repo_url` missing or not a `github.com` URL
- `401` — missing/invalid auth
- `500` — insert failed

---

## `GET /v1/analyses`

List the caller's own analyses, newest first.

**Response `200`**

```json
{
  "analyses": [
    {
      "id": "uuid",
      "repo_url": "https://github.com/octocat/Hello-World",
      "status": "queued",
      "created_at": "2026-08-26T12:00:00.000Z",
      "completed_at": null
    }
  ]
}
```

---

## `GET /v1/analyses/:id`

Fetch one analysis. Scoped to the caller — an analysis belonging to another user returns `404`, same as a nonexistent id.

**Response `200`**

```json
{
  "id": "uuid",
  "repo_url": "https://github.com/octocat/Hello-World",
  "status": "queued",
  "created_at": "2026-08-26T12:00:00.000Z",
  "completed_at": null
}
```

**Errors**

- `404` — not found, or not owned by the caller

---

## `POST /v1/api-keys`

Mint a new API key. **Requires a session JWT** (not an existing API key). The full key is returned exactly once — only its SHA-256 hash is stored, so it can't be recovered later.

**Body**

```json
{ "name": "CI pipeline" }
```

**Response `201`**

```json
{
  "id": "uuid",
  "name": "CI pipeline",
  "key_prefix": "rsw_live_ab12cd",
  "created_at": "2026-08-26T12:00:00.000Z",
  "key": "rsw_live_ab12cd...full-secret...xyz"
}
```

Save `key` now — it will not be shown again. Subsequent listings only ever include `key_prefix`.

**Errors**

- `403` — caller authenticated with an API key instead of a session JWT
- `400` — `name` missing or invalid

---

## `GET /v1/api-keys`

List the caller's own API keys (never includes the full key or its hash).

**Response `200`**

```json
{
  "api_keys": [
    {
      "id": "uuid",
      "name": "CI pipeline",
      "key_prefix": "rsw_live_ab12cd",
      "created_at": "2026-08-26T12:00:00.000Z",
      "revoked_at": null
    }
  ]
}
```

---

## `DELETE /v1/api-keys/:id`

Revoke an API key (sets `revoked_at`; the row is kept, not deleted). A revoked key immediately fails auth on all routes.

**Response `204`** — empty body

**Errors**

- `404` — not found, or not owned by the caller

---

## Error shape

Non-2xx responses are JSON. Validation errors (`400`) return Zod's field-error map; everything else returns a single message:

```json
{ "error": "Invalid or expired session token" }
```

```json
{ "error": { "repo_url": ["Invalid url"] } }
```
