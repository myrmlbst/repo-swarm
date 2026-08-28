# IAM / Cloud Permissions

Overly broad cloud permissions turn a small compromise (one leaked credential, one vulnerable
dependency) into a much bigger one, because the compromised identity can do far more than the
application actually needs.

What to look for:

- A single IAM role/service account used across multiple unrelated services or functions, rather
  than one scoped role per service.
- Policies granting `*` on actions or resources where a specific action/ARN would do (e.g.
  `s3:*` on all buckets instead of read access to one specific bucket).
- Admin-level managed policies attached to something that runs application code, rather than only to
  human/break-glass access.

What's fine: a role scoped to exactly the actions and resources a given service needs, nothing more.
