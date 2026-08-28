# IAM: Least Privilege

IAM roles/policies control what each AWS resource (an ECS task, a Lambda, a CI pipeline) is allowed
to do. Least privilege means granting exactly the permissions a resource needs, not a broad
role reused everywhere.

Practical notes:

- One role per service, not one shared role for "the app." An ECS task role for a service that only
  reads from S3 shouldn't also have RDS or IAM admin permissions just because it's convenient.
- Scope permissions to specific resources (a specific bucket ARN, a specific secret ARN) instead of
  `Resource: "*"` wherever the policy language allows it.
- Separate the **task execution role** (pull image, write CloudWatch logs — needed by ECS itself)
  from the **task role** (what the application code inside the container can do) — they serve
  different purposes and shouldn't be merged into one broad role.
- Avoid attaching AWS managed "Administrator" or "PowerUser" policies to application roles; they're
  meant for human/break-glass access, not services.
