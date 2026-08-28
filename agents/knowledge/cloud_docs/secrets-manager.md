# Secrets Manager

Secrets Manager stores credentials (DB passwords, API keys, third-party tokens) and lets services
retrieve them at runtime instead of having them baked into images, task definitions, or source code.

When it fits: any deployment that has real secrets — a database password, an external API key, a
signing key. If an app's only "config" is something like `PORT`, there's nothing to put here yet,
but the pattern is worth establishing early so the first real secret has an obvious home.

Practical notes:

- ECS tasks can reference a secret directly in the task definition (`secrets` field), which injects
  it as an environment variable at container start — the value itself never appears in the task
  definition or in `docker inspect`.
- Rotate secrets (Secrets Manager supports automatic rotation for RDS credentials natively) rather
  than treating them as set-once-forget.
- IAM controls who/what can read a given secret — grant the specific ECS task role read access to
  the specific secret it needs, not blanket `secretsmanager:GetSecretValue` on `*`.
