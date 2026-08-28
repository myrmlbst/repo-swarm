# Database Exposure

A production database should never be directly reachable from the public internet — only from the
application tier that's authorized to query it.

What to look for:

- A database connection string pointing at a publicly resolvable hostname/IP with no indication of
  network-level restriction (e.g. a managed DB configured with public accessibility enabled).
- Database credentials with broad privileges (admin/superuser) used by the application for routine
  queries, instead of a scoped role.
- No indication of network isolation (private subnet, security group restricted to the app tier) in
  the deployment configuration.

What's fine: a database reachable only from within a private network boundary, with the application
using scoped, least-privilege credentials.
