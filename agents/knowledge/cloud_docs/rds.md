# RDS (Postgres/MySQL)

RDS is a managed relational database — AWS handles patching, backups, and failover; you manage
schema, credentials, and access.

When it fits: the application uses Postgres, MySQL, or another RDS-supported engine as its primary
datastore. Don't provision RDS speculatively for an app with no database usage in its code.

Practical notes:

- **Never publicly accessible.** RDS should sit in a private subnet with a security group that only
  allows inbound connections from the application's own security group (e.g. the ECS service), not
  `0.0.0.0/0`.
- Credentials belong in **Secrets Manager**, injected into the application at runtime — not in
  environment variables set directly in a task definition, and never in source code.
- Enable automated backups and, for anything beyond a toy deployment, Multi-AZ for failover.
- Use least-privilege database credentials for the application (a role scoped to the schemas/tables
  it actually needs), separate from an admin/migration credential.
