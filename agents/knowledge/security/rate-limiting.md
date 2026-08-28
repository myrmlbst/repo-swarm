# Rate Limiting

Public endpoints without rate limiting are exposed to abuse: brute-force attempts against login
routes, scraping, or basic denial-of-service via request volume.

What to look for:

- No rate-limiting middleware configured anywhere in the app (e.g. no `express-rate-limit` or
  equivalent, no gateway-level throttling).
- Rate limiting present but scoped to a single process/instance (an in-memory counter) — this stops
  enforcing a real limit once the app runs as more than one instance, since each instance has its
  own counter.
- Especially notable on authentication endpoints (login, password reset, token issuance), which are
  the highest-value targets for brute-forcing.

What's fine: rate limiting backed by a shared store (e.g. Redis `INCR`/`EXPIRE`) so the limit holds
across instances, or a platform/gateway-level rate limit in front of the app.
