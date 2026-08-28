# ElastiCache (Redis)

ElastiCache Redis is a managed in-memory store, used for caching, session/job state, or rate-limit
counters.

When it fits: the application has an actual caching need (repeated expensive reads), session state
that needs to be shared across multiple app instances, or rate limiting that needs to work correctly
when the app runs as more than one instance (an in-memory counter per instance doesn't enforce a
real limit).

Practical notes:

- Don't add Redis just because it's a common piece of "production" infrastructure — if nothing in
  the application reads/writes a cache or shared counter today, it's not a real requirement yet.
- Like RDS, keep it in a private subnet, not publicly accessible.
- For rate limiting specifically: `INCR` + `EXPIRE` on a key per client/API-key is the standard
  pattern, and it's the reason rate limiting needs a shared store once there's more than one app
  instance — in-process counters silently stop working correctly under horizontal scaling.
