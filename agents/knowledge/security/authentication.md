# Authentication

Every route that should require a logged-in user or a valid API credential needs to actually verify
one — not just assume the caller is who they claim to be.

What to look for:

- Routes that read/modify user-specific data without checking a session token, JWT, or API key
  first.
- Auth middleware that's applied inconsistently — present on some routes, missing on others that
  handle equally sensitive data.
- A token/credential that's checked for _presence_ but not _validity_ (e.g. accepting any
  non-empty `Authorization` header without verifying a signature or looking it up).

What's fine: a consistent auth middleware/guard applied to every protected route, verified against a
real signature (JWT) or a real lookup (API key hash comparison). A public route with genuinely public
data (e.g. a health check) legitimately needs no auth — that's not a finding.
