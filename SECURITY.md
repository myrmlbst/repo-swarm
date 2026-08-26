# Security Policy

This is a capstone project, not a project with a formal bug bounty or SLA, but if you find a real security issue, please report it responsibly rather than opening a public issue.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: open the **Security** tab on this repo -> **Report a vulnerability**. That creates a private advisory only visible to the maintainer, instead
of a public issue.

## Scope

Things worth reporting:

- Auth/session handling issues in `api/` (Supabase session JWT verification, API key hashing/lookup)
- Row-level security or query issues that could leak one user's data (`analyses`, `api_keys`) to another user
- Anything that could bypass the guardrails described in [DESIGNDOC.md § 7](DESIGNDOC.md#7-guardrails) once they're implemented, prompt-injection resistance and secret redaction in the agent layer

## Handling secrets

None of `api/.env`, `web/.env.local`, or `agents/.env` are committed (see each package's `.env.example` for what belongs in them). If you ever find a real credential committed to this repo's history, treat it as compromised and report it via the process above rather than opening a public issue that names it.
